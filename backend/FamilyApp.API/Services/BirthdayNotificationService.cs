using FamilyApp.API.Data;
using Microsoft.EntityFrameworkCore;

namespace FamilyApp.API.Services;

public class BirthdayNotificationService(IServiceScopeFactory scopeFactory) : BackgroundService
{
    private static readonly TimeZoneInfo Paris = TimeZoneInfo.FindSystemTimeZoneById("Europe/Paris");

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var nowParis = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Paris);
            var nextRunParis = nowParis.Date.AddHours(8);
            if (nowParis >= nextRunParis) nextRunParis = nextRunParis.AddDays(1);

            var nextRunUtc = TimeZoneInfo.ConvertTimeToUtc(nextRunParis, Paris);
            await Task.Delay(nextRunUtc - DateTime.UtcNow, stoppingToken).ConfigureAwait(false);
            if (stoppingToken.IsCancellationRequested) break;

            await SendBirthdayNotificationsAsync();
        }
    }

    private async Task SendBirthdayNotificationsAsync()
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var pushService = scope.ServiceProvider.GetRequiredService<PushNotificationService>();

        var today = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Paris);

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
