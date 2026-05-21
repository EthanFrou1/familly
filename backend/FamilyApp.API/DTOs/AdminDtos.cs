namespace FamilyApp.API.DTOs;

public record AdminMemberOverviewDto(
    Guid Id,
    string FirstName,
    string LastName,
    string? ProfilePictureUrl,
    string? Email,
    string? Phone,
    string? WhatsappNumber,
    bool IsAlive,
    Guid? FamilyId,
    string? FamilyName,
    Guid? DelegateManagerId,
    string? DelegateManagerName,
    string AccountStatus,
    string? InvitationToken,
    Guid? UserId,
    DateTime CreatedAt
);
