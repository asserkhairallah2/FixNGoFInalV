using FixNGo.Application.DTOs;
using FixNGo.Application.Services;
using FixNGo.Application.Validators;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FixNGo.Web.Controllers;

[ApiController]
[Route("api/v1/auth")]
public sealed class AuthController(AuthService auth, IValidator<SignupRequest> signupValidator,
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
        => Ok(await auth.VerifyOtpAsync(req, ct));

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
    public IActionResult Me()
    {
        return Ok(new
        {
            id = User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value,
            email = User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Email)?.Value,
            role = User.FindFirst("role")?.Value
        });
    }
}
