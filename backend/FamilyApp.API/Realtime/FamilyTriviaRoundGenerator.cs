using System.Globalization;

namespace FamilyApp.API.Realtime;

// Génère les rounds du "Quiz Famille" (QCM façon Kahoot) à partir des infos des membres. Comme
// QuizQuestionGenerator, tout se fait côté serveur pour que CorrectKey ne soit jamais visible côté
// client avant résolution du round.
public static class FamilyTriviaRoundGenerator
{
    private const int OptionsPerQuestion = 4;
    private static readonly CultureInfo FrenchCulture = CultureInfo.GetCultureInfo("fr-FR");

    public record MemberInfo(Guid Id, string FirstName, string LastName, string? Gender, Guid? FamilyId, DateTime? BirthDate, string? City, string? Phone);

    public static List<SimRound> Build(List<MemberInfo> members, int roundCount, List<string> categories)
    {
        var rounds = new List<SimRound>();
        if (roundCount <= 0 || categories.Count == 0) return rounds;

        var eligibleCategories = categories.Where(c => IsCategoryEligible(c, members)).ToList();
        if (eligibleCategories.Count == 0) return rounds;

        // Clé = "{catégorie}-{cible ou paire}" : empêche de reposer la même question dans la
        // même partie tout en laissant chaque catégorie piocher parmi ses propres cibles.
        var usedKeys = new HashSet<string>();
        var maxAttempts = roundCount * 40;

        for (var attempts = 0; rounds.Count < roundCount && attempts < maxAttempts; attempts++)
        {
            var category = eligibleCategories[Random.Shared.Next(eligibleCategories.Count)];
            var round = category switch
            {
                "birthdate" => BuildBirthdateRound(members, usedKeys),
                "birth_day" => BuildBirthDayRound(members, usedKeys),
                "city" => BuildFieldRound(members, usedKeys, "city", m => m.City, m => $"Où habite {m.FirstName} {m.LastName} ?"),
                "phone" => BuildFieldRound(members, usedKeys, "phone", m => m.Phone, m => $"Quel est le numéro de {m.FirstName} {m.LastName} ?"),
                "birth_order" => BuildBirthOrderRound(members, usedKeys),
                _ => null,
            };
            if (round is not null) rounds.Add(round);
        }

        return rounds;
    }

    private static bool IsCategoryEligible(string category, List<MemberInfo> members) => category switch
    {
        "birthdate" => members.Count(m => m.BirthDate.HasValue) >= OptionsPerQuestion,
        // Les leurres sont des numéros de jour au hasard (pas des vraies données d'autres
        // membres) : une seule personne avec une date de naissance suffit à poser la question.
        "birth_day" => members.Count(m => m.BirthDate.HasValue) >= 1,
        "city" => members.Count(m => !string.IsNullOrWhiteSpace(m.City)) >= OptionsPerQuestion,
        "phone" => members.Count(m => !string.IsNullOrWhiteSpace(m.Phone)) >= OptionsPerQuestion,
        "birth_order" => members.Count(m => m.BirthDate.HasValue) >= 2,
        _ => false,
    };

    private static SimRound? BuildFieldRound(List<MemberInfo> members, HashSet<string> usedKeys, string category, Func<MemberInfo, string?> field, Func<MemberInfo, string> prompt)
    {
        var pool = members.Where(m => !string.IsNullOrWhiteSpace(field(m))).ToList();
        if (pool.Count < OptionsPerQuestion) return null;

        foreach (var target in Shuffle(pool).Where(m => !usedKeys.Contains($"{category}-{m.Id}")))
        {
            var targetLabel = field(target)!;
            var distractorLabels = Shuffle(pool.Where(m => m.Id != target.Id).ToList())
                .Select(m => field(m)!)
                .Where(v => !string.Equals(v, targetLabel, StringComparison.OrdinalIgnoreCase))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(OptionsPerQuestion - 1)
                .ToList();
            if (distractorLabels.Count < OptionsPerQuestion - 1) continue;

            usedKeys.Add($"{category}-{target.Id}");
            var options = Shuffle(new[] { targetLabel }.Concat(distractorLabels).ToList())
                .Select(label => new QuizOption { Key = label, Label = label })
                .ToList();

            return new SimRound
            {
                Id = $"{category}-{target.Id}",
                Prompt = prompt(target),
                CorrectKey = targetLabel,
                Options = options,
            };
        }

        return null;
    }

    private static SimRound? BuildBirthdateRound(List<MemberInfo> members, HashSet<string> usedKeys)
    {
        var pool = members.Where(m => m.BirthDate.HasValue).ToList();
        if (pool.Count < OptionsPerQuestion) return null;

        foreach (var target in Shuffle(pool).Where(m => !usedKeys.Contains($"birthdate-{m.Id}")))
        {
            var targetLabel = FormatDate(target.BirthDate!.Value);
            var distractorLabels = Shuffle(pool.Where(m => m.Id != target.Id).ToList())
                .Select(m => FormatDate(m.BirthDate!.Value))
                .Where(v => !string.Equals(v, targetLabel, StringComparison.OrdinalIgnoreCase))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(OptionsPerQuestion - 1)
                .ToList();
            if (distractorLabels.Count < OptionsPerQuestion - 1) continue;

            usedKeys.Add($"birthdate-{target.Id}");
            var options = Shuffle(new[] { targetLabel }.Concat(distractorLabels).ToList())
                .Select(label => new QuizOption { Key = label, Label = label })
                .ToList();

            return new SimRound
            {
                Id = $"birthdate-{target.Id}",
                Prompt = $"Quand est né(e) {target.FirstName} {target.LastName} ?",
                CorrectKey = targetLabel,
                Options = options,
            };
        }

        return null;
    }

    // Contrairement aux autres catégories, les leurres sont des numéros de jour tirés au hasard
    // (pas les vraies données d'autres membres) : le mois n'est jamais révélé, donc n'importe
    // quel jour de 1 à 31 est un leurre plausible.
    private static SimRound? BuildBirthDayRound(List<MemberInfo> members, HashSet<string> usedKeys)
    {
        var pool = members.Where(m => m.BirthDate.HasValue).ToList();
        if (pool.Count == 0) return null;

        foreach (var target in Shuffle(pool).Where(m => !usedKeys.Contains($"birth_day-{m.Id}")))
        {
            var correctDay = target.BirthDate!.Value.Day;
            var distractorDays = new List<int>();
            while (distractorDays.Count < OptionsPerQuestion - 1)
            {
                var candidate = Random.Shared.Next(1, 32);
                if (candidate == correctDay || distractorDays.Contains(candidate)) continue;
                distractorDays.Add(candidate);
            }

            usedKeys.Add($"birth_day-{target.Id}");
            var options = Shuffle(new[] { correctDay }.Concat(distractorDays).ToList())
                .Select(day => new QuizOption { Key = day.ToString(), Label = day.ToString() })
                .ToList();

            return new SimRound
            {
                Id = $"birth_day-{target.Id}",
                Prompt = $"Le combien du mois est né(e) {target.FirstName} {target.LastName} ?",
                CorrectKey = correctDay.ToString(),
                Options = options,
            };
        }

        return null;
    }

    private static SimRound? BuildBirthOrderRound(List<MemberInfo> members, HashSet<string> usedKeys)
    {
        var pool = members.Where(m => m.BirthDate.HasValue).ToList();
        if (pool.Count < 2) return null;

        for (var attempt = 0; attempt < 20; attempt++)
        {
            var a = pool[Random.Shared.Next(pool.Count)];
            var b = pool[Random.Shared.Next(pool.Count)];
            if (a.Id == b.Id || a.BirthDate!.Value.Date == b.BirthDate!.Value.Date) continue;

            var pairKey = $"birth_order-{string.Join("-", new[] { a.Id, b.Id }.OrderBy(x => x))}";
            if (usedKeys.Contains(pairKey)) continue;
            usedKeys.Add(pairKey);

            var elder = a.BirthDate < b.BirthDate ? a : b;
            var options = Shuffle(new List<MemberInfo> { a, b })
                .Select(m => new QuizOption { Key = m.Id.ToString(), Label = $"{m.FirstName} {m.LastName}" })
                .ToList();

            return new SimRound
            {
                Id = pairKey,
                Prompt = $"Qui est né(e) en premier, {a.FirstName} ou {b.FirstName} ?",
                CorrectKey = elder.Id.ToString(),
                Options = options,
            };
        }

        return null;
    }

    private static string FormatDate(DateTime date) => date.ToString("d MMMM yyyy", FrenchCulture);

    private static List<T> Shuffle<T>(List<T> list) => [.. list.OrderBy(_ => Random.Shared.Next())];
}
