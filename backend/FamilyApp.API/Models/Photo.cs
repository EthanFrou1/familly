namespace FamilyApp.API.Models;

public enum PhotoCategory
{
    Profile,
    Album,
    Feed
}

public class Photo
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UploaderId { get; set; }
    public Member Uploader { get; set; } = null!;
    public required string CloudinaryUrl { get; set; }
    public required string CloudinaryPublicId { get; set; }
    public PhotoCategory Category { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public Guid? EventId { get; set; }
    public Event? Event { get; set; }
    public Guid? AlbumId { get; set; }
    public Album? Album { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
