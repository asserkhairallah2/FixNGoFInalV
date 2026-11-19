using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using FixNGo.Domain.Entities;
using FixNGo.Web;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace FixNGo.Api.Tests;

/// <summary>
/// Phase 4 simulator dock: real DB-backed endpoints, the global 404 kill switch and
/// end-to-end actions. Uses isolated temp FIXNGO_DATA_DIR / FIXNGO_LOG_DIR per host.
/// </summary>
[Collection("api")]
public sealed class SimulatorTests
{
    private const string OwnerEmail = "sim-owner@simulator.test";
    private const string ProviderEmail = "sim-provider@simulator.test";

    // ---------------- Host ----------------

    private sealed class SimHost : IDisposable
    {
        private readonly List<WebApplicationFactory<Program>> _factories = [];
        private readonly Dictionary<string, Guid> _ids = new(StringComparer.OrdinalIgnoreCase);
        private readonly ITokenService _tokens;
        private readonly string? _oldData;
        private readonly string? _oldLogs;

        private SimHost(List<WebApplicationFactory<Program>> factories, ITokenService tokens,
            Dictionary<string, Guid> ids, string? oldData, string? oldLogs)
        {
            _factories = factories;
            _tokens = tokens;
            _ids = ids;
            _oldData = oldData;
            _oldLogs = oldLogs;
        }

        public static SimHost Create(bool enabled = true, bool nestedDisabled = false)
        {
            var data = Path.Combine(Path.GetTempPath(), "fixngo-sim-" + Guid.NewGuid().ToString("N"));
            var oldData = Environment.GetEnvironmentVariable("FIXNGO_DATA_DIR");
            var oldLogs = Environment.GetEnvironmentVariable("FIXNGO_LOG_DIR");
            Environment.SetEnvironmentVariable("FIXNGO_DATA_DIR", data);
            Environment.SetEnvironmentVariable("FIXNGO_LOG_DIR", Path.Combine(data, "logs"));

            var baseFactory = new SimFactory();
            var factories = new List<WebApplicationFactory<Program>> { baseFactory };
            WebApplicationFactory<Program> factory = baseFactory;
            var overrides = new Dictionary<string, string?>();
            if (!enabled) overrides["Simulators:Enabled"] = "false";
            if (nestedDisabled) overrides["Providers:Simulators:Enabled"] = "false";
            if (overrides.Count > 0)
            {
                factory = baseFactory.WithWebHostBuilder(b =>
                    b.ConfigureAppConfiguration((_, c) => c.AddInMemoryCollection(overrides)));
                factories.Add(factory);
            }

            using (var warm = factory.CreateClient()) { _ = warm; }

            var tokens = factory.Services.GetRequiredService<ITokenService>();
            var ids = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
            using (var scope = factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
                void Add(string email, string name, Role role, double lat, double lon)
                {
                    var u = new User
                    {
                        FullName = name, Email = email, Phone = "+2011" + (ids.Count + 100).ToString("D7"),
                        PasswordHash = string.Empty, Role = role, Status = UserStatus.Active,
                        EmailVerified = true, PhoneVerified = true, KycStatus = KycStatus.Approved,
                        Latitude = lat, Longitude = lon, AreaLabel = "Simulator area"
                    };
                    db.Users.Add(u);
                    ids[email] = u.Id;
                }
                Add(OwnerEmail, "Simulator Owner", Role.CarOwner, 30.0100, 31.0100);
                Add(ProviderEmail, "Simulator Provider", Role.TowCaptain, 30.0200, 31.0200);
                db.SaveChangesAsync().GetAwaiter().GetResult();
                db.ProviderProfiles.Add(new ProviderProfile
                {
                    UserId = ids[ProviderEmail], IsOnline = true,
                    Latitude = 30.0200, Longitude = 31.0200, LastHeartbeatAt = DateTime.UtcNow
                });
                db.SaveChangesAsync().GetAwaiter().GetResult();
            }
            return new SimHost(factories, tokens, ids, oldData, oldLogs);
        }

        public HttpClient Anon()
        {
            var c = _factories[^1].CreateClient();
            return c;
        }

        public HttpClient Client(string email)
        {
            var c = Anon();
            c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", Token(email));
            return c;
        }

        public string Token(string email) => _tokens.IssueAccessToken(_ids[email], email == OwnerEmail ? Role.CarOwner : Role.TowCaptain, email);
        public Guid Id(string email) => _ids[email];

        public async Task WithDb(Func<IAppDbContext, Task> action)
        {
            using var scope = _factories[^1].Services.CreateScope();
            await action(scope.ServiceProvider.GetRequiredService<IAppDbContext>());
        }

        public void Dispose()
        {
            foreach (var f in _factories) f.Dispose();
            Environment.SetEnvironmentVariable("FIXNGO_DATA_DIR", _oldData);
            Environment.SetEnvironmentVariable("FIXNGO_LOG_DIR", _oldLogs);
        }

        private sealed class SimFactory : WebApplicationFactory<Program>;
    }

    // ---------------- Enabled: all five panels work against real rows ----------------

    [Fact]
    public async Task Enabled_AllPanelsReturnRealDatabaseData()
    {
        using var host = SimHost.Create();
        var c = host.Client(OwnerEmail);

        var sms = await Post(c, "/api/v1/sim/messages", new
        {
            recipient = "sim-recipient@simulator.test", recipientName = "Simulator Recipient",
            body = "Simulator SMS body", channel = "Sms"
        });
        sms.Code.Should().Be(HttpStatusCode.OK);
        var smsId = sms.Body.GuidOf("id");

        var push = await Post(c, "/api/v1/sim/push", new
        {
            userId = host.Id(OwnerEmail), title = "Dock title", body = "Dock body", deepLink = "C01"
        });
        push.Code.Should().Be(HttpStatusCode.OK);

        var otp = await Post(c, "/api/v1/sim/otps/generate", new
        {
            target = OwnerEmail, purpose = "Signup", channel = "Email", recipientName = "Simulator Owner"
        });
        otp.Code.Should().Be(HttpStatusCode.OK);
        var otpCode = otp.Body.Text("code");
        otpCode.Should().HaveLength(6);

        var card = await Post(c, "/api/v1/sim/payments/tokenise", new
        {
            number = ValidCardNumber(), expMonth = 12, expYear = DateTime.UtcNow.Year + 3, label = "sim card"
        });
        card.Code.Should().Be(HttpStatusCode.OK);
        var token = card.Body.Text("token");

        var charge = await Post(c, "/api/v1/sim/payments/charge", new
        {
            token, amountMinor = 12500, reference = "sim-enabled-charge"
        });
        charge.Code.Should().Be(HttpStatusCode.OK);
        charge.Body.Text("status").Should().Be("Succeeded");

        var gps = await Put(c, "/api/v1/sim/gps", new
        {
            latitude = 30.123456, longitude = 31.123456, areaLabel = "Sim GPS area"
        });
        gps.Code.Should().Be(HttpStatusCode.OK);

        var drive = await Post(c, "/api/v1/sim/gps/drive", new
        {
            providerId = host.Id(ProviderEmail), targetUserId = host.Id(OwnerEmail), steps = 4
        });
        drive.Code.Should().Be(HttpStatusCode.OK);

        var messages = await Get(c, "/api/v1/sim/messages?channel=sms");
        messages.Code.Should().Be(HttpStatusCode.OK);
        HasId(messages.Body, smsId).Should().BeTrue();
        Has(messages.Body, "body", "Simulator SMS body").Should().BeTrue();

        var pushes = await Get(c, "/api/v1/sim/push");
        pushes.Code.Should().Be(HttpStatusCode.OK);
        Has(pushes.Body, "title", "Dock title").Should().BeTrue();

        var payments = await Get(c, "/api/v1/sim/payments");
        payments.Code.Should().Be(HttpStatusCode.OK);
        Has(payments.Body, "reference", "sim-enabled-charge").Should().BeTrue();

        var otps = await Get(c, "/api/v1/sim/otps");
        otps.Code.Should().Be(HttpStatusCode.OK);
        Has(otps.Body, "code", otpCode).Should().BeTrue();

        var gpsList = await Get(c, "/api/v1/sim/gps?all=true");
        gpsList.Code.Should().Be(HttpStatusCode.OK);
        gpsList.Body.EnumerateArray().Count().Should().BeGreaterThanOrEqualTo(2);

        var withdrawals = await Get(c, "/api/v1/sim/withdrawals");
        withdrawals.Code.Should().Be(HttpStatusCode.OK);
        withdrawals.Body.ValueKind.Should().Be(JsonValueKind.Array);
    }

    // ---------------- Disabled: global 404 kill switch ----------------

    [Fact]
    public async Task Disabled_SimulatorsEnabledFalse_Returns404ForEveryEndpoint()
    {
        using var host = SimHost.Create(enabled: false);
        await AssertAllSimEndpointsReturn404(host);
    }

    [Fact]
    public async Task Disabled_NestedProviderKeyFalse_Returns404ForEveryEndpoint()
    {
        using var host = SimHost.Create(nestedDisabled: true);
        await AssertAllSimEndpointsReturn404(host);
    }

    private static async Task AssertAllSimEndpointsReturn404(SimHost host)
    {
        var id = Guid.NewGuid();
        var endpoints = new (HttpMethod Method, string Path, object? Payload)[]
        {
            (HttpMethod.Get, "/api/v1/sim/messages", null),
            (HttpMethod.Get, "/api/v1/sim/messages?channel=sms", null),
            (HttpMethod.Post, "/api/v1/sim/messages", new { recipient = "x", body = "x", channel = "Sms" }),
            (HttpMethod.Post, $"/api/v1/sim/messages/{id}/read", new { }),
            (HttpMethod.Get, "/api/v1/sim/push", null),
            (HttpMethod.Get, "/api/v1/sim/push?all=true", null),
            (HttpMethod.Post, "/api/v1/sim/push", new { title = "x", body = "x" }),
            (HttpMethod.Post, "/api/v1/sim/push/read-all", new { }),
            (HttpMethod.Post, $"/api/v1/sim/push/{id}/read", new { }),
            (HttpMethod.Get, "/api/v1/sim/payments", null),
            (HttpMethod.Post, "/api/v1/sim/payments/tokenise", new { number = "x", expMonth = 1, expYear = 2030 }),
            (HttpMethod.Post, "/api/v1/sim/payments/charge", new { token = "x", amountMinor = 1 }),
            (HttpMethod.Post, $"/api/v1/sim/payments/{id}/approve", new { }),
            (HttpMethod.Post, $"/api/v1/sim/payments/{id}/decline", new { }),
            (HttpMethod.Post, $"/api/v1/sim/payments/{id}/refund", new { }),
            (HttpMethod.Get, "/api/v1/sim/withdrawals", null),
            (HttpMethod.Post, $"/api/v1/sim/withdrawals/{id}/advance", new { }),
            (HttpMethod.Post, $"/api/v1/sim/withdrawals/{id}/fail", new { reason = "x" }),
            (HttpMethod.Get, "/api/v1/sim/otps", null),
            (HttpMethod.Post, "/api/v1/sim/otps/generate", new { target = "x", purpose = "Signup" }),
            (HttpMethod.Post, "/api/v1/sim/otps/verify", new { target = "x", purpose = "Signup", code = "x" }),
            (HttpMethod.Get, "/api/v1/sim/gps", null),
            (HttpMethod.Put, "/api/v1/sim/gps", new { latitude = 1, longitude = 1 }),
            (HttpMethod.Post, "/api/v1/sim/gps/drive", new { providerId = id }),
            (HttpMethod.Post, "/api/v1/sim/gps/stale", new { providerId = id })
        };
        using var authClient = host.Client(OwnerEmail);
        using var anonClient = host.Anon();
        foreach (var (method, path, payload) in endpoints)
        {
            var auth = await Http.Call(authClient, method, path, payload);
            auth.Code.Should().Be(HttpStatusCode.NotFound, $"{method} {path} must be hidden when simulators are disabled");
            var anon = await Http.Call(anonClient, method, path, payload);
            anon.Code.Should().Be(HttpStatusCode.NotFound, $"{method} {path} must be hidden (anonymous) when simulators are disabled");
        }
    }

    // ---------------- End-to-end actions ----------------

    [Fact]
    public async Task TokeniseAndCharge_CreateRealPaymentAndGatewayRows()
    {
        using var host = SimHost.Create();
        var c = host.Client(OwnerEmail);
        var card = await Post(c, "/api/v1/sim/payments/tokenise", new
        {
            number = ValidCardNumber(), expMonth = 11, expYear = DateTime.UtcNow.Year + 2
        });
        card.Code.Should().Be(HttpStatusCode.OK);
        var token = card.Body.Text("token");
        token.Should().StartWith("tok_fake_");

        var charge = await Post(c, "/api/v1/sim/payments/charge", new
        {
            token, amountMinor = 98765, reference = "sim-e2e-charge"
        });
        charge.Code.Should().Be(HttpStatusCode.OK);
        var paymentId = charge.Body.GuidOf("paymentId");
        var txId = charge.Body.GuidOf("transactionId");

        await host.WithDb(async db =>
        {
            var method = await db.PaymentMethods.FirstOrDefaultAsync(p => p.Token == token);
            method.Should().NotBeNull();
            method!.UserId.Should().Be(host.Id(OwnerEmail));
            method.Last4.Should().NotBeNullOrEmpty();

            var payment = await db.Payments.FirstOrDefaultAsync(p => p.Id == paymentId);
            payment.Should().NotBeNull();
            payment!.AmountMinor.Should().Be(98765);
            payment.Status.Should().Be(PaymentStatus.Succeeded);
            payment.PayerId.Should().Be(host.Id(OwnerEmail));

            var tx = await db.SimPaymentTransactions.FirstOrDefaultAsync(t => t.Id == txId);
            tx.Should().NotBeNull();
            tx!.Reference.Should().Be("sim-e2e-charge");
            tx.PaymentId.Should().Be(payment.Id);
        });
    }

    [Fact]
    public async Task SendSms_CreatesRealSimMessageRow()
    {
        using var host = SimHost.Create();
        var c = host.Client(OwnerEmail);
        var sent = await Post(c, "/api/v1/sim/messages", new
        {
            recipient = "+201100000777", recipientName = "E2E recipient",
            body = "E2E simulator body", channel = "Sms"
        });
        sent.Code.Should().Be(HttpStatusCode.OK);
        var id = sent.Body.GuidOf("id");

        await host.WithDb(async db =>
        {
            var row = await db.SimMessages.FirstOrDefaultAsync(m => m.Id == id);
            row.Should().NotBeNull();
            row!.Channel.Should().Be(SimChannel.Sms);
            row.Recipient.Should().Be("+201100000777");
            row.Body.Should().Be("E2E simulator body");
        });

        var read = await Post(c, $"/api/v1/sim/messages/{id}/read", new { });
        read.Code.Should().Be(HttpStatusCode.OK);
        await host.WithDb(async db =>
        {
            var row = await db.SimMessages.FirstAsync(m => m.Id == id);
            row.IsRead.Should().BeTrue();
        });
    }

    [Fact]
    public async Task OtpGenerateListVerify_UsesRealOtpRows()
    {
        using var host = SimHost.Create();
        var c = host.Client(OwnerEmail);
        var generated = await Post(c, "/api/v1/sim/otps/generate", new
        {
            target = OwnerEmail, purpose = "Login", channel = "Sms", recipientName = "Simulator Owner"
        });
        generated.Code.Should().Be(HttpStatusCode.OK);
        var code = generated.Body.Text("code");
        code.Should().MatchRegex("^[0-9]{6}$");

        var listed = await Get(c, "/api/v1/sim/otps");
        listed.Code.Should().Be(HttpStatusCode.OK);
        Has(listed.Body, "code", code).Should().BeTrue();

        var wrong = await Post(c, "/api/v1/sim/otps/verify", new
        {
            target = OwnerEmail, purpose = "Login", code = code == "000000" ? "000001" : "000000"
        });
        wrong.Code.Should().Be(HttpStatusCode.OK);
        wrong.Body.GetProperty("valid").GetBoolean().Should().BeFalse();

        var ok = await Post(c, "/api/v1/sim/otps/verify", new
        {
            target = OwnerEmail, purpose = "Login", code
        });
        ok.Code.Should().Be(HttpStatusCode.OK);
        ok.Body.GetProperty("valid").GetBoolean().Should().BeTrue();

        await host.WithDb(async db =>
        {
            var otp = await db.OtpCodes.FirstAsync(o => o.Target == OwnerEmail && o.Purpose == OtpPurpose.Login);
            otp.Attempts.Should().Be(1);
            otp.Consumed.Should().BeTrue();
        });
    }

    [Fact]
    public async Task GpsSetDriveAndStale_UpdateRealCoordinates()
    {
        using var host = SimHost.Create();
        var c = host.Client(OwnerEmail);
        var moved = await Post(c, "/api/v1/sim/gps/drive", new
        {
            providerId = host.Id(ProviderEmail), targetLatitude = 30.5, targetLongitude = 31.5, steps = 5
        });
        moved.Code.Should().Be(HttpStatusCode.OK);
        var points = moved.Body.GetProperty("route").GetProperty("points");
        points.GetArrayLength().Should().Be(5);
        var end = points[4];
        end.GetProperty("latitude").GetDouble().Should().BeApproximately(30.5, 0.000001);

        await host.WithDb(async db =>
        {
            var profile = await db.ProviderProfiles.FirstAsync(p => p.UserId == host.Id(ProviderEmail));
            profile.Latitude.Should().BeApproximately(30.5, 0.000001);
            profile.Longitude.Should().BeApproximately(31.5, 0.000001);
        });

        var stale = await Post(c, "/api/v1/sim/gps/stale", new { providerId = host.Id(ProviderEmail) });
        stale.Code.Should().Be(HttpStatusCode.OK);
        await host.WithDb(async db =>
        {
            var profile = await db.ProviderProfiles.FirstAsync(p => p.UserId == host.Id(ProviderEmail));
            profile.LastHeartbeatAt.Should().BeBefore(DateTime.UtcNow.AddMinutes(-5));
        });
    }

    [Fact]
    public async Task PaymentApproveAndRefund_UpdateRealTransactions()
    {
        using var host = SimHost.Create();
        var c = host.Client(OwnerEmail);
        var card = await Post(c, "/api/v1/sim/payments/tokenise", new
        {
            number = ValidCardNumber(), expMonth = 10, expYear = DateTime.UtcNow.Year + 3
        });
        var token = card.Body.Text("token");
        var charge = await Post(c, "/api/v1/sim/payments/charge", new
        {
            token, amountMinor = 5000, reference = "sim-3ds-charge", requiresApproval = true
        });
        charge.Code.Should().Be(HttpStatusCode.OK);
        charge.Body.Text("status").Should().Be("Pending");
        var id = charge.Body.GuidOf("transactionId");

        var approve = await Post(c, $"/api/v1/sim/payments/{id}/approve", new { });
        approve.Code.Should().Be(HttpStatusCode.OK);
        approve.Body.Text("status").Should().Be("Succeeded");

        var refund = await Post(c, $"/api/v1/sim/payments/{id}/refund", new { });
        refund.Code.Should().Be(HttpStatusCode.OK);
        refund.Body.Text("status").Should().Be("Refunded");

        await host.WithDb(async db =>
        {
            var tx = await db.SimPaymentTransactions.FirstAsync(t => t.Id == id);
            tx.Status.Should().Be("Refunded");
            var payment = await db.Payments.FirstAsync(p => p.Id == tx.PaymentId);
            payment.Status.Should().Be(PaymentStatus.Refunded);
        });
    }

    // ---------------- Helpers ----------------

    private static async Task<(HttpStatusCode Code, JsonElement Body)> Get(HttpClient c, string path)
    {
        var (code, body) = await Http.Get(c, path);
        return (code, body);
    }

    private static async Task<(HttpStatusCode Code, JsonElement Body)> Post(HttpClient c, string path, object payload)
    {
        var (code, body) = await Http.Post(c, path, payload);
        return (code, body);
    }

    private static async Task<(HttpStatusCode Code, JsonElement Body)> Put(HttpClient c, string path, object payload)
    {
        var (code, body) = await Http.Put(c, path, payload);
        return (code, body);
    }

    private static bool Has(JsonElement array, string property, string value)
    {
        if (array.ValueKind != JsonValueKind.Array) return false;
        return array.EnumerateArray().Any(e => e.Text(property) == value);
    }

    private static bool HasId(JsonElement array, Guid id)
    {
        if (array.ValueKind != JsonValueKind.Array) return false;
        return array.EnumerateArray().Any(e => e.GuidOf("id") == id);
    }

    /// <summary>Builds a Luhn-valid 16-digit test number without embedding a literal PAN.</summary>
    private static string ValidCardNumber()
    {
        var body = string.Concat(Enumerable.Range(0, 15).Select(i => (char)('0' + ((i * 7 + 4) % 10))));
        var sum = 0;
        for (var i = 1; i <= body.Length; i++)
        {
            var d = body[body.Length - i] - '0';
            if (i % 2 == 1) { d *= 2; if (d > 9) d -= 9; }
            sum += d;
        }
        return body + ((10 - sum % 10) % 10).ToString();
    }
}
