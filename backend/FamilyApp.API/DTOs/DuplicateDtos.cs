namespace FamilyApp.API.DTOs;

public record DuplicateCandidateDto(
    Guid Id,
    DuplicateMemberDto MemberA,
    DuplicateMemberDto MemberB,
    string Confidence,
    List<string> Reasons,
    string Status,
    DateTime CreatedAt
);

public record DuplicateMemberDto(
    Guid Id,
    string FirstName,
    string LastName,
    string? ProfilePictureUrl,
    string? Email,
    string? Phone,
    DateTime? BirthDate
);
