namespace FamilyApp.API.Realtime;

public class SessionPlayer
{
    public required string ConnectionId { get; set; }
    public required Guid MemberId { get; set; }
    public required string Name { get; set; }
    public string? ProfilePictureUrl { get; set; }
    public int ColorIndex { get; set; }
    public int Score { get; set; }
    public bool IsHost { get; set; }
}

public class DeckCard
{
    public required string CardId { get; set; }
    public required Guid MemberId { get; set; }
    public required string PhotoUrl { get; set; }
}

public class GameSession
{
    public required string Code { get; set; }
    public required string GameType { get; set; }
    public List<SessionPlayer> Players { get; set; } = [];
    public List<DeckCard> Deck { get; set; } = [];
    public int PairsCount { get; set; }
    public int CurrentPlayerIndex { get; set; }
    public List<string> FlippedCardIds { get; set; } = [];
    public Dictionary<Guid, int> MatchedBy { get; set; } = [];
    public bool Started { get; set; }
    public DateTime? StartedAt { get; set; }

    public List<int> RemainingColorIndexesForWheel { get; set; } = [];
    public List<int> TurnOrderColorIndexes { get; set; } = [];
}
