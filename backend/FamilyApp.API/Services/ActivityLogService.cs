using System.Security.Claims;
using FamilyApp.API.Data;
using FamilyApp.API.Models;
using Microsoft.EntityFrameworkCore;

namespace FamilyApp.API.Services;

public class ActivityLogService(AppDbContext db)
{
    public async Task LogAsync(
        string type,
        ClaimsPrincipal? actor = null,
        Guid? targetMemberId = null,
        string? targetMemberName = null,
        string? targetMemberPictureUrl = null,
        Guid? relatedMemberId = null,
        string? relatedMemberName = null,
        string? metadata = null)
    {
        string? actorName = null;
        if (actor is not null)
        {
            var userIdStr = actor.FindFirstValue(ClaimTypes.NameIdentifier);
            if (Guid.TryParse(userIdStr, out var userId))
            {
                var actorMember = await db.Users
                    .Where(u => u.Id == userId)
                    .Select(u => new { u.Member.FirstName, u.Member.LastName })
                    .FirstOrDefaultAsync();
                if (actorMember is not null)
                    actorName = $"{actorMember.FirstName} {actorMember.LastName}";
            }
        }

        db.ActivityLogs.Add(new ActivityLog
        {
            Type = type,
            ActorName = actorName,
            TargetMemberId = targetMemberId,
            TargetMemberName = targetMemberName,
            TargetMemberPictureUrl = targetMemberPictureUrl,
            RelatedMemberId = relatedMemberId,
            RelatedMemberName = relatedMemberName,
            Metadata = metadata,
        });
        await db.SaveChangesAsync();
    }
}
