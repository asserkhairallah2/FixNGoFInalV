using AutoMapper;
using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FixNGo.Web.Controllers;

[ApiController]
[Route("api/v1/centers")]
[Authorize]
public sealed class CenterController(ICenterService svc) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> Catalog(CancellationToken ct) => Ok(await svc.CatalogAsync(ct));
    [HttpGet("{id:guid}")] public async Task<IActionResult> Get(Guid id, CancellationToken ct) => Ok(await svc.GetAsync(id, ct));
    [HttpGet("{id:guid}/services")] public async Task<IActionResult> Services(Guid id, CancellationToken ct) => Ok(await svc.ServicesAsync(id, ct));
    [HttpGet("{id:guid}/availability")] public async Task<IActionResult> Availability(Guid id, [FromQuery] Guid serviceId, [FromQuery] DateTime day, CancellationToken ct)
        => Ok(await svc.AvailabilityAsync(id, serviceId, day, ct));

    [HttpPost("bookings")]
    [Authorize(Roles = nameof(Role.CarOwner))]
    public async Task<IActionResult> Book([FromBody] CreateBookingRequest req, CancellationToken ct) => Ok(await svc.CreateBookingAsync(this.UserId(), req, ct));
    [HttpGet("bookings")] public async Task<IActionResult> Bookings(CancellationToken ct) => Ok(await svc.BookingsAsync(this.UserId(), this.IsAdmin(), ct));
    [HttpGet("bookings/{id:guid}")] public async Task<IActionResult> Booking(Guid id, CancellationToken ct) => Ok(await svc.GetBookingAsync(this.UserId(), this.IsAdmin(), id, ct));
    [HttpPost("bookings/{id:guid}/cancel")] public async Task<IActionResult> CancelBooking(Guid id, [FromBody] CancelBookingRequest? req, CancellationToken ct)
        => Ok(await svc.CancelBookingAsync(this.UserId(), this.IsAdmin(), id, req ?? new CancelBookingRequest(), ct));
    [HttpPost("bookings/{id:guid}/reschedule")]
    [Authorize(Roles = nameof(Role.CarOwner))]
    public async Task<IActionResult> Reschedule(Guid id, [FromBody] RescheduleRequest req, CancellationToken ct) => Ok(await svc.RescheduleAsync(this.UserId(), id, req, ct));
}

[ApiController]
[Route("api/v1/center-admin")]
[Authorize(Roles = nameof(Role.ServiceCenter))]
public sealed class CenterAdminController(ICenterService svc, IMapper mapper) : ControllerBase
{
    [HttpGet("profile")] public async Task<IActionResult> Profile(CancellationToken ct) => Ok(mapper.Map<CenterDto>(await svc.OwnedAsync(this.UserId(), ct)));
    [HttpPut("profile")] public async Task<IActionResult> UpdateProfile([FromBody] CenterProfileRequest req, CancellationToken ct) => Ok(await svc.UpdateProfileAsync(this.UserId(), req, ct));
    [HttpGet("services")] public async Task<IActionResult> Services(CancellationToken ct) => Ok(await svc.AllServicesAsync((await svc.OwnedAsync(this.UserId(), ct)).Id, ct));
    [HttpPost("services")] public async Task<IActionResult> AddService([FromBody] CenterServiceRequest req, CancellationToken ct) => Ok(await svc.AddServiceAsync(this.UserId(), req, ct));
    [HttpPut("services/{id:guid}")] public async Task<IActionResult> UpdateService(Guid id, [FromBody] CenterServiceRequest req, CancellationToken ct) => Ok(await svc.UpdateServiceAsync(this.UserId(), id, req, ct));
    [HttpDelete("services/{id:guid}")] public async Task<IActionResult> RemoveService(Guid id, CancellationToken ct) { await svc.RemoveServiceAsync(this.UserId(), id, ct); return NoContent(); }
    [HttpGet("hours")] public async Task<IActionResult> Hours(CancellationToken ct) => Ok(await svc.WorkingHoursAsync((await svc.OwnedAsync(this.UserId(), ct)).Id, ct));
    [HttpPut("hours")] public async Task<IActionResult> SetHours([FromBody] IReadOnlyList<WorkingHoursRequest> req, CancellationToken ct) { await svc.SetWorkingHoursAsync(this.UserId(), req, ct); return NoContent(); }
    [HttpGet("bays")] public async Task<IActionResult> Bays(CancellationToken ct) => Ok(await svc.BaysAsync((await svc.OwnedAsync(this.UserId(), ct)).Id, ct));
    [HttpPost("bays")] public async Task<IActionResult> AddBay([FromBody] NamedRequest req, CancellationToken ct) => Ok(await svc.AddBayAsync(this.UserId(), req, ct));
    [HttpGet("technicians")] public async Task<IActionResult> Technicians(CancellationToken ct) => Ok(await svc.TechniciansAsync((await svc.OwnedAsync(this.UserId(), ct)).Id, ct));
    [HttpPost("technicians")] public async Task<IActionResult> AddTechnician([FromBody] TechnicianRequest req, CancellationToken ct) => Ok(await svc.AddTechnicianAsync(this.UserId(), req, ct));
    [HttpPost("bookings/{id:guid}/confirm")] public async Task<IActionResult> Confirm(Guid id, CancellationToken ct) => Ok(await svc.DecideBookingAsync(this.UserId(), id, true, null, ct));
    [HttpPost("bookings/{id:guid}/reject")] public async Task<IActionResult> Reject(Guid id, [FromBody] RejectBookingRequest? req, CancellationToken ct) => Ok(await svc.DecideBookingAsync(this.UserId(), id, false, req?.Reason, ct));
    [HttpPost("bookings/{id:guid}/start")] public async Task<IActionResult> Start(Guid id, CancellationToken ct) => Ok(await svc.StartBookingAsync(this.UserId(), id, ct));
    [HttpPost("bookings/{id:guid}/complete")] public async Task<IActionResult> Complete(Guid id, [FromBody] CompleteBookingRequest? req, CancellationToken ct) => Ok(await svc.CompleteBookingAsync(this.UserId(), id, req, ct));
    [HttpGet("work-orders")] public async Task<IActionResult> WorkOrders([FromQuery] Guid? bookingId, CancellationToken ct) => Ok(await svc.WorkOrdersAsync(this.UserId(), this.IsAdmin(), bookingId, ct));
    [HttpPost("work-orders/{id:guid}/assign")] public async Task<IActionResult> Assign(Guid id, [FromBody] WorkOrderRequest req, CancellationToken ct) => Ok(await svc.AssignWorkOrderAsync(this.UserId(), id, req, ct));
    [HttpPost("work-orders/{id:guid}/advance")] public async Task<IActionResult> Advance(Guid id, [FromBody] WorkOrderNotesRequest req, CancellationToken ct) => Ok(await svc.AdvanceWorkOrderAsync(this.UserId(), id, req, ct));
    [HttpGet("reports")] public async Task<IActionResult> Reports(CancellationToken ct) => Ok(await svc.ReportsAsync(this.UserId(), ct));
}

public sealed record RejectBookingRequest(string? Reason);
