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
    // (famillenor) Équipe assignée en lobby avant lancement, null tant que l'hôte ne l'a pas choisie.
    public int? TeamIndex { get; set; }

    // Déconnexion en pleine partie (voir GameHub.HandleMidGameDisconnectAsync) : le joueur garde sa
    // place le temps du délai de grâce plutôt que d'être retiré immédiatement. DisconnectToken
    // identifie l'épisode de déconnexion en cours, pour qu'un timer de grâce expiré après une
    // reconnexion (ou après un kick manuel déjà traité) soit reconnu comme obsolète et ignoré.
    public bool Disconnected { get; set; }
    public Guid DisconnectToken { get; set; }
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

// Round d'un jeu "simultané" (superlative / whoami) : tous les joueurs répondent en parallèle,
// contrairement aux QuizQuestion résolues tour par tour. CorrectKey ne doit jamais être envoyé
// au client avant résolution (whoami : id du membre-sujet).
public class SimRound
{
    public required string Id { get; set; }
    public string? Prompt { get; set; }
    public List<string> Clues { get; set; } = [];
    public required string CorrectKey { get; set; }
}

// Une catégorie de réponses équivalentes pour une question "Une Famille en Or", triée par points
// décroissants dans FamilleEnOrRound.Slots. Le Label ne doit jamais être envoyé au client tant que
// Revealed est false (sinon la réponse est visible dans l'onglet réseau du navigateur).
public class FamilleEnOrSlot
{
    public required string Label { get; set; }
    public required int Points { get; set; }
    public bool Revealed { get; set; }
}

public class FamilleEnOrRound
{
    public required string QuestionKey { get; set; }
    public required string Prompt { get; set; }
    public required List<FamilleEnOrSlot> Slots { get; set; }
}

public enum UndercoverRole { Civilian, Undercover, MrWhite }

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
    public int? PausedByColorIndex { get; set; }

    public List<int> RemainingColorIndexesForWheel { get; set; } = [];
    public List<int> TurnOrderColorIndexes { get; set; } = [];

    public List<QuizQuestion> QuizQuestions { get; set; } = [];
    public int QuizQuestionIndex { get; set; }

    public List<SimRound> SimRounds { get; set; } = [];
    public int SimRoundIndex { get; set; }
    // (whoami) Nombre d'indices supplémentaires demandés par chaque joueur pour le round en
    // cours, en privé — chaque indice coûte des points au moment du score (voir ResolveRoundAsync).
    public Dictionary<Guid, int> PlayerHintCounts { get; set; } = [];
    public Dictionary<Guid, string?> PendingAnswers { get; set; } = [];
    public bool ResultSaved { get; set; }

    // (famillenor) Rounds piochés une fois pour toutes au lancement (voir StartFamilleEnOrGame) :
    // une re-curation admin pendant la partie n'affecte jamais une partie déjà en cours.
    public List<FamilleEnOrRound> FamilleEnOrRounds { get; set; } = [];
    public int FamilleEnOrRoundIndex { get; set; }
    public string FamilleEnOrPhase { get; set; } = "faceoff"; // "faceoff" | "control" | "steal"
    public int? FamilleEnOrControllingTeamIndex { get; set; }
    public int FamilleEnOrStrikes { get; set; }
    // Points déjà sécurisés ce round (réponses révélées pendant le contrôle) : ce que garde
    // l'équipe au contrôle si le vol échoue ensuite.
    public int FamilleEnOrRoundPot { get; set; }
    public List<Guid> FamilleEnOrFaceOffMemberIds { get; set; } = [];
    // Index du prochain représentant à désigner dans le roster de chaque équipe (rotation), clé =
    // TeamIndex (0 ou 1).
    public Dictionary<int, int> FamilleEnOrTeamRepIndex { get; set; } = [];

    // (undercover) Rôles/mots attribués une fois pour toutes au lancement. Word est null pour
    // Mr. White — ne jamais envoyer à un autre joueur que son propriétaire (voir StartUndercoverGame).
    public Dictionary<Guid, UndercoverRole> UndercoverRoles { get; set; } = [];
    public Dictionary<Guid, string?> UndercoverWords { get; set; } = [];
    public List<Guid> UndercoverAliveMemberIds { get; set; } = [];
    // Ordre de parole du tour d'indices en cours, recalculé à partir des vivants à chaque nouveau
    // tour (voir StartUndercoverGame / ContinueUndercoverRound).
    public List<Guid> UndercoverSpeakingOrder { get; set; } = [];
    public int UndercoverSpeakerIndex { get; set; }
    public Dictionary<Guid, Guid> UndercoverVotes { get; set; } = [];
    public string UndercoverPhase { get; set; } = "clue"; // "clue" | "vote" | "mrwhite-guess"
    public Guid? UndercoverPendingMrWhiteGuesserId { get; set; }
    // Camp gagnant une fois Finished (utilisé par ContinueUndercoverRound pour construire le
    // GameResult) : "civilians" | "undercover" | "mrwhite".
    public string? UndercoverWinningSide { get; set; }
    public Guid? UndercoverSoloWinnerMemberId { get; set; }
}
