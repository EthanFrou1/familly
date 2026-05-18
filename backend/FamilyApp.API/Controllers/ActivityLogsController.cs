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
}
