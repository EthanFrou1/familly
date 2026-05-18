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
[Route("api/members")]
[Authorize]
public class MembersController(AppDbContext db, CloudinaryService cloudinary, ActivityLogService activityLog) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var members = await db.Members.Include(m => m.Family).Select(ToDto).ToListAsync();
        return Ok(members);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var member = await db.Members.Include(m => m.Family).Where(m => m.Id == id).Select(ToDto).FirstOrDefaultAsync();
        return member is null ? NotFound() : Ok(member);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Member")]
    public async Task<IActionResult> Create([FromBody] CreateMemberRequest req)
    {
        var member = new Member
        {
            FirstName = req.FirstName,
            LastName = req.LastName,
            BirthDate = ToUtc(req.BirthDate),
            DeathDate = ToUtc(req.DeathDate),
            Email = req.Email,
            Phone = req.Phone,
            Bio = req.Bio,
            Address = req.Address,
            PostalCode = req.PostalCode,
            City = req.City,
            Country = req.Country,
            Latitude = req.Latitude,
            Longitude = req.Longitude,
            IsAlive = req.IsAlive,
            FacebookUrl = req.FacebookUrl,
            InstagramUsername = req.InstagramUsername,
            WhatsappNumber = req.WhatsappNumber,
            FamilyId = req.FamilyId
        };
        db.Members.Add(member);
        await db.SaveChangesAsync();
        await activityLog.LogAsync("member_created", User,
            targetMemberId: member.Id,
            targetMemberName: $"{member.FirstName} {member.LastName}");
        return CreatedAtAction(nameof(GetById), new { id = member.Id }, MapToDto(member));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin,Member")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateMemberRequest req)
    {
        var member = await db.Members.Include(m => m.User).FirstOrDefaultAsync(m => m.Id == id);
        if (member is null) return NotFound();

        if (!CanEditMember(member)) return Forbid();

        if (req.FirstName is not null) member.FirstName = req.FirstName;
        if (req.LastName is not null) member.LastName = req.LastName;
        if (req.BirthDate.HasValue) member.BirthDate = ToUtc(req.BirthDate);
        if (req.DeathDate.HasValue) member.DeathDate = ToUtc(req.DeathDate);
        if (req.Email is not null) member.Email = req.Email;
        if (req.Phone is not null) member.Phone = req.Phone;
        if (req.Bio is not null) member.Bio = req.Bio;
        member.Address = req.Address;
        member.PostalCode = req.PostalCode;
        if (req.City is not null) member.City = req.City;
        if (req.Country is not null) member.Country = req.Country;
        if (req.Latitude.HasValue) member.Latitude = req.Latitude;
        if (req.Longitude.HasValue) member.Longitude = req.Longitude;
        if (req.IsAlive.HasValue) member.IsAlive = req.IsAlive.Value;
        if (req.FacebookUrl is not null) member.FacebookUrl = req.FacebookUrl == "" ? null : req.FacebookUrl;
        if (req.InstagramUsername is not null) member.InstagramUsername = req.InstagramUsername == "" ? null : req.InstagramUsername;
        if (req.WhatsappNumber is not null) member.WhatsappNumber = req.WhatsappNumber == "" ? null : req.WhatsappNumber;
        member.FamilyId = req.FamilyId;

        await db.SaveChangesAsync();
        await activityLog.LogAsync("member_updated", User,
            targetMemberId: member.Id,
            targetMemberName: $"{member.FirstName} {member.LastName}",
            targetMemberPictureUrl: member.ProfilePictureUrl);
        return Ok(MapToDto(member));
    }

    [HttpPut("{id:guid}/profile-picture")]
    [Authorize(Roles = "Admin,Member")]
    public async Task<IActionResult> UpdateProfilePicture(Guid id, IFormFile file)
    {
        var member = await db.Members.Include(m => m.User).FirstOrDefaultAsync(m => m.Id == id);
        if (member is null) return NotFound();
        if (!CanEditMember(member)) return Forbid();

        var (url, _) = await cloudinary.UploadAsync(file, "family/profiles");
        member.ProfilePictureUrl = url;
        await db.SaveChangesAsync();
        await activityLog.LogAsync("photo_updated", User,
            targetMemberId: member.Id,
            targetMemberName: $"{member.FirstName} {member.LastName}",
            targetMemberPictureUrl: url);
        return Ok(new { profilePictureUrl = url });
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var member = await db.Members.FindAsync(id);
        if (member is null) return NotFound();
        db.Members.Remove(member);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private bool CanEditMember(Member member)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (role == "Admin") return true;
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        return member.User?.Id == userId;
    }

    private static MemberDto MapToDto(Member m) => new(
        m.Id, m.FirstName, m.LastName, m.BirthDate, m.DeathDate,
        m.Email, m.Phone, m.Bio, m.Address, m.PostalCode, m.City, m.Country,
        m.Latitude, m.Longitude, m.ProfilePictureUrl, m.IsAlive, m.CreatedAt,
        m.FacebookUrl, m.InstagramUsername, m.WhatsappNumber,
        m.FamilyId, m.Family?.Name
    );

    private static DateTime? ToUtc(DateTime? dt) =>
        dt.HasValue ? DateTime.SpecifyKind(dt.Value, DateTimeKind.Utc) : null;

    private static readonly System.Linq.Expressions.Expression<Func<Member, MemberDto>> ToDto = m => new MemberDto(
        m.Id, m.FirstName, m.LastName, m.BirthDate, m.DeathDate,
        m.Email, m.Phone, m.Bio, m.Address, m.PostalCode, m.City, m.Country,
        m.Latitude, m.Longitude, m.ProfilePictureUrl, m.IsAlive, m.CreatedAt,
        m.FacebookUrl, m.InstagramUsername, m.WhatsappNumber,
        m.FamilyId, m.Family != null ? m.Family.Name : null
    );
}
