namespace FamilyApp.API.Realtime;

// Génère les rounds du jeu "Qui suis-je ?" : choisit un membre de la famille comme sujet et
// construit des indices progressifs (du plus vague au plus révélateur) à partir de son lien de
// parenté avec un joueur présent et de ses champs métier/sport/date de naissance.
// CorrectKey (l'id du sujet) ne doit jamais être envoyé au client avant résolution du round.
public static class WhoAmIRoundGenerator
{
    public record MemberInfo(
        Guid Id, string FirstName, string LastName, string? Gender, Guid? FamilyId,
        DateTime? BirthDate, string? Occupation, string? Sport);

    public static List<SimRound> Build(
        List<MemberInfo> members,
        List<RelationshipLabelService.RelationInfo> relations,
        List<SessionPlayer> players,
        int roundCount)
    {
        var memberMap = members.ToDictionary(m => m.Id, m => new RelationshipLabelService.MemberFamilyInfo(m.Id, m.Gender, m.FamilyId));

        var subjectPool = Shuffle(members.Where(m => NonNullFieldCount(m) >= 2).ToList());
        var rounds = new List<SimRound>();

        foreach (var subject in subjectPool)
        {
            if (rounds.Count >= roundCount) break;

            var clues = new List<string>();

            var anchorClue = FindAnchorClue(relations, memberMap, players, subject.Id);
            if (anchorClue is not null) clues.Add(anchorClue);

            if (subject.BirthDate.HasValue)
                clues.Add($"Année de naissance : {subject.BirthDate.Value.Year}");

            if (!string.IsNullOrWhiteSpace(subject.Occupation))
                clues.Add($"Métier : {subject.Occupation}");

            if (!string.IsNullOrWhiteSpace(subject.Sport))
                clues.Add($"Sport / loisir : {subject.Sport}");

            if (clues.Count == 0) continue;

            rounds.Add(new SimRound
            {
                Id = $"whoami-{subject.Id}",
                Clues = clues,
                CorrectKey = subject.Id.ToString(),
            });
        }

        return rounds;
    }

    private static string? FindAnchorClue(
        List<RelationshipLabelService.RelationInfo> relations,
        Dictionary<Guid, RelationshipLabelService.MemberFamilyInfo> memberMap,
        List<SessionPlayer> players,
        Guid subjectId)
    {
        foreach (var player in Shuffle(players))
        {
            if (player.MemberId == subjectId) continue;

            var label = RelationshipLabelService.GetRelationshipLabel(relations, memberMap, player.MemberId, subjectId);
            if (label is null || !label.StartsWith(RelationshipLabelService.Prefix)) continue;

            var term = label[RelationshipLabelService.Prefix.Length..];
            return $"Lien avec {player.Name.Split(' ')[0]} : {term}";
        }

        return null;
    }

    private static int NonNullFieldCount(MemberInfo m) =>
        (m.BirthDate.HasValue ? 1 : 0) +
        (!string.IsNullOrWhiteSpace(m.Occupation) ? 1 : 0) +
        (!string.IsNullOrWhiteSpace(m.Sport) ? 1 : 0);

    private static List<T> Shuffle<T>(List<T> list) => [.. list.OrderBy(_ => Random.Shared.Next())];
}
