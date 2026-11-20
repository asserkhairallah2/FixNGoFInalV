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
        return Ok(await auth.LoginAsync(req, Device, Ip, ct));
    }

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
        => Ok(new { resetToken = await auth.ExchangeResetOtpAsync(req, ct) });

    [HttpPost("reset-password")]
    public async Task<IActionResult> Reset([FromBody] ResetPasswordRequest req, CancellationToken ct)
    {
        await resetValidator.ValidateAndThrowAsync(req, ct);
        await auth.ResetPasswordAsync(req, ct);
        return NoContent();
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest req, CancellationToken ct)
    {
        await changeValidator.ValidateAndThrowAsync(req, ct);
        var sub = User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value;
        await auth.ChangePasswordAsync(Guid.Parse(sub!), req, ct);
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
        => Ok(await auth.UpdateMeAsync(this.UserId(), req, ct));

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

    [HttpPost("2fa/setup")]
    [Authorize]
    public async Task<IActionResult> Setup2Fa(CancellationToken ct)
        => Ok(await auth.SetupTwoFactorAsync(this.UserId(), ct));

    [HttpPost("2fa/enable")]
    [Authorize]
    public async Task<IActionResult> Enable2Fa([FromBody] TwoFactorVerifyRequest req, CancellationToken ct)
        => Ok(await auth.EnableTwoFactorAsync(this.UserId(), req, ct));

    [HttpPost("2fa/disable")]
    [Authorize]
    public async Task<IActionResult> Disable2Fa([FromBody] TwoFactorDisableRequest? req, CancellationToken ct)
    {
        await auth.DisableTwoFactorAsync(this.UserId(), req ?? new TwoFactorDisableRequest(), ct);
        return Ok(new { enabled = false });
    }
}
