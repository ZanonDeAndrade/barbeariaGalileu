using BarbeariaGalileu.Server.Models;
using BarbeariaGalileu.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace BarbeariaGalileu.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HaircutsController : ControllerBase
{
    private readonly IHaircutService _haircutService;

    public HaircutsController(IHaircutService haircutService)
    {
        _haircutService = haircutService;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public ActionResult<IEnumerable<HaircutOption>> ListHaircuts()
    {
        var haircuts = _haircutService.List();
        return Ok(haircuts);
    }
}
