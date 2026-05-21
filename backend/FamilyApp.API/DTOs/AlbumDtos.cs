using System.ComponentModel.DataAnnotations;

namespace FamilyApp.API.DTOs;

public class CreateAlbumDto
{
    [Required, MaxLength(100)]
    public required string Name { get; set; }
    public Guid? EventId { get; set; }
    public bool AllowMemberUploads { get; set; } = true;
}
