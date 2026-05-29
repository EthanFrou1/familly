using FamilyApp.API.Data;
using FamilyApp.API.DTOs;
using FamilyApp.API.Models;
using FamilyApp.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FamilyApp.API.Controllers;

[ApiController]
[Route("api/families")]
[Authorize]
public class FamiliesController(AppDbContext db, CloudinaryService cloudinary) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var families = await db.Families
            .Include(f => f.Members)
            .OrderBy(f => f.Name)
            .ToListAsync();

        var result = families.Select(f =>
        {
            var today = DateTime.UtcNow;
            var ages = f.Members
                .Where(m => m.BirthDate.HasValue && m.IsAlive)
                .Select(m => (today - m.BirthDate!.Value).TotalDays / 365.25)
                .ToList();
            double? avgAge = ages.Count > 0 ? Math.Round(ages.Average(), 1) : null;
            return new FamilyDto(f.Id, f.Name, f.Members.Count, avgAge, f.GroupPhotoUrl);
        });

        return Ok(result);
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
        return CreatedAtAction(nameof(GetAll), new FamilyDto(family.Id, family.Name, 0, null, null));
    }

    [HttpPost("{id:guid}/group-photo")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UploadGroupPhoto(Guid id, IFormFile file)
    {
        var family = await db.Families.FindAsync(id);
        if (family is null) return NotFound();

        if (family.GroupPhotoPublicId is not null)
            await cloudinary.DeleteAsync(family.GroupPhotoPublicId);

        var (url, publicId) = await cloudinary.UploadAsync(file);
        family.GroupPhotoUrl = url;
        family.GroupPhotoPublicId = publicId;
        await db.SaveChangesAsync();

        return Ok(new { groupPhotoUrl = url });
    }

    [HttpDelete("{id:guid}/group-photo")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteGroupPhoto(Guid id)
    {
        var family = await db.Families.FindAsync(id);
        if (family is null) return NotFound();

        if (family.GroupPhotoPublicId is not null)
            await cloudinary.DeleteAsync(family.GroupPhotoPublicId);

        family.GroupPhotoUrl = null;
        family.GroupPhotoPublicId = null;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var family = await db.Families.FindAsync(id);
        if (family is null) return NotFound();

        if (family.GroupPhotoPublicId is not null)
            await cloudinary.DeleteAsync(family.GroupPhotoPublicId);

        db.Families.Remove(family);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
