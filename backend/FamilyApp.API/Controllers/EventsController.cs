using System.Security.Claims;
using FamilyApp.API.Data;
using FamilyApp.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FamilyApp.API.Controllers;

[ApiController]
[Route("api/events")]
[Authorize]
public class EventsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var events = await db.Events.OrderByDescending(e => e.EventDate).ToListAsync();
        return Ok(events);
    }

    [HttpGet("upcoming")]
    public async Task<IActionResult> GetUpcoming([FromQuery] int days = 7)
    {
        var today = DateTime.UtcNow.Date;
        var until = today.AddDays(days);

        // Anniversaires : membres vivants dont l'anniversaire tombe dans la fenêtre
        var birthdays = await db.Members
            .Where(m => m.IsAlive && m.BirthDate != null)
            .ToListAsync();

        var upcoming = birthdays
            .Where(m =>
            {
                var bday = new DateTime(today.Year, m.BirthDate!.Value.Month, m.BirthDate.Value.Day);
                if (bday < today) bday = bday.AddYears(1);
                return bday <= until;
            })
            .Select(m => new
            {
                Id = m.Id,
                Title = $"Anniversaire de {m.FirstName} {m.LastName}",
                EventDate = new DateTime(today.Year, m.BirthDate!.Value.Month, m.BirthDate.Value.Day),
                Type = "Birthday"
            })
            .OrderBy(e => e.EventDate)
            .ToList();

        return Ok(upcoming);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var ev = await db.Events.FindAsync(id);
        return ev is null ? NotFound() : Ok(ev);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Member")]
    public async Task<IActionResult> Create([FromBody] CreateEventRequest req)
    {
        if (!Enum.TryParse<EventType>(req.Type, true, out var type))
            return BadRequest(new { message = "Type d'événement invalide." });

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await db.Users.FindAsync(userId);
        if (user is null) return Unauthorized();

        var ev = new Event
        {
            Title = req.Title,
            Description = req.Description,
            EventDate = req.EventDate,
            Type = type,
            CreatedById = user.MemberId
        };

        db.Events.Add(ev);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = ev.Id }, ev);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] CreateEventRequest req)
    {
        var ev = await db.Events.FindAsync(id);
        if (ev is null) return NotFound();
        if (!Enum.TryParse<EventType>(req.Type, true, out var type))
            return BadRequest();

        ev.Title = req.Title;
        ev.Description = req.Description;
        ev.EventDate = req.EventDate;
        ev.Type = type;
        await db.SaveChangesAsync();
        return Ok(ev);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var ev = await db.Events.FindAsync(id);
        if (ev is null) return NotFound();
        db.Events.Remove(ev);
        await db.SaveChangesAsync();
        return NoContent();
    }
}

public record CreateEventRequest(string Title, string? Description, DateTime EventDate, string Type);
