namespace FamilyApp.API.Models;

public class GameResult
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string GameType { get; set; }
    public int PairsCount { get; set; }
    public int PlayerCount { get; set; }
    public required string PlayersJson { get; set; }
    public string? WinnerName { get; set; }
    public int? DurationSeconds { get; set; }
    public Guid PlayedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
