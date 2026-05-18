using FamilyApp.API.Data;
using FamilyApp.API.DTOs;
using FamilyApp.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FamilyApp.API.Controllers;

[ApiController]
[Route("api/families")]
[Authorize]
public class FamiliesController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var families = await db.Families
            .OrderBy(f => f.Name)
            .Select(f => new FamilyDto(f.Id, f.Name, f.Members.Count(m => m.FamilyId == f.Id)))
            .ToListAsync();
        return Ok(families);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] CreateFamilyRequest req)
    {
        var exists = await db.Families.AnyAsync(f => f.Name == req.Name);
        if (exists) return Conflict(new { message = "Cette famille existe déjà." });

        var family = new Family { Name = req.Name };
        db.Families.Add(family);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), new FamilyDto(family.Id, family.Name, 0));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var family = await db.Families.FindAsync(id);
        if (family is null) return NotFound();
        db.Families.Remove(family);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
