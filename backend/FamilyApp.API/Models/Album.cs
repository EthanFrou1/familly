namespace FamilyApp.API.Models;

public class Album
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Name { get; set; }
    public Guid CreatorId { get; set; }
    public Member Creator { get; set; } = null!;
    public Guid? EventId { get; set; }
    public Event? Event { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<Photo> Photos { get; set; } = [];
}
