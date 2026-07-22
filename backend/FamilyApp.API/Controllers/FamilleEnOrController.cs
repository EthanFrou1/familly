using System.Security.Claims;
using FamilyApp.API.Data;
using FamilyApp.API.DTOs;
using FamilyApp.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FamilyApp.API.Controllers;

[ApiController]
[Route("api/famille-en-or")]
[Authorize]
public class FamilleEnOrController(AppDbContext db, FamilleEnOrService service) : ControllerBase
{
    private async Task<Guid> GetCurrentMemberIdAsync()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await db.Users.FindAsync(userId);
        return user!.MemberId;
    }

    [HttpGet("questions")]
    public async Task<IActionResult> GetQuestions()
    {
        var memberId = await GetCurrentMemberIdAsync();
        return Ok(await service.GetQuestionsAsync(memberId));
    }

    [HttpPost("questions/{key}/answer")]
    public async Task<IActionResult> SubmitAnswer(string key, FamilleEnOrAnswerRequestDto dto)
    {
        var memberId = await GetCurrentMemberIdAsync();
        try
        {
            await service.SubmitAnswerAsync(memberId, key, dto.Text);
            return Ok();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("admin/questions/{key}/answers")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAdminQuestionDetail(string key)
    {
        try
        {
            return Ok(await service.GetAdminQuestionDetailAsync(key));
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    [HttpPost("admin/questions/{key}/groups")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateGroup(string key, FamilleEnOrCreateGroupRequestDto dto)
    {
        var groupId = await service.CreateGroupAsync(key, dto.AnswerIds, dto.Label);
        return Ok(new { id = groupId });
    }

    [HttpPut("admin/groups/{groupId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateGroup(Guid groupId, FamilleEnOrUpdateGroupRequestDto dto)
    {
        try
        {
            await service.UpdateGroupAsync(groupId, dto.Label, dto.AnswerIds);
            return Ok();
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    [HttpDelete("admin/answers/{answerId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteAnswer(Guid answerId)
    {
        await service.DeleteAnswerAsync(answerId);
        return Ok();
    }

    [HttpPost("admin/questions/{key}/ready")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> MarkReady(string key)
    {
        try
        {
            await service.MarkReadyAsync(key);
            return Ok();
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    [HttpPost("admin/questions/{key}/unready")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> MarkUnready(string key)
    {
        await service.MarkUnreadyAsync(key);
        return Ok();
    }
}
