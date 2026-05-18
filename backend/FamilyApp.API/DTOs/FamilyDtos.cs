namespace FamilyApp.API.DTOs;

public record FamilyDto(Guid Id, string Name, int MemberCount);
public record CreateFamilyRequest(string Name);
