using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;

namespace FixNGo.Web.Controllers;

[ApiController]
[Route("api/v1/support")]
[Authorize]
public sealed class SupportController(ISupportService svc, IPasswordHasher hasher) : ControllerBase
{
    [HttpPost("tickets")] public async Task<IActionResult> CreateTicket([FromBody] CreateTicketRequest req, CancellationToken ct) => Ok(await svc.CreateTicketAsync(this.UserId(), req, ct));
    [HttpGet("tickets")] public async Task<IActionResult> Tickets(CancellationToken ct) => Ok(await svc.TicketsAsync(this.UserId(), ct));
    [HttpGet("tickets/{id:guid}")] public async Task<IActionResult> Ticket(Guid id, CancellationToken ct) => Ok(await svc.TicketAsync(this.UserId(), this.IsAdmin(), id, ct));
    [HttpPost("tickets/{id:guid}/reply")] public async Task<IActionResult> Reply(Guid id, [FromBody] TicketReplyRequest req, CancellationToken ct) => Ok(await svc.ReplyAsync(this.UserId(), id, req, ct));

    [HttpGet("faqs")] [AllowAnonymous] public async Task<IActionResult> Faqs(CancellationToken ct) => Ok(await svc.FaqsAsync(ct));
    [HttpGet("legal/{key}")] [AllowAnonymous] public async Task<IActionResult> Legal(string key, CancellationToken ct) => Ok(await svc.LegalAsync(key, ct));

    [HttpPost("sos")] public async Task<IActionResult> Sos([FromBody] SosRequest req, CancellationToken ct) => Ok(await svc.SosAsync(this.UserId(), req, ct));
    [HttpGet("sos")] public async Task<IActionResult> MySos(CancellationToken ct) => Ok(await svc.MySosAsync(this.UserId(), ct));
    [HttpPost("safety")] public async Task<IActionResult> Report([FromBody] SafetyReportRequest req, CancellationToken ct) => Ok(await svc.ReportAsync(this.UserId(), req, ct));
    [HttpGet("safety")] public async Task<IActionResult> MyReports(CancellationToken ct) => Ok(await svc.MyReportsAsync(this.UserId(), ct));

    [HttpPost("deletion")] public async Task<IActionResult> RequestDeletion([FromBody] DeletionRequest req, CancellationToken ct) => Ok(await svc.RequestDeletionAsync(this.UserId(), req, hasher, ct));
    [HttpPost("deletion/cancel")] public async Task<IActionResult> CancelDeletion(CancellationToken ct) { await svc.CancelDeletionAsync(this.UserId(), ct); return NoContent(); }
}

[ApiController]
[Route("api/v1/files")]
[Authorize]
public sealed class FileController(IFileStore files, IFileAccessService access,
    Microsoft.AspNetCore.DataProtection.IDataProtectionProvider protection) : ControllerBase
{
    private static readonly TimeSpan TokenLifetime = TimeSpan.FromMinutes(10);
    private Microsoft.AspNetCore.DataProtection.ITimeLimitedDataProtector Protector =>
        Microsoft.AspNetCore.DataProtection.DataProtectionAdvancedExtensions.ToTimeLimitedDataProtector(
            protection.CreateProtector("FixNGo.FileDownload.v1"));

    [HttpPost("upload")]
    [RequestSizeLimit(11 * 1024 * 1024)]
    public async Task<IActionResult> Upload(IFormFile file, [FromQuery] string purpose, CancellationToken ct)
    {
        if (file is null || file.Length == 0) return BadRequest(new { code = "file.missing", detail = "Choose a file to upload." });
        await using var stream = file.OpenReadStream();
        var (id, _) = await files.SaveAsync(stream, file.FileName, file.ContentType, purpose ?? "document", ct);
        var dto = await access.AssignOwnerAsync(id, this.UserId(), ct);
        return Ok(dto);
    }

    /// <summary>Issues a short-lived token usable only for GET /api/v1/files/{id} (for img/a tags).</summary>
    [HttpPost("token")]
    public IActionResult Token()
    {
        var expires = DateTimeOffset.UtcNow.Add(TokenLifetime);
        var payload = $"{this.UserId()}|{(this.IsAdmin() ? 1 : 0)}";
        return Ok(new { token = Protector.Protect(payload, expires), expiresAt = expires.UtcDateTime });
    }

    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> Get(Guid id, [FromQuery] string? ft, CancellationToken ct)
    {
        Guid caller; bool isAdmin;
        if (User.Identity?.IsAuthenticated == true)
        {
            caller = this.UserId(); isAdmin = this.IsAdmin();
        }
        else if (!string.IsNullOrEmpty(ft) && TryReadToken(ft, out caller, out isAdmin)) { }
        else return Unauthorized();

        if (!await access.CanReadAsync(caller, isAdmin, id, ct)) return NotFound();
        var record = await access.GetMetadataAsync(id, ct);
        if (record is null) return NotFound();
        var stream = await files.OpenAsync(id, ct);
        if (stream is null) return NotFound();
        Response.Headers["Cache-Control"] = "private, max-age=300";
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        return File(stream, record.ContentType, record.FileName);
    }

    private bool TryReadToken(string token, out Guid caller, out bool isAdmin)
    {
        caller = Guid.Empty; isAdmin = false;
        try
        {
            var parts = Protector.Unprotect(token).Split('|');
            if (parts.Length != 2 || !Guid.TryParse(parts[0], out caller)) return false;
            isAdmin = parts[1] == "1";
            return true;
        }
        catch (System.Security.Cryptography.CryptographicException) { return false; }
    }
}
