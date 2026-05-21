using System.Security.Claims;
using FamilyApp.API.Data;
using FamilyApp.API.DTOs;
using FamilyApp.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FamilyApp.API.Controllers;

[ApiController]
[Route("api/external-media")]
[Authorize]
public class ExternalMediaController(AppDbContext db) : ControllerBase
{
    private static readonly string[] AllowedHosts = ["photos.google.com", "photos.app.goo.gl"];

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var items = await db.ExternalMedias
            .OrderByDescending(em => em.CreatedAt)
            .Select(em => new
            {
                em.Id,
                em.Title,
                em.ExternalUrl,
                em.Platform,
                em.EventId,
                em.LinkedMemberId,
                em.UploaderId,
                em.CreatedAt,
                UploaderName = em.Uploader.FirstName + " " + em.Uploader.LastName
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateExternalMediaDto dto)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await db.Users.FindAsync(userId);
        if (user is null) return Unauthorized();

        if (!Uri.TryCreate(dto.ExternalUrl, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp))
            return BadRequest(new { message = "Le lien fourni n'est pas une URL valide." });

        if (!AllowedHosts.Any(h => uri.Host.Equals(h, StringComparison.OrdinalIgnoreCase)))
            return BadRequest(new { message = "Le lien doit provenir de Google Photos (photos.google.com ou photos.app.goo.gl)." });

        var media = new ExternalMedia
        {
            UploaderId = user.MemberId,
            Title = string.IsNullOrWhiteSpace(dto.Title) ? null : dto.Title.Trim(),
            ExternalUrl = dto.ExternalUrl.Trim(),
            Platform = ExternalPlatform.GooglePhotos,
            EventId = dto.EventId,
            LinkedMemberId = dto.LinkedMemberId
        };

        db.ExternalMedias.Add(media);
        await db.SaveChangesAsync();

        return Created($"/api/external-media/{media.Id}", new
        {
            media.Id,
            media.Title,
            media.ExternalUrl,
            media.Platform,
            media.EventId,
            media.LinkedMemberId,
            media.UploaderId,
            media.CreatedAt
        });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var media = await db.ExternalMedias.FindAsync(id);
        if (media is null) return NotFound();

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var isAdmin = User.IsInRole("Admin");
        var user = await db.Users.FindAsync(userId);

        if (!isAdmin && media.UploaderId != user?.MemberId) return Forbid();

        db.ExternalMedias.Remove(media);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
