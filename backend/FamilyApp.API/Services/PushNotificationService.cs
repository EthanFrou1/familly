using System.Text.Json;
using FamilyApp.API.Data;
using Microsoft.EntityFrameworkCore;
using WebPush;

namespace FamilyApp.API.Services;

public class PushNotificationService(AppDbContext db, IConfiguration config)
{
    private readonly VapidDetails _vapid = new(
        config["Push:Subject"]!,
        config["Push:PublicKey"]!,
        config["Push:PrivateKey"]!
    );

    public Task SendToAllAsync(string title, string body, string url = "/")
        => SendAsync(null, title, body, url, standaloneOnly: false);

    public Task SendToUsersAsync(List<Guid> userIds, string title, string body, string url = "/", bool standaloneOnly = false)
        => SendAsync(userIds, title, body, url, standaloneOnly);

    private async Task SendAsync(List<Guid>? userIds, string title, string body, string url, bool standaloneOnly)
    {
        var query = db.PushSubscriptions.AsNoTracking();
        if (userIds != null) query = query.Where(s => userIds.Contains(s.UserId));
        if (standaloneOnly) query = query.Where(s => s.IsStandalone);
        var subscriptions = await query.ToListAsync();
        if (subscriptions.Count == 0) return;

        var client = new WebPushClient();
        var payload = JsonSerializer.Serialize(new { title, body, url });
        var toRemove = new List<int>();

        foreach (var sub in subscriptions)
        {
            try
            {
                var pushSub = new PushSubscription(sub.Endpoint, sub.P256dh, sub.Auth);
                await client.SendNotificationAsync(pushSub, payload, _vapid);
            }
            catch (WebPushException ex) when (ex.StatusCode == System.Net.HttpStatusCode.Gone
                                           || ex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                toRemove.Add(sub.Id);
            }
            catch { /* réseau ou autre erreur transitoire */ }
        }

        if (toRemove.Count > 0)
            await db.PushSubscriptions.Where(s => toRemove.Contains(s.Id)).ExecuteDeleteAsync();
    }
}
