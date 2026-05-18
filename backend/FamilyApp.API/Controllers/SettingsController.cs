using FamilyApp.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FamilyApp.API.Controllers;

[ApiController]
[Route("api/settings")]
[Authorize]
public class SettingsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var s = await db.AppSettings.FindAsync(1);
        return Ok(new { familyGroupName = s?.FamilyGroupName });
    }

    [HttpPut]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update([FromBody] UpdateSettingsRequest req)
    {
        var s = await db.AppSettings.FindAsync(1);
        if (s is null) return NotFound();
        s.FamilyGroupName = string.IsNullOrWhiteSpace(req.FamilyGroupName) ? null : req.FamilyGroupName.Trim();
        await db.SaveChangesAsync();
        return Ok(new { familyGroupName = s.FamilyGroupName });
    }
}

public record UpdateSettingsRequest(string? FamilyGroupName);
