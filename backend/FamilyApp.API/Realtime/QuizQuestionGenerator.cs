namespace FamilyApp.API.Realtime;

// Génère les questions de quiz côté serveur (jamais côté client) pour que la bonne réponse ne
// soit pas visible dans l'onglet réseau du navigateur avant résolution.
public static class QuizQuestionGenerator
{
    private const int OptionsPerQuestion = 4;

    public record MemberInfo(Guid Id, string FirstName, string LastName, string? ProfilePictureUrl, string? Gender);

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
            var distractors = Shuffle(membersWithPhoto.Where(m => m.Id != target.Id).ToList()).Take(OptionsPerQuestion - 1);
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

    private static List<T> Shuffle<T>(List<T> list) => [.. list.OrderBy(_ => Random.Shared.Next())];
}
