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

public class QuizOption
{
    public required string Key { get; set; }
    public required string Label { get; set; }
}

// Représente une question de quiz (Qui est-ce / Quel est le lien). CorrectKey ne doit jamais
// être envoyé au client avant que la question soit résolue (sinon la réponse est visible dans
// l'onglet réseau du navigateur).
public class QuizQuestion
{
    public required string Id { get; set; }
    public required string CorrectKey { get; set; }
    public required List<QuizOption> Options { get; set; }
    public string? PhotoUrl { get; set; }
    public Guid? MemberAId { get; set; }
    public Guid? MemberBId { get; set; }
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
    public bool Finished { get; set; }
    public DateTime? StartedAt { get; set; }

    public bool Paused { get; set; }
    public DateTime? PausedAt { get; set; }
    public double PausedSeconds { get; set; }

    public List<int> RemainingColorIndexesForWheel { get; set; } = [];
    public List<int> TurnOrderColorIndexes { get; set; } = [];

    public List<QuizQuestion> QuizQuestions { get; set; } = [];
    public int QuizQuestionIndex { get; set; }
}
