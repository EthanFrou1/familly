namespace FamilyApp.API.Models;

public class ActivityLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Type { get; set; }
    public string? ActorName { get; set; }
    public Guid? TargetMemberId { get; set; }
    public string? TargetMemberName { get; set; }
    public string? TargetMemberPictureUrl { get; set; }
    public Guid? RelatedMemberId { get; set; }
    public string? RelatedMemberName { get; set; }
    public string? Metadata { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
