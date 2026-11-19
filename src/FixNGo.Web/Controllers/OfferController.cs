using FixNGo.Application.DTOs;
using FixNGo.Application.Services;
using FixNGo.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FixNGo.Web.Controllers;

[ApiController]
[Route("api/v1/offers")]
[Authorize(Policy = "Provider")]
public sealed class OfferController(OfferService svc) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> Mine(CancellationToken ct) => Ok(await svc.ForProviderAsync(this.UserId(), ct));
    [HttpGet("{id:guid}")] public async Task<IActionResult> One(Guid id, CancellationToken ct)
    {
        var offer = (await svc.ForProviderAsync(this.UserId(), ct)).FirstOrDefault(o => o.Id == id);
        return offer is null ? NotFound() : Ok(offer);
    }
    [HttpPost("{id:guid}/accept")] public async Task<IActionResult> Accept(Guid id, CancellationToken ct) => Ok(await svc.AcceptAsync(this.UserId(), id, ct));
    [HttpPost("{id:guid}/decline")] public async Task<IActionResult> Decline(Guid id, [FromBody] DeclineOfferRequest? req, CancellationToken ct)
        => Ok(await svc.DeclineAsync(this.UserId(), id, req ?? new DeclineOfferRequest(), ct));
}
