using FixNGo.Application.DTOs;
using FixNGo.Application.Services;
using FixNGo.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FixNGo.Web.Controllers;

[ApiController]
[Route("api/v1/providers")]
[Authorize(Policy = "Provider")]
public sealed class ProviderController(ProviderService svc, PaymentService payments, RequestService requests) : ControllerBase
{
    [HttpGet("me")] public async Task<IActionResult> Profile(CancellationToken ct) => Ok(await svc.ProfileAsync(this.UserId(), ct));
    [HttpPut("me")] public async Task<IActionResult> UpdateProfile([FromBody] UpdateProviderProfileRequest req, CancellationToken ct) => Ok(await svc.UpdateProfileAsync(this.UserId(), req, ct));
    [HttpPost("online")] public async Task<IActionResult> Online([FromBody] OnlineRequest req, CancellationToken ct) => Ok(await svc.SetOnlineAsync(this.UserId(), req, ct));
    [HttpPost("heartbeat")] public async Task<IActionResult> Heartbeat([FromBody] HeartbeatRequest req, CancellationToken ct) { await svc.HeartbeatAsync(this.UserId(), req, ct); return NoContent(); }
    [HttpGet("nearby")] public async Task<IActionResult> Nearby([FromQuery] double lat, [FromQuery] double lng, CancellationToken ct)
        => Ok(await svc.NearbyAsync(lat, lng, this.IsIn(Role.TowCaptain) ? "TowCaptain" : "Mechanic", ct));

    [HttpPost("kyc")] public async Task<IActionResult> SubmitKyc([FromBody] SubmitKycRequest req, CancellationToken ct) => Ok(await svc.SubmitKycAsync(this.UserId(), req, ct));
    [HttpGet("kyc/me")] public async Task<IActionResult> MyKyc(CancellationToken ct) => Ok(await svc.MyKycAsync(this.UserId(), ct));
    [HttpGet("kyc/{id:guid}/documents")] public async Task<IActionResult> Documents(Guid id, CancellationToken ct) => Ok(await svc.DocumentsAsync(id, ct));

    [HttpGet("history")] public async Task<IActionResult> History(CancellationToken ct) => Ok(await requests.ListAsync(this.UserId(), false, ct));
    [HttpGet("earnings")] public async Task<IActionResult> Earnings(CancellationToken ct) => Ok(await payments.EarningsAsync(this.UserId(), ct));
}
