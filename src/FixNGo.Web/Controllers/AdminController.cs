using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FixNGo.Web.Controllers;

[ApiController]
[Route("api/v1/admin")]
[Authorize(Roles = nameof(Role.Admin))]
public sealed class AdminController(IAdminService svc, IProviderService providers, ISupportService support,
    IReviewService reviews) : ControllerBase
{
    [HttpGet("dashboard")] public async Task<IActionResult> Dashboard(CancellationToken ct) => Ok(await svc.DashboardAsync(ct));
    [HttpGet("users")] public async Task<IActionResult> Users(CancellationToken ct) => Ok(await svc.UsersAsync(ct));
    [HttpGet("users/{id:guid}")] public async Task<IActionResult> UserDetails(Guid id, CancellationToken ct)
    {
        var item = (await svc.UsersAsync(ct)).FirstOrDefault(x => x.Id == id);
        return item is null ? NotFound() : Ok(item);
    }
    [HttpPost("users/{id:guid}/suspend")] public async Task<IActionResult> Suspend(Guid id, [FromBody] SuspendRequest req, CancellationToken ct) => Ok(await svc.SuspendAsync(this.UserId(), id, req, ct));
    [HttpPost("users/{id:guid}/restore")] public async Task<IActionResult> Restore(Guid id, CancellationToken ct) => Ok(await svc.RestoreAsync(this.UserId(), id, ct));
    [HttpGet("sessions")] public async Task<IActionResult> MySessions(CancellationToken ct) => Ok(await svc.SessionsAsync(this.UserId(), ct));
    [HttpGet("users/{id:guid}/sessions")] public async Task<IActionResult> Sessions(Guid id, CancellationToken ct) => Ok(await svc.SessionsAsync(id, ct));
    [HttpDelete("sessions/{id:guid}")] public async Task<IActionResult> RevokeSession(Guid id, CancellationToken ct) { await svc.RevokeSessionAsync(this.UserId(), id, ct); return NoContent(); }

    [HttpGet("settings")] public async Task<IActionResult> Settings(CancellationToken ct) => Ok(await svc.SettingsAsync(ct));
    [HttpPut("settings")]
    public async Task<IActionResult> UpdateSettings([FromBody] System.Text.Json.JsonElement body, CancellationToken ct)
    {
        var opts = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        PricingSettings pricing;
        if (body.ValueKind == System.Text.Json.JsonValueKind.Object && body.TryGetProperty("pricing", out var nested))
            pricing = System.Text.Json.JsonSerializer.Deserialize<PricingSettings>(nested.GetRawText(), opts) ?? new PricingSettings();
        else
            pricing = System.Text.Json.JsonSerializer.Deserialize<PricingSettings>(body.GetRawText(), opts) ?? new PricingSettings();
        return Ok(await svc.UpdateSettingsAsync(this.UserId(), new UpdateSettingsRequest(pricing), ct));
    }

    [HttpGet("kyc/queue")] public async Task<IActionResult> KycQueue(CancellationToken ct) => Ok(await providers.KycQueueAsync(ct));
    [HttpGet("kyc/{id:guid}")]
    public async Task<IActionResult> GetKyc(Guid id, CancellationToken ct)
    {
        var item = await providers.KycByIdAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }
    [HttpPost("kyc/{id:guid}/review")] public async Task<IActionResult> ReviewKyc(Guid id, [FromBody] ReviewKycRequest req, CancellationToken ct) => Ok(await providers.ReviewKycAsync(this.UserId(), id, req, ct));

    [HttpGet("payment-reviews")] public async Task<IActionResult> PaymentReviews(CancellationToken ct) => Ok(await svc.PaymentReviewsAsync(ct));
    [HttpGet("payment-reviews/{id:guid}")] public async Task<IActionResult> PaymentReview(Guid id, CancellationToken ct)
    {
        var item = (await svc.PaymentReviewsAsync(ct)).FirstOrDefault(x => x.Id == id);
        return item is null ? NotFound() : Ok(item);
    }
    [HttpPost("payment-reviews/{id:guid}/resolve")] public async Task<IActionResult> ResolvePaymentReview(Guid id, [FromBody] ResolvePaymentReviewRequest req, CancellationToken ct) => Ok(await svc.ResolvePaymentReviewAsync(this.UserId(), id, req, ct));
    [HttpGet("withdrawals")] public async Task<IActionResult> Withdrawals(CancellationToken ct) => Ok(await svc.WithdrawalsAsync(ct));
    [HttpPost("withdrawals/{id:guid}/process")] public async Task<IActionResult> ProcessWithdrawal(Guid id, [FromBody] WithdrawalProcessRequest req, CancellationToken ct) => Ok(await svc.ProcessWithdrawalAsync(this.UserId(), id, req, ct));

    [HttpGet("safety")] public async Task<IActionResult> Safety(CancellationToken ct) => Ok(await support.AllReportsAsync(ct));
    [HttpGet("safety/{id:guid}")] public async Task<IActionResult> SafetyReport(Guid id, CancellationToken ct)
    {
        var item = (await support.AllReportsAsync(ct)).FirstOrDefault(x => x.Id == id);
        return item is null ? NotFound() : Ok(item);
    }
    [HttpPost("safety/{id:guid}/resolve")] public async Task<IActionResult> ResolveSafety(Guid id, [FromBody] ResolveSafetyRequest req, CancellationToken ct) => Ok(await support.ResolveReportAsync(this.UserId(), id, req, ct));
    [HttpGet("emergencies")] public async Task<IActionResult> Emergencies([FromQuery] bool openOnly = false, CancellationToken ct = default) => Ok(await svc.EmergenciesAsync(openOnly, ct));
    [HttpPost("emergencies/{id:guid}/resolve")] public async Task<IActionResult> ResolveEmergency(Guid id, CancellationToken ct) { await svc.ResolveEmergencyAsync(id, ct); return NoContent(); }

    [HttpGet("reviews")] public async Task<IActionResult> ReportedReviews(CancellationToken ct) => Ok(await reviews.ForProviderAsync(Guid.Empty, ct));
    [HttpPost("reviews/{id:guid}/moderate")] public async Task<IActionResult> ModerateReview(Guid id, [FromQuery] bool hide, CancellationToken ct) { await reviews.ModerateAsync(id, hide, ct); return NoContent(); }

    [HttpGet("tickets")] public async Task<IActionResult> Tickets(CancellationToken ct) => Ok(await support.AllTicketsAsync(ct));
    [HttpPost("tickets/{id:guid}/reply")] public async Task<IActionResult> TicketReply(Guid id, [FromBody] TicketReplyRequest req, CancellationToken ct) => Ok(await support.SupportReplyAsync(this.UserId(), id, req, ct));
    [HttpPost("tickets/{id:guid}/close")] public async Task<IActionResult> CloseTicket(Guid id, CancellationToken ct) { await support.CloseTicketAsync(this.UserId(), id, ct); return NoContent(); }

    [HttpGet("audit")] public async Task<IActionResult> Audit(CancellationToken ct) => Ok(await svc.AuditAsync(ct));
    [HttpGet("reports")] public async Task<IActionResult> Reports(CancellationToken ct) => Ok(await svc.ReportsAsync(ct));
}
