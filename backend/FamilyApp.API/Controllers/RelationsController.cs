using FamilyApp.API.Data;
using FamilyApp.API.DTOs;
using FamilyApp.API.Models;
using FamilyApp.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FamilyApp.API.Controllers;

[ApiController]
[Route("api/relations")]
[Authorize]
public class RelationsController(AppDbContext db, ActivityLogService activityLog, RelationValidationService validator) : ControllerBase
{
    private static readonly Dictionary<RelationType, (string AsA, string AsB)> TypeLabels = new()
    {
        { RelationType.ParentChild, ("Parent de", "Enfant de") },
        { RelationType.Spouse,      ("Marié(e) à", "Marié(e) à") },
        { RelationType.Partner,     ("En couple avec", "En couple avec") },
        { RelationType.Sibling,     ("Frère / Sœur", "Frère / Sœur") },
        { RelationType.HalfSibling, ("Demi-frère / Demi-sœur", "Demi-frère / Demi-sœur") },
        { RelationType.Separated,   ("Séparé(e) / Divorcé(e)", "Séparé(e) / Divorcé(e)") },
    };

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var relations = await db.Relations
            .Include(r => r.MemberA)
            .Include(r => r.MemberB)
            .Select(r => new RelationDto(
                r.Id,
                r.MemberAId,
                $"{r.MemberA.FirstName} {r.MemberA.LastName}",
                r.MemberBId,
                $"{r.MemberB.FirstName} {r.MemberB.LastName}",
                r.Type.ToString()
            ))
            .ToListAsync();

        return Ok(relations);
    }

    [HttpGet("member/{memberId:guid}")]
    public async Task<IActionResult> GetByMember(Guid memberId)
    {
        var asA = (await db.Relations
            .Where(r => r.MemberAId == memberId)
            .Include(r => r.MemberB)
            .ToListAsync())
            .Select(r => new MemberRelationDto(
                r.Id, r.MemberBId,
                $"{r.MemberB.FirstName} {r.MemberB.LastName}",
                r.MemberB.ProfilePictureUrl,
                r.Type.ToString(),
                TypeLabels[r.Type].AsA
            ));

        var asB = (await db.Relations
            .Where(r => r.MemberBId == memberId)
            .Include(r => r.MemberA)
            .ToListAsync())
            .Select(r => new MemberRelationDto(
                r.Id, r.MemberAId,
                $"{r.MemberA.FirstName} {r.MemberA.LastName}",
                r.MemberA.ProfilePictureUrl,
                r.Type.ToString(),
                TypeLabels[r.Type].AsB
            ));

        return Ok(asA.Concat(asB));
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] CreateRelationRequest req)
    {
        if (!Enum.TryParse<RelationType>(req.Type, true, out var type))
            return BadRequest(new { message = "Type de relation invalide." });

        var exists = await db.Relations.AnyAsync(r =>
            (r.MemberAId == req.MemberAId && r.MemberBId == req.MemberBId && r.Type == type) ||
            (r.MemberAId == req.MemberBId && r.MemberBId == req.MemberAId && r.Type == type));

        if (exists) return Conflict(new { message = "Cette relation existe déjà." });

        var validationError = await validator.ValidateAsync(req.MemberAId, req.MemberBId, type);
        if (validationError is not null)
            return BadRequest(new { message = validationError });

        var memberA = await db.Members.FindAsync(req.MemberAId);
        var memberB = await db.Members.FindAsync(req.MemberBId);

        var relation = new Relation { MemberAId = req.MemberAId, MemberBId = req.MemberBId, Type = type };
        db.Relations.Add(relation);
        await db.SaveChangesAsync();

        await activityLog.LogAsync("relation_created", User,
            targetMemberId: req.MemberAId,
            targetMemberName: memberA is null ? null : $"{memberA.FirstName} {memberA.LastName}",
            targetMemberPictureUrl: memberA?.ProfilePictureUrl,
            relatedMemberId: req.MemberBId,
            relatedMemberName: memberB is null ? null : $"{memberB.FirstName} {memberB.LastName}",
            metadata: type.ToString());

        return Created($"/api/relations/{relation.Id}", null);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var relation = await db.Relations.FindAsync(id);
        if (relation is null) return NotFound();
        db.Relations.Remove(relation);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
