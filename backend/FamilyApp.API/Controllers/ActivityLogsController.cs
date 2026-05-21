using FamilyApp.API.Data;
using FamilyApp.API.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FamilyApp.API.Controllers;

[ApiController]
[Route("api/activity-logs")]
[Authorize]
public class ActivityLogsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int limit = 30)
    {
        var logs = await db.ActivityLogs
            .Where(l => l.Type != "member_updated")
            .Where(l => l.TargetMemberId == null  || db.Members.Any(m => m.Id == l.TargetMemberId))
            .Where(l => l.RelatedMemberId == null || db.Members.Any(m => m.Id == l.RelatedMemberId))
            .OrderByDescending(l => l.CreatedAt)
            .Take(Math.Clamp(limit, 1, 100))
            .Select(l => new ActivityLogDto(
                l.Id, l.Type, l.ActorName,
                l.TargetMemberId, l.TargetMemberName, l.TargetMemberPictureUrl,
                l.RelatedMemberId, l.RelatedMemberName,
                l.Metadata, l.CreatedAt))
            .ToListAsync();

        return Ok(logs);
    }

    [HttpGet("member/{memberId:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetByMember(Guid memberId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var query = db.ActivityLogs
            .Where(l => l.TargetMemberId == memberId || l.RelatedMemberId == memberId)
            .OrderByDescending(l => l.CreatedAt);

        var total = await query.CountAsync();
        var logs = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new ActivityLogDto(
                l.Id, l.Type, l.ActorName,
                l.TargetMemberId, l.TargetMemberName, l.TargetMemberPictureUrl,
                l.RelatedMemberId, l.RelatedMemberName,
                l.Metadata, l.CreatedAt))
            .ToListAsync();

        return Ok(new
        {
            logs,
            total,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling((double)total / pageSize)
        });
    }
}
