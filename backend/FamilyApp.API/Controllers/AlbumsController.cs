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
[Route("api/albums")]
[Authorize]
public class AlbumsController(AppDbContext db, CloudinaryService cloudinary) : ControllerBase
{
    private const int MaxAlbumsPerMember = 10;

    private async Task<User?> GetCurrentUserAsync()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        return await db.Users.FindAsync(userId);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var albums = await db.Albums
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new
            {
                a.Id,
                a.Name,
                a.CreatedAt,
                a.ExpiresAt,
                a.AllowMemberUploads,
                a.EventId,
                EventTitle = a.Event != null ? a.Event.Title : null,
                PhotoCount = a.Photos.Count,
                CoverUrl = a.Photos.OrderByDescending(p => p.CreatedAt).Select(p => p.CloudinaryUrl).FirstOrDefault(),
                CreatorName = a.Creator.FirstName + " " + a.Creator.LastName,
            })
            .ToListAsync();

        return Ok(albums);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var album = await db.Albums
            .Where(a => a.Id == id)
            .Select(a => new
            {
                a.Id,
                a.Name,
                a.CreatedAt,
                a.ExpiresAt,
                a.AllowMemberUploads,
                a.CreatorId,
                a.EventId,
                EventTitle = a.Event != null ? a.Event.Title : null,
                Photos = a.Photos.OrderByDescending(p => p.CreatedAt)
                    .Select(p => new {
                        p.Id, p.CloudinaryUrl, p.CreatedAt, p.UploaderId,
                        UploaderName = p.Uploader.FirstName + " " + p.Uploader.LastName
                    })
            })
            .FirstOrDefaultAsync();

        if (album is null) return NotFound();
        return Ok(album);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateAlbumDto dto)
    {
        var user = await GetCurrentUserAsync();
        if (user is null) return Unauthorized();

        var isAdmin = User.IsInRole("Admin");

        // Limit 10 albums per non-admin member
        if (!isAdmin)
        {
            var count = await db.Albums.CountAsync(a => a.CreatorId == user.MemberId);
            if (count >= MaxAlbumsPerMember)
                return BadRequest(new { message = $"Vous avez atteint la limite de {MaxAlbumsPerMember} albums." });
        }

        // Unique name
        var nameExists = await db.Albums.AnyAsync(a => a.Name.ToLower() == dto.Name.Trim().ToLower());
        if (nameExists)
            return BadRequest(new { message = "Un album avec ce nom existe déjà." });

        // Albums always expire after 6 months for everyone
        var expiresAt = DateTime.UtcNow.AddMonths(6);

        var album = new Album
        {
            Name = dto.Name.Trim(),
            CreatorId = user.MemberId,
            EventId = dto.EventId,
            AllowMemberUploads = dto.AllowMemberUploads,
            ExpiresAt = expiresAt,
        };
        db.Albums.Add(album);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = album.Id }, new
        {
            album.Id, album.Name, album.CreatedAt, album.ExpiresAt, album.AllowMemberUploads,
            PhotoCount = 0, CoverUrl = (string?)null
        });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var user = await GetCurrentUserAsync();
        if (user is null) return Unauthorized();

        var album = await db.Albums.Include(a => a.Photos).FirstOrDefaultAsync(a => a.Id == id);
        if (album is null) return NotFound();
        if (album.CreatorId != user.MemberId && !User.IsInRole("Admin")) return Forbid();

        foreach (var photo in album.Photos)
        {
            await cloudinary.DeleteAsync(photo.CloudinaryPublicId);
            db.Photos.Remove(photo);
        }

        db.Albums.Remove(album);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:guid}/photos")]
    public async Task<IActionResult> AddPhoto(Guid id, IFormFile file)
    {
        var user = await GetCurrentUserAsync();
        if (user is null) return Unauthorized();

        var album = await db.Albums.FindAsync(id);
        if (album is null) return NotFound();

        var isAdmin = User.IsInRole("Admin");
        var isCreator = album.CreatorId == user.MemberId;

        if (!album.AllowMemberUploads && !isCreator && !isAdmin)
            return BadRequest(new { message = "Seul le créateur ou un admin peut ajouter des photos à cet album." });

        var (url, publicId) = await cloudinary.UploadAsync(file, "albums");
        var photo = new Photo
        {
            CloudinaryUrl = url,
            CloudinaryPublicId = publicId,
            UploaderId = user.MemberId,
            Category = PhotoCategory.Album,
            AlbumId = id,
        };
        db.Photos.Add(photo);
        await db.SaveChangesAsync();

        return Ok(new {
            photo.Id, photo.CloudinaryUrl, photo.CreatedAt, photo.UploaderId,
            UploaderName = user.Member?.FirstName + " " + user.Member?.LastName
        });
    }

    [HttpDelete("{albumId:guid}/photos/{photoId:guid}")]
    public async Task<IActionResult> RemovePhoto(Guid albumId, Guid photoId)
    {
        var user = await GetCurrentUserAsync();
        if (user is null) return Unauthorized();

        var photo = await db.Photos.FindAsync(photoId);
        if (photo is null || photo.AlbumId != albumId) return NotFound();
        if (photo.UploaderId != user.MemberId && !User.IsInRole("Admin")) return Forbid();

        await cloudinary.DeleteAsync(photo.CloudinaryPublicId);
        db.Photos.Remove(photo);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
