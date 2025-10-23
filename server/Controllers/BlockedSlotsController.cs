using BarbeariaGalileu.Server.Dtos;
using BarbeariaGalileu.Server.Models;
using BarbeariaGalileu.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace BarbeariaGalileu.Server.Controllers;

[ApiController]
[Route("api/blocked-slots")]
public class BlockedSlotsController : ControllerBase
{
    private readonly IBlockedSlotService _blockedSlotService;

    public BlockedSlotsController(IBlockedSlotService blockedSlotService)
    {
        _blockedSlotService = blockedSlotService;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<BlockedSlot>>> ListBlockedSlots(
        [FromQuery] string? date,
        CancellationToken cancellationToken)
    {
        var blockedSlots = await _blockedSlotService.ListBlockedSlotsAsync(date, cancellationToken);
        return Ok(blockedSlots);
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<ActionResult<BlockedSlot>> CreateBlockedSlot(
        [FromBody] BlockedSlotCreateRequest request,
        CancellationToken cancellationToken)
    {
        var blockedSlot = await _blockedSlotService.CreateBlockedSlotAsync(request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, blockedSlot);
    }

    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> RemoveBlockedSlot(string id, CancellationToken cancellationToken)
    {
        await _blockedSlotService.RemoveBlockedSlotAsync(id, cancellationToken);
        return NoContent();
    }
}
