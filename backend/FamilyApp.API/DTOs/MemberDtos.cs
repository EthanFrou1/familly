namespace FamilyApp.API.DTOs;

public record MemberDto(
    Guid Id,
    string FirstName,
    string LastName,
    DateTime? BirthDate,
    DateTime? DeathDate,
    string? Email,
    string? Phone,
    string? Bio,
    string? Address,
    string? PostalCode,
    string? City,
    string? Country,
    double? Latitude,
    double? Longitude,
    string? ProfilePictureUrl,
    bool IsAlive,
    DateTime CreatedAt,
    string? FacebookUrl,
    string? InstagramUsername,
    string? WhatsappNumber,
    Guid? FamilyId,
    string? FamilyName
);

public record CreateMemberRequest(
    string FirstName,
    string LastName,
    DateTime? BirthDate,
    DateTime? DeathDate,
    string? Email,
    string? Phone,
    string? Bio,
    string? Address,
    string? PostalCode,
    string? City,
    string? Country,
    double? Latitude,
    double? Longitude,
    bool IsAlive = true,
    string? FacebookUrl = null,
    string? InstagramUsername = null,
    string? WhatsappNumber = null,
    Guid? FamilyId = null
);

public record UpdateMemberRequest(
    string? FirstName,
    string? LastName,
    DateTime? BirthDate,
    DateTime? DeathDate,
    string? Email,
    string? Phone,
    string? Bio,
    string? Address,
    string? PostalCode,
    string? City,
    string? Country,
    double? Latitude,
    double? Longitude,
    bool? IsAlive,
    string? FacebookUrl,
    string? InstagramUsername,
    string? WhatsappNumber,
    Guid? FamilyId = null
);
