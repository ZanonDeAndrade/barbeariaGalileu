using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BarbeariaGalileu.Server.Models;

public class BlockedSlot
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    private DateTime _startTime;
    private DateTime _createdAt = DateTime.UtcNow;

    [Required]
    [Column(TypeName = "TEXT")]
    public DateTime StartTime
    {
        get => _startTime;
        set => _startTime = DateTime.SpecifyKind(value, DateTimeKind.Utc);
    }

    [MaxLength(140)]
    public string? Reason { get; set; }

    [Column(TypeName = "TEXT")]
    public DateTime CreatedAt
    {
        get => _createdAt;
        set => _createdAt = DateTime.SpecifyKind(value, DateTimeKind.Utc);
    }
}
