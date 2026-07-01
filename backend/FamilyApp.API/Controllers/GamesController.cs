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
