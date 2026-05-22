namespace FamilyApp.API.DTOs;

public record LoginRequest(string Email, string Password);
public record AcceptInvitationRequest(string Token, string Password, string? Email = null);
public record GenerateInvitationRequest(
    string? Email,
    string Role,
    Guid MemberId,
    string? AppUrl = null,
    string? FirstName = null,
    string? FamilyGroupName = null);

public record AuthResponse(string AccessToken, UserDto User);
public record InviteInfoDto(bool NeedsEmail, string? FirstName);

public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Token, string NewPassword);

public record UserDto(Guid Id, string Email, string Role, Guid MemberId, string FirstName, string LastName);
public record ActiveUserDto(Guid UserId, Guid MemberId, string FirstName, string LastName);
