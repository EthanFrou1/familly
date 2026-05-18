namespace FamilyApp.API.Models;

public class Family
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Name { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Member> Members { get; set; } = [];
}
