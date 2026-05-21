using System.Security.Claims;
using FamilyApp.API.DTOs;
using FamilyApp.API.Models;
using FamilyApp.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FamilyApp.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AuthService authService, EmailService emailService) : ControllerBase
{
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var result = await authService.LoginAsync(req.Email, req.Password);
        if (result is null) return Unauthorized(new { message = "Identifiants invalides." });

        Response.Cookies.Append("access_token", result.AccessToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.None,
            Expires = DateTimeOffset.UtcNow.AddDays(30)
        });

        return Ok(new { user = result.User, token = result.AccessToken });
    }

    [HttpPost("logout")]
    [Authorize]
    public IActionResult Logout()
    {
        Response.Cookies.Delete("access_token");
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await authService.GetCurrentUserAsync(userId);
        return user is null ? NotFound() : Ok(user);
    }

    [HttpPost("accept-invitation")]
    public async Task<IActionResult> AcceptInvitation([FromBody] AcceptInvitationRequest req)
    {
        var result = await authService.AcceptInvitationAsync(req.Token, req.Password);
        if (result is null) return BadRequest(new { message = "Lien invalide ou expiré." });

        Response.Cookies.Append("access_token", result.AccessToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.None,
            Expires = DateTimeOffset.UtcNow.AddDays(30)
        });

        return Ok(new { user = result.User, token = result.AccessToken });
    }

    [HttpGet("member/{memberId:guid}/account-status")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetMemberAccountStatus(Guid memberId)
    {
        var status = await authService.GetMemberAccountStatusAsync(memberId);
        return Ok(new { status });
    }

    [HttpGet("member/{memberId:guid}/invitation-token")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetMemberInvitationToken(Guid memberId)
    {
        var token = await authService.GetMemberInvitationTokenAsync(memberId);
        return Ok(new { token });
    }

    [HttpPost("invitations")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GenerateInvitation([FromBody] GenerateInvitationRequest req)
    {
        if (!Enum.TryParse<UserRole>(req.Role, true, out var role))
            return BadRequest(new { message = "Rôle invalide." });

        var user = await authService.GenerateInvitationAsync(req.Email, role, req.MemberId);
        if (user is null) return Conflict(new { message = "Ce membre a déjà un compte actif." });

        var token = user.InvitationToken!;
        var appUrl = req.AppUrl?.TrimEnd('/') ?? "https://mybigfamily.fr";
        var inviteLink = $"{appUrl}/invite/{token}";

        // Send email in background — don't block the response
        _ = emailService.SendInvitationAsync(req.Email, req.FirstName ?? "là", inviteLink, req.FamilyGroupName);

        return Ok(new { token });
    }
}
