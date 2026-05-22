using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using FamilyApp.API.Data;
using FamilyApp.API.DTOs;
using FamilyApp.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace FamilyApp.API.Services;

public class AuthService(AppDbContext db, IConfiguration config)
{
    public async Task<AuthResponse?> LoginAsync(string email, string password)
    {
        var user = await db.Users.Include(u => u.Member).FirstOrDefaultAsync(u => u.Email == email);
        if (user is null || !BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
            return null;

        var token = GenerateJwt(user);
        return new AuthResponse(token, MapToDto(user));
    }

    public async Task<AuthResponse?> AcceptInvitationAsync(string token, string password, string? email = null)
    {
        var user = await db.Users.Include(u => u.Member).FirstOrDefaultAsync(u => u.InvitationToken == token && u.InvitationUsedAt == null);
        if (user is null) return null;

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password);
        user.InvitationUsedAt = DateTime.UtcNow;
        user.InvitationToken = null;
        if (email is not null && user.Email.EndsWith("@noreply.placeholder"))
        {
            user.Email = email;
            if (user.Member is not null)
                user.Member.Email = email;
        }
        await db.SaveChangesAsync();

        var jwt = GenerateJwt(user);
        return new AuthResponse(jwt, MapToDto(user));
    }

    public async Task<InviteInfoDto?> GetInviteInfoAsync(string token)
    {
        var user = await db.Users.Include(u => u.Member)
            .FirstOrDefaultAsync(u => u.InvitationToken == token && u.InvitationUsedAt == null);
        if (user is null) return null;
        return new InviteInfoDto(user.Email.EndsWith("@noreply.placeholder"), user.Member.FirstName);
    }

    public async Task<string> GetMemberAccountStatusAsync(Guid memberId)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.MemberId == memberId);
        if (user is null) return "none";
        return user.InvitationUsedAt.HasValue ? "active" : "pending";
    }

    public async Task<User?> GenerateInvitationAsync(string? email, UserRole role, Guid memberId)
    {
        var effectiveEmail = email ?? $"no-email-{memberId}@noreply.placeholder";
        var existing = await db.Users.FirstOrDefaultAsync(u => u.Email == effectiveEmail);

        if (existing is not null)
        {
            // Compte actif → impossible de réinviter
            if (existing.InvitationUsedAt.HasValue) return null;
            // Invitation en attente → regénère le token
            existing.InvitationToken = Guid.NewGuid().ToString("N");
            await db.SaveChangesAsync();
            return existing;
        }

        var user = new User
        {
            Email = effectiveEmail,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString()),
            Role = role,
            MemberId = memberId,
            InvitationToken = Guid.NewGuid().ToString("N")
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    public async Task<List<ActiveUserDto>> GetActiveUsersAsync()
    {
        return await db.Users
            .Include(u => u.Member)
            .Where(u => u.InvitationUsedAt != null)
            .OrderBy(u => u.Member.FirstName).ThenBy(u => u.Member.LastName)
            .Select(u => new ActiveUserDto(u.Id, u.MemberId, u.Member.FirstName, u.Member.LastName))
            .ToListAsync();
    }

    public async Task<(string token, string firstName)?> GeneratePasswordResetTokenAsync(string email)
    {
        var user = await db.Users.Include(u => u.Member)
            .FirstOrDefaultAsync(u => u.Email == email && !u.Email.EndsWith("@noreply.placeholder"));
        if (user is null) return null;

        user.ResetPasswordToken = Guid.NewGuid().ToString("N");
        user.ResetPasswordTokenExpiry = DateTime.UtcNow.AddHours(1);
        await db.SaveChangesAsync();
        return (user.ResetPasswordToken, user.Member.FirstName);
    }

    public async Task<bool> ResetPasswordAsync(string token, string newPassword)
    {
        var user = await db.Users.FirstOrDefaultAsync(u =>
            u.ResetPasswordToken == token &&
            u.ResetPasswordTokenExpiry > DateTime.UtcNow);
        if (user is null) return false;

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        user.ResetPasswordToken = null;
        user.ResetPasswordTokenExpiry = null;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<string?> GetMemberInvitationTokenAsync(Guid memberId)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.MemberId == memberId && u.InvitationToken != null && u.InvitationUsedAt == null);
        return user?.InvitationToken;
    }

    public async Task<UserDto?> GetCurrentUserAsync(Guid userId)
    {
        var user = await db.Users.Include(u => u.Member).FirstOrDefaultAsync(u => u.Id == userId);
        return user is null ? null : MapToDto(user);
    }

    public async Task<bool> DeleteAccountAsync(Guid userId)
    {
        var user = await db.Users.Include(u => u.Member).FirstOrDefaultAsync(u => u.Id == userId);
        if (user is null) return false;

        var memberId = user.MemberId;

        // Anonymize activity logs where this member is target or related
        var logsAsTarget = await db.ActivityLogs.Where(l => l.TargetMemberId == memberId).ToListAsync();
        foreach (var log in logsAsTarget)
        {
            log.TargetMemberName = "Membre supprimé";
            log.TargetMemberPictureUrl = null;
        }

        var logsAsRelated = await db.ActivityLogs.Where(l => l.RelatedMemberId == memberId).ToListAsync();
        foreach (var log in logsAsRelated)
            log.RelatedMemberName = "Membre supprimé";

        // Remove personal contact data from member profile (keep name/birthdate for family tree)
        var member = user.Member;
        member.Email = null;
        member.Phone = null;
        member.Bio = null;
        member.Address = null;
        member.PostalCode = null;
        member.City = null;
        member.Country = null;
        member.Latitude = null;
        member.Longitude = null;
        member.FacebookUrl = null;
        member.InstagramUsername = null;
        member.WhatsappNumber = null;

        // Delete push subscriptions
        var pushSubs = db.PushSubscriptions.Where(p => p.UserId == userId);
        db.PushSubscriptions.RemoveRange(pushSubs);

        // Delete user account
        db.Users.Remove(user);

        await db.SaveChangesAsync();
        return true;
    }

    public async Task<object> GetMyExportAsync(Guid userId)
    {
        var user = await db.Users
            .Include(u => u.Member)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user is null) return new { };

        var memberId = user.MemberId;

        var photos = await db.Photos
            .Where(p => p.UploaderId == memberId)
            .Select(p => new { p.Id, p.Url, p.Category, p.CreatedAt })
            .ToListAsync();

        var activityLogs = await db.ActivityLogs
            .Where(l => l.TargetMemberId == memberId)
            .OrderByDescending(l => l.CreatedAt)
            .Select(l => new { l.Type, l.ActorName, l.CreatedAt })
            .ToListAsync();

        return new
        {
            exportedAt = DateTime.UtcNow,
            account = new
            {
                user.Id,
                user.Email,
                user.Role,
                user.CreatedAt,
            },
            profile = new
            {
                user.Member.Id,
                user.Member.FirstName,
                user.Member.LastName,
                user.Member.BirthDate,
                user.Member.Email,
                user.Member.Phone,
                user.Member.Bio,
                user.Member.Occupation,
                user.Member.Sport,
                user.Member.Address,
                user.Member.PostalCode,
                user.Member.City,
                user.Member.Country,
                user.Member.Latitude,
                user.Member.Longitude,
                user.Member.FacebookUrl,
                user.Member.InstagramUsername,
                user.Member.WhatsappNumber,
            },
            photos,
            activityLogs,
        };
    }

    private string GenerateJwt(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiry = DateTime.UtcNow.AddDays(int.Parse(config["Jwt:ExpirationDays"] ?? "30"));

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
        };

        var jwt = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"],
            audience: config["Jwt:Audience"],
            claims: claims,
            expires: expiry,
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(jwt);
    }

    private static UserDto MapToDto(User u) =>
        new(u.Id, u.Email, u.Role.ToString(), u.MemberId, u.Member.FirstName, u.Member.LastName);
}
