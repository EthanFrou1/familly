namespace FamilyApp.API.Models;

public enum EventType
{
    Birthday,
    Wedding,
    Reunion,
    Birth,
    Other
}

public class Event
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Title { get; set; }
    public string? Description { get; set; }
    public DateTime EventDate { get; set; }
    public EventType Type { get; set; }

    public Guid CreatedById { get; set; }
    public Member CreatedBy { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Photo> Photos { get; set; } = [];
}
