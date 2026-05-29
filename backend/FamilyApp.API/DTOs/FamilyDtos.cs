namespace FamilyApp.API.DTOs;

public record FamilyDto(Guid Id, string Name, int MemberCount, double? AverageAge, string? GroupPhotoUrl);
public record CreateFamilyRequest(string Name);
