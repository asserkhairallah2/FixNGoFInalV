using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FixNGo.Web.Controllers;

[ApiController]
[Route("api/v1/providers")]
[Authorize]
public sealed class ProviderController(IProviderService svc, IPaymentService payments, IRequestService requests) : ControllerBase
{
    [HttpGet("me")] [Authorize(Policy = "Provider")] public async Task<IActionResult> Profile(CancellationToken ct) => Ok(await svc.ProfileAsync(this.UserId(), ct));
    [HttpGet("{id:guid}/public-profile")] public async Task<IActionResult> PublicProfile(Guid id, CancellationToken ct) => Ok(await svc.PublicProfileAsync(id, ct));
    [HttpGet("customers/{id:guid}/public-profile")] public async Task<IActionResult> CustomerPublicProfile(Guid id, CancellationToken ct) => Ok(await svc.CustomerPublicProfileAsync(id, ct));
    [HttpPut("me")] [Authorize(Policy = "Provider")] public async Task<IActionResult> UpdateProfile([FromBody] UpdateProviderProfileRequest req, CancellationToken ct) => Ok(await svc.UpdateProfileAsync(this.UserId(), req, ct));
    [HttpPost("online")] [Authorize(Policy = "Provider")] public async Task<IActionResult> Online([FromBody] OnlineRequest req, CancellationToken ct) => Ok(await svc.SetOnlineAsync(this.UserId(), req, ct));
    [HttpPost("heartbeat")] [Authorize(Policy = "Provider")] public async Task<IActionResult> Heartbeat([FromBody] HeartbeatRequest req, CancellationToken ct) { await svc.HeartbeatAsync(this.UserId(), req, ct); return NoContent(); }
    [HttpGet("nearby")] [Authorize(Policy = "Provider")] public async Task<IActionResult> Nearby([FromQuery] double lat, [FromQuery] double lng, CancellationToken ct)
        => Ok(await svc.NearbyAsync(lat, lng, this.IsIn(Role.TowCaptain) ? "TowCaptain" : "Mechanic", ct));

    [HttpPost("kyc")]
    [Authorize(Roles = "Mechanic,TowCaptain,ServiceCenter,Admin")]
    public async Task<IActionResult> SubmitKyc([FromBody] SubmitKycRequest req, CancellationToken ct) => Ok(await svc.SubmitKycAsync(this.UserId(), req, ct));

    [HttpPost("kyc/documents")]
    [Authorize(Roles = "Mechanic,TowCaptain,ServiceCenter,Admin")]
    public async Task<IActionResult> UploadDocument([FromBody] KycDocumentInput req, CancellationToken ct) => Ok(await svc.UploadDocumentAsync(this.UserId(), req, ct));

    [HttpGet("kyc/me")]
    [Authorize(Roles = "Mechanic,TowCaptain,ServiceCenter,Admin")]
    public async Task<IActionResult> MyKyc(CancellationToken ct) => Ok(await svc.MyKycAsync(this.UserId(), ct));

    [HttpGet("kyc/{id:guid}/documents")]
    [Authorize(Roles = "Mechanic,TowCaptain,ServiceCenter,Admin")]
    public async Task<IActionResult> Documents(Guid id, CancellationToken ct) => Ok(await svc.DocumentsAsync(id, ct));

    [HttpGet("history")] [Authorize(Policy = "Provider")] public async Task<IActionResult> History(CancellationToken ct) => Ok(await requests.ListAsync(this.UserId(), false, ct));
    [HttpGet("earnings")] [Authorize(Policy = "Provider")] public async Task<IActionResult> Earnings(CancellationToken ct) => Ok(await payments.EarningsAsync(this.UserId(), ct));
}
