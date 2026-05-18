namespace FamilyApp.API.Models;

public enum UserRole
{
    Admin,
    Member,
    ReadOnly
}

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Email { get; set; }
    public required string PasswordHash { get; set; }
    public UserRole Role { get; set; } = UserRole.Member;

    public Guid MemberId { get; set; }
    public Member Member { get; set; } = null!;

    public string? InvitationToken { get; set; }
    public DateTime? InvitationUsedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
