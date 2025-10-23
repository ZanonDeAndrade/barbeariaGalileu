using BarbeariaGalileu.Server.Dtos;
using BarbeariaGalileu.Server.Models;
using BarbeariaGalileu.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace BarbeariaGalileu.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AppointmentsController : ControllerBase
{
    private readonly IAppointmentService _appointmentService;

    public AppointmentsController(IAppointmentService appointmentService)
    {
        _appointmentService = appointmentService;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<Appointment>>> ListAppointments(CancellationToken cancellationToken)
    {
        var appointments = await _appointmentService.ListAppointmentsAsync(cancellationToken);
        return Ok(appointments);
    }

    [HttpGet("availability")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<SlotAvailabilityDto>>> GetAvailability(
        [FromQuery] string? date,
        CancellationToken cancellationToken)
    {
        var availability = await _appointmentService.GetAvailabilityAsync(date ?? string.Empty, cancellationToken);
        return Ok(availability);
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<ActionResult<Appointment>> CreateAppointment(
        [FromBody] AppointmentCreateRequest request,
        CancellationToken cancellationToken)
    {
        var appointment = await _appointmentService.CreateAppointmentAsync(request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, appointment);
    }
}
