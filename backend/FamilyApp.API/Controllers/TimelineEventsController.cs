using System.Security.Claims;
using FamilyApp.API.Data;
using FamilyApp.API.DTOs;
using FamilyApp.API.Models;
using FamilyApp.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FamilyApp.API.Controllers;

[ApiController]
[Route("api/timeline-events")]
[Authorize]
public class TimelineEventsController(AppDbContext db, CloudinaryService cloudinary) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var events = await db.TimelineEvents
            .Include(te => te.Family)
            .Include(te => te.CreatedBy)
            .Include(te => te.LinkedMembers).ThenInclude(tem => tem.Member)
            .ToListAsync();

        var sorted = events
            .OrderByDescending(te => te.ExactDate ?? (te.Year.HasValue ? new DateTime(te.Year.Value, 1, 1) : DateTime.MinValue))
            .Select(ToDto)
            .ToList();

        return Ok(sorted);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var te = await db.TimelineEvents
            .Include(e => e.Family)
            .Include(e => e.CreatedBy)
            .Include(e => e.LinkedMembers).ThenInclude(tem => tem.Member)
            .FirstOrDefaultAsync(e => e.Id == id);

        return te is null ? NotFound() : Ok(ToDto(te));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTimelineEventRequest req)
    {
        if (!Enum.TryParse<TimelineEventType>(req.Type, true, out var type))
            return BadRequest(new { message = "Type d'événement invalide." });

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await db.Users.FindAsync(userId);
        if (user is null) return Unauthorized();

        var te = new TimelineEvent
        {
            Title = req.Title,
            Description = req.Description,
            Year = req.Year,
            ExactDate = req.ExactDate,
            Type = type,
            FamilyId = req.FamilyId,
            CreatedById = user.MemberId,
        };

        if (req.LinkedMemberIds?.Count > 0)
        {
            var memberIds = await db.Members
                .Where(m => req.LinkedMemberIds.Contains(m.Id))
                .Select(m => m.Id)
                .ToListAsync();

            te.LinkedMembers = memberIds
                .Select(mid => new TimelineEventMember { MemberId = mid })
                .ToList();
        }

        db.TimelineEvents.Add(te);
        await db.SaveChangesAsync();

        await db.Entry(te).Reference(e => e.CreatedBy).LoadAsync();
        await db.Entry(te).Reference(e => e.Family).LoadAsync();
        await db.Entry(te).Collection(e => e.LinkedMembers).Query()
            .Include(tem => tem.Member).LoadAsync();

        return CreatedAtAction(nameof(GetById), new { id = te.Id }, ToDto(te));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTimelineEventRequest req)
    {
        var te = await db.TimelineEvents
            .Include(e => e.LinkedMembers)
            .FirstOrDefaultAsync(e => e.Id == id);
        if (te is null) return NotFound();

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await db.Users.FindAsync(userId);
        var isAdmin = User.IsInRole("Admin");

        if (!isAdmin && te.CreatedById != user!.MemberId)
            return Forbid();

        if (req.Title is not null) te.Title = req.Title;
        if (req.Description is not null) te.Description = req.Description;
        if (req.Year.HasValue) te.Year = req.Year;
        if (req.ExactDate.HasValue) te.ExactDate = req.ExactDate;
        if (req.Type is not null && Enum.TryParse<TimelineEventType>(req.Type, true, out var type))
            te.Type = type;
        te.FamilyId = req.FamilyId;

        if (req.LinkedMemberIds is not null)
        {
            te.LinkedMembers.Clear();
            var memberIds = await db.Members
                .Where(m => req.LinkedMemberIds.Contains(m.Id))
                .Select(m => m.Id)
                .ToListAsync();
            te.LinkedMembers = memberIds
                .Select(mid => new TimelineEventMember { TimelineEventId = te.Id, MemberId = mid })
                .ToList();
        }

        await db.SaveChangesAsync();

        await db.Entry(te).Reference(e => e.CreatedBy).LoadAsync();
        await db.Entry(te).Reference(e => e.Family).LoadAsync();
        await db.Entry(te).Collection(e => e.LinkedMembers).Query()
            .Include(tem => tem.Member).LoadAsync();

        return Ok(ToDto(te));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var te = await db.TimelineEvents.FindAsync(id);
        if (te is null) return NotFound();

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await db.Users.FindAsync(userId);
        var isAdmin = User.IsInRole("Admin");

        if (!isAdmin && te.CreatedById != user!.MemberId)
            return Forbid();

        if (te.PhotoPublicId is not null)
            await cloudinary.DeleteAsync(te.PhotoPublicId);

        db.TimelineEvents.Remove(te);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:guid}/photo")]
    public async Task<IActionResult> UploadPhoto(Guid id, IFormFile file)
    {
        var te = await db.TimelineEvents.FindAsync(id);
        if (te is null) return NotFound();

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await db.Users.FindAsync(userId);
        var isAdmin = User.IsInRole("Admin");

        if (!isAdmin && te.CreatedById != user!.MemberId)
            return Forbid();

        if (te.PhotoPublicId is not null)
            await cloudinary.DeleteAsync(te.PhotoPublicId);

        var (url, publicId) = await cloudinary.UploadAsync(file);
        te.PhotoUrl = url;
        te.PhotoPublicId = publicId;
        await db.SaveChangesAsync();

        return Ok(new { photoUrl = url });
    }

    [HttpDelete("{id:guid}/photo")]
    public async Task<IActionResult> DeletePhoto(Guid id)
    {
        var te = await db.TimelineEvents.FindAsync(id);
        if (te is null) return NotFound();

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await db.Users.FindAsync(userId);
        var isAdmin = User.IsInRole("Admin");

        if (!isAdmin && te.CreatedById != user!.MemberId)
            return Forbid();

        if (te.PhotoPublicId is not null)
            await cloudinary.DeleteAsync(te.PhotoPublicId);

        te.PhotoUrl = null;
        te.PhotoPublicId = null;
        await db.SaveChangesAsync();
        return NoContent();
    }

    private static TimelineEventDto ToDto(TimelineEvent te) => new(
        te.Id,
        te.Title,
        te.Description,
        te.Year,
        te.ExactDate,
        te.Type.ToString(),
        GetTypeLabel(te.Type),
        GetTypeIcon(te.Type),
        te.PhotoUrl,
        te.FamilyId,
        te.Family?.Name,
        te.LinkedMembers.Select(lm => new TimelineMemberDto(
            lm.Member.Id,
            $"{lm.Member.FirstName} {lm.Member.LastName}",
            lm.Member.ProfilePictureUrl
        )).ToList(),
        te.CreatedById,
        $"{te.CreatedBy.FirstName} {te.CreatedBy.LastName}",
        te.CreatedAt
    );

    private static string GetTypeLabel(TimelineEventType type) => type switch
    {
        TimelineEventType.Birth => "Naissance",
        TimelineEventType.Marriage => "Mariage",
        TimelineEventType.Death => "Décès",
        TimelineEventType.Move => "Déménagement",
        TimelineEventType.FamilyCreation => "Création de famille",
        TimelineEventType.Memory => "Souvenir",
        TimelineEventType.Other => "Événement",
        _ => "Événement"
    };

    private static string GetTypeIcon(TimelineEventType type) => type switch
    {
        TimelineEventType.Birth => "👶",
        TimelineEventType.Marriage => "💍",
        TimelineEventType.Death => "🕯️",
        TimelineEventType.Move => "🏠",
        TimelineEventType.FamilyCreation => "👨‍👩‍👧‍👦",
        TimelineEventType.Memory => "📸",
        TimelineEventType.Other => "📌",
        _ => "📌"
    };
}
