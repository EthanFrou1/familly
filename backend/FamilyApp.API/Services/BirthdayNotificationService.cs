using FamilyApp.API.Data;
using Microsoft.EntityFrameworkCore;

namespace FamilyApp.API.Services;

public class BirthdayNotificationService(IServiceScopeFactory scopeFactory) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var now = DateTime.UtcNow;
            var nextRun = DateTime.UtcNow.Date.AddHours(8); // 8h UTC
            if (now >= nextRun) nextRun = nextRun.AddDays(1);

            await Task.Delay(nextRun - now, stoppingToken).ConfigureAwait(false);
            if (stoppingToken.IsCancellationRequested) break;

            await SendBirthdayNotificationsAsync();
        }
    }

    private async Task SendBirthdayNotificationsAsync()
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var pushService = scope.ServiceProvider.GetRequiredService<PushNotificationService>();

        var today = DateTime.UtcNow;

        var members = await db.Members
            .Where(m => m.BirthDate.HasValue
                     && m.BirthDate.Value.Month == today.Month
                     && m.BirthDate.Value.Day == today.Day
                     && m.IsAlive)
            .ToListAsync();

        foreach (var member in members)
        {
            var age = today.Year - member.BirthDate!.Value.Year;
            await pushService.SendToAllAsync(
                "🎂 Anniversaire !",
                $"C'est le grand jour pour {member.FirstName} {member.LastName} — {age} ans aujourd'hui !",
                $"/profile/{member.Id}"
            );
        }
    }
}
