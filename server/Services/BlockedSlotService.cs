using System.Globalization;
using BarbeariaGalileu.Server.Data;
using BarbeariaGalileu.Server.Dtos;
using BarbeariaGalileu.Server.Exceptions;
using BarbeariaGalileu.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace BarbeariaGalileu.Server.Services;

public interface IBlockedSlotService
{
    Task<IReadOnlyCollection<BlockedSlot>> ListBlockedSlotsAsync(string? dateIso, CancellationToken cancellationToken);
    Task<BlockedSlot> CreateBlockedSlotAsync(BlockedSlotCreateRequest request, CancellationToken cancellationToken);
    Task RemoveBlockedSlotAsync(string id, CancellationToken cancellationToken);
}

public class BlockedSlotService : IBlockedSlotService
{
    private readonly AppDbContext _dbContext;
    private readonly ISlotAvailabilityService _slotAvailabilityService;

    public BlockedSlotService(AppDbContext dbContext, ISlotAvailabilityService slotAvailabilityService)
    {
        _dbContext = dbContext;
        _slotAvailabilityService = slotAvailabilityService;
    }

    public async Task<IReadOnlyCollection<BlockedSlot>> ListBlockedSlotsAsync(string? dateIso, CancellationToken cancellationToken)
    {
        var query = _dbContext.BlockedSlots.AsQueryable();

        if (!string.IsNullOrWhiteSpace(dateIso))
        {
            if (!DateOnly.TryParseExact(
                    dateIso,
                    "yyyy-MM-dd",
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out var dateOnly))
            {
                throw new HttpException(400, "Formato de data inválido");
            }

            var dayStart = BusinessTimeHelper.GetUtcStartOfLocalDay(dateOnly);
            var dayEnd = BusinessTimeHelper.GetUtcEndOfLocalDay(dateOnly);
            query = query.Where(slot => slot.StartTime >= dayStart && slot.StartTime <= dayEnd);
        }

        var blockedSlots = await query
            .OrderBy(slot => slot.StartTime)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return blockedSlots;
    }

    public async Task<BlockedSlot> CreateBlockedSlotAsync(BlockedSlotCreateRequest request, CancellationToken cancellationToken)
    {
        if (!BusinessTimeHelper.TryParseIsoDateTime(request.StartTime, out var parsedStartTime))
        {
            throw new HttpException(400, "Data/hora inválida");
        }

        var normalizedSlot = BusinessTimeHelper.NormalizeToBusinessSlot(parsedStartTime)
            ?? throw new HttpException(400, "Horário fora do expediente");

        if (request.Reason is { Length: > 140 })
        {
            throw new HttpException(400, "Máximo de 140 caracteres");
        }

        await _slotAvailabilityService.EnsureSlotsAvailableAsync(new[] { normalizedSlot }, cancellationToken);

        var blockedSlot = new BlockedSlot
        {
            StartTime = normalizedSlot,
            Reason = request.Reason?.Trim(),
        };

        _dbContext.BlockedSlots.Add(blockedSlot);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return blockedSlot;
    }

    public async Task RemoveBlockedSlotAsync(string id, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            throw new HttpException(404, "Bloqueio não encontrado");
        }

        var blockedSlot = await _dbContext.BlockedSlots.FirstOrDefaultAsync(slot => slot.Id == id, cancellationToken);
        if (blockedSlot is null)
        {
            throw new HttpException(404, "Bloqueio não encontrado");
        }

        _dbContext.BlockedSlots.Remove(blockedSlot);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
