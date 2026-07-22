namespace FamilyApp.API.Realtime;

// Banque de questions du sondage "Une Famille en Or", fixe dans le code (comme
// SuperlativeRoundGenerator.Prompts). Contrairement à ce dernier, chaque question a une clé stable
// (Key) indépendante de sa position dans le tableau : les réponses du sondage en base référencent
// cette clé sur la durée, donc réordonner/ajouter des entrées ne doit jamais casser un lien existant.
public static class FamilleEnOrQuestionBank
{
    public record Question(string Key, string Prompt);

    public static readonly Question[] Questions =
    [
        new("plat-reclame", "Cite un plat que la famille réclame à tous les repas."),
        new("valise-vacances", "Cite une chose qu'on retrouve toujours dans la valise de quelqu'un en vacances."),
        new("sujet-repas", "Cite un sujet de conversation qui revient à presque tous les repas de famille."),
        new("excuse-retard", "Cite une excuse classique pour arriver en retard à un repas de famille."),
        new("activite-vacances", "Cite une activité que la famille fait à chaque fois en vacances."),
        new("objet-perdu", "Cite un objet que quelqu'un finit toujours par perdre ou oublier."),
        new("film-tout-le-monde", "Cite un film ou une série que toute la famille a regardé ensemble."),
        new("jeu-societe", "Cite un jeu de société auquel la famille joue souvent."),
        new("destination-reve", "Cite une destination de vacances dont la famille parle sans jamais y aller."),
        new("cadeau-noel", "Cite un cadeau de Noël classique dans la famille."),
        new("appareil-photo", "Cite un moment où tout le monde sort son téléphone pour prendre une photo."),
        new("bruit-cuisine", "Cite un bruit ou une odeur qu'on associe direct à la cuisine familiale."),
        new("expression-familiale", "Cite une expression ou un mot que seule la famille utilise/comprend."),
        new("occasion-fete", "Cite une occasion que la famille fête toujours, même petitement."),
        new("animal-ideal", "Cite un animal que la famille adopterait si elle pouvait choisir ensemble."),
        new("sport-suivi", "Cite un sport que plusieurs membres de la famille suivent ou pratiquent."),
        new("chanson-fete", "Cite une chanson qui met toujours l'ambiance aux fêtes de famille."),
        new("truc-enfance", "Cite un jouet ou une activité d'enfance dont on parle encore aujourd'hui."),
        new("metier-reve", "Cite un métier qu'un enfant de la famille a rêvé de faire un jour."),
        new("raison-dispute", "Cite un sujet sur lequel la famille n'est jamais d'accord (sans se fâcher !)."),
    ];

    public static readonly Dictionary<string, string> PromptByKey =
        Questions.ToDictionary(q => q.Key, q => q.Prompt);
}
