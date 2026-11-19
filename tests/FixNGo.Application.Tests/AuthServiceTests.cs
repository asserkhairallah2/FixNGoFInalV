using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Application.Services;
using FixNGo.Domain;
using FixNGo.Infrastructure;
using FixNGo.Infrastructure.Services;
using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace FixNGo.Application.Tests;

/// <summary>Real AuthService tests against a real EF Core/SQLite context (in-memory SQLite file). No mocks of the SUT.</summary>
public sealed class AuthServiceTests : IDisposable
{
    private readonly SqliteConnection _conn;
    private readonly AppDbContext _db;
    // BaseEntity.CreatedAt uses real UtcNow, so the fake clock must start at real UtcNow for OTP timing checks.
    private readonly TestClock _clock = new(DateTime.UtcNow);
    private readonly RecordingOtpSender _otp = new();
    private readonly AuthService _auth;
    private readonly ITokenService _tokens;

    public AuthServiceTests()
    {
        _conn = new SqliteConnection("Data Source=:memory:");
        _conn.Open();
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_conn).Options;
        _db = new AppDbContext(options);
        _db.Database.EnsureCreated();
        _tokens = new TokenService(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32) /* test-only key */, "FixNGo", "FixNGo.Client", 15);
        _auth = new AuthService(_db, _clock, new PasswordHasherService(), _tokens, _otp,
            NullLogger<AuthService>.Instance, new AuthOptions { AccessMinutes = 15, RefreshDays = 30, ExposeDevCodes = true });
    }

    private static SignupRequest Owner(string email = "owner@test.example", string phone = "+201000000001") =>
        new("Test Owner", email, phone, "Str0ng@Pass", nameof(Role.CarOwner));

    [Fact]
    public async Task Signup_CreatesPendingUser_SendsOtp_AndNeverAllowsAdmin()
    {
        var res = await _auth.SignupAsync(Owner());
        var user = await _db.Users.SingleAsync();
        user.Status.Should().Be(UserStatus.PendingVerification);
        user.Role.Should().Be(Role.CarOwner);
        user.PasswordHash.Should().NotContain("Str0ng@Pass");
        _otp.Sent.Should().ContainSingle();
        res.DevCode.Should().NotBeNull();
        await Assert.ThrowsAsync<DomainException>(() =>
            _auth.SignupAsync(new SignupRequest("A", "a@b.co", "+201000000099", "Str0ng@Pass", nameof(Role.Admin))));
    }

    [Fact]
    public async Task Signup_DuplicateEmailOrPhone_IsRejected()
    {
        await _auth.SignupAsync(Owner());
        await Assert.ThrowsAsync<DomainException>(() =>
            _auth.SignupAsync(Owner("other@test.example"))); // same phone
        await Assert.ThrowsAsync<DomainException>(() =>
            _auth.SignupAsync(Owner())); // same email
    }

    [Fact]
    public async Task VerifyOtp_ActivatesUser_AndWrongCodeIncrementsAttempts()
    {
        await _auth.SignupAsync(Owner());
        var target = "owner@test.example";
        var bad = await Assert.ThrowsAsync<DomainException>(() =>
            _auth.VerifyOtpAsync(new VerifyOtpRequest(target, "000000", OtpPurpose.Signup)));
        bad.Code.Should().Be("auth.otp_invalid");
        (await _db.OtpCodes.SingleAsync()).Attempts.Should().Be(1);

        var code = _otp.Sent.Single().Code;
        var dto = await _auth.VerifyOtpAsync(new VerifyOtpRequest(target, code, OtpPurpose.Signup));
        dto.Status.Should().Be(UserStatus.Active);
        (await _db.Users.SingleAsync()).EmailVerified.Should().BeTrue();
    }

    [Fact]
    public async Task Login_WrongPassword_ReturnsInvalidCredentials_AndSuccessIssuesValidTokens()
    {
        await _auth.SignupAsync(Owner());
        await Assert.ThrowsAsync<DomainException>(() =>
            _auth.LoginAsync(new LoginRequest("owner@test.example", "Wrong@1"), null, null));

        // activate then login
        await _auth.VerifyOtpAsync(new VerifyOtpRequest("owner@test.example", _otp.Sent.Single().Code, OtpPurpose.Signup));
        var res = await _auth.LoginAsync(new LoginRequest("owner@test.example", "Str0ng@Pass"), "test-agent", "127.0.0.1");
        _tokens.ValidateAccessToken(res.AccessToken)!.Value.Role.Should().Be(Role.CarOwner);
        (await _db.Sessions.CountAsync()).Should().Be(1);
        res.User.Role.Should().Be(Role.CarOwner);
    }

    [Fact]
    public async Task SuspendedAccount_CannotLogin()
    {
        await _auth.SignupAsync(Owner());
        await _auth.VerifyOtpAsync(new VerifyOtpRequest("owner@test.example", _otp.Sent.Single().Code, OtpPurpose.Signup));
        var user = await _db.Users.SingleAsync();
        user.Status = UserStatus.Suspended;
        await _db.SaveChangesAsync();
        var ex = await Assert.ThrowsAsync<DomainException>(() =>
            _auth.LoginAsync(new LoginRequest("owner@test.example", "Str0ng@Pass"), null, null));
        ex.Code.Should().Be("auth.account_blocked");
    }

    [Fact]
    public async Task Refresh_RotatesToken_AndReuseRevokesFamily()
    {
        await _auth.SignupAsync(Owner());
        await _auth.VerifyOtpAsync(new VerifyOtpRequest("owner@test.example", _otp.Sent.Single().Code, OtpPurpose.Signup));
        var first = await _auth.LoginAsync(new LoginRequest("owner@test.example", "Str0ng@Pass"), null, null);
        var second = await _auth.RefreshAsync(new RefreshRequest(first.RefreshToken));

        second.RefreshToken.Should().NotBe(first.RefreshToken);
        var reuse = await Assert.ThrowsAsync<DomainException>(() =>
            _auth.RefreshAsync(new RefreshRequest(first.RefreshToken)));
        reuse.Code.Should().Be("auth.refresh_reuse");
        (await _db.Sessions.CountAsync(s => s.RevokedAt != null)).Should().Be(2);
    }

    [Fact]
    public async Task PasswordReset_ChangesPassword_AndRevokesAllSessions()
    {
        await _auth.SignupAsync(Owner());
        await _auth.VerifyOtpAsync(new VerifyOtpRequest("owner@test.example", _otp.Sent.Single().Code, OtpPurpose.Signup));
        await _auth.LoginAsync(new LoginRequest("owner@test.example", "Str0ng@Pass"), null, null);

        // Advance past the intentional 30s OTP resend cooldown before requesting a reset code.
        _clock.UtcNow = _clock.UtcNow.AddSeconds(31);
        await _auth.ForgotPasswordAsync(new ForgotPasswordRequest("owner@test.example"));
        var resetCode = _otp.Sent.Last().Code;
        var resetToken = await _auth.ExchangeResetOtpAsync(
            new VerifyOtpRequest("owner@test.example", resetCode, OtpPurpose.Forgot));
        await _auth.ResetPasswordAsync(new ResetPasswordRequest(resetToken, "N3w@Password"));

        (await _db.Sessions.CountAsync(s => s.RevokedAt != null)).Should().BeGreaterThan(0);
        var relogin = await _auth.LoginAsync(new LoginRequest("owner@test.example", "N3w@Password"), null, null);
        relogin.AccessToken.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task ForgotPassword_ForUnknownEmail_DoesNotRevealAccountOrSendMessage()
    {
        var count = _otp.Sent.Count;
        var res = await _auth.ForgotPasswordAsync(new ForgotPasswordRequest("nobody@test.example"));
        res.Target.Should().Be("nobody@test.example");
        _otp.Sent.Count.Should().Be(count);
    }

    public void Dispose()
    {
        _db.Dispose();
        _conn.Dispose();
    }

    private sealed class TestClock(DateTime now) : IClock
    {
        public DateTime UtcNow { get; set; } = now;
    }

    private sealed class RecordingOtpSender : IOtpSender
    {
        public List<(string Recipient, string Code, string Purpose)> Sent { get; } = [];
        public Task SendAsync(string recipient, string? recipientName, SimChannel channel, string code, string purpose, CancellationToken ct = default)
        {
            Sent.Add((recipient, code, purpose));
            return Task.CompletedTask;
        }
    }
}
