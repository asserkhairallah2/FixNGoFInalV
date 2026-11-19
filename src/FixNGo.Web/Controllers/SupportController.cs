using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Application.Services;
using FixNGo.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FixNGo.Web.Controllers;

[ApiController]
[Route("api/v1/support")]
[Authorize]
public sealed class SupportController(SupportService svc, IPasswordHasher hasher) : ControllerBase
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
public sealed class FileController(IFileStore files, IAppDbContext db) : ControllerBase
{
    [HttpPost("upload")]
    public async Task<IActionResult> Upload(IFormFile file, [FromQuery] string purpose, CancellationToken ct)
    {
        await using var stream = file.OpenReadStream();
        var (id, _) = await files.SaveAsync(stream, file.FileName, file.ContentType, purpose, ct);
        var record = await db.UploadedFiles.FindAsync([id], ct);
        return Ok(new FileDto(id, record!.FileName, record.ContentType, record.SizeBytes, record.Purpose));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var record = await db.UploadedFiles.FindAsync([id], ct);
        if (record is null) return NotFound();
        var stream = await files.OpenAsync(id, ct);
        if (stream is null) return NotFound();
        return File(stream, record.ContentType, record.FileName);
    }
}
