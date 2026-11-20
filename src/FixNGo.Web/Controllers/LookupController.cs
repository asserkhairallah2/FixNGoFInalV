using FixNGo.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FixNGo.Web.Controllers;

[ApiController]
[Route("api/v1/lookups")]
[Authorize]
public sealed class LookupController(ILookupService svc) : ControllerBase
{
    [HttpGet("bootstrap")] public async Task<IActionResult> Bootstrap(CancellationToken ct) => Ok(await svc.BootstrapAsync(ct));
}
