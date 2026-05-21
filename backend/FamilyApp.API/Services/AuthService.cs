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

    public async Task<AuthResponse?> AcceptInvitationAsync(string token, string password)
    {
        var user = await db.Users.Include(u => u.Member).FirstOrDefaultAsync(u => u.InvitationToken == token && u.InvitationUsedAt == null);
        if (user is null) return null;

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password);
        user.InvitationUsedAt = DateTime.UtcNow;
        user.InvitationToken = null;
        await db.SaveChangesAsync();

        var jwt = GenerateJwt(user);
        return new AuthResponse(jwt, MapToDto(user));
    }

    public async Task<string> GetMemberAccountStatusAsync(Guid memberId)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.MemberId == memberId);
        if (user is null) return "none";
        return user.InvitationUsedAt.HasValue ? "active" : "pending";
    }

    public async Task<User?> GenerateInvitationAsync(string email, UserRole role, Guid memberId)
    {
        var existing = await db.Users.FirstOrDefaultAsync(u => u.Email == email);

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
            Email = email,
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
