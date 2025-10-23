namespace BarbeariaGalileu.Server.Dtos;

public record BlockedSlotCreateRequest(
    string StartTime,
    string? Reason
);
