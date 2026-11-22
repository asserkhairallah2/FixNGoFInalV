using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FixNGo.Web.Controllers;

[ApiController]
[Route("api/v1/notifications")]
[Authorize]
public sealed class NotificationController(INotificationService svc) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> List([FromQuery] bool unreadOnly = false, CancellationToken ct = default) => Ok(await svc.ListAsync(this.UserId(), unreadOnly, ct));
    [HttpGet("unread-count")] public async Task<IActionResult> UnreadCount(CancellationToken ct) => Ok(new { count = await svc.UnreadCountAsync(this.UserId(), ct) });
    [HttpPost("read")] public async Task<IActionResult> MarkRead([FromBody] MarkReadRequest req, CancellationToken ct) { await svc.MarkReadAsync(this.UserId(), req, ct); return NoContent(); }
    [HttpPost("read-all")] public async Task<IActionResult> MarkAll(CancellationToken ct) { await svc.MarkAllReadAsync(this.UserId(), ct); return NoContent(); }
    [HttpGet("preferences")] public async Task<IActionResult> Preferences(CancellationToken ct) => Ok(await svc.PreferencesAsync(this.UserId(), ct));
    [HttpPut("preferences")] public async Task<IActionResult> UpdatePreferences([FromBody] UpdateNotificationPreferencesRequest req, CancellationToken ct) => Ok(await svc.UpdatePreferencesAsync(this.UserId(), req, ct));
    [HttpPost("devices")] public async Task<IActionResult> AddDevice([FromBody] DeviceTokenRequest req, CancellationToken ct) { await svc.AddDeviceTokenAsync(this.UserId(), req, ct); return NoContent(); }
    [HttpDelete("devices/{token}")] public async Task<IActionResult> RemoveDevice(string token, CancellationToken ct) { await svc.RemoveDeviceTokenAsync(this.UserId(), token, ct); return NoContent(); }
}

[ApiController]
[Route("api/v1/chat")]
[Authorize]
public sealed class ChatController(IChatService svc) : ControllerBase
{
    [HttpGet("threads")] public async Task<IActionResult> Threads(CancellationToken ct) => Ok(await svc.ThreadsAsync(this.UserId(), ct));
    [HttpPost("threads")] public async Task<IActionResult> Start([FromBody] ChatThreadStartRequest req, CancellationToken ct) => Ok(await svc.StartAsync(this.UserId(), req, ct));
    [HttpGet("threads/{id:guid}")] public async Task<IActionResult> Thread(Guid id, CancellationToken ct) => Ok(await svc.ThreadAsync(this.UserId(), id, ct));
    [HttpPost("threads/{id:guid}/messages")] public async Task<IActionResult> Send(Guid id, [FromBody] SendMessageRequest req, CancellationToken ct) => Ok(await svc.SendAsync(this.UserId(), id, req, ct));
    [HttpPost("threads/{id:guid}/location")] public async Task<IActionResult> SendLocation(Guid id, [FromBody] LocationMessageRequest req, CancellationToken ct) => Ok(await svc.SendLocationAsync(this.UserId(), id, req, ct));
    [HttpPost("threads/{id:guid}/read")] public async Task<IActionResult> MarkRead(Guid id, CancellationToken ct) { await svc.MarkReadAsync(this.UserId(), id, ct); return NoContent(); }
}

[ApiController]
[Route("api/v1/reviews")]
[Authorize]
public sealed class ReviewController(IReviewService svc) : ControllerBase
{
    [HttpPost("provider/{providerId:guid}")] public async Task<IActionResult> ForProvider(Guid providerId, [FromQuery] Guid requestId, [FromBody] CreateReviewRequest req, CancellationToken ct)
        => Ok(await svc.CreateAsync(this.UserId(), ReviewTargetType.Provider, providerId, requestId, null, req, ct));
    [HttpPost("center/{centerId:guid}")] public async Task<IActionResult> ForCenter(Guid centerId, [FromQuery] Guid bookingId, [FromBody] CreateReviewRequest req, CancellationToken ct)
        => Ok(await svc.CreateAsync(this.UserId(), ReviewTargetType.Center, centerId, null, bookingId, req, ct));
    [HttpPost("customer/{customerId:guid}")] [Authorize(Policy = "Provider")] public async Task<IActionResult> ForCustomer(Guid customerId, [FromQuery] Guid requestId, [FromBody] CreateReviewRequest req, CancellationToken ct)
        => Ok(await svc.CreateAsync(this.UserId(), ReviewTargetType.Customer, customerId, requestId, null, req, ct));
    [HttpGet("provider/{providerId:guid}")] public async Task<IActionResult> ListProvider(Guid providerId, CancellationToken ct) => Ok(await svc.ForProviderAsync(providerId, ct));
    [HttpGet("center/{centerId:guid}")] public async Task<IActionResult> ListCenter(Guid centerId, CancellationToken ct) => Ok(await svc.ForCenterAsync(centerId, ct));
    [HttpGet("customer/{customerId:guid}")] public async Task<IActionResult> ListCustomer(Guid customerId, CancellationToken ct) => Ok(await svc.ForCustomerAsync(customerId, ct));
    [HttpPost("{id:guid}/report")] public async Task<IActionResult> Report(Guid id, [FromBody] ReportReviewRequest req, CancellationToken ct) { await svc.ReportAsync(id, req, ct); return NoContent(); }
}
