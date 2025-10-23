namespace BarbeariaGalileu.Server.Models;

public class HaircutOption
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Description { get; init; }
    public required int DurationMinutes { get; init; }
}
