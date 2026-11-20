using System.Net;
using System.Net.Http.Headers;
using FluentAssertions;

namespace FixNGo.Api.Tests;

/// <summary>
/// Verifies file upload magic-byte checks, scoped download tokens (?ft=), per-file ownership
/// enforcement, and rejection of JWT access_token in /api/v1/files query strings.
/// </summary>
[Collection("api")]
public sealed class FileSecurityTests(ApiTestHost host)
{
    private static readonly byte[] TinyPng = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");

    [Fact]
    public async Task Upload_RejectsFakePngWithHtmlBytes()
    {
        using var owner = host.Client(ApiTestHost.Owner);
        using var form = new MultipartFormDataContent();
        var fakeBytes = System.Text.Encoding.UTF8.GetBytes("<html><script>alert(1)</script></html>");
        var content = new ByteArrayContent(fakeBytes);
        content.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        form.Add(content, "file", "evil.png");

        using var res = await owner.PostAsync("/api/v1/files/upload?purpose=document", form);
        ((int)res.StatusCode).Should().BeOneOf([400, 409, 422]);
    }

    [Fact]
    public async Task ScopedFileToken_EnforcesOwnership_AllowsAdmin_AndRejectsJwtQueryParam()
    {
        // 1. Captain uploads a private KYC document
        Guid fileId;
        using (var captain = host.Client(ApiTestHost.Captain))
        {
            using var form = new MultipartFormDataContent();
            var content = new ByteArrayContent(TinyPng);
            content.Headers.ContentType = new MediaTypeHeaderValue("image/png");
            form.Add(content, "file", "license.png");
            using var uploadRes = await captain.PostAsync("/api/v1/files/upload?purpose=kyc", form);
            uploadRes.StatusCode.Should().Be(HttpStatusCode.OK);
            var json = System.Text.Json.JsonDocument.Parse(await uploadRes.Content.ReadAsStringAsync()).RootElement;
            fileId = json.GetProperty("id").GetGuid();
        }

        // 2. Anonymous request without token -> 401
        using var anon = host.Anon();
        (await anon.GetAsync($"/api/v1/files/{fileId}")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        // 3. Passing raw JWT in ?access_token= on /files -> MUST be rejected (401)
        var captainJwt = host.Token(ApiTestHost.Captain);
        (await anon.GetAsync($"/api/v1/files/{fileId}?access_token={Uri.EscapeDataString(captainJwt)}"))
            .StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        // 4. Captain's scoped ?ft= token -> 200 OK
        string captainFt;
        using (var captain = host.Client(ApiTestHost.Captain))
        {
            var (code, body) = await Http.Post(captain, "/api/v1/files/token", new { });
            code.Should().Be(HttpStatusCode.OK);
            captainFt = body.Text("token");
            captainFt.Should().NotBeNullOrWhiteSpace();
        }
        (await anon.GetAsync($"/api/v1/files/{fileId}?ft={Uri.EscapeDataString(captainFt)}"))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        // 5. Unrelated CarOwner's ?ft= token -> 404 NotFound (private file hidden)
        string ownerFt;
        using (var owner = host.Client(ApiTestHost.Owner))
        {
            var (code, body) = await Http.Post(owner, "/api/v1/files/token", new { });
            code.Should().Be(HttpStatusCode.OK);
            ownerFt = body.Text("token");
        }
        (await anon.GetAsync($"/api/v1/files/{fileId}?ft={Uri.EscapeDataString(ownerFt)}"))
            .StatusCode.Should().Be(HttpStatusCode.NotFound);

        // 6. Admin's ?ft= token -> 200 OK (admin can inspect KYC documents)
        string adminFt;
        using (var admin = host.Client(ApiTestHost.Admin))
        {
            var (code, body) = await Http.Post(admin, "/api/v1/files/token", new { });
            code.Should().Be(HttpStatusCode.OK);
            adminFt = body.Text("token");
        }
        (await anon.GetAsync($"/api/v1/files/{fileId}?ft={Uri.EscapeDataString(adminFt)}"))
            .StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
