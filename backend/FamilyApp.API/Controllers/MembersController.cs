using System.Security.Claims;
using System.Security.Cryptography;
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
public class MembersController(AppDbContext db, CloudinaryService cloudinary, ActivityLogService activityLog, IConfiguration config, PushNotificationService push) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var members = await db.Members.Include(m => m.Family).Select(ToDto).ToListAsync();
        return Ok(members);
    }

    [HttpGet("export/calendar-url")]
    public IActionResult GetCalendarUrl()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var token = GenerateCalendarToken(userId);
        return Ok(new { token });
    }

    [HttpGet("export/birthdays.ics")]
    [AllowAnonymous]
    public async Task<IActionResult> ExportBirthdaysIcs([FromQuery] string? token)
    {
        var authorized = User.Identity?.IsAuthenticated == true;
        if (!authorized && token is not null)
            authorized = ValidateCalendarToken(token) is not null;
        if (!authorized) return Unauthorized();

        var members = await db.Members
            .Where(m => m.BirthDate.HasValue)
            .OrderBy(m => m.FirstName).ThenBy(m => m.LastName)
            .Select(m => new { m.Id, m.FirstName, m.LastName, m.BirthDate })
            .ToListAsync();

        var culture = System.Globalization.CultureInfo.GetCultureInfo("fr-FR");
        var sb = new System.Text.StringBuilder();
        sb.Append("BEGIN:VCALENDAR\r\n");
        sb.Append("VERSION:2.0\r\n");
        sb.Append("PRODID:-//FamilyApp//FR\r\n");
        sb.Append("CALSCALE:GREGORIAN\r\n");
        sb.Append("METHOD:PUBLISH\r\n");
        AppendFolded(sb, "X-WR-CALNAME:Anniversaires famille");
        AppendFolded(sb, "X-WR-CALDESC:Anniversaires des membres de la famille");

        foreach (var m in members)
        {
            var birth = m.BirthDate!.Value;
            var name = IcsEscape($"{m.FirstName} {m.LastName}");
            var dateStr = birth.ToString("dd MMMM yyyy", culture);

            sb.Append("BEGIN:VEVENT\r\n");
            AppendFolded(sb, $"UID:birthday-{m.Id}@familyapp");
            sb.Append($"DTSTAMP:{DateTime.UtcNow:yyyyMMddTHHmmssZ}\r\n");
            AppendFolded(sb, $"DTSTART;VALUE=DATE:{birth:yyyyMMdd}");
            AppendFolded(sb, $"DTEND;VALUE=DATE:{birth.AddDays(1):yyyyMMdd}");
            sb.Append("RRULE:FREQ=YEARLY\r\n");
            AppendFolded(sb, $"SUMMARY:🎂 Anniversaire de {name}");
            AppendFolded(sb, $"DESCRIPTION:Né(e) le {IcsEscape(dateStr)}");
            sb.Append("TRANSP:TRANSPARENT\r\n");
            sb.Append("END:VEVENT\r\n");
        }

        sb.Append("END:VCALENDAR\r\n");

        var bytes = System.Text.Encoding.UTF8.GetBytes(sb.ToString());
        return File(bytes, "text/calendar; charset=utf-8", "anniversaires-famille.ics");
    }

    [HttpGet("export/contacts.vcf")]
    [AllowAnonymous]
    public async Task<IActionResult> ExportContactsVcf([FromQuery] string? ids, [FromQuery] string? token)
    {
        var authorized = User.Identity?.IsAuthenticated == true;
        if (!authorized && token is not null)
            authorized = ValidateCalendarToken(token) is not null;
        if (!authorized) return Unauthorized();

        IQueryable<Member> query = db.Members.Where(m => m.BirthDate.HasValue);

        if (!string.IsNullOrEmpty(ids))
        {
            var idList = ids.Split(',')
                .Select(id => Guid.TryParse(id.Trim(), out var g) ? g : (Guid?)null)
                .Where(g => g.HasValue).Select(g => g!.Value).ToList();
            query = query.Where(m => idList.Contains(m.Id));
        }

        var members = await query.OrderBy(m => m.FirstName).ThenBy(m => m.LastName)
            .Select(m => new { m.Id, m.FirstName, m.LastName, m.BirthDate })
            .ToListAsync();

        var sb = new System.Text.StringBuilder();
        foreach (var m in members)
        {
            sb.Append("BEGIN:VCARD\r\n");
            sb.Append("VERSION:3.0\r\n");
            sb.Append($"FN:{VCardEscape($"{m.FirstName} {m.LastName}")}\r\n");
            sb.Append($"N:{VCardEscape(m.LastName)};{VCardEscape(m.FirstName)};;;\r\n");
            sb.Append($"BDAY:{m.BirthDate!.Value:yyyy-MM-dd}\r\n");
            sb.Append($"UID:mbf-{m.Id}@mybigfamily.fr\r\n");
            sb.Append("END:VCARD\r\n");
            sb.Append("\r\n"); // blank line between entries required by some parsers
        }

        // UTF-8 BOM helps some importers (Outlook, iOS) detect encoding correctly
        var bom = System.Text.Encoding.UTF8.GetPreamble();
        var content = System.Text.Encoding.UTF8.GetBytes(sb.ToString());
        var bytes = bom.Concat(content).ToArray();
        return File(bytes, "text/vcard; charset=utf-8", "contacts-anniversaires.vcf");
    }

    private static string VCardEscape(string s) =>
        s.Replace("\\", "\\\\").Replace(",", "\\,").Replace(";", "\\;").Replace("\n", "\\n");

    private string GenerateCalendarToken(Guid userId)
    {
        var key = System.Text.Encoding.UTF8.GetBytes(config["Jwt:Key"]! + ":calendar");
        using var hmac = new HMACSHA256(key);
        var hash = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(userId.ToString()));
        var userPart = Convert.ToBase64String(userId.ToByteArray()).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var hashPart = Convert.ToBase64String(hash).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        return $"{userPart}.{hashPart}";
    }

    private Guid? ValidateCalendarToken(string token)
    {
        var parts = token.Split('.');
        if (parts.Length != 2) return null;
        try
        {
            var userIdBytes = Convert.FromBase64String(parts[0].Replace('-', '+').Replace('_', '/') + "==");
            var userId = new Guid(userIdBytes);
            return GenerateCalendarToken(userId) == token ? userId : null;
        }
        catch { return null; }
    }

    private static string IcsEscape(string s) =>
        s.Replace("\\", "\\\\").Replace(";", "\\;").Replace(",", "\\,").Replace("\n", "\\n");

    private static void AppendFolded(System.Text.StringBuilder sb, string line)
    {
        const int max = 75;
        if (line.Length <= max) { sb.Append(line).Append("\r\n"); return; }
        sb.Append(line[..max]).Append("\r\n");
        var rest = line[max..];
        while (rest.Length > 0)
        {
            var chunk = rest.Length > 74 ? rest[..74] : rest;
            sb.Append(' ').Append(chunk).Append("\r\n");
            rest = rest[chunk.Length..];
        }
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
        if (!string.IsNullOrWhiteSpace(req.Email))
        {
            var emailTaken = await db.Members.AnyAsync(m => m.Email == req.Email.Trim());
            if (emailTaken)
                return Conflict(new { message = "Cette adresse email est déjà utilisée par un autre membre." });
        }

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

        _ = Task.Run(() => push.SendToAllAsync(
            "👤 Nouveau membre !",
            $"{member.FirstName} {member.LastName} vient de rejoindre la famille !",
            $"/profile/{member.Id}"
        ));

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
        if (req.Email is not null && req.Email != "")
        {
            var emailTaken = await db.Members.AnyAsync(m => m.Email == req.Email.Trim() && m.Id != id);
            if (emailTaken)
                return Conflict(new { message = "Cette adresse email est déjà utilisée par un autre membre." });
        }
        if (req.Email is not null) member.Email = req.Email;
        if (req.Phone is not null) member.Phone = req.Phone;
        if (req.Bio is not null) member.Bio = req.Bio;
        if (req.Address is not null) member.Address = req.Address == "" ? null : req.Address;
        if (req.PostalCode is not null) member.PostalCode = req.PostalCode == "" ? null : req.PostalCode;
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
        await db.Entry(member).Reference(m => m.Family).LoadAsync();
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
