namespace FamilyApp.API.Models;

public enum RelationType
{
    ParentChild,
    Spouse,
    Sibling,
    HalfSibling,
    Separated,
    Partner
}

public class Relation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid MemberAId { get; set; }
    public Member MemberA { get; set; } = null!;
    public Guid MemberBId { get; set; }
    public Member MemberB { get; set; } = null!;
    public RelationType Type { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
