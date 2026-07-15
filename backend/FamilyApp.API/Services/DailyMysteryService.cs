using System.Text.Json;
using FamilyApp.API.Data;
using FamilyApp.API.DTOs;
using FamilyApp.API.Models;
using FamilyApp.API.Realtime;
using Microsoft.EntityFrameworkCore;

namespace FamilyApp.API.Services;

// "Le Mystère du jour" : jeu quotidien façon Wordle où toute la famille devine le même membre
// mystère du jour, en comparant génération/âge/ville/sexe/branche/statut à chaque essai.
// Comme WhoAmIRoundGenerator, le membre réponse n'est jamais exposé avant résolution/échec.
public class DailyMysteryService(AppDbContext db)
{
    public const int MaxAttempts = 15;
    private const int AvoidRepeatDays = 20;

    public record MemberInfo(
        Guid Id, string FirstName, string LastName, string? Gender, Guid? FamilyId,
        DateTime? BirthDate, bool IsAlive, string? City, string? Country, string? ProfilePictureUrl);

    public static DateOnly GetParisToday()
    {
        var tz = TimeZoneInfo.FindSystemTimeZoneById("Europe/Paris");
        var parisNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        return DateOnly.FromDateTime(parisNow);
    }

    public async Task<DailyChallenge> GetOrCreateTodayChallengeAsync()
    {
        var today = GetParisToday();
        var existing = await db.DailyChallenges.FirstOrDefaultAsync(c => c.Date == today);
        if (existing is not null) return existing;

        // Un membre trop peu renseigné donnerait une grille presque entièrement grise :
        // on exige la date de naissance (colonne Naissance) + au moins un autre attribut distinctif.
        var eligible = await db.Members
            .Where(m => m.BirthDate != null && (m.City != null || m.Gender != null))
            .Select(m => m.Id)
            .ToListAsync();
        if (eligible.Count == 0)
            throw new InvalidOperationException("Aucun membre suffisamment renseigné pour le défi du jour.");

        var recentCount = Math.Min(AvoidRepeatDays, eligible.Count - 1);
        var recentIds = (await db.DailyChallenges
                .OrderByDescending(c => c.Date)
                .Take(recentCount)
                .Select(c => c.MemberId)
                .ToListAsync())
            .ToHashSet();

        var pool = eligible.Where(id => !recentIds.Contains(id)).ToList();
        if (pool.Count == 0) pool = eligible;

        var challenge = new DailyChallenge { Date = today, MemberId = pool[Random.Shared.Next(pool.Count)] };
        db.DailyChallenges.Add(challenge);

        try
        {
            await db.SaveChangesAsync();
            return challenge;
        }
        catch (DbUpdateException)
        {
            // Un autre thread a créé le challenge du jour entre-temps (contrainte d'unicité sur Date).
            return await db.DailyChallenges.FirstAsync(c => c.Date == today);
        }
    }

    public async Task<DailyChallengeAttempt> GetOrCreateAttemptAsync(DailyChallenge challenge, Guid userId)
    {
        var existing = await db.DailyChallengeAttempts
            .FirstOrDefaultAsync(a => a.DailyChallengeId == challenge.Id && a.UserId == userId);
        if (existing is not null) return existing;

        var attempt = new DailyChallengeAttempt { DailyChallengeId = challenge.Id, UserId = userId };
        db.DailyChallengeAttempts.Add(attempt);

        try
        {
            await db.SaveChangesAsync();
            return attempt;
        }
        catch (DbUpdateException)
        {
            return await db.DailyChallengeAttempts.FirstAsync(a => a.DailyChallengeId == challenge.Id && a.UserId == userId);
        }
    }

    public async Task<DailyMysteryStateDto> SubmitGuessAsync(Guid userId, Guid memberId)
    {
        if (!await db.Members.AnyAsync(m => m.Id == memberId))
            throw new ArgumentException("Membre introuvable.");

        var challenge = await GetOrCreateTodayChallengeAsync();
        var attempt = await GetOrCreateAttemptAsync(challenge, userId);

        var guessedIds = JsonSerializer.Deserialize<List<Guid>>(attempt.GuessesJson) ?? [];

        if (!attempt.Solved && guessedIds.Count < MaxAttempts && !guessedIds.Contains(memberId))
        {
            guessedIds.Add(memberId);
            attempt.GuessesJson = JsonSerializer.Serialize(guessedIds);

            if (memberId == challenge.MemberId)
            {
                attempt.Solved = true;
                attempt.CompletedAt = DateTime.UtcNow;
            }
            else if (guessedIds.Count >= MaxAttempts)
            {
                attempt.CompletedAt = DateTime.UtcNow;
            }

            await db.SaveChangesAsync();
        }

        return await BuildStateAsync(challenge, attempt);
    }

    public async Task<DailyMysteryStateDto> BuildStateAsync(DailyChallenge challenge, DailyChallengeAttempt attempt)
    {
        var guessedIds = JsonSerializer.Deserialize<List<Guid>>(attempt.GuessesJson) ?? [];

        var members = await db.Members
            .Select(m => new MemberInfo(m.Id, m.FirstName, m.LastName, m.Gender, m.FamilyId, m.BirthDate, m.IsAlive, m.City, m.Country, m.ProfilePictureUrl))
            .ToListAsync();
        var memberMap = members.ToDictionary(m => m.Id);

        var relations = await db.Relations
            .Select(r => new RelationshipLabelService.RelationInfo(r.MemberAId, r.MemberBId, r.Type))
            .ToListAsync();

        var answer = memberMap[challenge.MemberId];
        var showBranch = members
            .Where(m => m.FamilyId is not null)
            .Select(m => m.FamilyId)
            .Distinct()
            .Count() > 1;

        var rows = guessedIds
            .Where(memberMap.ContainsKey)
            .Select(id => BuildRow(memberMap[id], answer, relations, showBranch))
            .ToList();

        var status = attempt.Solved ? "solved" : guessedIds.Count >= MaxAttempts ? "failed" : "inProgress";

        DailyAnswerDto? answerDto = status == "inProgress"
            ? null
            : new DailyAnswerDto(answer.Id, answer.FirstName, answer.LastName, answer.ProfilePictureUrl, answer.BirthDate, answer.City);

        var (streak, maxStreak) = await ComputeStreakAsync(attempt.UserId, challenge.Date);

        return new DailyMysteryStateDto(status, guessedIds.Count, MaxAttempts - guessedIds.Count, showBranch, rows, answerDto, streak, maxStreak);
    }

    private static DailyGuessRowDto BuildRow(
        MemberInfo guess, MemberInfo answer, List<RelationshipLabelService.RelationInfo> relations, bool showBranch)
    {
        var generation = BuildGenerationCell(relations, guess.Id, answer.Id);
        var birthYear = BuildNumericCell(guess.BirthDate?.Year, answer.BirthDate?.Year);
        var city = BuildCityCell(guess.City, guess.Country, answer.City, answer.Country);
        var gender = new DailyGuessCellDto(Eq(guess.Gender, answer.Gender) ? "green" : "gray", null);
        var alive = new DailyGuessCellDto(guess.IsAlive == answer.IsAlive ? "green" : "gray", null);
        DailyGuessCellDto? branch = showBranch
            ? new DailyGuessCellDto(guess.FamilyId == answer.FamilyId ? "green" : "gray", null)
            : null;

        return new DailyGuessRowDto(
            guess.Id, guess.FirstName, guess.LastName, guess.ProfilePictureUrl,
            generation, birthYear, city, gender, branch, alive, guess.Id == answer.Id);
    }

    private static bool Eq(string? a, string? b) =>
        a is not null && b is not null && string.Equals(a, b, StringComparison.OrdinalIgnoreCase);

    private static DailyGuessCellDto BuildNumericCell(int? guessValue, int? answerValue)
    {
        var value = guessValue?.ToString();
        if (guessValue is null || answerValue is null) return new DailyGuessCellDto("gray", null, value);
        if (guessValue == answerValue) return new DailyGuessCellDto("green", null, value);
        return new DailyGuessCellDto("gray", answerValue > guessValue ? "up" : "down", value);
    }

    private static DailyGuessCellDto BuildCityCell(string? guessCity, string? guessCountry, string? answerCity, string? answerCountry)
    {
        if (Eq(guessCity, answerCity)) return new DailyGuessCellDto("green", null);
        if (Eq(guessCountry, answerCountry)) return new DailyGuessCellDto("yellow", null);
        return new DailyGuessCellDto("gray", null);
    }

    private static DailyGuessCellDto BuildGenerationCell(List<RelationshipLabelService.RelationInfo> relations, Guid guessId, Guid answerId)
    {
        var gap = GetGenerationGap(relations, guessId, answerId);
        if (gap is null) return new DailyGuessCellDto("gray", null);
        if (gap == 0) return new DailyGuessCellDto("green", null);

        var direction = gap > 0 ? "up" : "down";
        return new DailyGuessCellDto(Math.Abs(gap.Value) == 1 ? "yellow" : "gray", direction);
    }

    // BFS signé sur les relations ParentChild uniquement : +1 en descendant vers un enfant,
    // -1 en remontant vers un parent. Renvoie l'écart de génération de toId par rapport à fromId.
    private static int? GetGenerationGap(List<RelationshipLabelService.RelationInfo> relations, Guid fromId, Guid toId)
    {
        if (fromId == toId) return 0;

        var visited = new HashSet<Guid> { fromId };
        var queue = new Queue<(Guid Id, int Depth)>();
        queue.Enqueue((fromId, 0));

        while (queue.Count > 0)
        {
            var (id, depth) = queue.Dequeue();
            if (Math.Abs(depth) >= 8) continue;

            var adjacent = relations.Where(r => r.Type == RelationType.ParentChild && (r.MemberAId == id || r.MemberBId == id));

            foreach (var rel in adjacent)
            {
                var isA = rel.MemberAId == id;
                var nextId = isA ? rel.MemberBId : rel.MemberAId;
                if (visited.Contains(nextId)) continue;

                var nextDepth = depth + (isA ? 1 : -1);
                if (nextId == toId) return nextDepth;

                visited.Add(nextId);
                queue.Enqueue((nextId, nextDepth));
            }
        }

        return null;
    }

    private async Task<(int Streak, int MaxStreak)> ComputeStreakAsync(Guid userId, DateOnly uptoDate)
    {
        var solvedDates = (await db.DailyChallengeAttempts
                .Where(a => a.UserId == userId && a.Solved)
                .Join(db.DailyChallenges, a => a.DailyChallengeId, c => c.Id, (a, c) => c.Date)
                .ToListAsync())
            .ToHashSet();

        if (solvedDates.Count == 0) return (0, 0);

        var streak = 0;
        var cursor = solvedDates.Contains(uptoDate) ? uptoDate : uptoDate.AddDays(-1);
        while (solvedDates.Contains(cursor))
        {
            streak++;
            cursor = cursor.AddDays(-1);
        }

        var maxStreak = 0;
        var current = 0;
        DateOnly? previous = null;
        foreach (var date in solvedDates.OrderBy(d => d))
        {
            current = previous is not null && date == previous.Value.AddDays(1) ? current + 1 : 1;
            maxStreak = Math.Max(maxStreak, current);
            previous = date;
        }

        return (streak, maxStreak);
    }
}
