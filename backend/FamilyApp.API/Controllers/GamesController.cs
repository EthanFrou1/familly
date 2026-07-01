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

    private static object? TopEntry(Dictionary<(Guid MemberId, string Name), int> counts) =>
        counts.Count == 0 ? null : counts
            .OrderByDescending(kv => kv.Value)
            .Select(kv => new { memberId = kv.Key.MemberId, name = kv.Key.Name, count = kv.Value })
            .First();

    [HttpGet("stats/member/{memberId:guid}")]
    public async Task<IActionResult> GetMemberStats(Guid memberId, [FromQuery] string gameType)
    {
        var results = await db.GameResults
            .Where(r => r.GameType == gameType)
            .ToListAsync();

        int gamesPlayed = 0, wins = 0, losses = 0, pairsFound = 0, bestScore = 0;

        foreach (var r in results)
        {
            var players = JsonSerializer.Deserialize<List<GamePlayerScoreDto>>(r.PlayersJson) ?? [];
            var linked = players.Where(p => p.MemberId.HasValue && !p.IsGuest).ToList();
            var me = linked.FirstOrDefault(p => p.MemberId == memberId);
            if (me is null || linked.Count < 2) continue;

            gamesPlayed++;
            pairsFound += me.Score;
            bestScore = Math.Max(bestScore, me.Score);

            var maxScore = linked.Max(p => p.Score);
            var isTie = linked.Count(p => p.Score == maxScore) > 1;
            if (!isTie && me.Score == maxScore) wins++;
            else losses++;
        }

        return Ok(new { gamesPlayed, wins, losses, pairsFound, bestScore });
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
