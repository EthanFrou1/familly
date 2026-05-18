namespace FamilyApp.API.DTOs;

public record RelationDto(
    Guid Id,
    Guid MemberAId,
    string MemberAName,
    Guid MemberBId,
    string MemberBName,
    string Type
);

public record CreateRelationRequest(
    Guid MemberAId,
    Guid MemberBId,
    string Type
);

public record MemberRelationDto(
    Guid Id,
    Guid RelatedMemberId,
    string RelatedMemberName,
    string? RelatedMemberProfilePicture,
    string Type,
    string TypeLabel
);
