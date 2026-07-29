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
    public record MemberInfo(
        Guid Id, string FirstName, string LastName, string? Gender, Guid? FamilyId,
        DateTime? BirthDate, bool IsAlive, string? City, string? Country, string? PostalCode,
        string? ProfilePictureUrl);

    private static readonly HashSet<string> FrenchCountryLabels = new(StringComparer.OrdinalIgnoreCase) { "france" };

    public static DateOnly GetParisToday()
    {
        var tz = TimeZoneInfo.FindSystemTimeZoneById("Europe/Paris");
        var parisNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        return DateOnly.FromDateTime(parisNow);
    }

    // Lundi de la semaine contenant `date` (convention française/ISO 8601 : la semaine commence le lundi).
    private static DateOnly GetStartOfWeek(DateOnly date)
    {
        var daysSinceMonday = ((int)date.DayOfWeek + 6) % 7; // Monday=0 ... Sunday=6
        return date.AddDays(-daysSinceMonday);
    }

    public async Task<DailyChallenge> GetOrCreateTodayChallengeAsync()
    {
        var today = GetParisToday();
        var existing = await db.DailyChallenges.FirstOrDefaultAsync(c => c.Date == today);
        if (existing is not null) return existing;

        // Un membre trop peu renseigné donnerait une grille presque entièrement grise :
        // on exige les 4 attributs comparés (ville, naissance, sexe, famille) pour être réponse possible.
        var eligible = await db.Members
            .Where(m => m.BirthDate != null
                && m.City != null && m.City != ""
                && m.Gender != null && m.Gender != ""
                && m.FamilyId != null)
            .Select(m => m.Id)
            .ToListAsync();
        if (eligible.Count == 0)
            throw new InvalidOperationException("Aucun membre suffisamment renseigné pour le défi du jour.");

        // Anti-répétition remis à zéro chaque lundi (comme le classement de points) : seuls les membres
        // déjà tirés depuis le début de la semaine en cours sont exclus, pas un historique glissant.
        var weekStart = GetStartOfWeek(today);
        var recentIds = (await db.DailyChallenges
                .Where(c => c.Date >= weekStart && c.Date < today)
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

    // Liste en lecture seule des membres ayant déjà une tentative aujourd'hui, avec leur résultat
    // et leur streak. N'appelle jamais GetOrCreateAttemptAsync : consulter cet écran ne doit pas
    // créer de tentative pour l'utilisateur courant.
    public async Task<List<DailyMysteryParticipantDto>> GetTodayParticipantsAsync()
    {
        var challenge = await GetOrCreateTodayChallengeAsync();
        return await GetParticipantsForChallengeAsync(challenge);
    }

    // Résultats de la veille (défi figé, ses points ne peuvent plus bouger) : renvoie null s'il n'y
    // avait pas encore de défi hier (ex. tout premier jour d'utilisation de l'app).
    public async Task<List<DailyMysteryParticipantDto>?> GetYesterdayParticipantsAsync()
    {
        var yesterday = GetParisToday().AddDays(-1);
        var challenge = await db.DailyChallenges.FirstOrDefaultAsync(c => c.Date == yesterday);
        return challenge is null ? null : await GetParticipantsForChallengeAsync(challenge);
    }

    private async Task<List<DailyMysteryParticipantDto>> GetParticipantsForChallengeAsync(DailyChallenge challenge)
    {
        var attempts = await db.DailyChallengeAttempts
            .Where(a => a.DailyChallengeId == challenge.Id)
            .ToListAsync();

        var userIds = attempts.Select(a => a.UserId).ToList();
        var userMembers = await db.Users
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.Member })
            .ToListAsync();

        var participants = new List<DailyMysteryParticipantDto>();
        foreach (var attempt in attempts)
        {
            var um = userMembers.FirstOrDefault(x => x.Id == attempt.UserId);
            if (um is null) continue;

            var guessedIds = JsonSerializer.Deserialize<List<Guid>>(attempt.GuessesJson) ?? [];
            var status = attempt.Solved ? "solved" : "inProgress";
            var (streak, _) = await ComputeStreakAsync(attempt.UserId, challenge.Date);
            int? pointsPreview = attempt.Solved ? PointsForAttempts(guessedIds.Count) : null;

            participants.Add(new DailyMysteryParticipantDto(
                um.Member.Id, um.Member.FirstName, um.Member.LastName, um.Member.ProfilePictureUrl,
                status, guessedIds.Count, streak, pointsPreview));
        }

        return participants
            .OrderBy(p => p.Status switch { "solved" => 0, "inProgress" => 1, _ => 2 })
            .ThenBy(p => p.Status == "solved" ? p.AttemptsUsed : int.MaxValue)
            .ToList();
    }

    // Classement toutes dates confondues (contrairement à GetTodayParticipantsAsync, limité au jour même).
    // Une tentative sans aucun essai (écran juste ouvert) ne compte pas comme "jouée".
    public async Task<List<DailyMysteryLeaderboardEntryDto>> GetAllTimeLeaderboardAsync()
    {
        var attempts = await db.DailyChallengeAttempts.ToListAsync();

        var userIds = attempts.Select(a => a.UserId).Distinct().ToList();
        var memberByUser = (await db.Users
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new { u.Id, u.Member })
                .ToListAsync())
            .ToDictionary(x => x.Id, x => x.Member);

        var stats = new Dictionary<Guid, (int Played, int Solved)>();
        foreach (var attempt in attempts)
        {
            if (!memberByUser.ContainsKey(attempt.UserId)) continue;

            var guessedIds = JsonSerializer.Deserialize<List<Guid>>(attempt.GuessesJson) ?? [];
            if (guessedIds.Count == 0) continue;

            var current = stats.GetValueOrDefault(attempt.UserId, (Played: 0, Solved: 0));
            stats[attempt.UserId] = (current.Played + 1, current.Solved + (attempt.Solved ? 1 : 0));
        }

        return stats
            .Select(kv =>
            {
                var member = memberByUser[kv.Key];
                var (played, solved) = kv.Value;
                return new DailyMysteryLeaderboardEntryDto(
                    member.Id, $"{member.FirstName} {member.LastName}",
                    played, solved, played - solved,
                    played > 0 ? Math.Round(100.0 * solved / played, 1) : 0);
            })
            .OrderByDescending(e => e.WinRate)
            .ThenByDescending(e => e.Wins)
            .ToList();
    }

    // Barème du jour : les points dépendent uniquement du nombre d'essais de CE membre, jamais de ce
    // que font les autres joueurs ce jour-là. Volontaire : ça récompense l'assiduité (jouer tous les
    // jours rapporte mécaniquement plus que bien jouer une seule fois) plutôt que la compétition du jour.
    private const int Tier1Points = 3; // trouvé en 1-2 essais
    private const int Tier2Points = 2; // trouvé en 3-4 essais
    private const int Tier3Points = 1; // trouvé en 5 essais ou plus

    private static int PointsForAttempts(int attemptsUsed) => attemptsUsed switch
    {
        <= 2 => Tier1Points,
        <= 4 => Tier2Points,
        _ => Tier3Points,
    };

    // Classement par points remis à zéro chaque semaine (lundi-dimanche) : ne compte que les jours
    // de la semaine en cours. Comme rien n'est stocké (tout est recalculé à la lecture), le "reset"
    // se fait tout seul dès qu'on change de semaine, sans tâche planifiée ni suppression de données.
    // Le défi du jour en cours est exclu : de nouveaux essais peuvent encore arriver, ses points ne
    // sont pas définitifs tant que le jour n'est pas terminé.
    public async Task<List<DailyMysteryPointsLeaderboardEntryDto>> GetPointsLeaderboardAsync()
    {
        var today = GetParisToday();
        var weekStart = GetStartOfWeek(today);

        var pastChallengeIds = await db.DailyChallenges
            .Where(c => c.Date >= weekStart && c.Date < today)
            .Select(c => c.Id)
            .ToListAsync();

        var solvedAttempts = await db.DailyChallengeAttempts
            .Where(a => a.Solved && pastChallengeIds.Contains(a.DailyChallengeId))
            .ToListAsync();

        var userIds = solvedAttempts.Select(a => a.UserId).Distinct().ToList();
        var memberByUser = (await db.Users
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new { u.Id, u.Member })
                .ToListAsync())
            .ToDictionary(x => x.Id, x => x.Member);

        var points = new Dictionary<Guid, int>();
        var daysWon = new Dictionary<Guid, int>();
        var daysPlayed = new Dictionary<Guid, int>();

        foreach (var group in solvedAttempts.GroupBy(a => a.DailyChallengeId))
        {
            var dayResults = group
                .Where(a => memberByUser.ContainsKey(a.UserId))
                .Select(a => (
                    MemberId: memberByUser[a.UserId].Id,
                    AttemptsUsed: (JsonSerializer.Deserialize<List<Guid>>(a.GuessesJson) ?? []).Count))
                .ToList();
            if (dayResults.Count == 0) continue;

            foreach (var (memberId, attemptsUsed) in dayResults)
            {
                var pts = PointsForAttempts(attemptsUsed);
                points[memberId] = points.GetValueOrDefault(memberId) + pts;
                daysPlayed[memberId] = daysPlayed.GetValueOrDefault(memberId) + 1;
                if (pts == Tier1Points) daysWon[memberId] = daysWon.GetValueOrDefault(memberId) + 1;
            }
        }

        var memberInfoById = memberByUser.Values
            .GroupBy(m => m.Id)
            .ToDictionary(g => g.Key, g => g.First());

        return points
            .Select(kv =>
            {
                var member = memberInfoById[kv.Key];
                return new DailyMysteryPointsLeaderboardEntryDto(
                    member.Id, member.FirstName, member.LastName, member.ProfilePictureUrl,
                    kv.Value, daysWon.GetValueOrDefault(kv.Key), daysPlayed.GetValueOrDefault(kv.Key));
            })
            .OrderByDescending(e => e.TotalPoints)
            .ThenByDescending(e => e.DaysWon)
            .ToList();
    }

    // Classement général (toutes semaines confondues) : une "victoire" = avoir le score de points le
    // plus haut d'une semaine terminée (lundi-dimanche), égalité incluse (tout le monde à égalité
    // gagne 1 victoire ce jour-là). Contrairement à GetPointsLeaderboardAsync, jamais remis à zéro :
    // sert de base au parcours/montagne où chaque membre avance d'un cran par victoire.
    // La semaine en cours est exclue tant qu'elle n'est pas terminée (même raison que GetPointsLeaderboardAsync).
    public async Task<List<DailyMysteryVictoriesDto>> GetVictoriesLeaderboardAsync()
    {
        var today = GetParisToday();
        var currentWeekStart = GetStartOfWeek(today);

        var allAttempts = await db.DailyChallengeAttempts.ToListAsync();
        var userIds = allAttempts.Select(a => a.UserId).Distinct().ToList();
        var memberByUser = (await db.Users
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new { u.Id, u.Member })
                .ToListAsync())
            .ToDictionary(x => x.Id, x => x.Member);

        var challengeDates = await db.DailyChallenges.ToDictionaryAsync(c => c.Id, c => c.Date);

        var pointsByWeek = new Dictionary<DateOnly, Dictionary<Guid, int>>();
        foreach (var attempt in allAttempts)
        {
            if (!attempt.Solved) continue;
            if (!memberByUser.TryGetValue(attempt.UserId, out var member)) continue;
            if (!challengeDates.TryGetValue(attempt.DailyChallengeId, out var date)) continue;

            var weekStart = GetStartOfWeek(date);
            if (weekStart >= currentWeekStart) continue;

            var attemptsUsed = (JsonSerializer.Deserialize<List<Guid>>(attempt.GuessesJson) ?? []).Count;
            var pts = PointsForAttempts(attemptsUsed);

            if (!pointsByWeek.TryGetValue(weekStart, out var weekPoints))
                pointsByWeek[weekStart] = weekPoints = new Dictionary<Guid, int>();
            weekPoints[member.Id] = weekPoints.GetValueOrDefault(member.Id) + pts;
        }

        var victories = new Dictionary<Guid, int>();
        foreach (var weekPoints in pointsByWeek.Values)
        {
            var maxPoints = weekPoints.Values.Max();
            foreach (var (memberId, pts) in weekPoints)
                if (pts == maxPoints) victories[memberId] = victories.GetValueOrDefault(memberId) + 1;
        }

        var memberInfoById = memberByUser.Values
            .GroupBy(m => m.Id)
            .ToDictionary(g => g.Key, g => g.First());

        return memberInfoById.Values
            .Select(m => new DailyMysteryVictoriesDto(
                m.Id, m.FirstName, m.LastName, m.ProfilePictureUrl, victories.GetValueOrDefault(m.Id)))
            .OrderByDescending(e => e.Victories)
            .ToList();
    }

    public async Task<DailyMysteryStateDto> SubmitGuessAsync(Guid userId, Guid memberId)
    {
        if (!await db.Members.AnyAsync(m => m.Id == memberId))
            throw new ArgumentException("Membre introuvable.");

        var challenge = await GetOrCreateTodayChallengeAsync();
        var attempt = await GetOrCreateAttemptAsync(challenge, userId);

        var guessedIds = JsonSerializer.Deserialize<List<Guid>>(attempt.GuessesJson) ?? [];

        if (!attempt.Solved && !guessedIds.Contains(memberId))
        {
            guessedIds.Add(memberId);
            attempt.GuessesJson = JsonSerializer.Serialize(guessedIds);

            if (memberId == challenge.MemberId)
            {
                attempt.Solved = true;
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
            .Select(m => new MemberInfo(m.Id, m.FirstName, m.LastName, m.Gender, m.FamilyId, m.BirthDate, m.IsAlive, m.City, m.Country, m.PostalCode, m.ProfilePictureUrl))
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

        var status = attempt.Solved ? "solved" : "inProgress";

        DailyAnswerDto? answerDto = status == "inProgress"
            ? null
            : new DailyAnswerDto(answer.Id, answer.FirstName, answer.LastName, answer.ProfilePictureUrl, answer.BirthDate, answer.City);

        var (streak, maxStreak) = await ComputeStreakAsync(attempt.UserId, challenge.Date);

        return new DailyMysteryStateDto(status, guessedIds.Count, showBranch, rows, answerDto, streak, maxStreak);
    }

    private static DailyGuessRowDto BuildRow(
        MemberInfo guess, MemberInfo answer, List<RelationshipLabelService.RelationInfo> relations, bool showBranch)
    {
        var generation = BuildGenerationCell(relations, guess.Id, answer.Id);
        var birthYear = BuildNumericCell(guess.BirthDate?.Year, answer.BirthDate?.Year);
        var city = BuildCityCell(guess, answer);
        var gender = BuildGenderCell(guess.Gender, answer.Gender);
        var alive = new DailyGuessCellDto(guess.IsAlive == answer.IsAlive ? "green" : "gray", null);
        DailyGuessCellDto? branch = showBranch ? BuildBranchCell(guess.FamilyId, answer.FamilyId) : null;

        return new DailyGuessRowDto(
            guess.Id, guess.FirstName, guess.LastName, guess.ProfilePictureUrl,
            generation, birthYear, city, gender, branch, alive, guess.Id == answer.Id);
    }

    // Une chaîne vide (ville/genre non renseigné, envoyé "" plutôt que null par le formulaire)
    // ne doit jamais être traitée comme une correspondance valide entre deux membres.
    private static bool Eq(string? a, string? b) =>
        !string.IsNullOrWhiteSpace(a) && !string.IsNullOrWhiteSpace(b) && string.Equals(a, b, StringComparison.OrdinalIgnoreCase);

    private static DailyGuessCellDto BuildNumericCell(int? guessValue, int? answerValue)
    {
        var value = guessValue?.ToString();
        if (guessValue is null || answerValue is null) return new DailyGuessCellDto("unknown", null, value);
        if (guessValue == answerValue) return new DailyGuessCellDto("green", null, value);
        return new DailyGuessCellDto("gray", answerValue > guessValue ? "up" : "down", value);
    }

    private static DailyGuessCellDto BuildGenderCell(string? guessGender, string? answerGender)
    {
        if (string.IsNullOrWhiteSpace(guessGender) || string.IsNullOrWhiteSpace(answerGender))
            return new DailyGuessCellDto("unknown", null);
        return new DailyGuessCellDto(Eq(guessGender, answerGender) ? "green" : "gray", null);
    }

    private static DailyGuessCellDto BuildBranchCell(Guid? guessFamilyId, Guid? answerFamilyId)
    {
        if (guessFamilyId is null || answerFamilyId is null) return new DailyGuessCellDto("unknown", null);
        return new DailyGuessCellDto(guessFamilyId == answerFamilyId ? "green" : "gray", null);
    }

    // "Proche" se base sur le département français (déduit du code postal) plutôt que sur le pays :
    // deux villes du même pays mais à des centaines de km (Lille/Marseille) n'ont rien de proche.
    // Le département n'est calculable qu'en France : hors de France (ou code postal manquant), on ne
    // peut pas dire "Proche", mais on sait déjà que les villes diffèrent (sinon Eq aurait matché) dès
    // qu'elles sont toutes les deux renseignées : "unknown" est réservé au cas où l'une des deux villes
    // est vraiment absente, pas au cas où on ne peut juste pas affiner en "Proche".
    private static DailyGuessCellDto BuildCityCell(MemberInfo guess, MemberInfo answer)
    {
        if (Eq(guess.City, answer.City)) return new DailyGuessCellDto("green", null);
        if (string.IsNullOrWhiteSpace(guess.City) || string.IsNullOrWhiteSpace(answer.City))
            return new DailyGuessCellDto("unknown", null);

        var guessDept = GetFrenchDepartment(guess.Country, guess.PostalCode);
        var answerDept = GetFrenchDepartment(answer.Country, answer.PostalCode);
        if (guessDept is not null && answerDept is not null)
            return new DailyGuessCellDto(guessDept == answerDept ? "yellow" : "gray", null);

        return new DailyGuessCellDto("gray", null);
    }

    // Le code du département est déduit des 2 premiers chiffres du code postal (3 pour les DOM/COM :
    // 971 Guadeloupe, 972 Martinique, ... 988 Nouvelle-Calédonie). Pas besoin d'un référentiel complet
    // des départements/régions : seule l'égalité entre deux membres compte pour ce jeu.
    private static string? GetFrenchDepartment(string? country, string? postalCode)
    {
        if (string.IsNullOrWhiteSpace(country) || !FrenchCountryLabels.Contains(country.Trim())) return null;
        if (string.IsNullOrWhiteSpace(postalCode)) return null;

        var digits = postalCode.Trim();
        if (digits.Length < 2) return null;
        if (digits.Length >= 3 && (digits.StartsWith("97") || digits.StartsWith("98"))) return digits[..3];
        return digits[..2];
    }

    private static DailyGuessCellDto BuildGenerationCell(List<RelationshipLabelService.RelationInfo> relations, Guid guessId, Guid answerId)
    {
        var gap = GetGenerationGap(relations, guessId, answerId);
        if (gap is null) return new DailyGuessCellDto("unknown", null);
        if (gap == 0) return new DailyGuessCellDto("green", null);

        // gap > 0 : la réponse est un descendant du membre proposé (génération plus jeune, donc "en bas" de l'arbre).
        // gap < 0 : la réponse est un ancêtre (génération plus ancienne, donc "en haut" de l'arbre).
        var direction = gap > 0 ? "down" : "up";
        return new DailyGuessCellDto(Math.Abs(gap.Value) == 1 ? "yellow" : "gray", direction);
    }

    // BFS signé sur toutes les relations : +1/-1 en traversant un lien ParentChild (enfant/parent),
    // 0 en traversant conjoint/ex/partenaire/fratrie (même génération). Sans ce dernier cas, deux
    // membres reliés uniquement via un·e conjoint·e (branches rapportées par mariage) n'avaient
    // aucun chemin ParentChild direct et ressortaient "Différent" alors qu'ils sont de la même génération.
    // Renvoie l'écart de génération de toId par rapport à fromId.
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

            var adjacent = relations.Where(r => r.MemberAId == id || r.MemberBId == id);

            foreach (var rel in adjacent)
            {
                var isA = rel.MemberAId == id;
                var nextId = isA ? rel.MemberBId : rel.MemberAId;
                if (visited.Contains(nextId)) continue;

                var nextDepth = rel.Type == RelationType.ParentChild ? depth + (isA ? 1 : -1) : depth;
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
