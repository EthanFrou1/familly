namespace FamilyApp.API.Models;

// Réponse texte libre d'un membre à une question du sondage "Une Famille en Or". QuestionKey
// référence une entrée stable de FamilleEnOrQuestionBank (banque fixe dans le code, pas en base).
public class FamilleEnOrAnswer
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string QuestionKey { get; set; }
    public Guid MemberId { get; set; }
    public Member Member { get; set; } = null!;
    public required string RawText { get; set; }
    public Guid? GroupId { get; set; }
    public FamilleEnOrAnswerGroup? Group { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
