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

        // Nullify activity log references (no FK constraint — just clean the stored IDs)
        await db.ActivityLogs.Where(l => l.TargetMemberId == memberId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(l => l.TargetMemberId, (Guid?)null)
                .SetProperty(l => l.TargetMemberName, "Compte supprimé")
                .SetProperty(l => l.TargetMemberPictureUrl, (string?)null));
        await db.ActivityLogs.Where(l => l.RelatedMemberId == memberId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(l => l.RelatedMemberId, (Guid?)null)
                .SetProperty(l => l.RelatedMemberName, "Compte supprimé"));

        // Delete push subscriptions
        await db.PushSubscriptions.Where(p => p.UserId == userId).ExecuteDeleteAsync();

        // Delete all family relations (both sides — Restrict FK requires explicit delete)
        await db.Relations
            .Where(r => r.MemberAId == memberId || r.MemberBId == memberId)
            .ExecuteDeleteAsync();

        // Delete external media uploaded by this member
        await db.ExternalMedias.Where(em => em.UploaderId == memberId).ExecuteDeleteAsync();

        // Delete photos uploaded by this member
        await db.Photos.Where(p => p.UploaderId == memberId).ExecuteDeleteAsync();

        // Reassign albums/events to an existing member to preserve shared content
        var fallbackId = await db.Members
            .Where(m => m.Id != memberId)
            .OrderBy(m => m.CreatedAt)
            .Select(m => (Guid?)m.Id)
            .FirstOrDefaultAsync();

        if (fallbackId.HasValue)
        {
            await db.Albums.Where(a => a.CreatorId == memberId)
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.CreatorId, fallbackId.Value));
            await db.Events.Where(e => e.CreatedById == memberId)
                .ExecuteUpdateAsync(s => s.SetProperty(e => e.CreatedById, fallbackId.Value));
        }
        else
        {
            await db.Albums.Where(a => a.CreatorId == memberId).ExecuteDeleteAsync();
            await db.Events.Where(e => e.CreatedById == memberId).ExecuteDeleteAsync();
        }

        // Delete user first (User.MemberId FK → Members), then member (DuplicateCandidates cascade)
        await db.Users.Where(u => u.Id == userId).ExecuteDeleteAsync();
        await db.Members.Where(m => m.Id == memberId).ExecuteDeleteAsync();

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
            .Select(p => new { p.Id, p.CloudinaryUrl, p.Category, p.CreatedAt })
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
