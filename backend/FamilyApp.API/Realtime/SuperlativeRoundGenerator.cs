namespace FamilyApp.API.Realtime;

// Génère les rounds du jeu "Le/la plus susceptible de..." : une banque de prompts fixes,
// aucune réponse cachée à protéger (pas de génération côté client à dupliquer, contrairement
// à QuizQuestionGenerator).
public static class SuperlativeRoundGenerator
{
    private static readonly string[] Prompts =
    [
        "s'endormir avant le dessert ?",
        "raconter la meilleure blague de la soirée ?",
        "arriver en retard au repas de famille ?",
        "reprendre trois fois du même plat ?",
        "gagner à tous les jeux de société ?",
        "prendre le plus de photos pendant le repas ?",
        "faire un discours improvisé ?",
        "oublier son téléphone à table ?",
        "proposer une blague vaseuse ?",
        "être le premier levé le lendemain ?",
        "faire durer une histoire beaucoup trop longtemps ?",
        "changer d'avis en pleine discussion ?",
        "connaître tous les derniers potins de la famille ?",
        "organiser la prochaine réunion de famille ?",
        "danser en premier sur la piste ?",
        "chanter faux mais avec le sourire ?",
        "faire rire toute la table sans le vouloir ?",
        "être encore à table après tout le monde ?",
        "avoir toujours une anecdote de voyage ?",
        "être le/la plus compétitif(ve) aux cartes ?",
        "réclamer une photo de groupe ?",
        "apporter le dessert le plus original ?",
        "faire la sieste après le repas ?",
        "se resservir en dernier par politesse ?",
        "raconter la même histoire chaque année ?",
        "être le/la meilleur(e) cuisinier(ère) de la famille ?",
        "négocier pour partir le/la dernier(ère) ?",
        "avoir le plus d'idées pour les prochaines vacances en famille ?",
        "faire un câlin à tout le monde en arrivant ?",
        "être le/la plus curieux(se) des nouvelles technologies ?",
        "défendre bec et ongles son équipe sportive préférée ?",
        "s'occuper des enfants pendant que les autres discutent ?",
        "proposer d'aider à débarrasser en premier ?",
        "avoir toujours un jeu de mots prêt ?",
        "connaître par cœur l'arbre généalogique de la famille ?",
        "être partant(e) pour un jeu improvisé ?",
        "prendre les meilleures décisions sous pression ?",
        "être le/la plus nostalgique des vieux souvenirs de famille ?",
    ];

    public static List<SimRound> Build(int roundCount)
    {
        var shuffled = Prompts.OrderBy(_ => Random.Shared.Next()).ToList();
        return shuffled
            .Take(Math.Min(roundCount, shuffled.Count))
            .Select((prompt, i) => new SimRound
            {
                Id = $"superlative-{i}",
                Prompt = $"Qui est le/la plus susceptible de {prompt}",
                CorrectKey = "",
            })
            .ToList();
    }
}
