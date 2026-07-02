using FamilyApp.API.Models;

namespace FamilyApp.API.Realtime;

// Port de frontend/src/utils/relationshipUtils.js (getRelationshipLabel + translatePath).
// Calcule le lien de parenté entre deux membres par BFS sur le graphe de relations.
public static class RelationshipLabelService
{
    public const string Prefix = "Votre ";

    public record RelationInfo(Guid MemberAId, Guid MemberBId, RelationType Type);
    public record MemberFamilyInfo(Guid Id, string? Gender, Guid? FamilyId);

    public static string? GetRelationshipLabel(List<RelationInfo> relations, Dictionary<Guid, MemberFamilyInfo> memberMap, Guid fromMemberId, Guid toMemberId)
    {
        if (fromMemberId == toMemberId) return "C'est vous";

        var targetGender = memberMap.GetValueOrDefault(toMemberId)?.Gender;

        var visited = new HashSet<Guid> { fromMemberId };
        var queue = new Queue<(Guid Id, List<string> Path)>();
        queue.Enqueue((fromMemberId, []));

        while (queue.Count > 0)
        {
            var (id, path) = queue.Dequeue();
            if (path.Count >= 7) continue;

            var adjacent = relations.Where(r => r.MemberAId == id || r.MemberBId == id);

            foreach (var rel in adjacent)
            {
                var isA = rel.MemberAId == id;
                var nextId = isA ? rel.MemberBId : rel.MemberAId;

                if (visited.Contains(nextId)) continue;

                string? step = rel.Type switch
                {
                    RelationType.ParentChild => isA ? "child" : "parent",
                    RelationType.Spouse => "spouse",
                    RelationType.Sibling => "sibling",
                    RelationType.HalfSibling => "halfSibling",
                    RelationType.Separated => "separated",
                    _ => null,
                };
                if (step is null) continue;

                var newPath = new List<string>(path) { step };

                if (nextId == toMemberId) return TranslatePath(newPath, targetGender);

                visited.Add(nextId);
                queue.Enqueue((nextId, newPath));
            }
        }

        var from = memberMap.GetValueOrDefault(fromMemberId);
        var to = memberMap.GetValueOrDefault(toMemberId);
        if (from?.FamilyId is not null && to?.FamilyId is not null && from.FamilyId == to.FamilyId)
            return "Membre de la même famille";

        return "Aucun lien familial connu";
    }

    private static string G(string? gender, string male, string female, string neutral) =>
        gender == "M" ? male : gender == "F" ? female : neutral;

    private static string TranslatePath(List<string> path, string? targetGender)
    {
        var key = string.Join("|", path);
        string Gr(string m, string f, string n) => G(targetGender, m, f, n);

        return key switch
        {
            "parent" => Gr("Votre père", "Votre mère", "Votre parent"),
            "child" => Gr("Votre fils", "Votre fille", "Votre enfant"),
            "spouse" => Gr("Votre époux", "Votre épouse", "Votre conjoint(e)"),
            "separated" => Gr("Votre ex-époux", "Votre ex-épouse", "Votre ex-conjoint(e)"),
            "sibling" => Gr("Votre frère", "Votre sœur", "Votre frère/sœur"),
            "halfSibling" => Gr("Votre demi-frère", "Votre demi-sœur", "Votre demi-frère/sœur"),

            "parent|parent" => Gr("Votre grand-père", "Votre grand-mère", "Votre grand-parent"),
            "child|child" => Gr("Votre petit-fils", "Votre petite-fille", "Votre petit-enfant"),

            "parent|sibling" => Gr("Votre oncle", "Votre tante", "Votre oncle/tante"),
            "parent|halfSibling" => Gr("Votre demi-oncle", "Votre demi-tante", "Votre demi-oncle/tante"),

            "parent|child" => Gr("Votre frère", "Votre sœur", "Votre frère/sœur"),

            "sibling|child" => Gr("Votre neveu", "Votre nièce", "Votre neveu/nièce"),
            "halfSibling|child" => Gr("Votre neveu", "Votre nièce", "Votre neveu/nièce"),

            "parent|parent|parent" => Gr("Votre arrière-grand-père", "Votre arrière-grand-mère", "Votre arrière-grand-parent"),
            "child|child|child" => Gr("Votre arrière-petit-fils", "Votre arrière-petite-fille", "Votre arrière-petit-enfant"),

            "parent|parent|sibling" => Gr("Votre grand-oncle", "Votre grand-tante", "Votre grand-oncle/tante"),
            "parent|parent|halfSibling" => Gr("Votre grand-oncle", "Votre grand-tante", "Votre grand-oncle/tante"),

            "parent|sibling|child" => Gr("Votre cousin", "Votre cousine", "Votre cousin(e)"),
            "parent|halfSibling|child" => Gr("Votre cousin", "Votre cousine", "Votre cousin(e)"),

            "spouse|parent" => Gr("Votre beau-père", "Votre belle-mère", "Votre beau-parent"),
            "parent|spouse" => Gr("Votre beau-père", "Votre belle-mère", "Votre beau-parent"),
            "spouse|sibling" => Gr("Votre beau-frère", "Votre belle-sœur", "Votre beau-frère/sœur"),
            "sibling|spouse" => Gr("Votre beau-frère", "Votre belle-sœur", "Votre beau-frère/sœur"),
            "child|spouse" => Gr("Votre gendre", "Votre belle-fille", "Votre gendre/belle-fille"),
            "spouse|child" => Gr("Votre beau-fils", "Votre belle-fille", "Votre beau-fils/fille"),

            "parent|parent|sibling|child" or "parent|parent|halfSibling|child" =>
                Gr("Votre cousin(e)", "Votre cousine", "Votre cousin(e) éloigné(e)"),

            "parent|sibling|child|child" or "parent|halfSibling|child|child" =>
                Gr("Votre cousin(e)", "Votre cousine", "Votre cousin(e) éloigné(e)"),

            "parent|parent|child" => Gr("Votre oncle", "Votre tante", "Votre oncle/tante"),

            "parent|parent|child|child" => Gr("Votre cousin(e)", "Votre cousine", "Votre cousin(e)"),

            _ => path.Count <= 6 ? "Lien familial éloigné" : "Membre de la famille",
        };
    }
}
