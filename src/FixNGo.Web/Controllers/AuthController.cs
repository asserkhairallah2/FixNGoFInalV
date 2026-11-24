using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FixNGo.Web.Controllers;

[ApiController]
[Route("api/v1/auth")]
public sealed class AuthController(IAuthService auth, IValidator<SignupRequest> signupValidator,
    IValidator<LoginRequest> loginValidator, IValidator<ForgotPasswordRequest> forgotValidator,
    IValidator<ResetPasswordRequest> resetValidator, IValidator<ChangePasswordRequest> changeValidator) : ControllerBase
{
    private string? Device => Request.Headers["User-Agent"].FirstOrDefault();
    private string? Ip => HttpContext.Connection.RemoteIpAddress?.ToString();
    private string? HeaderStepUpToken => Request.Headers["X-StepUp-Token"].FirstOrDefault();

    [HttpPost("signup")]
    public async Task<IActionResult> Signup([FromBody] SignupRequest req, CancellationToken ct)
    {
        await signupValidator.ValidateAndThrowAsync(req, ct);
        return Ok(await auth.SignupAsync(req, ct));
    }

    [HttpPost("verify-otp")]
    public async Task<IActionResult> VerifyOtp([FromBody] VerifyOtpRequest req, CancellationToken ct)
    {
        if (req.IssueSession)
            return Ok(await auth.VerifyOtpAndIssueSessionAsync(req, Device, Ip, ct));
        return Ok(await auth.VerifyOtpAsync(req, ct));
    }

    [HttpPost("resend-otp")]
    public async Task<IActionResult> ResendOtp([FromBody] ResendOtpRequest req, CancellationToken ct)
        => Ok(await auth.ResendOtpAsync(req, ct));

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req, CancellationToken ct)
    {
        await loginValidator.ValidateAndThrowAsync(req, ct);
        var flow = await auth.LoginFlowAsync(req, Device, Ip, ct);
        if (!flow.RequiresTwoFactor && flow.Session is not null)
            return Ok(flow.Session);
        return Ok(flow);
    }

    [HttpPost("login/verify-2fa")]
    public async Task<IActionResult> VerifyLogin2Fa([FromBody] VerifyTwoFactorChallengeRequest req, CancellationToken ct)
        => Ok(await auth.VerifyLoginTwoFactorAsync(req, Device, Ip, ct));

    [HttpPost("login/verify-otp")]
    public async Task<IActionResult> VerifyLoginOtp([FromBody] VerifyOtpRequest req, CancellationToken ct)
        => Ok(await auth.VerifyLoginOtpAsync(req, Device, Ip, ct));

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest req, CancellationToken ct)
        => Ok(await auth.RefreshAsync(req, ct));

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout([FromBody] RefreshRequest req, CancellationToken ct)
    {
        await auth.LogoutAsync(req.RefreshToken, ct);
        return NoContent();
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> Forgot([FromBody] ForgotPasswordRequest req, CancellationToken ct)
    {
        await forgotValidator.ValidateAndThrowAsync(req, ct);
        return Ok(await auth.ForgotPasswordAsync(req, ct));
    }

    [HttpPost("reset-otp")]
    public async Task<IActionResult> ResetOtp([FromBody] VerifyOtpRequest req, CancellationToken ct)
    {
        var flow = await auth.ExchangeResetOtpFlowAsync(req, ct);
        if (!flow.RequiresTwoFactor)
            return Ok(new { requiresTwoFactor = false, resetToken = flow.ResetToken });
        return Ok(flow);
    }

    [HttpPost("reset-otp/verify-2fa")]
    public async Task<IActionResult> VerifyReset2Fa([FromBody] VerifyTwoFactorChallengeRequest req, CancellationToken ct)
        => Ok(new { resetToken = await auth.VerifyResetTwoFactorAsync(req, ct) });

    [HttpPost("reset-password")]
    public async Task<IActionResult> Reset([FromBody] ResetPasswordRequest req, CancellationToken ct)
    {
        await resetValidator.ValidateAndThrowAsync(req, ct);
        await auth.ResetPasswordAsync(req, ct);
        return NoContent();
    }

    [HttpPost("in-app-reset/start")]
    [Authorize]
    public async Task<IActionResult> StartInAppReset(CancellationToken ct)
        => Ok(await auth.StartInAppPasswordResetAsync(this.UserId(), ct));

    [HttpPost("in-app-reset/complete")]
    [Authorize]
    public async Task<IActionResult> CompleteInAppReset([FromBody] InAppResetCompleteRequest req, CancellationToken ct)
    {
        var effective = string.IsNullOrWhiteSpace(req.StepUpToken) && !string.IsNullOrWhiteSpace(HeaderStepUpToken)
            ? req with { StepUpToken = HeaderStepUpToken }
            : req;
        return Ok(await auth.CompleteInAppPasswordResetAsync(this.UserId(), effective, Device, Ip, ct));
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest req, CancellationToken ct)
    {
        await changeValidator.ValidateAndThrowAsync(req, ct);
        var effective = string.IsNullOrWhiteSpace(req.StepUpToken) && !string.IsNullOrWhiteSpace(HeaderStepUpToken)
            ? req with { StepUpToken = HeaderStepUpToken }
            : req;
        await auth.ChangePasswordAsync(this.UserId(), effective, ct);
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var sub = User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value;
        if (Guid.TryParse(sub, out var userId))
        {
            var profile = await auth.GetMeAsync(userId, ct);
            if (profile is not null) return Ok(profile);
        }
        return Ok(new
        {
            id = sub,
            email = User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Email)?.Value,
            role = User.FindFirst("role")?.Value
        });
    }

    [HttpPut("me")]
    [Authorize]
    public async Task<IActionResult> UpdateMe([FromBody] UpdateMeRequest req, CancellationToken ct)
    {
        var effective = string.IsNullOrWhiteSpace(req.StepUpToken) && !string.IsNullOrWhiteSpace(HeaderStepUpToken)
            ? req with { StepUpToken = HeaderStepUpToken }
            : req;
        return Ok(await auth.UpdateMeAsync(this.UserId(), effective, ct));
    }

    [HttpGet("sessions")]
    [Authorize]
    public async Task<IActionResult> MySessions(CancellationToken ct)
        => Ok(await auth.MySessionsAsync(this.UserId(), ct));

    [HttpDelete("sessions/{id:guid}")]
    [Authorize]
    public async Task<IActionResult> RevokeMySession(Guid id, CancellationToken ct)
    {
        await auth.RevokeMySessionAsync(this.UserId(), id, ct);
        return NoContent();
    }

    [HttpPost("sessions/revoke-others")]
    [Authorize]
    public async Task<IActionResult> RevokeOthers(CancellationToken ct)
        => Ok(new { revoked = await auth.RevokeOtherSessionsAsync(this.UserId(), null, ct) });

    // ---- Google-grade 2FA endpoints ----

    [HttpGet("2fa/status")]
    [Authorize]
    public async Task<IActionResult> TwoFactorStatus(CancellationToken ct)
        => Ok(await auth.GetTwoFactorStatusAsync(this.UserId(), ct));

    [HttpPost("2fa/step-up")]
    [Authorize]
    public async Task<IActionResult> StepUp([FromBody] StepUpVerifyRequest req, CancellationToken ct)
        => Ok(await auth.VerifyStepUpAsync(this.UserId(), req, ct));

    [HttpPost("2fa/send-sms")]
    [AllowAnonymous]
    public async Task<IActionResult> Send2FaSms([FromBody] SendTwoFactorSmsRequest? req, CancellationToken ct)
    {
        Guid? callerId = null;
        var sub = User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value;
        if (Guid.TryParse(sub, out var parsed)) callerId = parsed;
        return Ok(await auth.SendTwoFactorSmsAsync(callerId, req ?? new SendTwoFactorSmsRequest(), ct));
    }

    [HttpPost("2fa/setup")]
    [HttpPost("2fa/totp/setup")]
    [Authorize]
    public async Task<IActionResult> Setup2Fa(CancellationToken ct)
        => Ok(await auth.SetupTwoFactorAsync(this.UserId(), HeaderStepUpToken, ct));

    [HttpPost("2fa/enable")]
    [HttpPost("2fa/totp/enable")]
    [Authorize]
    public async Task<IActionResult> Enable2Fa([FromBody] TwoFactorVerifyRequest req, CancellationToken ct)
    {
        var effective = string.IsNullOrWhiteSpace(req.StepUpToken) && !string.IsNullOrWhiteSpace(HeaderStepUpToken)
            ? req with { StepUpToken = HeaderStepUpToken }
            : req;
        return Ok(await auth.EnableTwoFactorAsync(this.UserId(), effective, ct));
    }

    [HttpPost("2fa/totp/disable")]
    [Authorize]
    public async Task<IActionResult> DisableTotp([FromBody] TwoFactorDisableRequest? req, CancellationToken ct)
    {
        var body = req ?? new TwoFactorDisableRequest();
        if (string.IsNullOrWhiteSpace(body.StepUpToken) && !string.IsNullOrWhiteSpace(HeaderStepUpToken))
            body = body with { StepUpToken = HeaderStepUpToken };
        return Ok(await auth.DisableTotpTwoFactorAsync(this.UserId(), body, ct));
    }

    [HttpPost("2fa/sms/setup")]
    [Authorize]
    public async Task<IActionResult> SetupSms2Fa(CancellationToken ct)
        => Ok(await auth.SetupSmsTwoFactorAsync(this.UserId(), HeaderStepUpToken, ct));

    [HttpPost("2fa/sms/enable")]
    [Authorize]
    public async Task<IActionResult> EnableSms2Fa([FromBody] TwoFactorVerifyRequest req, CancellationToken ct)
    {
        var effective = string.IsNullOrWhiteSpace(req.StepUpToken) && !string.IsNullOrWhiteSpace(HeaderStepUpToken)
            ? req with { StepUpToken = HeaderStepUpToken }
            : req;
        return Ok(await auth.EnableSmsTwoFactorAsync(this.UserId(), effective, ct));
    }

    [HttpPost("2fa/sms/disable")]
    [Authorize]
    public async Task<IActionResult> DisableSms2Fa([FromBody] TwoFactorDisableRequest? req, CancellationToken ct)
    {
        var body = req ?? new TwoFactorDisableRequest();
        if (string.IsNullOrWhiteSpace(body.StepUpToken) && !string.IsNullOrWhiteSpace(HeaderStepUpToken))
            body = body with { StepUpToken = HeaderStepUpToken };
        return Ok(await auth.DisableSmsTwoFactorAsync(this.UserId(), body, ct));
    }

    [HttpPost("2fa/recovery-codes/regenerate")]
    [Authorize]
    public async Task<IActionResult> RegenerateRecoveryCodes(CancellationToken ct)
        => Ok(await auth.RegenerateRecoveryCodesAsync(this.UserId(), HeaderStepUpToken, ct));

    [HttpPost("2fa/disable")]
    [Authorize]
    public async Task<IActionResult> Disable2Fa([FromBody] TwoFactorDisableRequest? req, CancellationToken ct)
    {
        var body = req ?? new TwoFactorDisableRequest();
        if (string.IsNullOrWhiteSpace(body.StepUpToken) && !string.IsNullOrWhiteSpace(HeaderStepUpToken))
            body = body with { StepUpToken = HeaderStepUpToken };
        await auth.DisableTwoFactorAsync(this.UserId(), body, ct);
        return Ok(new { enabled = false });
    }
}
