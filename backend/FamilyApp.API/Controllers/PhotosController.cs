using System.Security.Claims;
using FamilyApp.API.Data;
using FamilyApp.API.Models;
using FamilyApp.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FamilyApp.API.Controllers;

[ApiController]
[Route("api/photos")]
[Authorize]
public class PhotosController(AppDbContext db, CloudinaryService cloudinary) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? category)
    {
        var query = db.Photos.AsQueryable();
        if (Enum.TryParse<PhotoCategory>(category, true, out var cat))
            query = query.Where(p => p.Category == cat);

        var photos = await query
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new { p.Id, p.CloudinaryUrl, p.Category, p.ExpiresAt, p.CreatedAt, p.UploaderId })
            .ToListAsync();

        return Ok(photos);
    }

    [HttpGet("member/{memberId:guid}")]
    public async Task<IActionResult> GetByMember(Guid memberId)
    {
        var photos = await db.Photos
            .Where(p => p.UploaderId == memberId)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new { p.Id, p.CloudinaryUrl, p.Category, p.ExpiresAt, p.CreatedAt })
            .ToListAsync();

        return Ok(photos);
    }

    [HttpPost]
    public async Task<IActionResult> Upload(IFormFile file, [FromForm] string category,
        [FromForm] Guid? eventId, [FromForm] DateTime? expiresAt)
    {
        if (!Enum.TryParse<PhotoCategory>(category, true, out var cat))
            return BadRequest(new { message = "Catégorie invalide." });

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await db.Users.FindAsync(userId);
        if (user is null) return Unauthorized();

        var (url, publicId) = await cloudinary.UploadAsync(file, $"family/{cat.ToString().ToLower()}");

        var photo = new Photo
        {
            UploaderId = user.MemberId,
            CloudinaryUrl = url,
            CloudinaryPublicId = publicId,
            Category = cat,
            ExpiresAt = expiresAt,
            EventId = eventId
        };

        db.Photos.Add(photo);
        await db.SaveChangesAsync();

        return Created($"/api/photos/{photo.Id}", new { photo.Id, photo.CloudinaryUrl, photo.Category, photo.ExpiresAt, photo.CreatedAt });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var photo = await db.Photos.FindAsync(id);
        if (photo is null) return NotFound();

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var isAdmin = User.IsInRole("Admin");
        var user = await db.Users.FindAsync(userId);

        if (!isAdmin && photo.UploaderId != user?.MemberId) return Forbid();

        await cloudinary.DeleteAsync(photo.CloudinaryPublicId);
        db.Photos.Remove(photo);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
