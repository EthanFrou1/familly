namespace FamilyApp.API.DTOs;

public record ActivityLogDto(
    Guid Id,
    string Type,
    string? ActorName,
    Guid? TargetMemberId,
    string? TargetMemberName,
    string? TargetMemberPictureUrl,
    Guid? RelatedMemberId,
    string? RelatedMemberName,
    string? Metadata,
    DateTime CreatedAt
);
