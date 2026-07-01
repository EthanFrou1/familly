using System.Security.Claims;
using System.Text.Json;
using FamilyApp.API.Data;
using FamilyApp.API.DTOs;
using FamilyApp.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace FamilyApp.API.Realtime;

public record PlayerDto(Guid MemberId, string Name, string? ProfilePictureUrl, int ColorIndex, bool IsHost, int Score);

[Authorize]
public class GameHub(AppDbContext db, GameSessionStore store) : Hub
{
    private const int MinPlayers = 2;
    private const int MaxPlayers = 4;

    public async Task<object> CreateRoom(string gameType)
    {
        var (memberId, name, photo) = await ResolveCallerAsync();
        var session = store.Create(gameType);

        session.Players.Add(new SessionPlayer
        {
            ConnectionId = Context.ConnectionId,
            MemberId = memberId,
            Name = name,
            ProfilePictureUrl = photo,
            ColorIndex = 0,
            IsHost = true,
        });

        await Groups.AddToGroupAsync(Context.ConnectionId, session.Code);
        return new { success = true, code = session.Code, players = ToPlayerDtos(session) };
    }

    public async Task<object> JoinRoom(string code)
    {
        var session = store.Get(code);
        if (session is null) return new { success = false, error = "Code introuvable." };
        if (session.Started) return new { success = false, error = "La partie a déjà commencé." };

        var (memberId, name, photo) = await ResolveCallerAsync();

        List<PlayerDto> playerDtos;
        lock (session)
        {
            if (session.Players.Count >= MaxPlayers)
                return new { success = false, error = "La partie est complète." };
            if (session.Players.Any(p => p.MemberId == memberId))
                return new { success = false, error = "Vous êtes déjà dans cette partie." };

            session.Players.Add(new SessionPlayer
            {
                ConnectionId = Context.ConnectionId,
                MemberId = memberId,
                Name = name,
                ProfilePictureUrl = photo,
                ColorIndex = session.Players.Count,
                IsHost = false,
            });
            playerDtos = ToPlayerDtos(session);
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, session.Code);
        await Clients.Group(session.Code).SendAsync("PlayerJoined", playerDtos);
        return new { success = true, code = session.Code, players = playerDtos };
    }

    public async Task LeaveRoom()
    {
        var session = store.FindByConnectionId(Context.ConnectionId);
        if (session is not null) await HandleLeaveAsync(session, Context.ConnectionId);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var session = store.FindByConnectionId(Context.ConnectionId);
        if (session is not null) await HandleLeaveAsync(session, Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }

    private async Task HandleLeaveAsync(GameSession session, string connectionId)
    {
        bool wasStarted;
        List<PlayerDto>? remainingPlayers = null;
        bool sessionEmpty = false;

        lock (session)
        {
            var player = session.Players.FirstOrDefault(p => p.ConnectionId == connectionId);
            if (player is null) { wasStarted = false; }
            else
            {
                wasStarted = session.Started;
                if (!wasStarted)
                {
                    session.Players.Remove(player);
                    if (session.Players.Count == 0) sessionEmpty = true;
                    else
                    {
                        if (player.IsHost) session.Players[0].IsHost = true;
                        remainingPlayers = ToPlayerDtos(session);
                    }
                }
            }
        }

        if (wasStarted)
        {
            await Clients.Group(session.Code).SendAsync("GameCancelled");
            store.Remove(session.Code);
        }
        else if (sessionEmpty)
        {
            store.Remove(session.Code);
        }
        else if (remainingPlayers is not null)
        {
            await Clients.Group(session.Code).SendAsync("PlayerLeft", remainingPlayers);
        }
    }

    public async Task StartGame(int pairsCount)
    {
        var session = store.FindByConnectionId(Context.ConnectionId);
        if (session is null || session.Started) return;

        var caller = session.Players.FirstOrDefault(p => p.ConnectionId == Context.ConnectionId);
        if (caller is null || !caller.IsHost || session.Players.Count < MinPlayers) return;

        var membersWithPhoto = await db.Members
            .Where(m => m.ProfilePictureUrl != null)
            .Select(m => new { m.Id, m.ProfilePictureUrl })
            .ToListAsync();

        if (membersWithPhoto.Count < pairsCount) return;

        var pool = membersWithPhoto.OrderBy(_ => Random.Shared.Next()).Take(pairsCount).ToList();
        var deck = pool
            .SelectMany(m => new[]
            {
                new DeckCard { CardId = $"{m.Id}-a", MemberId = m.Id, PhotoUrl = m.ProfilePictureUrl! },
                new DeckCard { CardId = $"{m.Id}-b", MemberId = m.Id, PhotoUrl = m.ProfilePictureUrl! },
            })
            .OrderBy(_ => Random.Shared.Next())
            .ToList();

        object payload;
        lock (session)
        {
            session.Deck = deck;
            session.PairsCount = pairsCount;
            session.Started = true;
            session.StartedAt = DateTime.UtcNow;
            session.RemainingColorIndexesForWheel = session.Players.Select(p => p.ColorIndex).ToList();
            session.TurnOrderColorIndexes = [];
            session.MatchedBy.Clear();
            session.FlippedCardIds.Clear();
            foreach (var p in session.Players) p.Score = 0;

            payload = new
            {
                deck = deck.Select(c => new { cardId = c.CardId, memberId = c.MemberId, photoUrl = c.PhotoUrl }),
                players = ToPlayerDtos(session),
                pairsCount,
            };
        }

        await Clients.Group(session.Code).SendAsync("GameStarting", payload);
    }

    public async Task SpinWheel()
    {
        var session = store.FindByConnectionId(Context.ConnectionId);
        if (session is null || !session.Started) return;

        var caller = session.Players.FirstOrDefault(p => p.ConnectionId == Context.ConnectionId);
        if (caller is null || !caller.IsHost) return;

        int winnerColorIndex;
        bool orderReady;
        List<int>? finalOrder = null;

        lock (session)
        {
            if (session.RemainingColorIndexesForWheel.Count == 0) return;

            var winnerIndex = Random.Shared.Next(session.RemainingColorIndexesForWheel.Count);
            winnerColorIndex = session.RemainingColorIndexesForWheel[winnerIndex];
            session.RemainingColorIndexesForWheel.RemoveAt(winnerIndex);
            session.TurnOrderColorIndexes.Add(winnerColorIndex);

            if (session.RemainingColorIndexesForWheel.Count == 1)
            {
                session.TurnOrderColorIndexes.Add(session.RemainingColorIndexesForWheel[0]);
                session.RemainingColorIndexesForWheel.Clear();
            }

            orderReady = session.RemainingColorIndexesForWheel.Count == 0;
            if (orderReady)
            {
                session.CurrentPlayerIndex = 0;
                finalOrder = [.. session.TurnOrderColorIndexes];
            }
        }

        await Clients.Group(session.Code).SendAsync("WheelSpun", new { winnerColorIndex });
        if (orderReady)
            await Clients.Group(session.Code).SendAsync("TurnOrderReady", new { orderedColorIndexes = finalOrder });
    }

    public async Task FlipCard(string cardId)
    {
        var session = store.FindByConnectionId(Context.ConnectionId);
        if (session is null || !session.Started) return;

        var caller = session.Players.FirstOrDefault(p => p.ConnectionId == Context.ConnectionId);
        if (caller is null) return;

        object? flippedPayload = null;
        object? resolvedPayload = null;
        object? finishedPayload = null;
        GameResult? resultToSave = null;

        lock (session)
        {
            if (session.TurnOrderColorIndexes.Count == 0) return;
            var currentColorIndex = session.TurnOrderColorIndexes[session.CurrentPlayerIndex];
            if (caller.ColorIndex != currentColorIndex) return;
            if (session.FlippedCardIds.Contains(cardId) || session.FlippedCardIds.Count >= 2) return;

            var card = session.Deck.FirstOrDefault(c => c.CardId == cardId);
            if (card is null || session.MatchedBy.ContainsKey(card.MemberId)) return;

            session.FlippedCardIds.Add(cardId);
            flippedPayload = new { cardId, byColorIndex = caller.ColorIndex };

            if (session.FlippedCardIds.Count == 2)
            {
                var firstCard = session.Deck.First(c => c.CardId == session.FlippedCardIds[0]);
                var secondCard = session.Deck.First(c => c.CardId == session.FlippedCardIds[1]);
                var matched = firstCard.MemberId == secondCard.MemberId;

                if (matched)
                {
                    session.MatchedBy[firstCard.MemberId] = currentColorIndex;
                    session.Players.First(p => p.ColorIndex == currentColorIndex).Score++;
                }

                session.FlippedCardIds.Clear();
                var nextPlayerIndex = matched
                    ? session.CurrentPlayerIndex
                    : (session.CurrentPlayerIndex + 1) % session.TurnOrderColorIndexes.Count;
                session.CurrentPlayerIndex = nextPlayerIndex;

                resolvedPayload = new
                {
                    matched,
                    cardIds = new[] { firstCard.CardId, secondCard.CardId },
                    scorerColorIndex = matched ? currentColorIndex : (int?)null,
                    nextPlayerColorIndex = session.TurnOrderColorIndexes[nextPlayerIndex],
                };

                if (session.MatchedBy.Count == session.PairsCount)
                {
                    var durationSeconds = session.StartedAt is null ? 0 : (int)(DateTime.UtcNow - session.StartedAt.Value).TotalSeconds;
                    var topScore = session.Players.Max(p => p.Score);
                    var winners = session.Players.Where(p => p.Score == topScore).ToList();
                    var winnerName = winners.Count == 1 ? winners[0].Name : null;

                    var playersJson = JsonSerializer.Serialize(session.Players
                        .Select(p => new GamePlayerScoreDto(p.Name, p.Score, p.MemberId, false)));

                    resultToSave = new GameResult
                    {
                        GameType = session.GameType,
                        PairsCount = session.PairsCount,
                        PlayerCount = session.Players.Count,
                        PlayersJson = playersJson,
                        WinnerName = winnerName,
                        DurationSeconds = durationSeconds,
                        PlayedByUserId = Guid.Parse(Context.User!.FindFirstValue(ClaimTypes.NameIdentifier)!),
                    };

                    finishedPayload = new
                    {
                        players = session.Players.Select(p => new { memberId = p.MemberId, name = p.Name, score = p.Score, colorIndex = p.ColorIndex }),
                        durationSeconds,
                    };
                }
            }
        }

        if (flippedPayload is not null) await Clients.Group(session.Code).SendAsync("CardFlipped", flippedPayload);
        if (resolvedPayload is not null) await Clients.Group(session.Code).SendAsync("TurnResolved", resolvedPayload);

        if (resultToSave is not null)
        {
            db.GameResults.Add(resultToSave);
            await db.SaveChangesAsync();
        }
        if (finishedPayload is not null) await Clients.Group(session.Code).SendAsync("GameFinished", finishedPayload);
    }

    public async Task PlayAgain()
    {
        var session = store.FindByConnectionId(Context.ConnectionId);
        if (session is null) return;

        var caller = session.Players.FirstOrDefault(p => p.ConnectionId == Context.ConnectionId);
        if (caller is null || !caller.IsHost) return;

        lock (session)
        {
            session.Started = false;
            session.Deck = [];
            session.FlippedCardIds.Clear();
            session.MatchedBy.Clear();
            session.TurnOrderColorIndexes = [];
            session.RemainingColorIndexesForWheel = [];
            foreach (var p in session.Players) p.Score = 0;
        }

        await Clients.Group(session.Code).SendAsync("BackToDifficulty");
    }

    private static List<PlayerDto> ToPlayerDtos(GameSession session) =>
        [.. session.Players.Select(p => new PlayerDto(p.MemberId, p.Name, p.ProfilePictureUrl, p.ColorIndex, p.IsHost, p.Score))];

    private async Task<(Guid MemberId, string Name, string? Photo)> ResolveCallerAsync()
    {
        var userId = Guid.Parse(Context.User!.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await db.Users.Include(u => u.Member).FirstAsync(u => u.Id == userId);
        return (user.MemberId, $"{user.Member.FirstName} {user.Member.LastName}", user.Member.ProfilePictureUrl);
    }
}
