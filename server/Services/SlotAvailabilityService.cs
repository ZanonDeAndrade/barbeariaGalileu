using BarbeariaGalileu.Server.Data;
using BarbeariaGalileu.Server.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace BarbeariaGalileu.Server.Services;

public interface ISlotAvailabilityService
{
    Task EnsureSlotsAvailableAsync(IReadOnlyCollection<DateTime> slots, CancellationToken cancellationToken);
}

public class SlotAvailabilityService : ISlotAvailabilityService
{
    private readonly AppDbContext _dbContext;

    public SlotAvailabilityService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task EnsureSlotsAvailableAsync(IReadOnlyCollection<DateTime> slots, CancellationToken cancellationToken)
    {
        if (slots.Count == 0)
        {
            throw new HttpException(400, "Horário inválido");
        }

        var requestedTimes = slots.Select(slot => slot.Ticks).ToHashSet();
        var dayStart = BusinessTimeHelper.GetUtcStartOfLocalDay(slots.First());
        var dayEnd = BusinessTimeHelper.GetUtcEndOfLocalDay(slots.First());

        var appointmentsTask = _dbContext.Appointments
            .Where(appointment => appointment.StartTime >= dayStart && appointment.StartTime <= dayEnd)
            .ToListAsync(cancellationToken);

        var blockedSlotsTask = _dbContext.BlockedSlots
            .Where(slot => slot.StartTime >= dayStart && slot.StartTime <= dayEnd)
            .ToListAsync(cancellationToken);

        await Task.WhenAll(appointmentsTask, blockedSlotsTask);

        var conflictingAppointment = appointmentsTask.Result.FirstOrDefault(appointment =>
        {
            var appointmentSlots = BusinessTimeHelper.ComputeSequentialSlots(appointment.StartTime, appointment.DurationMinutes);
            return appointmentSlots.Any(slot => requestedTimes.Contains(slot.Ticks));
        });

        if (conflictingAppointment is not null)
        {
            throw new HttpException(409, "Horário indisponível");
        }

        if (blockedSlotsTask.Result.Any(blocked => requestedTimes.Contains(blocked.StartTime.Ticks)))
        {
            throw new HttpException(409, "Horário bloqueado pelo barbeiro");
        }
    }
}
