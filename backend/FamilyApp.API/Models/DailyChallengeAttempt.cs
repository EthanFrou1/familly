namespace FamilyApp.API.Models;

public class DailyChallengeAttempt
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DailyChallengeId { get; set; }
    public DailyChallenge DailyChallenge { get; set; } = null!;
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    // Liste ordonnée d'ids de membres devinés (JSON), sérialisée/désérialisée par le service.
    public string GuessesJson { get; set; } = "[]";
    public bool Solved { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
