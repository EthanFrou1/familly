namespace FamilyApp.API.DTOs;

public record FamilleEnOrAnswerRequestDto(string Text);

// Pilote l'écran de sondage : HasAnswered/IsReady déterminent si le membre courant peut encore
// répondre ou modifier sa réponse (verrouillé une fois la question passée en "prête").
public record FamilleEnOrQuestionDto(string Key, string Prompt, bool HasAnswered, bool IsReady);

public record FamilleEnOrAdminAnswerDto(Guid Id, Guid MemberId, string MemberName, string RawText, Guid? GroupId);

public record FamilleEnOrAdminGroupDto(Guid Id, string Label, int Points);

public record FamilleEnOrAdminQuestionDetailDto(
    string Key, string Prompt, bool IsReady,
    List<FamilleEnOrAdminAnswerDto> Answers,
    List<FamilleEnOrAdminGroupDto> Groups);

public record FamilleEnOrCreateGroupRequestDto(List<Guid> AnswerIds, string Label);

public record FamilleEnOrUpdateGroupRequestDto(string Label, List<Guid> AnswerIds);
