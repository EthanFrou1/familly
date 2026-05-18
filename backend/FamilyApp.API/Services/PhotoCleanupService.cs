using FamilyApp.API.Data;
using Microsoft.EntityFrameworkCore;

namespace FamilyApp.API.Services;

public class PhotoCleanupService(IServiceScopeFactory scopeFactory, ILogger<PhotoCleanupService> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var now = DateTime.UtcNow;
            var nextRun = now.Date.AddDays(1).AddHours(0); // minuit
            var delay = nextRun - now;
            await Task.Delay(delay, stoppingToken);

            await CleanupExpiredPhotosAsync(stoppingToken);
        }
    }

    private async Task CleanupExpiredPhotosAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var cloudinary = scope.ServiceProvider.GetRequiredService<CloudinaryService>();

        var expired = await db.Photos
            .Where(p => p.ExpiresAt != null && p.ExpiresAt < DateTime.UtcNow)
            .ToListAsync(ct);

        logger.LogInformation("Suppression de {Count} photos expirées", expired.Count);

        foreach (var photo in expired)
        {
            try
            {
                await cloudinary.DeleteAsync(photo.CloudinaryPublicId);
                db.Photos.Remove(photo);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Erreur suppression photo {Id}", photo.Id);
            }
        }

        await db.SaveChangesAsync(ct);
    }
}
