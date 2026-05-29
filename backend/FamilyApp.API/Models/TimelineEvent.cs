namespace FamilyApp.API.Models;

public enum TimelineEventType
{
    Birth,
    Marriage,
    Death,
    Move,
    FamilyCreation,
    Memory,
    Other
}

public class TimelineEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Title { get; set; }
    public string? Description { get; set; }
    public int? Year { get; set; }
    public DateTime? ExactDate { get; set; }
    public TimelineEventType Type { get; set; }
    public string? PhotoUrl { get; set; }
    public string? PhotoPublicId { get; set; }

    public Guid? FamilyId { get; set; }
    public Family? Family { get; set; }

    public Guid CreatedById { get; set; }
    public Member CreatedBy { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<TimelineEventMember> LinkedMembers { get; set; } = [];
}

public class TimelineEventMember
{
    public Guid TimelineEventId { get; set; }
    public TimelineEvent TimelineEvent { get; set; } = null!;

    public Guid MemberId { get; set; }
    public Member Member { get; set; } = null!;
}
