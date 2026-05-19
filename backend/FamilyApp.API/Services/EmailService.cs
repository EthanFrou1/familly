using System.Text.Json;

namespace FamilyApp.API.Services;

public class EmailService(IHttpClientFactory http, IConfiguration config, ILogger<EmailService> logger)
{
    public async Task SendInvitationAsync(
        string toEmail,
        string firstName,
        string inviteLink,
        string? familyGroupName)
    {
        var apiKey      = config["Brevo:ApiKey"];
        var fromEmail   = config["Brevo:FromAddress"] ?? "bonjour@mybigfamily.fr";
        var fromName    = config["Brevo:FromName"] ?? "MyBigFamily";

        if (string.IsNullOrEmpty(apiKey))
        {
            logger.LogWarning("Brevo API key not set — invitation email skipped for {Email}", toEmail);
            return;
        }

        var subject = familyGroupName is not null
            ? $"Invitation à rejoindre la Famille {familyGroupName}"
            : "Invitation à rejoindre MyBigFamily";

        var greeting = familyGroupName is not null
            ? $"Tu es invité(e) à rejoindre la Famille <strong>{familyGroupName}</strong> sur MyBigFamily."
            : "Tu es invité(e) à rejoindre notre espace famille sur MyBigFamily.";

        var greetingText = familyGroupName is not null
            ? $"Tu es invité(e) à rejoindre la Famille {familyGroupName} sur MyBigFamily."
            : "Tu es invité(e) à rejoindre notre espace famille sur MyBigFamily.";

        var html = $"""
            <!DOCTYPE html>
            <html lang="fr">
            <head><meta charset="UTF-8"/></head>
            <body style="font-family:system-ui,sans-serif;background:#FAF7F2;margin:0;padding:0">
              <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
                <div style="background:#947762;padding:32px 24px;text-align:center">
                  <h1 style="color:#fff;margin:0;font-size:24px;font-weight:900">MyBigFamily</h1>
                  <p style="color:rgba(255,255,255,0.75);margin:8px 0 0;font-size:14px">Votre histoire familiale, au même endroit.</p>
                </div>
                <div style="padding:32px 24px">
                  <p style="color:#333;font-size:16px;margin:0 0 8px">Bonjour {firstName} 👋</p>
                  <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px">{greeting}</p>
                  <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px">
                    Clique sur le bouton ci-dessous pour créer ton compte&nbsp;:
                  </p>
                  <a href="{inviteLink}"
                     style="display:block;text-align:center;background:#A87048;color:#fff;font-weight:700;font-size:15px;padding:14px 24px;border-radius:12px;text-decoration:none;margin-bottom:24px">
                    Créer mon compte →
                  </a>
                  <p style="color:#aaa;font-size:11px;word-break:break-all;margin:0">
                    Lien alternatif&nbsp;: <a href="{inviteLink}" style="color:#A87048">{inviteLink}</a>
                  </p>
                </div>
                <div style="padding:16px 24px;border-top:1px solid #f0f0f0;text-align:center">
                  <p style="color:#bbb;font-size:11px;margin:0">MyBigFamily · Accès sur invitation uniquement</p>
                </div>
              </div>
            </body>
            </html>
            """;

        var textContent = $"""
            Bonjour {firstName},

            {greetingText}

            Crée ton compte en cliquant sur ce lien :
            {inviteLink}

            — L'équipe MyBigFamily
            """;

        var payload = new
        {
            sender      = new { name = fromName, email = fromEmail },
            to          = new[] { new { email = toEmail, name = firstName } },
            replyTo     = new { email = fromEmail, name = fromName },
            subject,
            htmlContent = html,
            textContent,
        };

        try
        {
            var client = http.CreateClient();
            client.DefaultRequestHeaders.Add("api-key", apiKey);
            client.DefaultRequestHeaders.Add("Accept", "application/json");

            var response = await client.PostAsJsonAsync("https://api.brevo.com/v3/smtp/email", payload);
            var body     = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                using var doc = JsonDocument.Parse(body);
                var id = doc.RootElement.GetProperty("messageId").GetString();
                logger.LogInformation("Invitation email sent to {Email} — brevo id={Id}", toEmail, id);
            }
            else
            {
                logger.LogError("Brevo error {Status} for {Email}: {Body}", (int)response.StatusCode, toEmail, body);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Exception sending invitation email to {Email}", toEmail);
        }
    }
}
