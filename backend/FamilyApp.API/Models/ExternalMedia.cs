namespace FamilyApp.API.Models;

public enum ExternalPlatform
{
    GooglePhotos,
    YouTube,
    Other
}

public class ExternalMedia
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UploaderId { get; set; }
    public Member Uploader { get; set; } = null!;
    public string? Title { get; set; }
    public required string ExternalUrl { get; set; }
    public ExternalPlatform Platform { get; set; } = ExternalPlatform.GooglePhotos;
    public Guid? EventId { get; set; }
    public Event? Event { get; set; }
    public Guid? LinkedMemberId { get; set; }
    public Member? LinkedMember { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
