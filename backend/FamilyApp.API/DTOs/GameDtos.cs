namespace FamilyApp.API.DTOs;

public record GamePlayerScoreDto(string Name, int Score, Guid? MemberId, bool IsGuest);

public record CreateGameResultDto(
    string GameType,
    int PairsCount,
    List<GamePlayerScoreDto> Players,
    string? WinnerName,
    int? DurationSeconds
);

public record GameResultDto(
    Guid Id,
    string GameType,
    int PairsCount,
    int PlayerCount,
    List<GamePlayerScoreDto> Players,
    string? WinnerName,
    int? DurationSeconds,
    DateTime CreatedAt
);
