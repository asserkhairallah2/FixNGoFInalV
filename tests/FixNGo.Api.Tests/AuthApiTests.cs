using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using FixNGo.Domain.Entities;
using FixNGo.Infrastructure;
using FixNGo.Infrastructure.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace FixNGo.Api.Tests;

/// <summary>Real HTTP integration tests for the auth API using WebApplicationFactory + temp SQLite DB.</summary>
public sealed class AuthApiTests : IClassFixture<AuthApiTests.ApiFactory>
{
    private readonly ApiFactory _factory;

    public AuthApiTests(ApiFactory factory) => _factory = factory;

    private HttpClient Client => _factory.CreateClient();

    [Fact]
    public async Task Health_ReturnsOk()
    {
        var res = await Client.GetAsync("/health");
        res.StatusCode.Should().Be(HttpStatusCode.OK);
        using var body = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        body.RootElement.GetProperty("status").GetString().Should().Be("ok");
    }

    [Fact]
    public async Task SystemStatus_ReportsSetupCompleteAndMode()
    {
        var body = await Client.GetFromJsonAsync<JsonElement>("/api/v1/system/status");
        body.GetProperty("setupComplete").GetBoolean().Should().BeTrue();
        body.GetProperty("mode").GetString().Should().Be("real");
    }

    [Fact]
    public async Task Login_WithCorrectCredentials_ReturnsTokensAndAdminRole()
    {
        var (code, doc) = await Post("/api/v1/auth/login",
            new { email = "apiadmin@fixngo.local", password = "Setup@2026" });
        code.Should().Be(HttpStatusCode.OK);
        doc.RootElement.GetProperty("user").GetProperty("role").GetString().Should().Be(nameof(Role.Admin));
        var access = doc.RootElement.GetProperty("accessToken").GetString();
        access.Should().NotBeNullOrWhiteSpace();

        using var authed = _factory.CreateClient();
        authed.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", access);
        var me = await authed.GetFromJsonAsync<JsonElement>("/api/v1/auth/me");
        me.GetProperty("email").GetString().Should().Be("apiadmin@fixngo.local");
        me.GetProperty("role").GetString().Should().Be(nameof(Role.Admin));
    }

    [Fact]
    public async Task Login_WithWrongPassword_Returns401()
    {
        var (code, doc) = await Post("/api/v1/auth/login",
            new { email = "apiadmin@fixngo.local", password = "Wrong@123" });
        code.Should().Be(HttpStatusCode.Unauthorized);
        doc.RootElement.GetProperty("code").GetString().Should().Be("auth.invalid_credentials");
    }

    [Fact]
    public async Task Login_WithInvalidEmail_Returns400Validation()
    {
        var (code, _) = await Post("/api/v1/auth/login", new { email = "not-an-email", password = "x" });
        code.Should().Be(HttpStatusCode.BadRequest);
    }

    [Theory]
    [InlineData("/api/v1/auth/me")]
    public async Task ProtectedEndpoint_WithoutToken_Returns401(string path)
    {
        (await Client.GetAsync(path)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    private async Task<(HttpStatusCode, JsonDocument)> Post(string path, object payload)
    {
        var res = await Client.PostAsJsonAsync(path, payload);
        return (res.StatusCode, JsonDocument.Parse(await res.Content.ReadAsStringAsync()));
    }

    /// <summary>Builds the real host on a unique temp data dir and seeds one admin via the real hasher.</summary>
    public sealed class ApiFactory : WebApplicationFactory<Program>
    {
        public ApiFactory()
        {
            var data = Path.Combine(Path.GetTempPath(), "fixngo-apitest-" + Guid.NewGuid().ToString("N"));
            Environment.SetEnvironmentVariable("FIXNGO_DATA_DIR", data);
            Environment.SetEnvironmentVariable("FIXNGO_LOG_DIR", Path.Combine(data, "logs"));

            // Force host creation (runs Program.cs DB ensure) before seeding.
            using var startupClient = CreateClient();
            _ = startupClient;
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
            if (!db.Users.Any())
            {
                db.Users.Add(new User
                {
                    FullName = "API Test Administrator",
                    Email = "apiadmin@fixngo.local",
                    Phone = "+201000000050",
                    PasswordHash = hasher.Hash("Setup@2026"),
                    Role = Role.Admin,
                    Status = UserStatus.Active,
                    EmailVerified = true,
                    IsSuperAdmin = true
                });
                db.SaveChangesAsync().GetAwaiter().GetResult();
            }
        }
    }
}
