using System.Security.Claims;
using FamilyApp.API.Data;
using FamilyApp.API.DTOs;
using FamilyApp.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FamilyApp.API.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController(AppDbContext db, DuplicateDetectionService duplicateService) : ControllerBase
{
    [HttpGet("members-overview")]
    public async Task<IActionResult> GetMembersOverview()
    {
        var members = await db.Members
            .OrderBy(m => m.LastName).ThenBy(m => m.FirstName)
            .Select(m => new AdminMemberOverviewDto(
                m.Id,
                m.FirstName,
                m.LastName,
                m.ProfilePictureUrl,
                m.Email,
                m.Phone,
                m.WhatsappNumber,
                m.IsAlive,
                m.FamilyId,
                m.Family != null ? m.Family.Name : null,
                m.DelegateManagerId,
                m.DelegateManager != null && m.DelegateManager.Member != null
                    ? m.DelegateManager.Member.FirstName + " " + m.DelegateManager.Member.LastName
                    : null,
                m.User != null
                    ? (m.User.InvitationUsedAt != null ? "active"
                        : m.User.InvitationToken != null ? "pending"
                        : "none")
                    : "none",
                m.User != null && m.User.InvitationToken != null && m.User.InvitationUsedAt == null
                    ? m.User.InvitationToken
                    : null,
                m.User != null ? m.User.Id : (Guid?)null,
                m.CreatedAt
            ))
            .ToListAsync();

        return Ok(members);
    }

    [HttpGet("duplicates")]
    public async Task<IActionResult> GetDuplicates()
    {
        var results = await duplicateService.ScanAndGetOpenAsync();
        return Ok(results);
    }

    [HttpPost("duplicates/{id:guid}/ignore")]
    public async Task<IActionResult> IgnoreDuplicate(Guid id)
    {
        var candidate = await db.DuplicateCandidates.FindAsync(id);
        if (candidate is null) return NotFound();

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        candidate.Status = "Ignored";
        candidate.ReviewedByUserId = userId;
        candidate.ReviewedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("duplicates/{id:guid}/resolve")]
    public async Task<IActionResult> ResolveDuplicate(Guid id)
    {
        var candidate = await db.DuplicateCandidates.FindAsync(id);
        if (candidate is null) return NotFound();

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        candidate.Status = "Resolved";
        candidate.ReviewedByUserId = userId;
        candidate.ReviewedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }
}
