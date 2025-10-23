using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BarbeariaGalileu.Server.Models;

public class Appointment
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [Required]
    [MaxLength(120)]
    public string CustomerName { get; set; } = string.Empty;

    [Required]
    [MaxLength(30)]
    public string CustomerPhone { get; set; } = string.Empty;

    [Required]
    [MaxLength(60)]
    public string HaircutType { get; set; } = string.Empty;

    [MaxLength(280)]
    public string? Notes { get; set; }

    private DateTime _startTime;
    private DateTime _createdAt = DateTime.UtcNow;
    private DateTime _updatedAt = DateTime.UtcNow;

    [Required]
    [Column(TypeName = "TEXT")]
    public DateTime StartTime
    {
        get => _startTime;
        set => _startTime = DateTime.SpecifyKind(value, DateTimeKind.Utc);
    }

    [Range(1, 480)]
    public int DurationMinutes { get; set; }

    [Column(TypeName = "TEXT")]
    public DateTime CreatedAt
    {
        get => _createdAt;
        set => _createdAt = DateTime.SpecifyKind(value, DateTimeKind.Utc);
    }

    [Column(TypeName = "TEXT")]
    public DateTime UpdatedAt
    {
        get => _updatedAt;
        set => _updatedAt = DateTime.SpecifyKind(value, DateTimeKind.Utc);
    }
}
