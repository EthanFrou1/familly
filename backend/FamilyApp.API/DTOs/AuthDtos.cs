namespace FamilyApp.API.DTOs;

public record LoginRequest(string Email, string Password);
public record AcceptInvitationRequest(string Token, string Password);
public record GenerateInvitationRequest(
    string Email,
    string Role,
    Guid MemberId,
    string? AppUrl = null,
    string? FirstName = null,
    string? FamilyGroupName = null);

public record AuthResponse(string AccessToken, UserDto User);

public record UserDto(Guid Id, string Email, string Role, Guid MemberId, string FirstName, string LastName);
