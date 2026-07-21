using System.Security.Claims;
using FamilyApp.API.DTOs;
using FamilyApp.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FamilyApp.API.Controllers;

[ApiController]
[Route("api/daily-mystery")]
[Authorize]
public class DailyMysteryController(DailyMysteryService service) : ControllerBase
{
    [HttpGet("today")]
    public async Task<IActionResult> GetToday()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var challenge = await service.GetOrCreateTodayChallengeAsync();
        var attempt = await service.GetOrCreateAttemptAsync(challenge, userId);
        return Ok(await service.BuildStateAsync(challenge, attempt));
    }

    [HttpGet("today/leaderboard")]
    public async Task<IActionResult> GetTodayLeaderboard()
    {
        return Ok(await service.GetTodayParticipantsAsync());
    }

    [HttpGet("leaderboard")]
    public async Task<IActionResult> GetLeaderboard()
    {
        return Ok(await service.GetAllTimeLeaderboardAsync());
    }

    [HttpGet("leaderboard/points")]
    public async Task<IActionResult> GetPointsLeaderboard()
    {
        return Ok(await service.GetPointsLeaderboardAsync());
    }

    [HttpPost("guess")]
    public async Task<IActionResult> Guess(DailyGuessRequestDto dto)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        try
        {
            return Ok(await service.SubmitGuessAsync(userId, dto.MemberId));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
