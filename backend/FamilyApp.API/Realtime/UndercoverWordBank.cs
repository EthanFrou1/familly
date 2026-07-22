namespace FamilyApp.API.Realtime;

// Banque de paires de mots pour Undercover (civil / undercover), fixe dans le code, même
// convention que SuperlativeRoundGenerator.Prompts. Les civils reçoivent Civilian, les undercover
// reçoivent Undercover, les Mr. White ne reçoivent aucun mot (Word = null côté GameSession).
public static class UndercoverWordBank
{
    public record WordPair(string Civilian, string Undercover);

    public static readonly WordPair[] Pairs =
    [
        new("Café", "Thé"),
        new("Chien", "Chat"),
        new("Plage", "Piscine"),
        new("Pizza", "Burger"),
        new("Été", "Printemps"),
        new("Train", "Avion"),
        new("Guitare", "Piano"),
        new("Football", "Rugby"),
        new("Montagne", "Colline"),
        new("Cinéma", "Théâtre"),
        new("Vélo", "Trottinette"),
        new("Soleil", "Lune"),
        new("Riz", "Pâtes"),
        new("Mer", "Océan"),
        new("Livre", "Magazine"),
        new("Camping", "Hôtel"),
        new("Chocolat", "Bonbon"),
        new("Voiture", "Moto"),
        new("Forêt", "Jardin"),
        new("Neige", "Pluie"),
        new("Fromage", "Yaourt"),
        new("Crayon", "Stylo"),
        new("Tablette", "Ordinateur"),
        new("Sandwich", "Salade"),
        new("Piscine", "Lac"),
        new("Basket", "Tennis"),
        new("Confiture", "Miel"),
        new("Randonnée", "Balade"),
        new("Château", "Manoir"),
        new("Bibliothèque", "Librairie"),
    ];

    public static WordPair PickRandom() => Pairs[Random.Shared.Next(Pairs.Length)];
}
