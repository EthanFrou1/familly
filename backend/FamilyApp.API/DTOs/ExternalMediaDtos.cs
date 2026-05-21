using System.ComponentModel.DataAnnotations;

namespace FamilyApp.API.DTOs;

public class CreateExternalMediaDto
{
    public string? Title { get; set; }

    [Required(ErrorMessage = "Le lien Google Photos est obligatoire.")]
    public required string ExternalUrl { get; set; }

    public Guid? EventId { get; set; }
    public Guid? LinkedMemberId { get; set; }
}
