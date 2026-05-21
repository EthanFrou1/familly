using System.Security.Claims;
using FamilyApp.API.Data;
using FamilyApp.API.Models;
using FamilyApp.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FamilyApp.API.Controllers;

[ApiController]
[Route("api/push")]
[Authorize]
public class PushController(AppDbContext db, IConfiguration config, PushNotificationService push) : ControllerBase
{
    [HttpGet("vapid-public-key")]
    public IActionResult GetPublicKey() => Ok(new { key = config["Push:PublicKey"] });

    [HttpPost("subscribe")]
    public async Task<IActionResult> Subscribe([FromBody] SubscribeDto dto)
    {
        var userId = GetUserId();

        var existing = await db.PushSubscriptions
            .FirstOrDefaultAsync(s => s.Endpoint == dto.Endpoint);
        if (existing != null) db.PushSubscriptions.Remove(existing);

        db.PushSubscriptions.Add(new PushSubscription
        {
            UserId = userId,
            Endpoint = dto.Endpoint,
            P256dh = dto.P256dh,
            Auth = dto.Auth,
        });

        await db.SaveChangesAsync();
        return Ok();
    }

    [HttpDelete("unsubscribe")]
    public async Task<IActionResult> Unsubscribe([FromBody] UnsubscribeDto dto)
    {
        var userId = GetUserId();
        await db.PushSubscriptions
            .Where(s => s.UserId == userId && s.Endpoint == dto.Endpoint)
            .ExecuteDeleteAsync();
        return Ok();
    }

    [HttpGet("subscribers")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetSubscribers()
    {
        var subs = await db.PushSubscriptions
            .Include(s => s.User).ThenInclude(u => u.Member)
            .AsNoTracking()
            .ToListAsync();

        var grouped = subs
            .GroupBy(s => s.UserId)
            .Select(g => new
            {
                userId = g.Key,
                firstName = g.First().User.Member.FirstName,
                lastName = g.First().User.Member.LastName,
                deviceCount = g.Count()
            })
            .OrderBy(x => x.firstName)
            .ToList();

        return Ok(grouped);
    }

    [HttpPost("test")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SendTest([FromBody] SendTestDto dto)
    {
        if (dto.UserIds == null || dto.UserIds.Count == 0)
            return BadRequest(new { message = "Sélectionnez au moins un utilisateur." });

        var count = await db.PushSubscriptions.CountAsync(s => dto.UserIds.Contains(s.UserId));
        if (count == 0) return Ok(new { sent = 0 });

        await push.SendToUsersAsync(dto.UserIds, "🔔 Notification test", "Les notifications fonctionnent correctement !", "/");
        return Ok(new { sent = count });
    }

    private Guid GetUserId() => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
}

public record SubscribeDto(string Endpoint, string P256dh, string Auth);
public record UnsubscribeDto(string Endpoint);
public record SendTestDto(List<Guid> UserIds);
