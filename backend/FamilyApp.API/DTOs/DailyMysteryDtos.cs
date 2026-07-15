namespace FamilyApp.API.DTOs;

public record DailyGuessRequestDto(Guid MemberId);

// Status: "green" | "yellow" | "gray". Direction (attributs numériques/génération) : "up" | "down" | null.
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

// Status: "inProgress" | "solved" | "failed".
public record DailyMysteryStateDto(
    string Status,
    int AttemptsUsed,
    int AttemptsRemaining,
    bool ShowBranchColumn,
    List<DailyGuessRowDto> Rows,
    DailyAnswerDto? Answer,
    int Streak,
    int MaxStreak
);
