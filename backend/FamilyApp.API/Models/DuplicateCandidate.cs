namespace FamilyApp.API.Models;

public class DuplicateCandidate
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid MemberAId { get; set; }
    public Member MemberA { get; set; } = null!;
    public Guid MemberBId { get; set; }
    public Member MemberB { get; set; } = null!;
    public string Confidence { get; set; } = "probable"; // "fort" | "probable" | "faible"
    public string Reasons { get; set; } = "[]"; // JSON array of reason keys
    public string Status { get; set; } = "Open"; // "Open" | "Ignored" | "Resolved"
    public Guid? ReviewedByUserId { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
