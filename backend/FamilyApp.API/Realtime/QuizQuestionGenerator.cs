namespace FamilyApp.API.Realtime;

// Génère les questions de quiz côté serveur (jamais côté client) pour que la bonne réponse ne
// soit pas visible dans l'onglet réseau du navigateur avant résolution.
public static class QuizQuestionGenerator
{
    private const int OptionsPerQuestion = 4;

    public record MemberInfo(Guid Id, string FirstName, string LastName, string? ProfilePictureUrl, string? Gender, Guid? FamilyId);

    // Pool de secours si la famille n'a pas assez de types de liens différents pour fournir
    // 3 leurres distincts autour d'une bonne réponse donnée.
    private static readonly string[] FallbackTerms =
    [
        "père", "mère", "fils", "fille", "frère", "sœur",
        "grand-père", "grand-mère", "petit-fils", "petite-fille",
        "oncle", "tante", "neveu", "nièce", "cousin", "cousine",
        "beau-frère", "belle-sœur",
    ];

    // Port de buildWhoIsItRounds (frontend/src/utils/whoIsItGame.js).
    public static List<QuizQuestion> BuildWhoIsItQuestions(List<MemberInfo> membersWithPhoto, int questionCount, IEnumerable<Guid> excludeMemberIds)
    {
        var excluded = new HashSet<Guid>(excludeMemberIds);
        var targetPool = membersWithPhoto.Where(m => !excluded.Contains(m.Id)).ToList();
        var targets = Shuffle(targetPool).Take(Math.Min(questionCount, targetPool.Count)).ToList();

        var questions = new List<QuizQuestion>();
        for (var i = 0; i < targets.Count; i++)
        {
            var target = targets[i];
            var distractors = PickDistractors(membersWithPhoto, target);
            var options = Shuffle(new[] { target }.Concat(distractors).ToList())
                .Select(m => new QuizOption { Key = m.Id.ToString(), Label = $"{m.FirstName} {m.LastName}" })
                .ToList();

            questions.Add(new QuizQuestion
            {
                Id = $"{target.Id}-{i}",
                CorrectKey = target.Id.ToString(),
                Options = options,
                PhotoUrl = target.ProfilePictureUrl,
            });
        }

        return questions;
    }

    // Un seul prénom masculin/féminin au milieu de leurres de l'autre genre trahirait la bonne
    // réponse : on pioche d'abord les leurres dans le même genre que le sujet, et on ne complète
    // avec le reste que si le pool same-gender est trop petit pour remplir les options.
    private static List<MemberInfo> PickDistractors(List<MemberInfo> pool, MemberInfo target)
    {
        var others = pool.Where(m => m.Id != target.Id).ToList();
        if (string.IsNullOrWhiteSpace(target.Gender))
            return Shuffle(others).Take(OptionsPerQuestion - 1).ToList();

        var sameGender = Shuffle(others.Where(m => string.Equals(m.Gender, target.Gender, StringComparison.OrdinalIgnoreCase)).ToList());
        if (sameGender.Count >= OptionsPerQuestion - 1) return sameGender.Take(OptionsPerQuestion - 1).ToList();

        var rest = Shuffle(others.Where(m => !string.Equals(m.Gender, target.Gender, StringComparison.OrdinalIgnoreCase)).ToList());
        return sameGender.Concat(rest).Take(OptionsPerQuestion - 1).ToList();
    }

    // Port de buildRelationshipRounds (frontend/src/utils/relationshipGame.js).
    public static List<QuizQuestion> BuildRelationshipQuestions(List<MemberInfo> members, List<RelationshipLabelService.RelationInfo> relations, int questionCount)
    {
        var memberMap = members.ToDictionary(m => m.Id, m => new RelationshipLabelService.MemberFamilyInfo(m.Id, m.Gender, m.FamilyId));
        var rounds = new List<(string Id, Guid MemberAId, Guid MemberBId, string CorrectTerm)>();
        var usedPairs = new HashSet<string>();
        var maxAttempts = questionCount * 40;

        for (var attempts = 0; rounds.Count < questionCount && attempts < maxAttempts; attempts++)
        {
            var a = members[Random.Shared.Next(members.Count)];
            var b = members[Random.Shared.Next(members.Count)];
            if (a.Id == b.Id) continue;

            var pairKey = string.Join("|", new[] { a.Id, b.Id }.OrderBy(x => x));
            if (usedPairs.Contains(pairKey)) continue;

            var label = RelationshipLabelService.GetRelationshipLabel(relations, memberMap, a.Id, b.Id);
            if (label is null || !label.StartsWith(RelationshipLabelService.Prefix)) continue;

            usedPairs.Add(pairKey);
            rounds.Add((pairKey, a.Id, b.Id, label[RelationshipLabelService.Prefix.Length..]));
        }

        var knownTerms = rounds.Select(r => r.CorrectTerm).Distinct().ToList();

        return [.. rounds.Select(r =>
        {
            var alternativePool = Shuffle(knownTerms.Concat(FallbackTerms).Distinct().Where(t => t != r.CorrectTerm).ToList());
            var distractors = alternativePool.Take(OptionsPerQuestion - 1);
            var options = Shuffle(new[] { r.CorrectTerm }.Concat(distractors).ToList())
                .Select(term => new QuizOption { Key = term, Label = term })
                .ToList();

            return new QuizQuestion
            {
                Id = r.Id,
                CorrectKey = r.CorrectTerm,
                Options = options,
                MemberAId = r.MemberAId,
                MemberBId = r.MemberBId,
            };
        })];
    }

    private static List<T> Shuffle<T>(List<T> list) => [.. list.OrderBy(_ => Random.Shared.Next())];
}
