using System.Security.Claims;
using System.Text.Json;
using FamilyApp.API.Data;
using FamilyApp.API.DTOs;
using FamilyApp.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FamilyApp.API.Controllers;

[ApiController]
[Route("api/games")]
[Authorize]
public class GamesController(AppDbContext db) : ControllerBase
{
    [HttpGet("results")]
    public async Task<IActionResult> GetResults([FromQuery] string gameType, [FromQuery] int limit = 10)
    {
        var results = await db.GameResults
            .Where(r => r.GameType == gameType)
            .OrderByDescending(r => r.CreatedAt)
            .Take(Math.Clamp(limit, 1, 50))
            .ToListAsync();

        return Ok(results.Select(ToDto));
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats([FromQuery] string gameType)
    {
        var results = await db.GameResults
            .Where(r => r.GameType == gameType)
            .ToListAsync();

        var wins = new Dictionary<(Guid MemberId, string Name), int>();
        var losses = new Dictionary<(Guid MemberId, string Name), int>();

        foreach (var r in results)
        {
            var players = JsonSerializer.Deserialize<List<GamePlayerScoreDto>>(r.PlayersJson) ?? [];
            var linked = players.Where(p => p.MemberId.HasValue && !p.IsGuest).ToList();
            if (linked.Count < 2) continue;

            var maxScore = linked.Max(p => p.Score);
            var isTie = linked.Count(p => p.Score == maxScore) > 1;

            foreach (var p in linked)
            {
                var key = (p.MemberId!.Value, p.Name);
                if (!isTie && p.Score == maxScore) wins[key] = wins.GetValueOrDefault(key) + 1;
                else losses[key] = losses.GetValueOrDefault(key) + 1;
            }
        }

        return Ok(new
        {
            topWinner = TopEntry(wins),
            topLoser = TopEntry(losses),
        });
    }

    // Boss toutes-catégories : cumule les victoires sur tous les mini-jeux (memory, famille en or,
    // sur le front, etc.) au lieu de filtrer par gameType comme GetStats.
    [HttpGet("stats/global")]
    public async Task<IActionResult> GetGlobalStats()
    {
        var results = await db.GameResults.ToListAsync();
        var wins = new Dictionary<(Guid MemberId, string Name), int>();

        foreach (var r in results)
        {
            var players = JsonSerializer.Deserialize<List<GamePlayerScoreDto>>(r.PlayersJson) ?? [];
            var linked = players.Where(p => p.MemberId.HasValue && !p.IsGuest).ToList();
            if (linked.Count < 2) continue;

            var maxScore = linked.Max(p => p.Score);
            var isTie = linked.Count(p => p.Score == maxScore) > 1;
            if (isTie) continue;

            foreach (var p in linked.Where(p => p.Score == maxScore))
            {
                var key = (p.MemberId!.Value, p.Name);
                wins[key] = wins.GetValueOrDefault(key) + 1;
            }
        }

        return Ok(new { topWinner = TopEntry(wins) });
    }

    private static object? TopEntry(Dictionary<(Guid MemberId, string Name), int> counts) =>
        counts.Count == 0 ? null : counts
            .OrderByDescending(kv => kv.Value)
            .Select(kv => new { memberId = kv.Key.MemberId, name = kv.Key.Name, count = kv.Value })
            .First();

    [HttpGet("leaderboard")]
    public async Task<IActionResult> GetLeaderboard([FromQuery] string gameType)
    {
        var results = await db.GameResults.Where(r => r.GameType == gameType).ToListAsync();
        var stats = ComputePlayerStats(results);

        var leaderboard = stats
            .Select(kv => new
            {
                memberId = kv.Key.MemberId,
                name = kv.Key.Name,
                gamesPlayed = kv.Value.Played,
                wins = kv.Value.Wins,
                losses = kv.Value.Losses,
                winRate = kv.Value.Played > 0 ? Math.Round(100.0 * kv.Value.Wins / kv.Value.Played, 1) : 0,
            })
            .OrderByDescending(e => e.winRate)
            .ThenByDescending(e => e.wins)
            .ToList();

        return Ok(leaderboard);
    }

    [HttpGet("leaderboard/global")]
    public async Task<IActionResult> GetGlobalLeaderboard()
    {
        var results = await db.GameResults.ToListAsync();
        var winRatesByMember = new Dictionary<(Guid MemberId, string Name), List<double>>();

        foreach (var group in results.GroupBy(r => r.GameType))
        {
            foreach (var (key, value) in ComputePlayerStats(group.ToList()))
            {
                if (value.Played == 0) continue;
                if (!winRatesByMember.TryGetValue(key, out var rates))
                    winRatesByMember[key] = rates = [];
                rates.Add(100.0 * value.Wins / value.Played);
            }
        }

        var leaderboard = winRatesByMember
            .Select(kv => new
            {
                memberId = kv.Key.MemberId,
                name = kv.Key.Name,
                averageWinRate = Math.Round(kv.Value.Average(), 1),
                gameTypesPlayed = kv.Value.Count,
            })
            .OrderByDescending(e => e.averageWinRate)
            .ToList();

        return Ok(leaderboard);
    }

    private static Dictionary<(Guid MemberId, string Name), (int Wins, int Losses, int Played)> ComputePlayerStats(List<GameResult> results)
    {
        var stats = new Dictionary<(Guid MemberId, string Name), (int Wins, int Losses, int Played)>();

        foreach (var r in results)
        {
            var players = JsonSerializer.Deserialize<List<GamePlayerScoreDto>>(r.PlayersJson) ?? [];
            var linked = players.Where(p => p.MemberId.HasValue && !p.IsGuest).ToList();
            if (linked.Count < 2) continue;

            var maxScore = linked.Max(p => p.Score);
            var isTie = linked.Count(p => p.Score == maxScore) > 1;

            foreach (var p in linked)
            {
                var key = (MemberId: p.MemberId!.Value, Name: p.Name);
                var current = stats.GetValueOrDefault(key, (Wins: 0, Losses: 0, Played: 0));
                var won = !isTie && p.Score == maxScore;
                stats[key] = (current.Wins + (won ? 1 : 0), current.Losses + (won ? 0 : 1), current.Played + 1);
            }
        }

        return stats;
    }

    [HttpGet("stats/member/{memberId:guid}")]
    public async Task<IActionResult> GetMemberStats(Guid memberId, [FromQuery] string gameType)
    {
        var results = await db.GameResults
            .Where(r => r.GameType == gameType)
            .ToListAsync();

        int gamesPlayed = 0, wins = 0, losses = 0, pairsFound = 0, bestScore = 0;
        int? bestDurationSeconds = null;

        foreach (var r in results)
        {
            var players = JsonSerializer.Deserialize<List<GamePlayerScoreDto>>(r.PlayersJson) ?? [];
            var linked = players.Where(p => p.MemberId.HasValue && !p.IsGuest).ToList();
            var me = linked.FirstOrDefault(p => p.MemberId == memberId);
            if (me is null || linked.Count < 2) continue;

            gamesPlayed++;
            pairsFound += me.Score;
            bestScore = Math.Max(bestScore, me.Score);
            if (r.DurationSeconds.HasValue)
                bestDurationSeconds = Math.Min(bestDurationSeconds ?? int.MaxValue, r.DurationSeconds.Value);

            var maxScore = linked.Max(p => p.Score);
            var isTie = linked.Count(p => p.Score == maxScore) > 1;
            if (!isTie && me.Score == maxScore) wins++;
            else losses++;
        }

        return Ok(new { gamesPlayed, wins, losses, pairsFound, bestScore, bestDurationSeconds });
    }

    [HttpPost("results")]
    public async Task<IActionResult> CreateResult(CreateGameResultDto dto)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var result = new GameResult
        {
            GameType = dto.GameType,
            PairsCount = dto.PairsCount,
            PlayerCount = dto.Players.Count,
            PlayersJson = JsonSerializer.Serialize(dto.Players),
            WinnerName = dto.WinnerName,
            DurationSeconds = dto.DurationSeconds,
            PlayedByUserId = userId,
        };

        db.GameResults.Add(result);
        await db.SaveChangesAsync();

        return Ok(ToDto(result));
    }

    private static GameResultDto ToDto(GameResult r) => new(
        r.Id, r.GameType, r.PairsCount, r.PlayerCount,
        JsonSerializer.Deserialize<List<GamePlayerScoreDto>>(r.PlayersJson) ?? [],
        r.WinnerName, r.DurationSeconds, r.CreatedAt);
}
