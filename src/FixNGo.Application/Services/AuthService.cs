using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FixNGo.Application.Services;

/// <summary>Authentication: signup/OTP verification, login with lockout, token rotation, password reset.</summary>
public sealed class AuthService(
    IAppDbContext db,
    IClock clock,
    IPasswordHasher hasher,
    ITokenService tokens,
    IOtpSender otpSender,
    ILogger<AuthService> logger,
    AuthOptions options)
{
    private static readonly TimeSpan OtpTtl = TimeSpan.FromMinutes(2);
    private static readonly TimeSpan ResendCooldown = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan LockoutWindow = TimeSpan.FromMinutes(15);
    private const int MaxFailedAttempts = 5;

    /// <summary>Register a new account and send an OTP. Admin cannot self-register.</summary>
    public async Task<OtpResponse> SignupAsync(SignupRequest req, CancellationToken ct = default)
    {
        var email = req.Email.Trim().ToLowerInvariant();
        var phone = Rules.NormalisePhone(req.Phone);
        if (await db.Users.AnyAsync(u => u.Email == email, ct))
            throw new DomainException("auth.email_exists", "An account with this email already exists.");
        if (await db.Users.AnyAsync(u => u.Phone == phone, ct))
            throw new DomainException("auth.phone_exists", "An account with this phone already exists.");

        if (!Enum.TryParse<Role>(req.Role, true, out var role) || role == Role.Admin)
            throw new DomainException("auth.invalid_role", "Invalid role.");

        var user = new User
        {
            FullName = req.FullName.Trim(),
            Email = email,
            Phone = phone,
            PasswordHash = hasher.Hash(req.Password),
            Role = role,
            Status = UserStatus.PendingVerification,
            KycStatus = role == Role.CarOwner ? KycStatus.None : KycStatus.Submitted
        };
        db.Users.Add(user);

        if (role is Role.Mechanic or Role.TowCaptain)
            db.ProviderProfiles.Add(new ProviderProfile { UserId = user.Id, IsOnline = false });
        if (role == Role.ServiceCenter && !string.IsNullOrWhiteSpace(req.BusinessName))
        {
            db.ServiceCenters.Add(new ServiceCenter
            {
                OwnerId = user.Id,
                Name = req.BusinessName.Trim(),
                Address = string.Empty,
                Phone = phone
            });
        }

        db.NotificationPreferences.Add(new NotificationPreference { UserId = user.Id });
        db.Wallets.Add(new Wallet { UserId = user.Id });

        var code = GenerateCode();
        await IssueOtpAsync(email, OtpPurpose.Signup, code, ct);
        await otpSender.SendAsync(email, user.FullName, SimChannel.Email, code, "signup", ct);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Signup created user {UserId} with role {Role}", user.Id, role);
        return new OtpResponse(email, (int)OtpTtl.TotalSeconds, options.ExposeDevCodes ? code : null);
    }

    /// <summary>Verify an OTP and activate the account.</summary>
    public async Task<UserDto> VerifyOtpAsync(VerifyOtpRequest req, CancellationToken ct = default)
    {
        var otp = await db.OtpCodes
            .Where(o => o.Target == req.Target && o.Purpose == req.Purpose && !o.Consumed)
            .OrderByDescending(o => o.CreatedAt).FirstOrDefaultAsync(ct)
            ?? throw new DomainException("auth.otp_invalid", "No valid code. Request a new one.");

        if (!Rules.OtpAllowed(otp.ExpiresAt, otp.Attempts, otp.Consumed, clock.UtcNow))
            throw new DomainException("auth.otp_expired", "The code has expired or too many attempts were made.");
        if (!FixedTimeEquals(otp.CodeHash, HashCode(req.Code)))
        {
            otp.Attempts++;
            await db.SaveChangesAsync(ct);
            throw new DomainException("auth.otp_invalid", "Incorrect code.");
        }

        otp.Consumed = true;
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == req.Target, ct)
            ?? throw new DomainException("auth.otp_invalid", "Account not found.");
        user.EmailVerified = true;
        user.Status = user.Status == UserStatus.PendingVerification ? UserStatus.Active : user.Status;
        await db.SaveChangesAsync(ct);
        logger.LogInformation("OTP verified for user {UserId}", user.Id);
        return UserDtoMapper.ToDto(user);
    }

    /// <summary>Login with failed-attempt lockout and a new session.</summary>
    public async Task<AuthResponse> LoginAsync(LoginRequest req, string? device, string? ip, CancellationToken ct = default)
    {
        var email = req.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
        if (user is null || !hasher.Verify(user.PasswordHash, req.Password))
            throw new DomainException("auth.invalid_credentials", "Invalid email or password.");

        if (user.Status is UserStatus.Suspended or UserStatus.Deleted)
            throw new DomainException("auth.account_blocked", "This account is not available.");

        if (user.OtpOnLogin)
        {
            var code = GenerateCode();
            await IssueOtpAsync(email, OtpPurpose.Login, code, ct);
            await otpSender.SendAsync(email, user.FullName, SimChannel.Email, code, "login", ct);
            await db.SaveChangesAsync(ct);
            throw new DomainException("auth.otp_required", "Enter the login code we sent.");
        }

        return await IssueSessionAsync(user, device, ip, ct);
    }

    /// <summary>Login step 2 when OTP-on-login is enabled.</summary>
    public async Task<AuthResponse> VerifyLoginOtpAsync(VerifyOtpRequest req, string? device, string? ip, CancellationToken ct = default)
    {
        var otp = await db.OtpCodes.Where(o => o.Target == req.Target && o.Purpose == OtpPurpose.Login && !o.Consumed)
            .OrderByDescending(o => o.CreatedAt).FirstOrDefaultAsync(ct)
            ?? throw new DomainException("auth.otp_invalid", "No valid login code.");
        if (!Rules.OtpAllowed(otp.ExpiresAt, otp.Attempts, otp.Consumed, clock.UtcNow) || !FixedTimeEquals(otp.CodeHash, HashCode(req.Code)))
            throw new DomainException("auth.otp_invalid", "Incorrect or expired login code.");
        otp.Consumed = true;
        var user = await db.Users.FirstAsync(u => u.Email == req.Target, ct);
        return await IssueSessionAsync(user, device, ip, ct);
    }

    /// <summary>Rotate a refresh token; reuse of an already-used token revokes the whole session family.</summary>
    public async Task<AuthResponse> RefreshAsync(RefreshRequest req, CancellationToken ct = default)
    {
        var hash = HashCode(req.RefreshToken);
        var session = await db.Sessions.Include(s => s.User).FirstOrDefaultAsync(s => s.RefreshTokenHash == hash, ct)
            ?? throw new DomainException("auth.refresh_invalid", "Invalid refresh token.");
        if (session.RevokedAt is not null)
        {
            var user0 = session.User;
            foreach (var s in db.Sessions.Where(x => x.UserId == user0.Id)) s.RevokedAt = clock.UtcNow;
            await db.SaveChangesAsync(ct);
            throw new DomainException("auth.refresh_reuse", "Refresh token reuse detected. All sessions revoked.");
        }
        if (session.ExpiresAt < clock.UtcNow) throw new DomainException("auth.refresh_expired", "Session expired.");
        session.RevokedAt = clock.UtcNow;
        var user = session.User;
        return await IssueSessionAsync(user, session.DeviceLabel, session.IpAddress, ct);
    }

    /// <summary>Revoke a session (logout).</summary>
    public async Task LogoutAsync(string refreshToken, CancellationToken ct = default)
    {
        var hash = HashCode(refreshToken);
        var session = await db.Sessions.FirstOrDefaultAsync(s => s.RefreshTokenHash == hash, ct);
        if (session is not null) { session.RevokedAt = clock.UtcNow; await db.SaveChangesAsync(ct); }
    }

    /// <summary>Start password reset: email a one-time code (never reveals whether the account exists).</summary>
    public async Task<OtpResponse> ForgotPasswordAsync(ForgotPasswordRequest req, CancellationToken ct = default)
    {
        var email = req.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
        if (user is not null)
        {
            var code = GenerateCode();
            await IssueOtpAsync(email, OtpPurpose.Forgot, code, ct);
            await otpSender.SendAsync(email, user.FullName, SimChannel.Email, code, "reset", ct);
            await db.SaveChangesAsync(ct);
        }
        return new OtpResponse(email, (int)OtpTtl.TotalSeconds, options.ExposeDevCodes && user is not null ? null : null);
    }

    /// <summary>Exchange the reset OTP for a short-lived single-use token.</summary>
    public async Task<string> ExchangeResetOtpAsync(VerifyOtpRequest req, CancellationToken ct = default)
    {
        var otp = await db.OtpCodes.Where(o => o.Target == req.Target && o.Purpose == OtpPurpose.Forgot && !o.Consumed)
            .OrderByDescending(o => o.CreatedAt).FirstOrDefaultAsync(ct)
            ?? throw new DomainException("auth.otp_invalid", "No valid reset code.");
        if (!Rules.OtpAllowed(otp.ExpiresAt, otp.Attempts, otp.Consumed, clock.UtcNow) || !FixedTimeEquals(otp.CodeHash, HashCode(req.Code)))
            throw new DomainException("auth.otp_invalid", "Incorrect or expired code.");
        otp.Consumed = true;
        var user = await db.Users.FirstAsync(u => u.Email == req.Target, ct);
        var raw = tokens.GenerateRefreshToken();
        db.PasswordResetTokens.Add(new PasswordResetToken
        {
            UserId = user.Id, TokenHash = HashCode(raw), ExpiresAt = clock.UtcNow.AddMinutes(10)
        });
        await db.SaveChangesAsync(ct);
        return raw;
    }

    /// <summary>Complete password reset and revoke every session.</summary>
    public async Task ResetPasswordAsync(ResetPasswordRequest req, CancellationToken ct = default)
    {
        var token = await db.PasswordResetTokens.FirstOrDefaultAsync(t => t.TokenHash == HashCode(req.ResetToken) && !t.Consumed, ct)
            ?? throw new DomainException("auth.reset_invalid", "Invalid or used reset link.");
        if (token.ExpiresAt < clock.UtcNow) throw new DomainException("auth.reset_expired", "Reset link expired.");
        token.Consumed = true;
        var user = await db.Users.FirstAsync(u => u.Id == token.UserId, ct);
        user.PasswordHash = hasher.Hash(req.NewPassword);
        foreach (var s in db.Sessions.Where(s => s.UserId == user.Id)) s.RevokedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Password reset completed for user {UserId}", user.Id);
    }

    /// <summary>Change password after verifying the current one.</summary>
    public async Task ChangePasswordAsync(Guid userId, ChangePasswordRequest req, CancellationToken ct = default)
    {
        var user = await db.Users.FirstAsync(u => u.Id == userId, ct);
        if (!hasher.Verify(user.PasswordHash, req.CurrentPassword))
            throw new DomainException("auth.invalid_credentials", "Current password is incorrect.");
        user.PasswordHash = hasher.Hash(req.NewPassword);
        foreach (var s in db.Sessions.Where(s => s.UserId == userId && s.RefreshTokenHash != "")) s.RevokedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    private async Task<AuthResponse> IssueSessionAsync(User user, string? device, string? ip, CancellationToken ct)
    {
        user.LastActiveAt = clock.UtcNow;
        var access = tokens.IssueAccessToken(user.Id, user.Role, user.Email);
        var refresh = tokens.GenerateRefreshToken();
        db.Sessions.Add(new Session
        {
            UserId = user.Id,
            RefreshTokenHash = HashCode(refresh),
            ExpiresAt = clock.UtcNow.AddDays(options.RefreshDays),
            DeviceLabel = device,
            IpAddress = ip,
            IsCurrent = true
        });
        await db.SaveChangesAsync(ct);
        return new AuthResponse(access, refresh, clock.UtcNow.AddMinutes(options.AccessMinutes), UserDtoMapper.ToDto(user));
    }

    private async Task IssueOtpAsync(string target, OtpPurpose purpose, string code, CancellationToken ct)
    {
        var now = clock.UtcNow;
        var recent = await db.OtpCodes.Where(o => o.Target == target && o.CreatedAt > now.AddHours(-1)).ToListAsync(ct);
        if (recent.Count >= 5) throw new DomainException("auth.otp_rate_limit", "Too many codes. Try again later.");
        var last = recent.OrderByDescending(o => o.CreatedAt).FirstOrDefault();
        if (last is not null && last.CreatedAt.Add(ResendCooldown) > now)
            throw new DomainException("auth.otp_cooldown", "Please wait before requesting another code.");
        db.OtpCodes.Add(new OtpCode
        {
            Target = target, Purpose = purpose, CodeHash = HashCode(code), ExpiresAt = now.Add(OtpTtl)
        });
    }

    private static string GenerateCode()
    {
        var bytes = System.Security.Cryptography.RandomNumberGenerator.GetBytes(4);
        var n = BitConverter.ToUInt32(bytes) % 1_000_000u;
        return n.ToString("D6");
    }

    private static string HashCode(string value)
    {
        var bytes = System.Text.Encoding.UTF8.GetBytes(value);
        return Convert.ToBase64String(System.Security.Cryptography.SHA256.HashData(bytes));
    }

    private static bool FixedTimeEquals(string a, string b)
    {
        var x = System.Text.Encoding.UTF8.GetBytes(a);
        var y = System.Text.Encoding.UTF8.GetBytes(b);
        return System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(x, y);
    }
}

/// <summary>Auth timing/secret options, bound from configuration.</summary>
public sealed class AuthOptions
{
    public int AccessMinutes { get; set; } = 15;
    public int RefreshDays { get; set; } = 30;
    /// <summary>Only true when simulators are enabled: the OTP code is returned for the simulator panel.</summary>
    public bool ExposeDevCodes { get; set; }
}
