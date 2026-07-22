namespace FamilyApp.API.Models;

// Statut de curation d'une question du sondage "Une Famille en Or". Tant qu'une question n'est
// pas IsReady, elle n'est ni piochable pour une partie en direct, ni modifiable par les membres.
public class FamilleEnOrQuestionState
{
    public required string QuestionKey { get; set; }
    public bool IsReady { get; set; }
    public DateTime? ReadyAt { get; set; }
}
