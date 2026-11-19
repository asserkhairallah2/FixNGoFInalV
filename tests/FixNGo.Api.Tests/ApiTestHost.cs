using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using FixNGo.Domain.Entities;
using FixNGo.Infrastructure;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace FixNGo.Api.Tests;

internal static class Http
{
    public static async Task<(HttpStatusCode Code, JsonElement Body)> Call(HttpClient c, HttpMethod method,
        string path, object? payload = null)
    {
        using var req = new HttpRequestMessage(method, path);
        if (payload is not null) req.Content = JsonContent.Create(payload);
        using var res = await c.SendAsync(req);
        var text = await res.Content.ReadAsStringAsync();
        JsonElement body = string.IsNullOrWhiteSpace(text) ? default : JsonDocument.Parse(text).RootElement.Clone();
        return (res.StatusCode, body);
    }

    public static Task<(HttpStatusCode, JsonElement)> Get(HttpClient c, string path) => Call(c, HttpMethod.Get, path);
    public static Task<(HttpStatusCode, JsonElement)> Post(HttpClient c, string path, object payload) => Call(c, HttpMethod.Post, path, payload);
    public static Task<(HttpStatusCode, JsonElement)> Put(HttpClient c, string path, object payload) => Call(c, HttpMethod.Put, path, payload);

    public static string Text(this JsonElement e, string name) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) ? v.GetString() ?? "" : "";
    public static Guid GuidOf(this JsonElement e, string name) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) ? v.GetGuid() : Guid.Empty;
    public static long LongOf(this JsonElement e, string name) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) ? v.GetInt64() : 0;

    /// <summary>Walk up from the test binary to the repository root containing FixNGo.sln.</summary>
    public static string RepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            if (File.Exists(Path.Combine(dir.FullName, "FixNGo.sln"))) return dir.FullName;
            dir = dir.Parent;
        }
        throw new DirectoryNotFoundException("FixNGo.sln not found above " + AppContext.BaseDirectory);
    }
}

/// <summary>Serialise API test classes: they share one process-wide FIXNGO_DATA_DIR setting.</summary>
[CollectionDefinition("api", DisableParallelization = true)]
public sealed class ApiCollection : ICollectionFixture<ApiTestHost>;

/// <summary>
/// One real host on a unique temp SQLite DB, seeded with one user per role. Tests obtain
/// authenticated HttpClient instances via the real ITokenService (no hand-built JWTs).
/// </summary>
public sealed class ApiTestHost : IDisposable
{
    private readonly ApiFactory _factory;
    private readonly Dictionary<string, Guid> _ids = new(StringComparer.OrdinalIgnoreCase);
    private readonly ITokenService _tokens;

    public const string Password = "Setup@2026";

    public ApiTestHost()
    {
        var data = Path.Combine(Path.GetTempPath(), "fixngo-gate2-" + Guid.NewGuid().ToString("N"));
        Environment.SetEnvironmentVariable("FIXNGO_DATA_DIR", data);
        Environment.SetEnvironmentVariable("FIXNGO_LOG_DIR", Path.Combine(data, "logs"));
        _factory = new ApiFactory();
        // Force host creation NOW while our env vars are set, then seed via the real services.
        using (var warm = _factory.CreateClient()) { _ = warm; }
        _tokens = _factory.Services.GetRequiredService<ITokenService>();
        Seed();
    }

    public IServiceProvider Services => _factory.Services;

    public HttpClient Anon() => _factory.CreateClient();

    public HttpClient Client(string email)
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", Token(email));
        return c;
    }

    public string Token(string email) => _tokens.IssueAccessToken(Id(email), RoleFor(email), email);

    public Guid Id(string email) => _ids.TryGetValue(email, out var id)
        ? id : throw new KeyNotFoundException($"No seeded user '{email}'.");

    public static Role RoleFor(string email) => email.Split('@')[0].ToLowerInvariant() switch
    {
        "admin" => Role.Admin,
        "owner" => Role.CarOwner,
        "mechanic" => Role.Mechanic,
        "captain" or "captain2" or "kycseed" => Role.TowCaptain,
        "center" => Role.ServiceCenter,
        _ => throw new KeyNotFoundException(email)
    };

    public async Task WithDb(Func<IAppDbContext, Task> action)
    {
        using var scope = _factory.Services.CreateScope();
        await action(scope.ServiceProvider.GetRequiredService<IAppDbContext>());
    }

    public async Task<T> WithDb<T>(Func<IAppDbContext, Task<T>> action)
    {
        using var scope = _factory.Services.CreateScope();
        return await action(scope.ServiceProvider.GetRequiredService<IAppDbContext>());
    }

    public const string Admin = "admin@gate2.test";
    public const string Owner = "owner@gate2.test";
    public const string Mechanic = "mechanic@gate2.test";
    public const string Captain = "captain@gate2.test";
    public const string Captain2 = "captain2@gate2.test";
    public const string Center = "center@gate2.test";
    public const string KycSeed = "kycseed@gate2.test";

    private void Seed()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        User Add(string email, string name, Role role, KycStatus kyc = KycStatus.None, bool super = false)
        {
            var u = new User
            {
                FullName = name, Email = email, Phone = "+2010000000" + (_ids.Count + 1).ToString("00"),
                PasswordHash = hasher.Hash(Password), Role = role, Status = UserStatus.Active,
                EmailVerified = true, PhoneVerified = true, KycStatus = kyc, IsSuperAdmin = super,
                Latitude = 30.0444, Longitude = 31.2357, AreaLabel = "Cairo"
            };
            db.Users.Add(u);
            _ids[email] = u.Id;
            return u;
        }

        Add(Admin, "Gate2 Administrator", Role.Admin, super: true);
        Add(Owner, "Gate2 Car Owner", Role.CarOwner);
        Add(Mechanic, "Gate2 Mechanic", Role.Mechanic, KycStatus.Approved);
        Add(Captain, "Gate2 Captain", Role.TowCaptain, KycStatus.Approved);
        Add(Captain2, "Gate2 Captain Two", Role.TowCaptain, KycStatus.Approved);
        Add(Center, "Gate2 Center", Role.ServiceCenter, KycStatus.Approved);
        Add(KycSeed, "Gate2 KYC Applicant", Role.TowCaptain, KycStatus.None);

        foreach (var email in new[] { Mechanic, Captain, Captain2 })
        {
            db.ProviderProfiles.Add(new ProviderProfile
            {
                UserId = Id(email), IsOnline = true, Latitude = 30.0450, Longitude = 31.2360,
                LastHeartbeatAt = DateTime.UtcNow, Rating = 4.7m, RatingCount = 12,
                YearsExperience = 5, TruckMake = email.StartsWith("captain") ? "Mercedes" : null,
                TruckPlate = email.StartsWith("captain") ? "CAB-1234" : null
            });
        }

        var center = new ServiceCenter
        {
            OwnerId = Id(Center), Name = "Gate2 Service Center", Address = "Cairo, Egypt",
            Phone = "+201000000099", Latitude = 30.0444, Longitude = 31.2357
        };
        db.ServiceCenters.Add(center);
        db.CenterServices.Add(new FixNGo.Domain.Entities.CenterService
        {
            Center = center, Name = "Full Service", PriceMinor = 25000, DurationMinutes = 60, IsActive = true
        });
        db.Bays.Add(new Bay { Center = center, Name = "Bay 1" });
        for (var d = 0; d < 7; d++)
            db.WorkingHours.Add(new WorkingHours { Center = center, DayOfWeek = d, OpenTime = new TimeSpan(8, 0, 0), CloseTime = new TimeSpan(18, 0, 0) });

        db.SaveChangesAsync().GetAwaiter().GetResult();
    }

    public void Dispose() => _factory.Dispose();

    public sealed class ApiFactory : WebApplicationFactory<Program>;
}
