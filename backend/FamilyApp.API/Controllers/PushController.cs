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
            IsStandalone = dto.IsStandalone,
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

    // Membres joignables pour un défi : notifications activées + site installé en PWA (mode standalone).
    [HttpGet("challengeable-members")]
    public async Task<IActionResult> GetChallengeableMembers()
    {
        var userId = GetUserId();
        var standaloneUserIds = await db.PushSubscriptions
            .Where(s => s.IsStandalone)
            .Select(s => s.UserId)
            .Distinct()
            .ToListAsync();

        var members = await db.Users
            .Where(u => u.Id != userId && standaloneUserIds.Contains(u.Id))
            .Include(u => u.Member)
            .Select(u => new
            {
                userId = u.Id,
                memberId = u.MemberId,
                firstName = u.Member.FirstName,
                lastName = u.Member.LastName,
                profilePictureUrl = u.Member.ProfilePictureUrl,
            })
            .OrderBy(m => m.firstName)
            .ToListAsync();

        return Ok(members);
    }

    // Envoie un lien de partie en cours à un ou plusieurs membres, uniquement ceux joignables (cf. challengeable-members).
    [HttpPost("challenge")]
    public async Task<IActionResult> SendChallenge([FromBody] ChallengeDto dto)
    {
        if (dto.TargetUserIds == null || dto.TargetUserIds.Count == 0)
            return BadRequest(new { message = "Choisis au moins un membre à défier." });

        var userId = GetUserId();
        var host = await db.Users.Include(u => u.Member).FirstOrDefaultAsync(u => u.Id == userId);
        if (host == null) return Unauthorized();

        var url = $"/games/{dto.GameType}/remote?code={dto.RoomCode}";
        await push.SendToUsersAsync(
            dto.TargetUserIds,
            $"🎮 {host.Member.FirstName} te défie !",
            "Rejoins la partie maintenant",
            url,
            standaloneOnly: true);

        return Ok();
    }

    private Guid GetUserId() => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
}

public record SubscribeDto(string Endpoint, string P256dh, string Auth, bool IsStandalone = false);
public record UnsubscribeDto(string Endpoint);
public record SendTestDto(List<Guid> UserIds);
public record ChallengeDto(List<Guid> TargetUserIds, string GameType, string RoomCode);
