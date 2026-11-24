using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using FixNGo.Domain;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Api.Tests;

/// <summary>
/// Round 8 integration tests:
/// - Optional post-signup 2FA via Authenticator App (TOTP) and Mobile SMS (Simulator), individually or both together
/// - Dual-method availability ("totp" + "sms") when both are enabled
/// - 2FA enforcement across all 6 protected flows:
///   1) Login
///   2) Forgot Password
///   3) In-App Password Reset (mandatory Email OTP always, + 2FA when enabled)
///   4) Change Password
///   5) Core Account Details (PUT /auth/me)
///   6) Accessing / modifying 2FA Settings itself (StepUp gate)
/// - Official Security Alert emails recorded in SimMessages
/// </summary>
[Collection("api")]
public sealed class Round8TwoFactorSecurityTests(ApiTestHost host)
{
    private async Task<string> LatestOtpAsync(string recipient, OtpPurpose _)
    {
        var msg = await host.WithDb(async db =>
            await db.SimMessages
                .OrderByDescending(m => m.CreatedAt)
                .FirstAsync(m => m.Recipient == recipient && m.OtpCode != null));
        return msg.OtpCode!;
    }

    private async Task<(string Email, string Phone, string AccessToken)> CreateVerifiedOwnerAsync(string tag)
    {
        using var anon = host.Anon();
        var suffix = Guid.NewGuid().ToString("N")[..7];
        var email = $"r8.{tag}.{suffix}@gate2.test";
        var digits = Math.Abs(suffix.GetHashCode()) % 100_000_000;
        var phone = $"+2010{digits:D8}";

        var (sCode, _) = await Http.Post(anon, "/api/v1/auth/signup", new
        {
            fullName = $"R8 User {tag}",
            email,
            phone,
            password = ApiTestHost.Password,
            role = "CarOwner"
        });
        sCode.Should().Be(HttpStatusCode.OK);

        var otpCode = await LatestOtpAsync(email, OtpPurpose.Signup);

        var (vCode, vBody) = await Http.Post(anon, "/api/v1/auth/verify-otp", new
        {
            target = email,
            code = otpCode,
            purpose = "Signup",
            issueSession = true
        });
        vCode.Should().Be(HttpStatusCode.OK);
        vBody.GetProperty("user").GetProperty("twoFactorEnabled").GetBoolean().Should().BeFalse(
            "2FA must never be forced during signup");

        return (email, phone, vBody.Text("accessToken"));
    }

    private HttpClient AuthedClient(string token, string? stepUpToken = null)
    {
        var c = host.Anon();
        c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (!string.IsNullOrWhiteSpace(stepUpToken))
            c.DefaultRequestHeaders.Add("X-StepUp-Token", stepUpToken);
        return c;
    }

    [Fact]
    public async Task InAppReset_WithoutTwoFactor_AlwaysSendsMandatoryEmailOtp_AndResetsPassword()
    {
        var (email, _, token) = await CreateVerifiedOwnerAsync("inapp-no2fa");
        using var client = AuthedClient(token);

        var (startCode, startBody) = await Http.Post(client, "/api/v1/auth/in-app-reset/start", new { });
        startCode.Should().Be(HttpStatusCode.OK);
        startBody.GetProperty("requiresTwoFactor").GetBoolean().Should().BeFalse();
        startBody.Text("target").Should().Be(email);

        var emailOtp = await LatestOtpAsync(email, OtpPurpose.InAppReset);

        // Wrong email OTP rejected
        var (badCode, _) = await Http.Post(client, "/api/v1/auth/in-app-reset/complete", new
        {
            emailCode = "000000",
            newPassword = "ResetPass@2026!"
        });
        ((int)badCode).Should().BeOneOf([400, 401, 409, 422]);

        // Valid email OTP succeeds and issues fresh tokens without knowing old password
        var (okCode, okBody) = await Http.Post(client, "/api/v1/auth/in-app-reset/complete", new
        {
            emailCode = emailOtp,
            newPassword = "ResetPass@2026!"
        });
        okCode.Should().Be(HttpStatusCode.OK);
        okBody.Text("accessToken").Should().NotBeNullOrWhiteSpace();

        // Can log in with new password
        using var anon = host.Anon();
        var (loginCode, _) = await Http.Post(anon, "/api/v1/auth/login", new
        {
            email,
            password = "ResetPass@2026!"
        });
        loginCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task DualTwoFactor_TotpAndSms_EnforcesStepUpAcrossAllSixFlows_AndRecordsEmailsAndSms()
    {
        var (email, phone, token) = await CreateVerifiedOwnerAsync("dual2fa");

        // 1. Enable Authenticator App (TOTP) from Account Settings
        string totpStepUp;
        string currentTotp;
        IReadOnlyList<string> recoveryCodes;
        using (var client = AuthedClient(token))
        {
            var (setupCode, setupBody) = await Http.Post(client, "/api/v1/auth/2fa/totp/setup", new { });
            setupCode.Should().Be(HttpStatusCode.OK);
            currentTotp = setupBody.Text("currentCode");
            currentTotp.Should().HaveLength(6);

            var (enableCode, enableBody) = await Http.Post(client, "/api/v1/auth/2fa/totp/enable", new
            {
                code = currentTotp
            });
            enableCode.Should().Be(HttpStatusCode.OK);
            enableBody.GetProperty("totpEnabled").GetBoolean().Should().BeTrue();
            totpStepUp = enableBody.Text("stepUpToken");
            totpStepUp.Should().NotBeNullOrWhiteSpace();
            recoveryCodes = enableBody.GetProperty("recoveryCodes").EnumerateArray().Select(x => x.GetString()!).ToList();
            recoveryCodes.Should().HaveCount(8);
        }

        // 2. Attempting to configure SMS 2FA WITHOUT StepUpToken now MUST be blocked (2FA settings gate!)
        using (var unstepped = AuthedClient(token))
        {
            var (blockedCode, blockedBody) = await Http.Post(unstepped, "/api/v1/auth/2fa/sms/setup", new { });
            blockedCode.Should().Be(HttpStatusCode.Conflict);
            blockedBody.Text("code").Should().Be("auth.2fa_required");
        }

        // 3. With StepUpToken, enable Mobile SMS 2FA too so BOTH methods are active!
        using (var stepped = AuthedClient(token, totpStepUp))
        {
            var (smsSetupCode, _) = await Http.Post(stepped, "/api/v1/auth/2fa/sms/setup", new { });
            smsSetupCode.Should().Be(HttpStatusCode.OK);

            var smsOtp = await LatestOtpAsync(phone, OtpPurpose.TwoFactorSmsSetup);

            var (smsEnableCode, smsEnableBody) = await Http.Post(stepped, "/api/v1/auth/2fa/sms/enable", new
            {
                code = smsOtp
            });
            smsEnableCode.Should().Be(HttpStatusCode.OK);
            smsEnableBody.GetProperty("totpEnabled").GetBoolean().Should().BeTrue();
            smsEnableBody.GetProperty("smsEnabled").GetBoolean().Should().BeTrue();

            var (statusCode, statusBody) = await Http.Get(stepped, "/api/v1/auth/2fa/status");
            statusCode.Should().Be(HttpStatusCode.OK);
            var methods = statusBody.GetProperty("availableMethods").EnumerateArray().Select(x => x.GetString()).ToList();
            methods.Should().Contain(["totp", "sms"]);
        }

        // 4. Flow #1 — Login requires 2FA, exposes BOTH options ("totp" and "sms"), and succeeds via SMS Simulator code
        using (var anon = host.Anon())
        {
            var (loginCode, loginBody) = await Http.Post(anon, "/api/v1/auth/login", new
            {
                email,
                password = ApiTestHost.Password
            });
            loginCode.Should().Be(HttpStatusCode.OK);
            loginBody.GetProperty("requiresTwoFactor").GetBoolean().Should().BeTrue();
            var loginMethods = loginBody.GetProperty("availableMethods").EnumerateArray().Select(x => x.GetString()).ToList();
            loginMethods.Should().Contain(["totp", "sms"]);
            var challengeToken = loginBody.Text("challengeToken");

            var (sendSmsCode, _) = await Http.Post(anon, "/api/v1/auth/2fa/send-sms", new { challengeToken });
            sendSmsCode.Should().Be(HttpStatusCode.OK);

            var loginSmsOtp = await LatestOtpAsync(phone, OtpPurpose.TwoFactor);

            var (verifyLoginCode, verifyLoginBody) = await Http.Post(anon, "/api/v1/auth/login/verify-2fa", new
            {
                challengeToken,
                method = "sms",
                code = loginSmsOtp
            });
            verifyLoginCode.Should().Be(HttpStatusCode.OK);
            token = verifyLoginBody.Text("accessToken");
            token.Should().NotBeNullOrWhiteSpace();
        }

        // 5. Flow #4 & #5 — ChangePassword and UpdateMe (core data) reject without 2FA and succeed with fresh StepUpToken
        using (var unstepped = AuthedClient(token))
        {
            // Non-sensitive preference (theme) works without step-up
            var (prefCode, _) = await Http.Put(unstepped, "/api/v1/auth/me", new { theme = "dark" });
            prefCode.Should().Be(HttpStatusCode.OK);

            // Core data (fullName) rejected without step-up
            var (coreBlocked, coreBody) = await Http.Put(unstepped, "/api/v1/auth/me", new
            {
                fullName = "Updated Name Blocked"
            });
            coreBlocked.Should().Be(HttpStatusCode.Conflict);
            coreBody.Text("code").Should().Be("auth.2fa_required");

            // ChangePassword rejected without step-up
            var (cpBlocked, cpBody) = await Http.Post(unstepped, "/api/v1/auth/change-password", new
            {
                currentPassword = ApiTestHost.Password,
                newPassword = "ChangedPass@2026!"
            });
            cpBlocked.Should().Be(HttpStatusCode.Conflict);
            cpBody.Text("code").Should().Be("auth.2fa_required");

            // Obtain fresh StepUpToken using backup recovery code
            var (stepCode, stepBody) = await Http.Post(unstepped, "/api/v1/auth/2fa/step-up", new
            {
                method = "recovery",
                code = recoveryCodes[0]
            });
            stepCode.Should().Be(HttpStatusCode.OK);
            var freshStepUp = stepBody.Text("stepUpToken");

            using var stepped = AuthedClient(token, freshStepUp);
            var (coreOk, _) = await Http.Put(stepped, "/api/v1/auth/me", new
            {
                fullName = "Verified Updated Owner"
            });
            coreOk.Should().Be(HttpStatusCode.OK);

            var (cpOk, _) = await Http.Post(stepped, "/api/v1/auth/change-password", new
            {
                currentPassword = ApiTestHost.Password,
                newPassword = "ChangedPass@2026!"
            });
            cpOk.Should().Be(HttpStatusCode.NoContent);
        }

        // 6. Flow #3 — In-App Password Reset WITH 2FA enabled requires BOTH Email OTP AND 2FA
        using (var client = AuthedClient(token))
        {
            var (startCode, startBody) = await Http.Post(client, "/api/v1/auth/in-app-reset/start", new { });
            startCode.Should().Be(HttpStatusCode.OK);
            startBody.GetProperty("requiresTwoFactor").GetBoolean().Should().BeTrue();
            var resetMethods = startBody.GetProperty("availableMethods").EnumerateArray().Select(x => x.GetString()).ToList();
            resetMethods.Should().Contain(["totp", "sms"]);

            var emailOtp = await LatestOtpAsync(email, OtpPurpose.InAppReset);

            // Email OTP alone (missing 2FA) MUST be rejected
            var (missing2FaCode, missing2FaBody) = await Http.Post(client, "/api/v1/auth/in-app-reset/complete", new
            {
                emailCode = emailOtp,
                newPassword = "InApp2FaPass@2026!"
            });
            missing2FaCode.Should().Be(HttpStatusCode.Conflict);
            missing2FaBody.Text("code").Should().Be("auth.2fa_required");

            // Check if email OTP was consumed; if so, issue a fresh one
            var activeUnconsumed = await host.WithDb(async db =>
                await db.OtpCodes.AnyAsync(o => o.Target == email && o.Purpose == OtpPurpose.InAppReset && !o.Consumed));
            if (!activeUnconsumed)
            {
                await Http.Post(client, "/api/v1/auth/in-app-reset/start", new { });
                emailOtp = await LatestOtpAsync(email, OtpPurpose.InAppReset);
            }

            // Send SMS 2FA code and complete with BOTH Email OTP + SMS 2FA
            await Http.Post(client, "/api/v1/auth/2fa/send-sms", new { });
            var sms2Fa = await LatestOtpAsync(phone, OtpPurpose.TwoFactor);

            var (completeCode, completeBody) = await Http.Post(client, "/api/v1/auth/in-app-reset/complete", new
            {
                emailCode = emailOtp,
                newPassword = "InApp2FaPass@2026!",
                twoFactorMethod = "sms",
                twoFactorCode = sms2Fa
            });
            completeCode.Should().Be(HttpStatusCode.OK);
            token = completeBody.Text("accessToken");
        }

        // 7. Flow #2 — Logged-out Forgot Password requires Email OTP + 2FA before issuing resetToken
        using (var anon = host.Anon())
        {
            var (fgCode, _) = await Http.Post(anon, "/api/v1/auth/forgot-password", new { email });
            fgCode.Should().Be(HttpStatusCode.OK);

            var forgotOtp = await LatestOtpAsync(email, OtpPurpose.Forgot);

            var (exCode, exBody) = await Http.Post(anon, "/api/v1/auth/reset-otp", new
            {
                target = email,
                code = forgotOtp,
                purpose = "Forgot"
            });
            exCode.Should().Be(HttpStatusCode.OK);
            exBody.GetProperty("requiresTwoFactor").GetBoolean().Should().BeTrue();
            exBody.Text("resetToken").Should().BeEmpty("resetToken must not be issued before 2FA verification");
            var forgotChallenge = exBody.Text("challengeToken");

            var (verifyReset2FaCode, verifyReset2FaBody) = await Http.Post(anon, "/api/v1/auth/reset-otp/verify-2fa", new
            {
                challengeToken = forgotChallenge,
                method = "recovery",
                code = recoveryCodes[1]
            });
            verifyReset2FaCode.Should().Be(HttpStatusCode.OK);
            var resetToken = verifyReset2FaBody.Text("resetToken");
            resetToken.Should().NotBeNullOrWhiteSpace();

            var (finalResetCode, _) = await Http.Post(anon, "/api/v1/auth/reset-password", new
            {
                resetToken,
                newPassword = "FinalForgot@2026!"
            });
            finalResetCode.Should().Be(HttpStatusCode.NoContent);
        }

        // 8. Verify official Security Alert emails & Simulator SMS records were dispatched
        var simCount = await host.WithDb(async db =>
            await db.SimMessages.CountAsync(m => m.Recipient == email && m.Channel == SimChannel.Email));
        simCount.Should().BeGreaterThanOrEqualTo(5, "OTP emails + Security Alert emails must be recorded on every event");

        var smsCount = await host.WithDb(async db =>
            await db.SimMessages.CountAsync(m => m.Recipient == phone && m.Channel == SimChannel.Sms));
        smsCount.Should().BeGreaterThanOrEqualTo(2, "Simulator SMS messages must be recorded for SMS 2FA");
    }
}
