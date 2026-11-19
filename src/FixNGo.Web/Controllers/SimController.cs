using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Application.Services;
using FixNGo.Domain;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;

namespace FixNGo.Web.Controllers;

/// <summary>
/// Guards every simulator action inside MVC: a disabled dock returns 404 for both anonymous and
/// authenticated callers (before auth), while an enabled dock still requires a bearer token.
/// Authentication is handled here instead of [Authorize] so the disabled 404 cannot be pre-empted
/// by AuthorizationMiddleware returning 401/403 first.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
public sealed class SimulatorEnabledAttribute : Attribute, IAuthorizationFilter
{
    public int Order => int.MinValue;

    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var options = context.HttpContext.RequestServices.GetRequiredService<IOptions<SimulatorOptions>>().Value;
        if (!options.Enabled)
        {
            context.Result = new NotFoundResult();
            return;
        }
    }
}

/// <summary>Five-panel simulator dock API: notifications, payments, messages, OTP and GPS.</summary>
[ApiController]
[Route("api/v1/sim")]
[SimulatorEnabled]
public sealed class SimController(ISimulatorService sim) : ControllerBase
{
    // ---- Panel 1: notifications / fake push ----

    [HttpGet("push")]
    public async Task<IActionResult> ListPush([FromQuery] bool all = false, CancellationToken ct = default) =>
        Ok(await sim.ListPushesAsync(this.UserId(), all, ct));

    [HttpPost("push")]
    public async Task<IActionResult> SendPush([FromBody] SimSendPushRequest req, CancellationToken ct = default) =>
        Ok(await sim.SendPushAsync(this.UserId(), req, ct));

    [HttpPost("push/read-all")]
    public async Task<IActionResult> MarkAllPushRead(CancellationToken ct = default) =>
        Ok(await sim.MarkAllPushesReadAsync(this.UserId(), ct));

    [HttpPost("push/{id:guid}/read")]
    public async Task<IActionResult> MarkPushRead(Guid id, CancellationToken ct = default) =>
        Ok(await sim.MarkPushesReadAsync(new SimMarkReadRequest([id], "push"), ct));

    // ---- Panel 2: fake payment gateway ----

    [HttpGet("payments")]
    public async Task<IActionResult> Payments(CancellationToken ct = default) =>
        Ok(await sim.ListPaymentsAsync(ct));

    [HttpPost("payments/tokenise")]
    public async Task<IActionResult> Tokenise([FromBody] SimTokeniseRequest req, CancellationToken ct = default) =>
        Ok(await sim.TokeniseCardAsync(this.UserId(), req, ct));

    [HttpPost("payments/charge")]
    public async Task<IActionResult> Charge([FromBody] SimChargeRequest req, CancellationToken ct = default) =>
        Ok(await sim.ChargeAsync(this.UserId(), req, ct));

    [HttpPost("payments/{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id, CancellationToken ct = default) =>
        Ok(await sim.SetPaymentStatusAsync(id, "Succeeded", ct));

    [HttpPost("payments/{id:guid}/decline")]
    public async Task<IActionResult> Decline(Guid id, CancellationToken ct = default) =>
        Ok(await sim.SetPaymentStatusAsync(id, "Failed", ct));

    [HttpPost("payments/{id:guid}/refund")]
    public async Task<IActionResult> Refund(Guid id, CancellationToken ct = default) =>
        Ok(await sim.SetPaymentStatusAsync(id, "Refunded", ct));

    [HttpGet("withdrawals")]
    public async Task<IActionResult> Withdrawals(CancellationToken ct = default) =>
        Ok(await sim.ListWithdrawalsAsync(ct));

    [HttpPost("withdrawals/{id:guid}/advance")]
    public async Task<IActionResult> AdvanceWithdrawal(Guid id, CancellationToken ct = default) =>
        Ok(await sim.AdvanceWithdrawalAsync(id, ct));

    [HttpPost("withdrawals/{id:guid}/fail")]
    public async Task<IActionResult> FailWithdrawal(Guid id, [FromBody] SimFailWithdrawalRequest? req, CancellationToken ct = default) =>
        Ok(await sim.FailWithdrawalAsync(id, req?.Reason, ct));

    // ---- Panel 3: SMS / email inbox ----

    [HttpGet("messages")]
    public async Task<IActionResult> Messages([FromQuery] string? channel, CancellationToken ct = default)
    {
        SimChannel? parsed = null;
        if (!string.IsNullOrWhiteSpace(channel))
        {
            if (!Enum.TryParse(channel, true, out SimChannel value))
                return BadRequest(new { error = "sim.invalid_channel" });
            parsed = value;
        }
        return Ok(await sim.ListMessagesAsync(parsed, ct));
    }

    [HttpPost("messages")]
    public async Task<IActionResult> SendMessage([FromBody] SimSendMessageRequest req, CancellationToken ct = default) =>
        Ok(await sim.SendMessageAsync(req, ct));

    [HttpPost("messages/{id:guid}/read")]
    public async Task<IActionResult> MarkMessageRead(Guid id, CancellationToken ct = default) =>
        Ok(await sim.MarkMessagesReadAsync([id], ct));

    // ---- Panel 4: OTP ----

    [HttpGet("otps")]
    public async Task<IActionResult> Otps(CancellationToken ct = default) => Ok(await sim.ListOtpsAsync(ct));

    [HttpPost("otps/generate")]
    public async Task<IActionResult> GenerateOtp([FromBody] SimOtpGenerateRequest req, CancellationToken ct = default) =>
        Ok(await sim.GenerateOtpAsync(req, ct));

    [HttpPost("otps/verify")]
    public async Task<IActionResult> VerifyOtp([FromBody] SimOtpVerifyRequest req, CancellationToken ct = default) =>
        Ok(await sim.VerifyOtpAsync(req, ct));

    // ---- Panel 5: GPS / maps ----

    [HttpGet("gps")]
    public async Task<IActionResult> Gps([FromQuery] bool all = false, [FromQuery] Guid? userId = null,
        CancellationToken ct = default) => Ok(await sim.ListGpsAsync(this.UserId(), userId, all, ct));

    [HttpPut("gps")]
    public async Task<IActionResult> SetGps([FromBody] SimGpsSetRequest req, CancellationToken ct = default) =>
        Ok(await sim.SetGpsAsync(this.UserId(), req, ct));

    [HttpPost("gps/drive")]
    public async Task<IActionResult> Drive([FromBody] SimDriveRequest req, CancellationToken ct = default) =>
        Ok(await sim.DriveAsync(req, ct));

    [HttpPost("gps/stale")]
    public async Task<IActionResult> GoStale([FromBody] SimStaleRequest req, CancellationToken ct = default) =>
        Ok(await sim.GoStaleAsync(req.ProviderId, ct));
}

public sealed record SimFailWithdrawalRequest(string? Reason);
public sealed record SimStaleRequest(Guid ProviderId);

/// <summary>
/// One-line Program.cs registration: binds the simulator switch, registers the functional
/// service and lets the global 404 guard inspect IOptions&lt;SimulatorOptions&gt;.
/// </summary>
public static class SimulatorApiRegistration
{
    public static IServiceCollection AddSimulatorApi(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<SimulatorOptions>(configuration.GetSection("Simulators"));
        // Also honour the nested provider switch used by the master prompt; either key can disable the dock.
        services.PostConfigure<SimulatorOptions>(options =>
        {
            var nested = configuration.GetValue<bool?>("Providers:Simulators:Enabled");
            if (nested.HasValue) options.Enabled = options.Enabled && nested.Value;
        });
        services.AddScoped<ISimulatorService, SimulatorService>();
        return services;
    }
}
