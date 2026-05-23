namespace FamilyApp.API.Models;

public class Member
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string FirstName { get; set; }
    public required string LastName { get; set; }
    public DateTime? BirthDate { get; set; }
    public DateTime? DeathDate { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Bio { get; set; }
    public string? Occupation { get; set; }
    public string? Sport { get; set; }
    public string? Address { get; set; }
    public string? PostalCode { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? ProfilePictureUrl { get; set; }
    public bool IsAlive { get; set; } = true;
    public string? Gender { get; set; } // "M" or "F"
    public string? FacebookUrl { get; set; }
    public string? InstagramUsername { get; set; }
    public string? WhatsappNumber { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Guid? FamilyId { get; set; }
    public Family? Family { get; set; }

    public Guid? UserId { get; set; }
    public User? User { get; set; }

    public Guid? DelegateManagerId { get; set; }
    public User? DelegateManager { get; set; }

    public ICollection<Relation> RelationsAsA { get; set; } = [];
    public ICollection<Relation> RelationsAsB { get; set; } = [];
    public ICollection<Photo> Photos { get; set; } = [];
}
