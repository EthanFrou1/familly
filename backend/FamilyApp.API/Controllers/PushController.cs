using System.Security.Claims;
using FamilyApp.API.Data;
using FamilyApp.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FamilyApp.API.Controllers;

[ApiController]
[Route("api/push")]
[Authorize]
public class PushController(AppDbContext db, IConfiguration config) : ControllerBase
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

    private Guid GetUserId() => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
}

public record SubscribeDto(string Endpoint, string P256dh, string Auth);
public record UnsubscribeDto(string Endpoint);
