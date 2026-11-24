using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FixNGo.Application.Services;

/// <summary>Authentication: signup/OTP verification, Google-grade 2FA (TOTP + SMS), step-up re-auth, login, token rotation, password reset &amp; security emails.</summary>
public sealed class AuthService(
    IAppDbContext db,
    IClock clock,
    IPasswordHasher hasher,
    ITokenService tokens,
    IOtpSender otpSender,
    ILogger<AuthService> logger,
    AuthOptions options) : IAuthService
{
    private static readonly TimeSpan OtpTtl = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan ResendCooldown = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan ChallengeTtl = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan StepUpTtl = TimeSpan.FromMinutes(10);

    private const string PurposeReset = "Reset";
    private const string PurposeLogin2Fa = "Login2Fa";
    private const string PurposeForgot2Fa = "Forgot2Fa";
    private const string PurposeStepUp = "StepUp";

    private static bool IsTotpActive(User u) =>
        (u.TotpEnabled || u.TwoFactorEnabled) && !string.IsNullOrWhiteSpace(u.TwoFactorSecret);

    private static bool IsSmsActive(User u) =>
        u.SmsTwoFactorEnabled && !string.IsNullOrWhiteSpace(u.Phone);

    private static bool IsAny2FaActive(User u) => IsTotpActive(u) || IsSmsActive(u);

    private static List<string> GetAvailableMethods(User u)
    {
        var list = new List<string>(2);
        if (IsTotpActive(u)) list.Add("totp");
        if (IsSmsActive(u)) list.Add("sms");
        return list;
    }

    private static void SyncAggregateTwoFactorFlag(User u)
    {
        u.TwoFactorEnabled = IsTotpActive(u) || IsSmsActive(u);
    }

    private static TwoFactorStatusDto BuildStatusDto(User u)
    {
        var totp = IsTotpActive(u);
        var sms = IsSmsActive(u);
        var methods = GetAvailableMethods(u);
        var hasRecovery = !string.IsNullOrWhiteSpace(u.TwoFactorRecoveryHashes) && u.TwoFactorRecoveryHashes != "[]";
        return new TwoFactorStatusDto(
            TwoFactorEnabled: totp || sms,
            TotpEnabled: totp,
            SmsEnabled: sms,
            AvailableMethods: methods,
            MaskedPhone: UserDtoMapper.MaskPhone(u.Phone),
            Phone: u.Phone,
            HasRecoveryCodes: hasRecovery);
    }

    /// <summary>Register a new account and send an OTP. Admin cannot self-register. 2FA is NOT forced during signup.</summary>
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
            KycStatus = role == Role.CarOwner ? KycStatus.None : KycStatus.Submitted,
            TwoFactorEnabled = false,
            TotpEnabled = false,
            SmsTwoFactorEnabled = false
        };
        db.Users.Add(user);

        if (role is Role.Mechanic or Role.TowCaptain)
            db.ProviderProfiles.Add(new ProviderProfile { UserId = user.Id, IsOnline = false });
        if (role == Role.ServiceCenter)
        {
            db.ServiceCenters.Add(new ServiceCenter
            {
                OwnerId = user.Id,
                Name = !string.IsNullOrWhiteSpace(req.BusinessName) ? req.BusinessName.Trim() : user.FullName,
                Address = "Cairo, Egypt",
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
        var target = req.Target.Trim().ToLowerInvariant();
        var otp = await db.OtpCodes
            .Where(o => o.Target == target && o.Purpose == req.Purpose && !o.Consumed)
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
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == target, ct)
            ?? throw new DomainException("auth.otp_invalid", "Account not found.");
        user.EmailVerified = true;
        user.Status = user.Status == UserStatus.PendingVerification ? UserStatus.Active : user.Status;
        await db.SaveChangesAsync(ct);

        await otpSender.SendSecurityAlertAsync(
            user.Email,
            user.FullName,
            "FixNGo — Welcome! Your email is verified",
            "Welcome to FixNGo",
            "Your email address has been verified and your FixNGo account is now active. You can optionally enable 2-Step Verification anytime from Account Settings.",
            ct);

        logger.LogInformation("OTP verified for user {UserId}", user.Id);
        return UserDtoMapper.ToDto(user);
    }

    /// <summary>Verify an OTP, activate the account, and issue a live session so signup flows stay signed in.</summary>
    public async Task<AuthResponse> VerifyOtpAndIssueSessionAsync(VerifyOtpRequest req, string? device, string? ip, CancellationToken ct = default)
    {
        var dto = await VerifyOtpAsync(req, ct);
        var user = await db.Users.FirstAsync(u => u.Id == dto.Id, ct);
        return await IssueSessionAsync(user, device, ip, ct);
    }

    /// <summary>Resend an OTP code with cooldown and hourly limit checks.</summary>
    public async Task<OtpResponse> ResendOtpAsync(ResendOtpRequest req, CancellationToken ct = default)
    {
        var target = req.Target.Trim();
        var isEmail = target.Contains('@');
        if (isEmail) target = target.ToLowerInvariant();
        var user = isEmail
            ? await db.Users.FirstOrDefaultAsync(u => u.Email == target, ct)
            : await db.Users.FirstOrDefaultAsync(u => u.Phone == target, ct);
        var code = GenerateCode();
        await IssueOtpAsync(target, req.Purpose, code, ct);
        await otpSender.SendAsync(
            target,
            user?.FullName ?? target,
            isEmail ? SimChannel.Email : SimChannel.Sms,
            code,
            req.Purpose.ToString().ToLowerInvariant(),
            ct);
        await db.SaveChangesAsync(ct);
        return new OtpResponse(target, (int)OtpTtl.TotalSeconds, options.ExposeDevCodes ? code : null);
    }

    public async Task<UserDto?> GetMeAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        return user is null ? null : UserDtoMapper.ToDto(user);
    }

    public async Task<UserDto> UpdateMeAsync(Guid userId, UpdateMeRequest req, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new DomainException("user.not_found", "User not found.");

        var oldEmail = user.Email;
        var oldName = user.FullName;
        var oldPhone = user.Phone;

        var nextName = !string.IsNullOrWhiteSpace(req.FullName) ? req.FullName.Trim() : user.FullName;
        var nextEmail = !string.IsNullOrWhiteSpace(req.Email) ? req.Email.Trim().ToLowerInvariant() : user.Email;
        var nextPhone = !string.IsNullOrWhiteSpace(req.Phone) ? Rules.NormalisePhone(req.Phone) : user.Phone;

        var coreIdentityChanged =
            !string.Equals(nextName, oldName, StringComparison.Ordinal) ||
            !string.Equals(nextEmail, oldEmail, StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(nextPhone, oldPhone, StringComparison.Ordinal) ||
            (req.OtpOnLogin.HasValue && req.OtpOnLogin.Value != user.OtpOnLogin);

        if (coreIdentityChanged && IsAny2FaActive(user))
        {
            await EnsureStepUpOrInline2FaAsync(user, req.StepUpToken, req.TwoFactorMethod, req.TwoFactorCode, ct);
        }

        if (!string.IsNullOrWhiteSpace(req.FullName))
            user.FullName = nextName;

        if (!string.IsNullOrWhiteSpace(req.Email) && !string.Equals(nextEmail, user.Email, StringComparison.OrdinalIgnoreCase))
        {
            if (await db.Users.AnyAsync(u => u.Email == nextEmail && u.Id != userId, ct))
                throw new DomainException("auth.email_exists", "An account with this email already exists.");
            user.Email = nextEmail;
        }

        if (!string.IsNullOrWhiteSpace(req.Phone) && !string.Equals(nextPhone, user.Phone, StringComparison.Ordinal))
        {
            if (await db.Users.AnyAsync(u => u.Phone == nextPhone && u.Id != userId, ct))
                throw new DomainException("auth.phone_exists", "An account with this phone already exists.");
            user.Phone = nextPhone;
        }

        if (!string.IsNullOrWhiteSpace(req.Language)) user.Language = req.Language.Trim().ToLowerInvariant();
        if (!string.IsNullOrWhiteSpace(req.Theme)) user.Theme = req.Theme.Trim().ToLowerInvariant();
        if (req.OtpOnLogin.HasValue) user.OtpOnLogin = req.OtpOnLogin.Value;
        if (req.Latitude.HasValue) user.Latitude = req.Latitude.Value;
        if (req.Longitude.HasValue) user.Longitude = req.Longitude.Value;
        if (req.AreaLabel is not null) user.AreaLabel = req.AreaLabel.Trim();

        await db.SaveChangesAsync(ct);

        if (coreIdentityChanged)
        {
            var summary = $"Your FixNGo account profile details were updated (Name: {user.FullName}, Email: {user.Email}, Phone: {user.Phone ?? "—"}).";
            await otpSender.SendSecurityAlertAsync(
                oldEmail,
                user.FullName,
                "FixNGo Security Alert — Account details updated",
                "Your account details were updated",
                summary,
                ct);

            if (!string.Equals(oldEmail, user.Email, StringComparison.OrdinalIgnoreCase))
            {
                await otpSender.SendSecurityAlertAsync(
                    user.Email,
                    user.FullName,
                    "FixNGo Security Alert — Email address linked to your account",
                    "Your email address was updated",
                    summary,
                    ct);
            }
        }

        return UserDtoMapper.ToDto(user);
    }

    public async Task<IReadOnlyList<SessionDto>> MySessionsAsync(Guid userId, CancellationToken ct = default) =>
        await db.Sessions.Where(s => s.UserId == userId && s.RevokedAt == null)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new SessionDto(s.Id, s.DeviceLabel ?? "Web Browser", s.IpAddress ?? "127.0.0.1", s.ExpiresAt, s.RevokedAt))
            .ToListAsync(ct);

    public async Task RevokeMySessionAsync(Guid userId, Guid sessionId, CancellationToken ct = default)
    {
        var s = await db.Sessions.FirstOrDefaultAsync(x => x.Id == sessionId && x.UserId == userId, ct)
            ?? throw new DomainException("session.not_found", "Session not found.");
        s.RevokedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    public async Task<int> RevokeOtherSessionsAsync(Guid userId, Guid? keepSessionId, CancellationToken ct = default)
    {
        var active = await db.Sessions.Where(s => s.UserId == userId && s.RevokedAt == null).OrderByDescending(s => s.CreatedAt).ToListAsync(ct);
        var keep = keepSessionId ?? active.FirstOrDefault()?.Id;
        var count = 0;
        foreach (var s in active.Where(s => s.Id != keep))
        {
            s.RevokedAt = clock.UtcNow;
            count++;
        }
        if (count > 0) await db.SaveChangesAsync(ct);
        return count;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GOOGLE-GRADE TWO-FACTOR AUTHENTICATION (TOTP + PHONE SMS + STEP-UP)
    // ═══════════════════════════════════════════════════════════════════════════

    public async Task<TwoFactorStatusDto> GetTwoFactorStatusAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new DomainException("user.not_found", "User not found.");
        return BuildStatusDto(user);
    }

    public async Task<StepUpTokenDto> VerifyStepUpAsync(Guid userId, StepUpVerifyRequest req, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new DomainException("user.not_found", "User not found.");
        if (!IsAny2FaActive(user))
            throw new DomainException("auth.2fa_not_enabled", "Two-factor authentication is not enabled on this account.");

        await VerifyUserTwoFactorAsync(user, req.Method, req.Code, ct);
        var (raw, expiresAt) = CreateSecurityToken(user.Id, PurposeStepUp, StepUpTtl);
        await db.SaveChangesAsync(ct);
        return new StepUpTokenDto(raw, expiresAt);
    }

    public async Task<TwoFactorSmsDispatchDto> SendTwoFactorSmsAsync(Guid? callerUserId, SendTwoFactorSmsRequest req, CancellationToken ct = default)
    {
        User? user = null;
        if (!string.IsNullOrWhiteSpace(req.ChallengeToken))
        {
            var hash = HashCode(req.ChallengeToken.Trim());
            var token = await db.PasswordResetTokens.Include(t => t.User)
                .FirstOrDefaultAsync(t => t.TokenHash == hash && !t.Consumed && (t.Purpose == PurposeLogin2Fa || t.Purpose == PurposeForgot2Fa), ct)
                ?? throw new DomainException("auth.challenge_invalid", "Verification session expired. Please try again.");
            if (token.ExpiresAt < clock.UtcNow)
                throw new DomainException("auth.challenge_expired", "Verification session expired. Please try again.");
            user = token.User;
        }
        else if (callerUserId.HasValue && callerUserId.Value != Guid.Empty)
        {
            user = await db.Users.FirstOrDefaultAsync(u => u.Id == callerUserId.Value, ct);
        }

        if (user is null)
            throw new DomainException("user.not_found", "Account not found.");
        if (!IsSmsActive(user))
            throw new DomainException("auth.sms_2fa_not_enabled", "SMS 2-Step Verification is not enabled for this account.");

        var code = await IssueAndSendSmsCodeAsync(user, OtpPurpose.TwoFactor, ct);
        await db.SaveChangesAsync(ct);
        return new TwoFactorSmsDispatchDto(UserDtoMapper.MaskPhone(user.Phone) ?? user.Phone!, (int)OtpTtl.TotalSeconds, options.ExposeDevCodes ? code : null);
    }

    public Task<TwoFactorSetupDto> SetupTwoFactorAsync(Guid userId, CancellationToken ct = default) =>
        SetupTwoFactorAsync(userId, null, ct);

    public async Task<TwoFactorSetupDto> SetupTwoFactorAsync(Guid userId, string? stepUpToken, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new DomainException("user.not_found", "User not found.");
        if (IsAny2FaActive(user))
            await EnsureStepUpOrInline2FaAsync(user, stepUpToken, null, null, ct);

        var secretBytes = System.Security.Cryptography.RandomNumberGenerator.GetBytes(20);
        var secret = ToBase32(secretBytes);
        user.PendingTotpSecret = secret;
        if (!IsTotpActive(user))
            user.TwoFactorSecret = secret;
        await db.SaveChangesAsync(ct);

        var uri = $"otpauth://totp/FixNGo:{Uri.EscapeDataString(user.Email)}?secret={secret}&issuer=FixNGo&digits=6&period=30";
        var currentCode = ComputeTotp(secretBytes, clock.UtcNow);
        return new TwoFactorSetupDto(secret, uri, currentCode);
    }

    public async Task<TwoFactorEnableDto> EnableTwoFactorAsync(Guid userId, TwoFactorVerifyRequest req, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new DomainException("user.not_found", "User not found.");
        if (IsAny2FaActive(user) && !string.IsNullOrWhiteSpace(req.StepUpToken))
            await EnsureStepUpOrInline2FaAsync(user, req.StepUpToken, null, null, ct);

        var candidateSecret = !string.IsNullOrWhiteSpace(user.PendingTotpSecret) ? user.PendingTotpSecret : user.TwoFactorSecret;
        if (string.IsNullOrWhiteSpace(candidateSecret))
            throw new DomainException("auth.2fa_not_setup", "Run Authenticator setup first.");

        var secretBytes = FromBase32(candidateSecret);
        if (!VerifyTotp(secretBytes, req.Code?.Trim() ?? "", clock.UtcNow))
            throw new DomainException("auth.2fa_invalid", "Invalid 6-digit authenticator code.");

        user.TwoFactorSecret = candidateSecret;
        user.PendingTotpSecret = null;
        user.TotpEnabled = true;
        SyncAggregateTwoFactorFlag(user);

        var recovery = EnsureRecoveryCodes(user);
        var (stepUpRaw, _) = CreateSecurityToken(user.Id, PurposeStepUp, StepUpTtl);
        await db.SaveChangesAsync(ct);

        await otpSender.SendSecurityAlertAsync(
            user.Email,
            user.FullName,
            "FixNGo Security Alert — Authenticator App 2FA turned ON",
            "2-Step Verification enabled (Authenticator App)",
            "Authenticator App (6-digit rolling code) 2-Step Verification is now active on your FixNGo account.",
            ct);

        return new TwoFactorEnableDto(true, recovery, TotpEnabled: true, SmsEnabled: IsSmsActive(user), StepUpToken: stepUpRaw);
    }

    public async Task<TwoFactorStatusDto> DisableTotpTwoFactorAsync(Guid userId, TwoFactorDisableRequest req, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new DomainException("user.not_found", "User not found.");
        if (IsAny2FaActive(user))
            await EnsureStepUpOrInline2FaAsync(user, req.StepUpToken, req.Method, req.Code, ct);

        user.TotpEnabled = false;
        user.TwoFactorSecret = null;
        user.PendingTotpSecret = null;
        SyncAggregateTwoFactorFlag(user);
        if (!user.TwoFactorEnabled) user.TwoFactorRecoveryHashes = null;
        await db.SaveChangesAsync(ct);

        await otpSender.SendSecurityAlertAsync(
            user.Email,
            user.FullName,
            "FixNGo Security Alert — Authenticator App 2FA turned OFF",
            "Authenticator App 2-Step Verification turned off",
            "Authenticator App 2-Step Verification was removed from your FixNGo account.",
            ct);

        return BuildStatusDto(user);
    }

    public async Task<TwoFactorSmsDispatchDto> SetupSmsTwoFactorAsync(Guid userId, string? stepUpToken, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new DomainException("user.not_found", "User not found.");
        if (string.IsNullOrWhiteSpace(user.Phone))
            throw new DomainException("auth.phone_required", "Add a mobile phone number in Edit Account Details before enabling SMS 2FA.");
        if (IsAny2FaActive(user))
            await EnsureStepUpOrInline2FaAsync(user, stepUpToken, null, null, ct);

        var code = await IssueAndSendSmsCodeAsync(user, OtpPurpose.TwoFactorSmsSetup, ct);
        await db.SaveChangesAsync(ct);
        return new TwoFactorSmsDispatchDto(UserDtoMapper.MaskPhone(user.Phone) ?? user.Phone!, (int)OtpTtl.TotalSeconds, options.ExposeDevCodes ? code : null);
    }

    public async Task<TwoFactorEnableDto> EnableSmsTwoFactorAsync(Guid userId, TwoFactorVerifyRequest req, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new DomainException("user.not_found", "User not found.");
        if (string.IsNullOrWhiteSpace(user.Phone))
            throw new DomainException("auth.phone_required", "Mobile phone number is required.");

        await ConsumeOtpOrThrowAsync(user.Phone, OtpPurpose.TwoFactorSmsSetup, req.Code?.Trim() ?? "", ct);

        user.SmsTwoFactorEnabled = true;
        user.PhoneVerified = true;
        SyncAggregateTwoFactorFlag(user);

        var recovery = EnsureRecoveryCodes(user);
        var (stepUpRaw, _) = CreateSecurityToken(user.Id, PurposeStepUp, StepUpTtl);
        await db.SaveChangesAsync(ct);

        await otpSender.SendSecurityAlertAsync(
            user.Email,
            user.FullName,
            "FixNGo Security Alert — Mobile SMS 2FA turned ON",
            "2-Step Verification enabled (Mobile SMS)",
            $"SMS 2-Step Verification ({UserDtoMapper.MaskPhone(user.Phone)}) is now active on your FixNGo account.",
            ct);

        return new TwoFactorEnableDto(true, recovery, TotpEnabled: IsTotpActive(user), SmsEnabled: true, StepUpToken: stepUpRaw);
    }

    public async Task<TwoFactorStatusDto> DisableSmsTwoFactorAsync(Guid userId, TwoFactorDisableRequest req, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new DomainException("user.not_found", "User not found.");
        if (IsAny2FaActive(user))
            await EnsureStepUpOrInline2FaAsync(user, req.StepUpToken, req.Method, req.Code, ct);

        user.SmsTwoFactorEnabled = false;
        SyncAggregateTwoFactorFlag(user);
        if (!user.TwoFactorEnabled) user.TwoFactorRecoveryHashes = null;
        await db.SaveChangesAsync(ct);

        await otpSender.SendSecurityAlertAsync(
            user.Email,
            user.FullName,
            "FixNGo Security Alert — Mobile SMS 2FA turned OFF",
            "Mobile SMS 2-Step Verification turned off",
            "Mobile SMS 2-Step Verification was removed from your FixNGo account.",
            ct);

        return BuildStatusDto(user);
    }

    public async Task<TwoFactorEnableDto> RegenerateRecoveryCodesAsync(Guid userId, string? stepUpToken, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new DomainException("user.not_found", "User not found.");
        if (!IsAny2FaActive(user))
            throw new DomainException("auth.2fa_not_enabled", "Enable at least one 2FA method first.");
        await EnsureStepUpOrInline2FaAsync(user, stepUpToken, null, null, ct);

        user.TwoFactorRecoveryHashes = null;
        var recovery = EnsureRecoveryCodes(user);
        await db.SaveChangesAsync(ct);

        await otpSender.SendSecurityAlertAsync(
            user.Email,
            user.FullName,
            "FixNGo Security Alert — New 2FA recovery codes generated",
            "New backup recovery codes generated",
            "Your previous 2-Step Verification backup codes were invalidated and a fresh set of 8 recovery codes was generated.",
            ct);

        return new TwoFactorEnableDto(true, recovery, TotpEnabled: IsTotpActive(user), SmsEnabled: IsSmsActive(user), StepUpToken: stepUpToken);
    }

    public async Task DisableTwoFactorAsync(Guid userId, TwoFactorDisableRequest req, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new DomainException("user.not_found", "User not found.");
        if (!string.IsNullOrWhiteSpace(req.Password) && !hasher.Verify(user.PasswordHash, req.Password))
            throw new DomainException("auth.invalid_credentials", "Invalid password.");
        if (IsAny2FaActive(user))
            await EnsureStepUpOrInline2FaAsync(user, req.StepUpToken, req.Method, req.Code, ct);

        user.TwoFactorEnabled = false;
        user.TotpEnabled = false;
        user.SmsTwoFactorEnabled = false;
        user.TwoFactorSecret = null;
        user.PendingTotpSecret = null;
        user.TwoFactorRecoveryHashes = null;
        await db.SaveChangesAsync(ct);

        await otpSender.SendSecurityAlertAsync(
            user.Email,
            user.FullName,
            "FixNGo Security Alert — 2-Step Verification turned OFF",
            "2-Step Verification was turned off",
            "All 2-Step Verification methods have been disabled on your FixNGo account.",
            ct);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // LOGIN + 2FA CHALLENGE
    // ═══════════════════════════════════════════════════════════════════════════

    public async Task<AuthResponse> LoginAsync(LoginRequest req, string? device, string? ip, CancellationToken ct = default)
    {
        var flow = await LoginFlowAsync(req, device, ip, ct);
        if (flow.RequiresTwoFactor || flow.Session is null)
            throw new DomainException("auth.2fa_required", "Two-factor verification is required to sign in.");
        return flow.Session;
    }

    public async Task<LoginFlowResult> LoginFlowAsync(LoginRequest req, string? device, string? ip, CancellationToken ct = default)
    {
        var email = req.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
        if (user is null || !hasher.Verify(user.PasswordHash, req.Password))
            throw new DomainException("auth.invalid_credentials", "Invalid email or password.");

        if (user.Status is UserStatus.Suspended or UserStatus.Deleted)
            throw new DomainException("auth.account_blocked", "This account is not available.");

        if (IsAny2FaActive(user))
        {
            if (!string.IsNullOrWhiteSpace(req.TotpCode))
            {
                await VerifyUserTwoFactorAsync(user, req.TwoFactorMethod, req.TotpCode, ct);
                var directSession = await IssueSessionAsync(user, device, ip, ct);
                return new LoginFlowResult(false, directSession);
            }

            var methods = GetAvailableMethods(user);
            var defaultMethod = methods.Contains("totp") ? "totp" : methods[0];
            var (challengeRaw, _) = CreateSecurityToken(user.Id, PurposeLogin2Fa, ChallengeTtl);
            string? devSms = null;
            var smsSent = false;
            if (defaultMethod == "sms")
            {
                devSms = await IssueAndSendSmsCodeAsync(user, OtpPurpose.TwoFactor, ct);
                smsSent = true;
            }
            await db.SaveChangesAsync(ct);

            return new LoginFlowResult(
                RequiresTwoFactor: true,
                Session: null,
                ChallengeToken: challengeRaw,
                AvailableMethods: methods,
                MaskedPhone: UserDtoMapper.MaskPhone(user.Phone),
                DefaultMethod: defaultMethod,
                SmsSent: smsSent,
                DevCode: options.ExposeDevCodes ? devSms : null);
        }

        if (user.OtpOnLogin)
        {
            var code = GenerateCode();
            await IssueOtpAsync(email, OtpPurpose.Login, code, ct);
            await otpSender.SendAsync(email, user.FullName, SimChannel.Email, code, "login", ct);
            await db.SaveChangesAsync(ct);
            throw new DomainException("auth.otp_required", "Enter the login code we sent.");
        }

        var session = await IssueSessionAsync(user, device, ip, ct);
        return new LoginFlowResult(false, session);
    }

    public async Task<AuthResponse> VerifyLoginTwoFactorAsync(VerifyTwoFactorChallengeRequest req, string? device, string? ip, CancellationToken ct = default)
    {
        var token = await GetValidSecurityTokenAsync(req.ChallengeToken, PurposeLogin2Fa, ct);
        var user = token.User;

        await VerifyUserTwoFactorAsync(user, req.Method, req.Code, ct);
        token.Consumed = true;

        var session = await IssueSessionAsync(user, device, ip, ct);

        await otpSender.SendSecurityAlertAsync(
            user.Email,
            user.FullName,
            "FixNGo Security Alert — New sign-in verified with 2FA",
            "New sign-in to your FixNGo account",
            $"A sign-in to your FixNGo account was completed using 2-Step Verification ({req.Method.ToUpperInvariant()}).",
            ct);

        return session;
    }

    /// <summary>Login step 2 when OTP-on-login is enabled.</summary>
    public async Task<AuthResponse> VerifyLoginOtpAsync(VerifyOtpRequest req, string? device, string? ip, CancellationToken ct = default)
    {
        var target = req.Target.Trim().ToLowerInvariant();
        await ConsumeOtpOrThrowAsync(target, OtpPurpose.Login, req.Code, ct);
        var user = await db.Users.FirstAsync(u => u.Email == target, ct);
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

    // ═══════════════════════════════════════════════════════════════════════════
    // FORGOT PASSWORD + IN-APP PASSWORD RESET + CHANGE PASSWORD
    // ═══════════════════════════════════════════════════════════════════════════

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
        return new OtpResponse(email, (int)OtpTtl.TotalSeconds, null);
    }

    public async Task<string> ExchangeResetOtpAsync(VerifyOtpRequest req, CancellationToken ct = default)
    {
        var flow = await ExchangeResetOtpFlowAsync(req, ct);
        if (flow.RequiresTwoFactor || string.IsNullOrWhiteSpace(flow.ResetToken))
            throw new DomainException("auth.2fa_required", "Two-factor verification is required to reset this password.");
        return flow.ResetToken;
    }

    public async Task<ResetOtpFlowResult> ExchangeResetOtpFlowAsync(VerifyOtpRequest req, CancellationToken ct = default)
    {
        var target = req.Target.Trim().ToLowerInvariant();
        await ConsumeOtpOrThrowAsync(target, OtpPurpose.Forgot, req.Code, ct);
        var user = await db.Users.FirstAsync(u => u.Email == target, ct);

        if (IsAny2FaActive(user))
        {
            var methods = GetAvailableMethods(user);
            var defaultMethod = methods.Contains("totp") ? "totp" : methods[0];
            var (challengeRaw, _) = CreateSecurityToken(user.Id, PurposeForgot2Fa, ChallengeTtl);
            string? devSms = null;
            var smsSent = false;
            if (defaultMethod == "sms")
            {
                devSms = await IssueAndSendSmsCodeAsync(user, OtpPurpose.TwoFactor, ct);
                smsSent = true;
            }
            await db.SaveChangesAsync(ct);
            return new ResetOtpFlowResult(
                RequiresTwoFactor: true,
                ResetToken: null,
                ChallengeToken: challengeRaw,
                AvailableMethods: methods,
                MaskedPhone: UserDtoMapper.MaskPhone(user.Phone),
                DefaultMethod: defaultMethod,
                SmsSent: smsSent,
                DevCode: options.ExposeDevCodes ? devSms : null);
        }

        var (raw, _) = CreateSecurityToken(user.Id, PurposeReset, TimeSpan.FromMinutes(10));
        await db.SaveChangesAsync(ct);
        return new ResetOtpFlowResult(false, raw);
    }

    public async Task<string> VerifyResetTwoFactorAsync(VerifyTwoFactorChallengeRequest req, CancellationToken ct = default)
    {
        var challenge = await GetValidSecurityTokenAsync(req.ChallengeToken, PurposeForgot2Fa, ct);
        var user = challenge.User;

        await VerifyUserTwoFactorAsync(user, req.Method, req.Code, ct);
        challenge.Consumed = true;

        var (rawReset, _) = CreateSecurityToken(user.Id, PurposeReset, TimeSpan.FromMinutes(10));
        await db.SaveChangesAsync(ct);
        return rawReset;
    }

    /// <summary>Complete password reset, revoke every session, and send security alert email.</summary>
    public async Task ResetPasswordAsync(ResetPasswordRequest req, CancellationToken ct = default)
    {
        ValidateStrongPassword(req.NewPassword);
        var hash = HashCode(req.ResetToken);
        var token = await db.PasswordResetTokens.FirstOrDefaultAsync(t => t.TokenHash == hash && !t.Consumed && t.Purpose == PurposeReset, ct)
            ?? throw new DomainException("auth.reset_invalid", "Invalid or used reset link.");
        if (token.ExpiresAt < clock.UtcNow) throw new DomainException("auth.reset_expired", "Reset link expired.");
        token.Consumed = true;

        var user = await db.Users.FirstAsync(u => u.Id == token.UserId, ct);
        user.PasswordHash = hasher.Hash(req.NewPassword);
        foreach (var s in db.Sessions.Where(s => s.UserId == user.Id)) s.RevokedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);

        await otpSender.SendSecurityAlertAsync(
            user.Email,
            user.FullName,
            "FixNGo Security Alert — Your password was reset",
            "Your FixNGo password was reset",
            "Your FixNGo account password was successfully reset and previous sessions were signed out for your protection.",
            ct);

        logger.LogInformation("Password reset completed for user {UserId}", user.Id);
    }

    /// <summary>In-app password reset for signed-in users: ALWAYS sends a mandatory email OTP code first.</summary>
    public async Task<InAppResetStartDto> StartInAppPasswordResetAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new DomainException("user.not_found", "User not found.");

        var emailCode = GenerateCode();
        await IssueOtpAsync(user.Email, OtpPurpose.InAppReset, emailCode, ct);
        await otpSender.SendAsync(user.Email, user.FullName, SimChannel.Email, emailCode, "inappreset", ct);

        var methods = GetAvailableMethods(user);
        if (methods.Count == 1 && methods[0] == "sms")
        {
            await IssueAndSendSmsCodeAsync(user, OtpPurpose.TwoFactor, ct);
        }

        await db.SaveChangesAsync(ct);
        return new InAppResetStartDto(
            Target: user.Email,
            ExpiresInSeconds: (int)OtpTtl.TotalSeconds,
            RequiresTwoFactor: methods.Count > 0,
            AvailableMethods: methods,
            MaskedPhone: UserDtoMapper.MaskPhone(user.Phone),
            DevCode: options.ExposeDevCodes ? emailCode : null);
    }

    /// <summary>Complete in-app password reset: requires mandatory Email OTP + 2FA (if enabled), keeps current user signed in.</summary>
    public async Task<AuthResponse> CompleteInAppPasswordResetAsync(
        Guid userId,
        InAppResetCompleteRequest req,
        string? device,
        string? ip,
        CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new DomainException("user.not_found", "User not found.");

        ValidateStrongPassword(req.NewPassword);

        // Mandatory email code verification whether 2FA is enabled or not
        await ConsumeOtpOrThrowAsync(user.Email, OtpPurpose.InAppReset, req.EmailCode?.Trim() ?? "", ct);

        // Plus mandatory 2FA verification if 2FA is enabled
        if (IsAny2FaActive(user))
        {
            await EnsureStepUpOrInline2FaAsync(user, req.StepUpToken, req.TwoFactorMethod, req.TwoFactorCode, ct);
        }

        user.PasswordHash = hasher.Hash(req.NewPassword);
        foreach (var s in db.Sessions.Where(s => s.UserId == userId && s.RevokedAt == null))
            s.RevokedAt = clock.UtcNow;

        var freshSession = await IssueSessionAsync(user, device, ip, ct);

        await otpSender.SendSecurityAlertAsync(
            user.Email,
            user.FullName,
            "FixNGo Security Alert — Your password was reset",
            "Your FixNGo password was reset",
            "Your FixNGo password was reset from inside your account after email verification.",
            ct);

        return freshSession;
    }

    /// <summary>Change password after verifying current password (+ 2FA if enabled), and send security alert email.</summary>
    public async Task ChangePasswordAsync(Guid userId, ChangePasswordRequest req, CancellationToken ct = default)
    {
        var user = await db.Users.FirstAsync(u => u.Id == userId, ct);
        if (!hasher.Verify(user.PasswordHash, req.CurrentPassword))
            throw new DomainException("auth.invalid_credentials", "Current password is incorrect.");

        ValidateStrongPassword(req.NewPassword);

        if (IsAny2FaActive(user))
        {
            await EnsureStepUpOrInline2FaAsync(user, req.StepUpToken, req.TwoFactorMethod, req.TwoFactorCode, ct);
        }

        user.PasswordHash = hasher.Hash(req.NewPassword);
        await db.SaveChangesAsync(ct);

        await otpSender.SendSecurityAlertAsync(
            user.Email,
            user.FullName,
            "FixNGo Security Alert — Your password was changed",
            "Your FixNGo password was changed",
            "Your account password was recently updated. If you made this change, no further action is needed.",
            ct);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INTERNAL HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    private static void ValidateStrongPassword(string password)
    {
        if (string.IsNullOrWhiteSpace(password) ||
            password.Length < 8 ||
            !password.Any(char.IsUpper) ||
            !password.Any(char.IsLower) ||
            !password.Any(char.IsDigit) ||
            password.All(char.IsLetterOrDigit))
        {
            throw new DomainException("auth.weak_password", "Password must be at least 8 characters and include uppercase, lowercase, a digit, and a special character.");
        }
    }

    private List<string> EnsureRecoveryCodes(User user)
    {
        if (!string.IsNullOrWhiteSpace(user.TwoFactorRecoveryHashes) && user.TwoFactorRecoveryHashes != "[]")
        {
            try
            {
                var existing = System.Text.Json.JsonSerializer.Deserialize<List<string>>(user.TwoFactorRecoveryHashes);
                if (existing is { Count: > 0 }) return [];
            }
            catch { /* regenerate if corrupt */ }
        }

        var recovery = Enumerable.Range(0, 8)
            .Select(_ => $"{GenerateCode()[..4]}-{GenerateCode()[..4]}")
            .ToList();
        user.TwoFactorRecoveryHashes = System.Text.Json.JsonSerializer.Serialize(recovery.Select(HashCode).ToList());
        return recovery;
    }

    private (string RawToken, DateTime ExpiresAt) CreateSecurityToken(Guid userId, string purpose, TimeSpan ttl)
    {
        var raw = tokens.GenerateRefreshToken();
        var expires = clock.UtcNow.Add(ttl);
        db.PasswordResetTokens.Add(new PasswordResetToken
        {
            UserId = userId,
            TokenHash = HashCode(raw),
            Purpose = purpose,
            ExpiresAt = expires,
            Consumed = false
        });
        return (raw, expires);
    }

    private async Task<PasswordResetToken> GetValidSecurityTokenAsync(string rawToken, string purpose, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(rawToken))
            throw new DomainException("auth.challenge_invalid", "Verification token is missing.");
        var hash = HashCode(rawToken.Trim());
        var token = await db.PasswordResetTokens.Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == hash && !t.Consumed && t.Purpose == purpose, ct)
            ?? throw new DomainException("auth.challenge_invalid", "Verification session is invalid or already used.");
        if (token.ExpiresAt < clock.UtcNow)
            throw new DomainException("auth.challenge_expired", "Verification session expired. Please try again.");
        return token;
    }

    private async Task EnsureStepUpOrInline2FaAsync(
        User user,
        string? stepUpToken,
        string? inlineMethod,
        string? inlineCode,
        CancellationToken ct)
    {
        if (!IsAny2FaActive(user)) return;

        if (!string.IsNullOrWhiteSpace(stepUpToken))
        {
            var hash = HashCode(stepUpToken.Trim());
            var validStepUp = await db.PasswordResetTokens.AnyAsync(t =>
                t.UserId == user.Id &&
                t.TokenHash == hash &&
                t.Purpose == PurposeStepUp &&
                !t.Consumed &&
                t.ExpiresAt > clock.UtcNow, ct);
            if (validStepUp) return;
        }

        if (!string.IsNullOrWhiteSpace(inlineCode))
        {
            await VerifyUserTwoFactorAsync(user, inlineMethod, inlineCode, ct);
            return;
        }

        throw new DomainException("auth.2fa_required", "Two-factor verification is required to complete this action.");
    }

    private async Task VerifyUserTwoFactorAsync(User user, string? method, string? code, CancellationToken ct)
    {
        var cleanCode = (code ?? "").Trim();
        if (string.IsNullOrWhiteSpace(cleanCode))
            throw new DomainException("auth.2fa_invalid", "Please enter your 6-digit verification code.");

        var normalizedMethod = (method ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(normalizedMethod))
        {
            normalizedMethod = IsTotpActive(user) ? "totp" : IsSmsActive(user) ? "sms" : "recovery";
        }

        // Allow 8-char backup recovery codes (XXXX-XXXX) across any method
        if (normalizedMethod == "recovery" || cleanCode.Contains('-'))
        {
            if (TryConsumeRecoveryCode(user, cleanCode))
                return;
            throw new DomainException("auth.2fa_invalid", "Invalid or already used recovery code.");
        }

        if (normalizedMethod == "sms")
        {
            if (!IsSmsActive(user))
                throw new DomainException("auth.sms_2fa_not_enabled", "SMS 2-Step Verification is not enabled.");
            await ConsumeOtpOrThrowAsync(user.Phone!, OtpPurpose.TwoFactor, cleanCode, ct);
            return;
        }

        // Default: Authenticator App (TOTP)
        if (!IsTotpActive(user) || string.IsNullOrWhiteSpace(user.TwoFactorSecret))
            throw new DomainException("auth.totp_not_enabled", "Authenticator App 2-Step Verification is not enabled.");

        var secretBytes = FromBase32(user.TwoFactorSecret);
        if (!VerifyTotp(secretBytes, cleanCode, clock.UtcNow))
            throw new DomainException("auth.2fa_invalid", "Incorrect 6-digit authenticator code.");
    }

    private bool TryConsumeRecoveryCode(User user, string rawRecoveryCode)
    {
        if (string.IsNullOrWhiteSpace(user.TwoFactorRecoveryHashes)) return false;
        try
        {
            var hashes = System.Text.Json.JsonSerializer.Deserialize<List<string>>(user.TwoFactorRecoveryHashes) ?? [];
            var candidateHash = HashCode(rawRecoveryCode.Trim().ToUpperInvariant());
            var matchIdx = hashes.FindIndex(h => FixedTimeEquals(h, candidateHash));
            if (matchIdx < 0) return false;
            hashes.RemoveAt(matchIdx);
            user.TwoFactorRecoveryHashes = System.Text.Json.JsonSerializer.Serialize(hashes);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private async Task<string> IssueAndSendSmsCodeAsync(User user, OtpPurpose purpose, CancellationToken ct)
    {
        var phone = user.Phone!.Trim();
        var code = GenerateCode();
        await IssueOtpAsync(phone, purpose, code, ct, bypassCooldown: true);
        await otpSender.SendAsync(phone, user.FullName, SimChannel.Sms, code, purpose.ToString(), ct);
        return code;
    }

    private async Task ConsumeOtpOrThrowAsync(string target, OtpPurpose purpose, string code, CancellationToken ct)
    {
        var otp = await db.OtpCodes
            .Where(o => o.Target == target && o.Purpose == purpose && !o.Consumed)
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync(ct)
            ?? throw new DomainException("auth.otp_invalid", "No valid verification code found. Please request a new code.");

        if (!Rules.OtpAllowed(otp.ExpiresAt, otp.Attempts, otp.Consumed, clock.UtcNow))
            throw new DomainException("auth.otp_expired", "The verification code has expired or exceeded maximum attempts.");

        if (!FixedTimeEquals(otp.CodeHash, HashCode(code.Trim())))
        {
            otp.Attempts++;
            await db.SaveChangesAsync(ct);
            throw new DomainException("auth.otp_invalid", "Incorrect verification code.");
        }

        otp.Consumed = true;
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

    private async Task IssueOtpAsync(string target, OtpPurpose purpose, string code, CancellationToken ct, bool bypassCooldown = false)
    {
        var now = clock.UtcNow;
        var recent = await db.OtpCodes
            .Where(o => o.Target == target && o.Purpose == purpose && o.CreatedAt > now.AddHours(-1))
            .ToListAsync(ct);
        if (recent.Count >= 15)
            throw new DomainException("auth.otp_rate_limit", "Too many verification codes requested. Please try again later.");
        if (!bypassCooldown)
        {
            var last = recent.OrderByDescending(o => o.CreatedAt).FirstOrDefault();
            if (last is not null && last.CreatedAt.Add(ResendCooldown) > now)
                throw new DomainException("auth.otp_cooldown", "Please wait a moment before requesting another code.");
        }
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

    private const string Base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    private static string ToBase32(byte[] data)
    {
        var sb = new System.Text.StringBuilder();
        int buffer = data[0], next = 1, bitsLeft = 8;
        while (bitsLeft > 0 || next < data.Length)
        {
            if (bitsLeft < 5)
            {
                if (next < data.Length) { buffer = (buffer << 8) | (data[next++] & 0xff); bitsLeft += 8; }
                else { int pad = 5 - bitsLeft; buffer <<= pad; bitsLeft += pad; }
            }
            int index = 0x1f & (buffer >> (bitsLeft - 5));
            bitsLeft -= 5;
            sb.Append(Base32Alphabet[index]);
        }
        return sb.ToString();
    }

    private static byte[] FromBase32(string base32)
    {
        var clean = base32.Trim().TrimEnd('=').ToUpperInvariant();
        var bytes = new List<byte>();
        int buffer = 0, bitsLeft = 0;
        foreach (var c in clean)
        {
            var val = Base32Alphabet.IndexOf(c);
            if (val < 0) continue;
            buffer = (buffer << 5) | val;
            bitsLeft += 5;
            if (bitsLeft >= 8)
            {
                bytes.Add((byte)((buffer >> (bitsLeft - 8)) & 0xff));
                bitsLeft -= 8;
            }
        }
        return bytes.ToArray();
    }

    private static string ComputeTotp(byte[] secret, DateTime utcNow, long stepOffset = 0)
    {
        var unixSeconds = new DateTimeOffset(DateTime.SpecifyKind(utcNow, DateTimeKind.Utc)).ToUnixTimeSeconds();
        var counter = (unixSeconds / 30) + stepOffset;
        var counterBytes = BitConverter.GetBytes(counter);
        if (BitConverter.IsLittleEndian) Array.Reverse(counterBytes);
        using var hmac = new System.Security.Cryptography.HMACSHA1(secret);
        var hash = hmac.ComputeHash(counterBytes);
        var offset = hash[^1] & 0x0f;
        var binary = ((hash[offset] & 0x7f) << 24) | ((hash[offset + 1] & 0xff) << 16)
                     | ((hash[offset + 2] & 0xff) << 8) | (hash[offset + 3] & 0xff);
        return (binary % 1_000_000).ToString("D6");
    }

    private static bool VerifyTotp(byte[] secret, string code, DateTime utcNow)
    {
        if (code.Length != 6 || !code.All(char.IsDigit)) return false;
        for (long step = -2; step <= 2; step++)
            if (ComputeTotp(secret, utcNow, step) == code) return true;
        return false;
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
