namespace FamilyApp.API.DTOs;

public record DailyGuessRequestDto(Guid MemberId);

// Status: "green" | "yellow" | "gray" | "unknown" (indices insuffisants pour comparer, ex. ville hors
// France sans code postal). Direction (attributs numériques/génération) : "up" | "down" | null.
// Value : valeur brute affichable dans la case (utilisé pour l'année de naissance, indice supplémentaire).
public record DailyGuessCellDto(string Status, string? Direction, string? Value = null);

public record DailyGuessRowDto(
    Guid MemberId,
    string FirstName,
    string LastName,
    string? ProfilePictureUrl,
    DailyGuessCellDto Generation,
    DailyGuessCellDto BirthYear,
    DailyGuessCellDto City,
    DailyGuessCellDto Gender,
    DailyGuessCellDto? Branch,
    DailyGuessCellDto Alive,
    bool IsCorrect
);

public record DailyAnswerDto(
    Guid MemberId,
    string FirstName,
    string LastName,
    string? ProfilePictureUrl,
    DateTime? BirthDate,
    string? City
);

// Status: "inProgress" | "solved". Nombre d'essais illimité.
public record DailyMysteryStateDto(
    string Status,
    int AttemptsUsed,
    bool ShowBranchColumn,
    List<DailyGuessRowDto> Rows,
    DailyAnswerDto? Answer,
    int Streak,
    int MaxStreak
);

// Status: "inProgress" | "solved". Streak : jours consécutifs résolus pour ce membre.
public record DailyMysteryParticipantDto(
    Guid MemberId,
    string FirstName,
    string LastName,
    string? ProfilePictureUrl,
    string Status,
    int AttemptsUsed,
    int Streak
);

// Classement toutes dates confondues, même forme que le leaderboard générique des autres jeux
// (GamesController.GetLeaderboard) pour être affichable sans changement côté frontend.
public record DailyMysteryLeaderboardEntryDto(
    Guid MemberId,
    string Name,
    int GamesPlayed,
    int Wins,
    int Losses,
    double WinRate
);
