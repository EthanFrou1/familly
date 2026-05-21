using System.Globalization;
using System.Text;
using System.Text.Json;
using FamilyApp.API.Data;
using FamilyApp.API.DTOs;
using FamilyApp.API.Models;
using Microsoft.EntityFrameworkCore;

namespace FamilyApp.API.Services;

public class DuplicateDetectionService(AppDbContext db)
{
    private record MemberProjection(
        Guid Id, string FirstName, string LastName,
        string? Email, string? Phone, DateTime? BirthDate
    );

    public async Task<List<DuplicateCandidateDto>> ScanAndGetOpenAsync()
    {
        var members = await db.Members
            .Select(m => new MemberProjection(
                m.Id, m.FirstName, m.LastName, m.Email, m.Phone, m.BirthDate))
            .ToListAsync();

        var existing = await db.DuplicateCandidates
            .ToDictionaryAsync(c => PairKey(c.MemberAId, c.MemberBId));

        var toAdd = new List<DuplicateCandidate>();
        var toUpdate = new List<DuplicateCandidate>();

        for (int i = 0; i < members.Count; i++)
        {
            for (int j = i + 1; j < members.Count; j++)
            {
                var a = members[i];
                var b = members[j];

                var (confidence, reasons) = DetectPair(a, b);
                if (confidence is null) continue;

                var (aId, bId) = a.Id.CompareTo(b.Id) < 0 ? (a.Id, b.Id) : (b.Id, a.Id);
                var key = PairKey(aId, bId);
                var reasonsJson = JsonSerializer.Serialize(reasons);

                if (existing.TryGetValue(key, out var candidate))
                {
                    if (candidate.Status != "Open") continue; // respect admin decision
                    if (candidate.Confidence != confidence || candidate.Reasons != reasonsJson)
                    {
                        candidate.Confidence = confidence;
                        candidate.Reasons = reasonsJson;
                        toUpdate.Add(candidate);
                    }
                }
                else
                {
                    toAdd.Add(new DuplicateCandidate
                    {
                        MemberAId = aId,
                        MemberBId = bId,
                        Confidence = confidence,
                        Reasons = reasonsJson,
                    });
                }
            }
        }

        if (toAdd.Count > 0) db.DuplicateCandidates.AddRange(toAdd);
        if (toAdd.Count > 0 || toUpdate.Count > 0) await db.SaveChangesAsync();

        var openCandidates = await db.DuplicateCandidates
            .Where(c => c.Status == "Open")
            .Include(c => c.MemberA)
            .Include(c => c.MemberB)
            .OrderBy(c => c.Confidence == "fort" ? 0 : c.Confidence == "probable" ? 1 : 2)
            .ThenByDescending(c => c.CreatedAt)
            .ToListAsync();

        return openCandidates.Select(ToDto).ToList();
    }

    private static (string? confidence, List<string> reasons) DetectPair(
        MemberProjection a, MemberProjection b)
    {
        var reasons = new List<string>();
        string? confidence = null;

        // Same email
        if (!string.IsNullOrWhiteSpace(a.Email) && !string.IsNullOrWhiteSpace(b.Email) &&
            NormalizeEmail(a.Email) == NormalizeEmail(b.Email))
        {
            reasons.Add("same_email");
            confidence = "fort";
        }

        // Same phone
        var phoneA = NormalizePhone(a.Phone);
        var phoneB = NormalizePhone(b.Phone);
        if (phoneA.Length >= 7 && phoneA == phoneB)
        {
            reasons.Add("same_phone");
            if (confidence == null) confidence = "fort";
        }

        // Name comparison
        var nameA = NormalizeName($"{a.FirstName} {a.LastName}");
        var nameB = NormalizeName($"{b.FirstName} {b.LastName}");

        if (nameA == nameB)
        {
            reasons.Add("same_name");

            if (a.BirthDate.HasValue && b.BirthDate.HasValue &&
                a.BirthDate.Value.Date == b.BirthDate.Value.Date)
            {
                reasons.Add("same_birthdate");
                confidence = "fort";
            }
            else if (confidence == null)
            {
                confidence = "probable";
            }
        }
        else
        {
            // Check similar names: same last name + similar first name (shared prefix ≥ 3 chars)
            var lastA = NormalizeName(a.LastName);
            var lastB = NormalizeName(b.LastName);
            var firstA = NormalizeName(a.FirstName);
            var firstB = NormalizeName(b.FirstName);

            if (lastA == lastB && firstA.Length >= 3 && firstB.Length >= 3)
            {
                var prefixLen = Math.Min(firstA.Length, firstB.Length);
                var shared = Enumerable.Range(1, prefixLen)
                    .TakeWhile(n => firstA[..n] == firstB[..n])
                    .LastOrDefault();

                if (shared >= 3)
                {
                    reasons.Add("similar_name");
                    if (confidence == null) confidence = "faible";
                }
            }
        }

        return (confidence, reasons);
    }

    public static string NormalizeName(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return "";
        s = s.Trim().ToLowerInvariant();
        var normalized = s.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (char c in normalized)
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        // Collapse multiple spaces
        var result = sb.ToString().Normalize(NormalizationForm.FormC);
        return string.Join(' ', result.Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    private static string NormalizeEmail(string? s) =>
        s?.Trim().ToLowerInvariant() ?? "";

    private static string NormalizePhone(string? s) =>
        s is null ? "" : new string(s.Where(char.IsDigit).ToArray());

    private static string PairKey(Guid a, Guid b) =>
        a.CompareTo(b) < 0 ? $"{a}:{b}" : $"{b}:{a}";

    private static DuplicateCandidateDto ToDto(DuplicateCandidate c) => new(
        c.Id,
        new DuplicateMemberDto(c.MemberA.Id, c.MemberA.FirstName, c.MemberA.LastName,
            c.MemberA.ProfilePictureUrl, c.MemberA.Email, c.MemberA.Phone, c.MemberA.BirthDate),
        new DuplicateMemberDto(c.MemberB.Id, c.MemberB.FirstName, c.MemberB.LastName,
            c.MemberB.ProfilePictureUrl, c.MemberB.Email, c.MemberB.Phone, c.MemberB.BirthDate),
        c.Confidence,
        JsonSerializer.Deserialize<List<string>>(c.Reasons) ?? [],
        c.Status,
        c.CreatedAt
    );
}
