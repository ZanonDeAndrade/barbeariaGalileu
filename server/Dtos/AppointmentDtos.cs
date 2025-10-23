namespace BarbeariaGalileu.Server.Dtos;

public record AppointmentCreateRequest(
    string CustomerName,
    string CustomerPhone,
    string HaircutType,
    string StartTime,
    string? Notes
);

public record SlotAvailabilityDto(
    string StartTime,
    string Status
);
