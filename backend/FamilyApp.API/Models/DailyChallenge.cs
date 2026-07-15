namespace FamilyApp.API.Models;

public class DailyChallenge
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateOnly Date { get; set; }
    public Guid MemberId { get; set; }
    public Member Member { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
