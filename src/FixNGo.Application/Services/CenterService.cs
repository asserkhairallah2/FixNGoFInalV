using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Application.Services;

/// <summary>Service-center catalog, availability, bookings and work orders.</summary>
public sealed class CenterService(
    IAppDbContext db, IClock clock, INotifier notifier, SettingsService settings)
{
    public async Task<IReadOnlyList<CenterDto>> CatalogAsync(CancellationToken ct = default) =>
        await db.ServiceCenters.OrderByDescending(c => (double)c.Rating).ThenBy(c => c.Name)
            .Select(c => Mappings.Center(c)).ToListAsync(ct);

    public async Task<CenterDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var c = await db.ServiceCenters.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new DomainException("center.not_found", "Service center not found.");
        return Mappings.Center(c);
    }

    public async Task<ServiceCenter> OwnedAsync(Guid ownerId, CancellationToken ct = default) =>
        await db.ServiceCenters.FirstOrDefaultAsync(c => c.OwnerId == ownerId, ct)
        ?? throw new DomainException("center.not_found", "No service center is linked to this account.");

    public async Task<CenterDto> UpdateProfileAsync(Guid ownerId, CenterProfileRequest req, CancellationToken ct = default)
    {
        var c = await OwnedAsync(ownerId, ct);
        c.Name = req.Name.Trim(); c.Address = req.Address.Trim(); c.Description = req.Description;
        c.Phone = req.Phone; c.Latitude = req.Latitude; c.Longitude = req.Longitude;
        await db.SaveChangesAsync(ct);
        return Mappings.Center(c);
    }

    public async Task<IReadOnlyList<CenterServiceDto>> ServicesAsync(Guid centerId, CancellationToken ct = default) =>
        await db.CenterServices.Where(s => s.CenterId == centerId && s.IsActive)
            .OrderBy(s => s.Name).Select(s => Mappings.CenterService(s)).ToListAsync(ct);

    public async Task<IReadOnlyList<CenterServiceDto>> AllServicesAsync(Guid centerId, CancellationToken ct = default) =>
        await db.CenterServices.Where(s => s.CenterId == centerId)
            .OrderBy(s => s.Name).Select(s => Mappings.CenterService(s)).ToListAsync(ct);

    public async Task<CenterServiceDto> AddServiceAsync(Guid ownerId, CenterServiceRequest req, CancellationToken ct = default)
    {
        var c = await OwnedAsync(ownerId, ct);
        if (req.PriceMinor < 0 || req.DurationMinutes < 5)
            throw new DomainException("center.service_invalid", "Invalid price or duration.");
        var s = new FixNGo.Domain.Entities.CenterService
        {
            CenterId = c.Id, Name = req.Name.Trim(), Description = req.Description,
            PriceMinor = req.PriceMinor, DurationMinutes = req.DurationMinutes, IsActive = req.IsActive
        };
        db.CenterServices.Add(s);
        await db.SaveChangesAsync(ct);
        return Mappings.CenterService(s);
    }

    public async Task<CenterServiceDto> UpdateServiceAsync(Guid ownerId, Guid serviceId, CenterServiceRequest req, CancellationToken ct = default)
    {
        var c = await OwnedAsync(ownerId, ct);
        var s = await db.CenterServices.FirstOrDefaultAsync(x => x.Id == serviceId && x.CenterId == c.Id, ct)
            ?? throw new DomainException("center.service_not_found", "Service not found.");
        if (!string.IsNullOrWhiteSpace(req.Name)) s.Name = req.Name.Trim();
        if (req.Description is not null) s.Description = req.Description;
        if (req.PriceMinor > 0) s.PriceMinor = req.PriceMinor;
        if (req.DurationMinutes >= 5) s.DurationMinutes = req.DurationMinutes;
        s.IsActive = req.IsActive;
        await db.SaveChangesAsync(ct);
        return Mappings.CenterService(s);
    }

    public async Task RemoveServiceAsync(Guid ownerId, Guid serviceId, CancellationToken ct = default)
    {
        var c = await OwnedAsync(ownerId, ct);
        var s = await db.CenterServices.FirstOrDefaultAsync(x => x.Id == serviceId && x.CenterId == c.Id, ct)
            ?? throw new DomainException("center.service_not_found", "Service not found.");
        db.CenterServices.Remove(s);
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<object>> WorkingHoursAsync(Guid centerId, CancellationToken ct = default)
    {
        await EnsureCenterDefaultsAsync(centerId, ct);
        return await db.WorkingHours.Where(h => h.CenterId == centerId).OrderBy(h => h.DayOfWeek)
            .Select(h => (object)new { h.Id, h.DayOfWeek, h.IsClosed, h.OpenTime, h.CloseTime, h.IsSpecial }).ToListAsync(ct);
    }

    public async Task SetWorkingHoursAsync(Guid ownerId, IReadOnlyList<WorkingHoursRequest> items, CancellationToken ct = default)
    {
        var c = await OwnedAsync(ownerId, ct);
        foreach (var h in db.WorkingHours.Where(h => h.CenterId == c.Id)) db.WorkingHours.Remove(h);
        foreach (var item in items)
            db.WorkingHours.Add(new WorkingHours
            {
                CenterId = c.Id, DayOfWeek = item.DayOfWeek, IsClosed = item.IsClosed,
                OpenTime = item.OpenTime, CloseTime = item.CloseTime, IsSpecial = item.IsSpecial
            });
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<object>> BaysAsync(Guid centerId, CancellationToken ct = default)
    {
        await EnsureCenterDefaultsAsync(centerId, ct);
        return await db.Bays.Where(b => b.CenterId == centerId && b.IsActive)
            .Select(b => (object)new { b.Id, b.Name }).ToListAsync(ct);
    }

    private async Task EnsureCenterDefaultsAsync(Guid centerId, CancellationToken ct)
    {
        var changed = false;
        if (!await db.WorkingHours.AnyAsync(h => h.CenterId == centerId, ct))
        {
            for (var dow = 0; dow < 7; dow++)
            {
                db.WorkingHours.Add(new WorkingHours
                {
                    CenterId = centerId,
                    DayOfWeek = dow,
                    IsClosed = dow == 5, // Friday closed by default in Egypt
                    OpenTime = TimeSpan.FromHours(9),
                    CloseTime = TimeSpan.FromHours(17)
                });
            }
            changed = true;
        }
        if (!await db.Bays.AnyAsync(b => b.CenterId == centerId && b.IsActive, ct))
        {
            db.Bays.Add(new Bay { CenterId = centerId, Name = "Bay 1", IsActive = true });
            changed = true;
        }
        if (changed) await db.SaveChangesAsync(ct);
    }

    public async Task<object> AddBayAsync(Guid ownerId, NamedRequest req, CancellationToken ct = default)
    {
        var c = await OwnedAsync(ownerId, ct);
        var b = new Bay { CenterId = c.Id, Name = req.Name.Trim() };
        db.Bays.Add(b);
        await db.SaveChangesAsync(ct);
        return new { b.Id, b.Name };
    }

    public async Task<IReadOnlyList<object>> TechniciansAsync(Guid centerId, CancellationToken ct = default) =>
        await db.Technicians.Where(t => t.CenterId == centerId && t.IsActive)
            .Select(t => (object)new { t.Id, t.Name, t.Phone }).ToListAsync(ct);

    public async Task<object> AddTechnicianAsync(Guid ownerId, TechnicianRequest req, CancellationToken ct = default)
    {
        var c = await OwnedAsync(ownerId, ct);
        var t = new Technician { CenterId = c.Id, Name = req.Name.Trim(), Phone = req.Phone };
        db.Technicians.Add(t);
        await db.SaveChangesAsync(ct);
        return new { t.Id, t.Name, t.Phone };
    }

    /// <summary>Generate bookable slots for a day from working hours, bay capacity and existing bookings.</summary>
    public async Task<IReadOnlyList<AvailabilityDto>> AvailabilityAsync(Guid centerId, Guid serviceId, DateTime day, CancellationToken ct = default)
    {
        var service = await db.CenterServices.FirstOrDefaultAsync(s => s.Id == serviceId && s.CenterId == centerId, ct)
            ?? throw new DomainException("center.service_not_found", "Service not found.");
        await EnsureCenterDefaultsAsync(centerId, ct);
        var dow = (int)day.DayOfWeek;
        var hours = await db.WorkingHours.FirstOrDefaultAsync(h => h.CenterId == centerId && h.DayOfWeek == dow && !h.IsSpecial, ct);
        var bays = await db.Bays.CountAsync(b => b.CenterId == centerId && b.IsActive, ct);
        if (hours is null || hours.IsClosed || bays == 0) return [];
        var date = day.Date;
        // Working hours are entered in Africa/Cairo local time (UTC+2); store and return slots in UTC.
        var open = DateTime.SpecifyKind(date.Add(hours.OpenTime).AddHours(-2), DateTimeKind.Utc);
        var close = DateTime.SpecifyKind(date.Add(hours.CloseTime).AddHours(-2), DateTimeKind.Utc);
        var duration = TimeSpan.FromMinutes(Math.Max(15, service.DurationMinutes));
        var windowStart = date.AddHours(-4);
        var windowEnd = date.AddDays(1).AddHours(4);
        var existing = await db.Bookings.Where(b => b.CenterId == centerId && b.Status != BookingStatus.Cancelled
            && b.SlotStart >= windowStart && b.SlotStart < windowEnd).Select(b => b.SlotStart).ToListAsync(ct);

        var slots = new List<AvailabilityDto>();
        for (var start = open; start + duration <= close; start += duration)
        {
            var overlapping = existing.Count(s => DateTime.SpecifyKind(s, DateTimeKind.Utc) < start + duration
                && start < DateTime.SpecifyKind(s, DateTimeKind.Utc).Add(duration));
            slots.Add(new AvailabilityDto(start, start + duration, overlapping < bays));
        }
        return slots;
    }

    public async Task<BookingDto> CreateBookingAsync(Guid customerId, CreateBookingRequest req, CancellationToken ct = default)
    {
        var service = await db.CenterServices.FirstOrDefaultAsync(s => s.Id == req.ServiceId && s.CenterId == req.CenterId && s.IsActive, ct)
            ?? throw new DomainException("center.service_not_found", "Service not found.");
        if (req.VehicleId is not null && !await db.Vehicles.AnyAsync(v => v.Id == req.VehicleId && v.OwnerId == customerId, ct))
            throw new DomainException("request.vehicle_not_owned", "Vehicle not found.");
        var (s, _) = await settings.CurrentAsync(ct);
        var end = req.SlotStart.AddMinutes(service.DurationMinutes);
        if (await BookingsFull(req.CenterId, req.SlotStart, end, ct))
            throw new DomainException("booking.slot_full", "This slot is no longer available.");
        var b = new Booking
        {
            Code = await Codes.NextAsync(db, "BK", ct), CenterId = req.CenterId, ServiceId = req.ServiceId,
            CustomerId = customerId, VehicleId = req.VehicleId, SlotStart = req.SlotStart, SlotEnd = end,
            PriceMinor = service.PriceMinor, Status = BookingStatus.Pending, Note = req.Note,
            CreatedAt = clock.UtcNow
        };
        db.Bookings.Add(b);
        await db.SaveChangesAsync(ct);
        var center = await db.ServiceCenters.FirstOrDefaultAsync(c => c.Id == req.CenterId, ct);
        if (center is not null)
            await notifier.NotifyUserAsync(center.OwnerId, NotificationType.BookingCreated, "New booking",
                $"Booking {b.Code} was created.", $"booking:{b.Id}", ct);
        return Mappings.Booking(b);
    }

    private async Task<bool> BookingsFull(Guid centerId, DateTime start, DateTime end, CancellationToken ct)
    {
        var bays = await db.Bays.CountAsync(b => b.CenterId == centerId && b.IsActive, ct);
        if (bays == 0) bays = 1;
        var active = await db.Bookings.CountAsync(b => b.CenterId == centerId && b.Status != BookingStatus.Cancelled
            && b.Status != BookingStatus.Rejected && b.Status != BookingStatus.Expired
            && b.SlotStart < end && start < b.SlotEnd, ct);
        return active >= bays;
    }

    public async Task<IReadOnlyList<BookingDto>> BookingsAsync(Guid callerId, bool isAdmin, CancellationToken ct = default)
    {
        var q = db.Bookings.Include(b => b.Center).Include(b => b.Service).Include(b => b.Customer).Include(b => b.Vehicle).AsQueryable();
        if (!isAdmin)
        {
            var center = await db.ServiceCenters.FirstOrDefaultAsync(c => c.OwnerId == callerId, ct);
            q = center is null ? q.Where(b => b.CustomerId == callerId) : q.Where(b => b.CustomerId == callerId || b.CenterId == center.Id);
        }
        var list = await q.OrderByDescending(b => b.CreatedAt).Take(200).ToListAsync(ct);
        return list.Select(Mappings.Booking).ToList();
    }

    public async Task<BookingDto> GetBookingAsync(Guid callerId, bool isAdmin, Guid id, CancellationToken ct = default)
    {
        var b = await VisibleBooking(callerId, isAdmin, id, ct);
        return Mappings.Booking(b);
    }

    private async Task<Booking> VisibleBooking(Guid callerId, bool isAdmin, Guid id, CancellationToken ct)
    {
        var b = await db.Bookings.Include(x => x.Center).Include(x => x.Service).Include(x => x.Customer).Include(x => x.Vehicle)
            .FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new DomainException("booking.not_found", "Booking not found.");
        var center = await db.ServiceCenters.FirstOrDefaultAsync(c => c.Id == b.CenterId, ct);
        if (!isAdmin && b.CustomerId != callerId && center?.OwnerId != callerId)
            throw new DomainException("auth.forbidden", "You cannot view this booking.");
        return b;
    }

    public async Task<BookingDto> DecideBookingAsync(Guid ownerId, Guid id, bool confirm, string? reason, CancellationToken ct = default)
    {
        var b = await db.Bookings.Include(x => x.Center).Include(x => x.Service).Include(x => x.Customer).Include(x => x.Vehicle)
            .FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new DomainException("booking.not_found", "Booking not found.");
        var center = await OwnedAsync(ownerId, ct);
        if (b.CenterId != center.Id) throw new DomainException("auth.forbidden", "This booking is not for your center.");
        b.Status = StateMachines.Booking.Transition(b.Status, confirm ? BookingStatus.Confirmed : BookingStatus.Rejected);
        if (!confirm) b.RejectReason = reason;
        await db.SaveChangesAsync(ct);
        await notifier.NotifyUserAsync(b.CustomerId, confirm ? NotificationType.BookingConfirmed : NotificationType.BookingRejected,
            confirm ? "Booking confirmed" : "Booking rejected", $"Booking {b.Code}.", $"booking:{b.Id}", ct);
        if (confirm && !await db.WorkOrders.AnyAsync(w => w.BookingId == b.Id, ct))
            db.WorkOrders.Add(new WorkOrder { Code = await Codes.NextAsync(db, "WO", ct), BookingId = b.Id, CenterId = center.Id });
        await db.SaveChangesAsync(ct);
        return Mappings.Booking(b);
    }

    public async Task<BookingDto> StartBookingAsync(Guid ownerId, Guid id, CancellationToken ct = default)
    {
        var b = await db.Bookings.Include(x => x.Center).Include(x => x.Service).Include(x => x.Customer).Include(x => x.Vehicle)
            .FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new DomainException("booking.not_found", "Booking not found.");
        var center = await OwnedAsync(ownerId, ct);
        if (b.CenterId != center.Id) throw new DomainException("auth.forbidden", "This booking is not for your center.");
        b.Status = StateMachines.Booking.Transition(b.Status, BookingStatus.InProgress);
        b.StartedAt = clock.UtcNow;
        var wo = await db.WorkOrders.FirstOrDefaultAsync(w => w.BookingId == b.Id, ct);
        if (wo is not null && wo.Status == WorkOrderStatus.Assigned)
        {
            wo.Status = WorkOrderStatus.InProgress;
            wo.StartedAt ??= clock.UtcNow;
        }
        await db.SaveChangesAsync(ct);
        await notifier.NotifyUserAsync(b.CustomerId, NotificationType.StatusWorking, "Appointment started",
            $"Booking {b.Code} has started.", $"booking:{b.Id}", ct);
        return Mappings.Booking(b);
    }

    public async Task<BookingDto> CompleteBookingAsync(Guid ownerId, Guid id, CompleteBookingRequest? req = null, CancellationToken ct = default)
    {
        var b = await db.Bookings.Include(x => x.Center).Include(x => x.Service).Include(x => x.Customer).Include(x => x.Vehicle)
            .FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new DomainException("booking.not_found", "Booking not found.");
        var center = await OwnedAsync(ownerId, ct);
        if (b.CenterId != center.Id) throw new DomainException("auth.forbidden", "This booking is not for your center.");
        b.Status = StateMachines.Booking.Transition(b.Status, BookingStatus.Completed);
        b.CompletedAt = clock.UtcNow;

        var basePrice = b.Service?.PriceMinor ?? b.PriceMinor;
        var extraMinor = req is not null && req.ExtraMinor > 0 ? req.ExtraMinor : 0;
        if (extraMinor > 0) b.PriceMinor = basePrice + extraMinor;
        if (req is not null && (!string.IsNullOrWhiteSpace(req.ExtraDescription) || extraMinor > 0 || !string.IsNullOrWhiteSpace(req.Notes)))
        {
            var noteBase = !string.IsNullOrWhiteSpace(req.Notes) ? req.Notes : b.Note;
            b.Note = Mappings.EncodeBookingNote(noteBase, req.ExtraDescription, extraMinor, basePrice);
        }

        var wo = await db.WorkOrders.FirstOrDefaultAsync(w => w.BookingId == b.Id, ct);
        if (wo is not null)
        {
            wo.Status = WorkOrderStatus.Closed;
            wo.ReadyAt ??= clock.UtcNow;
            wo.SupervisorReviewed = true;
            if (!string.IsNullOrWhiteSpace(req?.Notes)) wo.Notes = req.Notes;
        }

        var inv = await db.Invoices.FirstOrDefaultAsync(i => i.BookingId == b.Id, ct);
        var lines = extraMinor > 0
            ? new object[]
            {
                new { label = b.Service?.Name ?? "Service", amountMinor = basePrice },
                new { label = string.IsNullOrWhiteSpace(req?.ExtraDescription) ? "Additional parts/labor" : req!.ExtraDescription!.Trim(), amountMinor = extraMinor }
            }
            : new object[]
            {
                new { label = b.Service?.Name ?? "Service", amountMinor = b.PriceMinor }
            };
        if (inv is null)
        {
            inv = new Invoice
            {
                Number = await Codes.NextAsync(db, "INV", ct),
                BookingId = b.Id,
                CustomerId = b.CustomerId,
                SubtotalMinor = b.PriceMinor,
                ServiceFeeMinor = 0,
                TotalMinor = b.PriceMinor,
                Status = InvoiceStatus.Paid,
                Method = PaymentMethodType.Cash,
                CustomerCashConfirmed = true,
                LinesJson = System.Text.Json.JsonSerializer.Serialize(lines)
            };
            db.Invoices.Add(inv);
        }
        else
        {
            inv.SubtotalMinor = b.PriceMinor;
            inv.TotalMinor = b.PriceMinor;
            inv.Status = InvoiceStatus.Paid;
            inv.LinesJson = System.Text.Json.JsonSerializer.Serialize(lines);
        }

        await db.SaveChangesAsync(ct);
        await notifier.NotifyUserAsync(b.CustomerId, NotificationType.StatusCompleted, "Appointment complete",
            $"Booking {b.Code} was completed.", $"booking:{b.Id}", ct);
        return Mappings.Booking(b);
    }

    public async Task<BookingDto> CancelBookingAsync(Guid callerId, bool isAdmin, Guid id, CancelBookingRequest req, CancellationToken ct = default)
    {
        var b = await VisibleBooking(callerId, isAdmin, id, ct);
        b.Status = StateMachines.Booking.Transition(b.Status, BookingStatus.Cancelled);
        b.CancelReason = req.Reason;
        await db.SaveChangesAsync(ct);
        return Mappings.Booking(b);
    }

    public async Task<BookingDto> RescheduleAsync(Guid callerId, Guid id, RescheduleRequest req, CancellationToken ct = default)
    {
        var b = await VisibleBooking(callerId, false, id, ct);
        if (b.CustomerId != callerId) throw new DomainException("auth.forbidden", "Only the customer may reschedule.");
        if (b.Status != BookingStatus.Pending && b.Status != BookingStatus.Confirmed)
            throw new DomainException("booking.stage_invalid", "Booking cannot be rescheduled.");
        var end = req.SlotStart.AddMinutes((await db.CenterServices.FirstAsync(s => s.Id == b.ServiceId, ct)).DurationMinutes);
        if (await BookingsFull(b.CenterId, req.SlotStart, end, ct))
            throw new DomainException("booking.slot_full", "Slot is full.");
        b.SlotStart = req.SlotStart; b.SlotEnd = end; b.Status = BookingStatus.Pending;
        await db.SaveChangesAsync(ct);
        await notifier.NotifyUserAsync(b.CustomerId, NotificationType.BookingRescheduled, "Booking rescheduled",
            $"Booking {b.Code} moved to {req.SlotStart:u}.", $"booking:{b.Id}", ct);
        return Mappings.Booking(b);
    }

    public async Task<IReadOnlyList<WorkOrderDto>> WorkOrdersAsync(Guid callerId, bool isAdmin, Guid? bookingId, CancellationToken ct = default)
    {
        var q = db.WorkOrders
            .Include(w => w.Booking).ThenInclude(b => b.Service)
            .Include(w => w.Booking).ThenInclude(b => b.Customer)
            .Include(w => w.Booking).ThenInclude(b => b.Vehicle)
            .Include(w => w.Bay)
            .Include(w => w.Technician)
            .AsQueryable();
        if (bookingId is not null) q = q.Where(w => w.BookingId == bookingId);
        if (!isAdmin)
        {
            var center = await db.ServiceCenters.FirstOrDefaultAsync(c => c.OwnerId == callerId, ct);
            q = center is null ? q.Where(w => false) : q.Where(w => w.CenterId == center.Id);
        }
        var list = await q.OrderByDescending(w => w.CreatedAt).ToListAsync(ct);
        return list.Select(Mappings.WorkOrder).ToList();
    }

    public async Task<WorkOrderDto> AdvanceWorkOrderAsync(Guid ownerId, Guid id, WorkOrderNotesRequest req, CancellationToken ct = default)
    {
        var w = await db.WorkOrders.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new DomainException("work_order.not_found", "Work order not found.");
        var center = await OwnedAsync(ownerId, ct);
        if (w.CenterId != center.Id) throw new DomainException("auth.forbidden", "Not your work order.");
        var next = w.Status switch
        {
            WorkOrderStatus.Assigned => WorkOrderStatus.InProgress,
            WorkOrderStatus.InProgress => WorkOrderStatus.ReadyForReview,
            WorkOrderStatus.ReadyForReview => WorkOrderStatus.Closed,
            _ => throw new DomainException("work_order.closed", "Work order already closed.")
        };
        w.Status = StateMachines.WorkOrder.Transition(w.Status, next);
        w.Notes = req.Notes ?? w.Notes;
        w.SupervisorReviewed = req.SupervisorReviewed || w.SupervisorReviewed;
        if (next == WorkOrderStatus.InProgress) w.StartedAt = clock.UtcNow;
        if (next == WorkOrderStatus.ReadyForReview) w.ReadyAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        return Mappings.WorkOrder(w);
    }

    public async Task<WorkOrderDto> AssignWorkOrderAsync(Guid ownerId, Guid id, WorkOrderRequest req, CancellationToken ct = default)
    {
        var w = await db.WorkOrders.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new DomainException("work_order.not_found", "Work order not found.");
        var center = await OwnedAsync(ownerId, ct);
        if (w.CenterId != center.Id) throw new DomainException("auth.forbidden", "Not your work order.");
        if (req.BayId is not null && !await db.Bays.AnyAsync(b => b.Id == req.BayId && b.CenterId == center.Id, ct))
            throw new DomainException("center.bay_invalid", "Unknown bay.");
        if (req.TechnicianId is not null && !await db.Technicians.AnyAsync(t => t.Id == req.TechnicianId && t.CenterId == center.Id, ct))
            throw new DomainException("center.technician_invalid", "Unknown technician.");
        w.BayId = req.BayId; w.TechnicianId = req.TechnicianId; w.Notes = req.Notes ?? w.Notes;
        await db.SaveChangesAsync(ct);
        return Mappings.WorkOrder(w);
    }

    public async Task<object> ReportsAsync(Guid ownerId, CancellationToken ct = default)
    {
        var center = await OwnedAsync(ownerId, ct);
        var total = await db.Bookings.CountAsync(b => b.CenterId == center.Id, ct);
        var completed = await db.Bookings.CountAsync(b => b.CenterId == center.Id && b.Status == BookingStatus.Completed, ct);
        var revenue = await db.Invoices.Where(i => i.Booking != null && i.Booking.CenterId == center.Id && i.Status == InvoiceStatus.Paid)
            .SumAsync(i => (long?)i.TotalMinor, ct) ?? 0;
        return new { total, completed, revenueMinor = revenue };
    }
}
