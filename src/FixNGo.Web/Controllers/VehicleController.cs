using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FixNGo.Web.Controllers;

[ApiController]
[Route("api/v1/vehicles")]
[Authorize(Roles = nameof(Role.CarOwner))]
public sealed class VehicleController(IVehicleService svc) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> List(CancellationToken ct) => Ok(await svc.ListAsync(this.UserId(), ct));
    [HttpGet("{id:guid}")] public async Task<IActionResult> Get(Guid id, CancellationToken ct) => Ok(await svc.GetAsync(this.UserId(), id, ct));
    [HttpPost] public async Task<IActionResult> Create([FromBody] VehicleRequest req, CancellationToken ct) => Ok(await svc.CreateAsync(this.UserId(), req, ct));
    [HttpPut("{id:guid}")] public async Task<IActionResult> Update(Guid id, [FromBody] VehicleRequest req, CancellationToken ct) => Ok(await svc.UpdateAsync(this.UserId(), id, req, ct));
    [HttpDelete("{id:guid}")] public async Task<IActionResult> Delete(Guid id, CancellationToken ct) { await svc.DeleteAsync(this.UserId(), id, ct); return NoContent(); }
    [HttpPost("{id:guid}/primary")] public async Task<IActionResult> SetPrimary(Guid id, CancellationToken ct) => Ok(await svc.SetPrimaryAsync(this.UserId(), id, ct));
}
