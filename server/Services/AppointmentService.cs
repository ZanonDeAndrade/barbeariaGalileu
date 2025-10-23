using System.Globalization;
using BarbeariaGalileu.Server.Data;
using BarbeariaGalileu.Server.Dtos;
using BarbeariaGalileu.Server.Exceptions;
using BarbeariaGalileu.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace BarbeariaGalileu.Server.Services;

public interface IAppointmentService
{
    Task<IReadOnlyCollection<Appointment>> ListAppointmentsAsync(CancellationToken cancellationToken);
    IReadOnlyCollection<HaircutOption> ListHaircuts();
    Task<Appointment> CreateAppointmentAsync(AppointmentCreateRequest request, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<SlotAvailabilityDto>> GetAvailabilityAsync(string dateIso, CancellationToken cancellationToken);
}

public class AppointmentService : IAppointmentService
{
    private readonly AppDbContext _dbContext;
    private readonly IHaircutService _haircutService;
    private readonly ISlotAvailabilityService _slotAvailabilityService;

    public AppointmentService(
        AppDbContext dbContext,
        IHaircutService haircutService,
        ISlotAvailabilityService slotAvailabilityService)
    {
        _dbContext = dbContext;
        _haircutService = haircutService;
        _slotAvailabilityService = slotAvailabilityService;
    }

    public async Task<IReadOnlyCollection<Appointment>> ListAppointmentsAsync(CancellationToken cancellationToken)
    {
        var todayStartUtc = BusinessTimeHelper.GetUtcStartOfLocalDay(DateTime.UtcNow);

        var appointments = await _dbContext.Appointments
            .Where(appointment => appointment.StartTime >= todayStartUtc)
            .OrderBy(appointment => appointment.StartTime)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return appointments;
    }

    public IReadOnlyCollection<HaircutOption> ListHaircuts() => _haircutService.List();

    public async Task<Appointment> CreateAppointmentAsync(
        AppointmentCreateRequest request,
        CancellationToken cancellationToken)
    {
        var data = ValidateAndNormalizeRequest(request);
        var haircut = _haircutService.GetById(data.HaircutType)
            ?? throw new HttpException(400, "Tipo de corte inválido");

        var normalizedSlot = BusinessTimeHelper.NormalizeToBusinessSlot(data.StartTime)
            ?? throw new HttpException(400, "Horário fora do expediente");

        var requiredSlots = BusinessTimeHelper.ComputeSequentialSlots(normalizedSlot, haircut.DurationMinutes);
        var expectedSlotCount = Math.Max(
            1,
            (int)Math.Ceiling(haircut.DurationMinutes / (double)BusinessTimeHelper.SlotIntervalMinutes));

        if (requiredSlots.Count != expectedSlotCount)
        {
            throw new HttpException(400, "Horário fora do expediente");
        }

        await _slotAvailabilityService.EnsureSlotsAvailableAsync(requiredSlots, cancellationToken);

        var appointment = new Appointment
        {
            CustomerName = data.CustomerName,
            CustomerPhone = data.CustomerPhone,
            HaircutType = haircut.Id,
            Notes = data.Notes,
            StartTime = normalizedSlot,
            DurationMinutes = haircut.DurationMinutes,
        };

        _dbContext.Appointments.Add(appointment);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return appointment;
    }

    public async Task<IReadOnlyCollection<SlotAvailabilityDto>> GetAvailabilityAsync(
        string dateIso,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(dateIso))
        {
            throw new HttpException(400, "Informe uma data válida (YYYY-MM-DD)");
        }

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

        var appointmentsTask = _dbContext.Appointments
            .Where(appointment => appointment.StartTime >= dayStart && appointment.StartTime <= dayEnd)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var blockedSlotsTask = _dbContext.BlockedSlots
            .Where(slot => slot.StartTime >= dayStart && slot.StartTime <= dayEnd)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        await Task.WhenAll(appointmentsTask, blockedSlotsTask);

        var businessSlots = BusinessTimeHelper.GenerateDailySlots(dateOnly);
        var blockedSlotTimes = blockedSlotsTask.Result
            .Select(slot => slot.StartTime)
            .ToHashSet();

        var bookedSlotTimes = new HashSet<DateTime>();
        foreach (var appointment in appointmentsTask.Result)
        {
            var appointmentSlots = BusinessTimeHelper.ComputeSequentialSlots(appointment.StartTime, appointment.DurationMinutes);
            foreach (var appointmentSlot in appointmentSlots)
            {
                bookedSlotTimes.Add(appointmentSlot);
            }
        }

        var availability = businessSlots
            .Select(slot =>
            {
                var status = "available";
                if (blockedSlotTimes.Contains(slot))
                {
                    status = "blocked";
                }
                else if (bookedSlotTimes.Contains(slot))
                {
                    status = "booked";
                }

                return new SlotAvailabilityDto(
                    BusinessTimeHelper.ToIsoString(slot),
                    status);
            })
            .ToList();

        return availability;
    }

    private static (string CustomerName, string CustomerPhone, string HaircutType, DateTime StartTime, string? Notes)
        ValidateAndNormalizeRequest(AppointmentCreateRequest request)
    {
        if (request.CustomerName is null || request.CustomerName.Trim().Length < 3)
        {
            throw new HttpException(400, "Informe o nome completo");
        }

        if (request.CustomerPhone is null || request.CustomerPhone.Trim().Length < 8)
        {
            throw new HttpException(400, "Telefone inválido");
        }

        if (string.IsNullOrWhiteSpace(request.HaircutType))
        {
            throw new HttpException(400, "Tipo de corte inválido");
        }

        if (!BusinessTimeHelper.TryParseIsoDateTime(request.StartTime, out var parsedStartTime))
        {
            throw new HttpException(400, "Data/hora inválida");
        }

        if (request.Notes is { Length: > 280 })
        {
            throw new HttpException(400, "Notas devem ter no máximo 280 caracteres");
        }

        return (
            request.CustomerName.Trim(),
            request.CustomerPhone.Trim(),
            request.HaircutType.Trim(),
            parsedStartTime,
            request.Notes?.Trim()
        );
    }

}
