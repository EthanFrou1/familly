namespace FamilyApp.API.Models;

// Un paquet de réponses jugées équivalentes par l'admin pour une question du sondage "Une Famille
// en Or". Ses points en jeu ne sont jamais stockés ici : ils se déduisent du nombre de
// FamilleEnOrAnswer qui lui sont rattachées (fidèle au vrai jeu, pas de barème à définir à la main).
public class FamilleEnOrAnswerGroup
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string QuestionKey { get; set; }
    public required string Label { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
