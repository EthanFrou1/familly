using FamilyApp.API.Data;
using FamilyApp.API.DTOs;
using FamilyApp.API.Models;
using FamilyApp.API.Realtime;
using Microsoft.EntityFrameworkCore;

namespace FamilyApp.API.Services;

// Sondage + curation du jeu "Une Famille en Or". La banque de questions est fixe (voir
// FamilleEnOrQuestionBank), seules les réponses et leur regroupement en catégories vivent en base.
public class FamilleEnOrService(AppDbContext db)
{
    public async Task<List<FamilleEnOrQuestionDto>> GetQuestionsAsync(Guid memberId)
    {
        var answeredKeys = (await db.FamilleEnOrAnswers
                .Where(a => a.MemberId == memberId)
                .Select(a => a.QuestionKey)
                .ToListAsync())
            .ToHashSet();

        var readyKeys = await GetReadyQuestionKeysAsync();

        return FamilleEnOrQuestionBank.Questions
            .Select(q => new FamilleEnOrQuestionDto(q.Key, q.Prompt, answeredKeys.Contains(q.Key), readyKeys.Contains(q.Key)))
            .ToList();
    }

    public async Task SubmitAnswerAsync(Guid memberId, string questionKey, string text)
    {
        if (!FamilleEnOrQuestionBank.PromptByKey.ContainsKey(questionKey))
            throw new ArgumentException("Question inconnue.");

        var readyKeys = await GetReadyQuestionKeysAsync();
        if (readyKeys.Contains(questionKey))
            throw new InvalidOperationException("Cette question est déjà prête à être jouée, elle ne peut plus être modifiée.");

        var trimmed = text.Trim();
        if (trimmed.Length == 0) throw new ArgumentException("Réponse vide.");

        var existing = await db.FamilleEnOrAnswers
            .FirstOrDefaultAsync(a => a.QuestionKey == questionKey && a.MemberId == memberId);

        if (existing is not null)
        {
            existing.RawText = trimmed;
        }
        else
        {
            db.FamilleEnOrAnswers.Add(new FamilleEnOrAnswer { QuestionKey = questionKey, MemberId = memberId, RawText = trimmed });
        }

        await db.SaveChangesAsync();
    }

    public async Task<FamilleEnOrAdminQuestionDetailDto> GetAdminQuestionDetailAsync(string questionKey)
    {
        if (!FamilleEnOrQuestionBank.PromptByKey.TryGetValue(questionKey, out var prompt))
            throw new ArgumentException("Question inconnue.");

        var answers = await db.FamilleEnOrAnswers
            .Where(a => a.QuestionKey == questionKey)
            .Select(a => new FamilleEnOrAdminAnswerDto(a.Id, a.MemberId, a.Member.FirstName + " " + a.Member.LastName, a.RawText, a.GroupId))
            .ToListAsync();

        var groups = await db.FamilleEnOrAnswerGroups
            .Where(g => g.QuestionKey == questionKey)
            .Select(g => new { g.Id, g.Label, Points = db.FamilleEnOrAnswers.Count(a => a.GroupId == g.Id) })
            .ToListAsync();

        var isReady = await db.FamilleEnOrQuestionStates
            .Where(s => s.QuestionKey == questionKey)
            .Select(s => s.IsReady)
            .FirstOrDefaultAsync();

        return new FamilleEnOrAdminQuestionDetailDto(
            questionKey, prompt, isReady,
            answers,
            groups.Select(g => new FamilleEnOrAdminGroupDto(g.Id, g.Label, g.Points)).OrderByDescending(g => g.Points).ToList());
    }

    public async Task<Guid> CreateGroupAsync(string questionKey, List<Guid> answerIds, string label)
    {
        var group = new FamilleEnOrAnswerGroup { QuestionKey = questionKey, Label = label.Trim() };
        db.FamilleEnOrAnswerGroups.Add(group);
        // ExecuteUpdateAsync exécute sa propre requête immédiatement, en dehors du change tracker :
        // le groupe doit déjà exister en base (SaveChangesAsync) avant de pouvoir y rattacher des
        // réponses, sinon la contrainte de clé étrangère échoue.
        await db.SaveChangesAsync();

        await db.FamilleEnOrAnswers
            .Where(a => a.QuestionKey == questionKey && answerIds.Contains(a.Id))
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.GroupId, group.Id));

        return group.Id;
    }

    public async Task UpdateGroupAsync(Guid groupId, string label, List<Guid> answerIds)
    {
        var group = await db.FamilleEnOrAnswerGroups.FindAsync(groupId)
            ?? throw new ArgumentException("Groupe introuvable.");
        group.Label = label.Trim();

        // Détache d'abord toutes les réponses actuellement dans ce groupe, puis rattache
        // exactement la sélection reçue : évite de laisser des réponses orphelines du groupe
        // si l'admin en a désélectionné certaines.
        await db.FamilleEnOrAnswers
            .Where(a => a.GroupId == groupId)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.GroupId, (Guid?)null));

        await db.FamilleEnOrAnswers
            .Where(a => a.QuestionKey == group.QuestionKey && answerIds.Contains(a.Id))
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.GroupId, groupId));

        await db.SaveChangesAsync();
    }

    public async Task DeleteAnswerAsync(Guid answerId)
    {
        var answer = await db.FamilleEnOrAnswers.FindAsync(answerId);
        if (answer is null) return;
        db.FamilleEnOrAnswers.Remove(answer);
        await db.SaveChangesAsync();
    }

    public async Task MarkReadyAsync(string questionKey)
    {
        if (!FamilleEnOrQuestionBank.PromptByKey.ContainsKey(questionKey))
            throw new ArgumentException("Question inconnue.");

        // Toute réponse encore sans groupe devient son propre groupe à part entière : rien n'est
        // perdu silencieusement quand l'admin marque la question prête sans avoir tout regroupé.
        var ungrouped = await db.FamilleEnOrAnswers
            .Where(a => a.QuestionKey == questionKey && a.GroupId == null)
            .ToListAsync();

        foreach (var answer in ungrouped)
        {
            var group = new FamilleEnOrAnswerGroup { QuestionKey = questionKey, Label = answer.RawText };
            db.FamilleEnOrAnswerGroups.Add(group);
            answer.GroupId = group.Id;
        }

        await SetReadyAsync(questionKey, true);
    }

    public Task MarkUnreadyAsync(string questionKey) => SetReadyAsync(questionKey, false);

    private async Task SetReadyAsync(string questionKey, bool isReady)
    {
        var state = await db.FamilleEnOrQuestionStates.FindAsync(questionKey);
        if (state is null)
        {
            state = new FamilleEnOrQuestionState { QuestionKey = questionKey };
            db.FamilleEnOrQuestionStates.Add(state);
        }

        state.IsReady = isReady;
        state.ReadyAt = isReady ? DateTime.UtcNow : null;
        await db.SaveChangesAsync();
    }

    public async Task<HashSet<string>> GetReadyQuestionKeysAsync() =>
        (await db.FamilleEnOrQuestionStates.Where(s => s.IsReady).Select(s => s.QuestionKey).ToListAsync()).ToHashSet();

    // Pioche `count` questions prêtes au hasard et construit leur plateau de réponses (triées par
    // points décroissants) — snapshot figé pour la durée de la partie, comme SimRounds pour
    // superlative/whoami : une re-curation pendant une partie en cours n'affecte jamais une partie
    // déjà lancée.
    public async Task<List<FamilleEnOrRound>> PickRandomReadyRoundsAsync(int count)
    {
        var readyKeys = await GetReadyQuestionKeysAsync();
        var pool = readyKeys.OrderBy(_ => Random.Shared.Next()).Take(count).ToList();

        var rounds = new List<FamilleEnOrRound>();
        foreach (var key in pool)
        {
            var groups = await db.FamilleEnOrAnswerGroups
                .Where(g => g.QuestionKey == key)
                .Select(g => new { g.Label, Points = db.FamilleEnOrAnswers.Count(a => a.GroupId == g.Id) })
                .Where(g => g.Points > 0)
                .OrderByDescending(g => g.Points)
                .ToListAsync();

            if (groups.Count == 0) continue;

            rounds.Add(new FamilleEnOrRound
            {
                QuestionKey = key,
                Prompt = FamilleEnOrQuestionBank.PromptByKey[key],
                Slots = groups.Select(g => new FamilleEnOrSlot { Label = g.Label, Points = g.Points }).ToList(),
            });
        }

        return rounds;
    }
}
