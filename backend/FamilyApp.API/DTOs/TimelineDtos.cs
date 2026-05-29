namespace FamilyApp.API.DTOs;

public record TimelineEventDto(
    Guid Id,
    string Title,
    string? Description,
    int? Year,
    DateTime? ExactDate,
    string Type,
    string TypeLabel,
    string TypeIcon,
    string? PhotoUrl,
    Guid? FamilyId,
    string? FamilyName,
    List<TimelineMemberDto> LinkedMembers,
    Guid CreatedById,
    string CreatedByName,
    DateTime CreatedAt
);

public record TimelineMemberDto(Guid Id, string Name, string? ProfilePictureUrl);

public record CreateTimelineEventRequest(
    string Title,
    string? Description,
    int? Year,
    DateTime? ExactDate,
    string Type,
    Guid? FamilyId,
    List<Guid>? LinkedMemberIds
);

public record UpdateTimelineEventRequest(
    string? Title,
    string? Description,
    int? Year,
    DateTime? ExactDate,
    string? Type,
    Guid? FamilyId,
    List<Guid>? LinkedMemberIds
);
