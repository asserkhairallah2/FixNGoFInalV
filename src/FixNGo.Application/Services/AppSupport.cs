using System.Text.Json;
using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Application.Services;

/// <summary>Atomic human-readable code allocator backed by the Sequences table.</summary>
public static class Codes
{
    public static async Task<string> NextAsync(IAppDbContext db, string prefix, CancellationToken ct = default)
    {
        var seq = await db.Sequences.FirstOrDefaultAsync(s => s.Prefix == prefix, ct);
        if (seq is null)
        {
            seq = new Sequence { Prefix = prefix, NextValue = 1 };
            db.Sequences.Add(seq);
        }
        var value = seq.NextValue++;
        await db.SaveChangesAsync(ct);
        return $"{prefix}-{value:D4}";
    }
}

/// <summary>Loads the current pricing snapshot; old requests keep their own version.</summary>
public sealed class SettingsService(IAppDbContext db) : ISettingsService
{
    public async Task<(PricingSettings Settings, int Version)> CurrentAsync(CancellationToken ct = default)
    {
        var version = await db.PlatformSettingsVersions.Where(x => x.IsCurrent)
            .OrderByDescending(x => x.Version).FirstOrDefaultAsync(ct);
        if (version is null) return (new PricingSettings(), 1);
        var settings = JsonSerializer.Deserialize<PricingSettings>(version.SettingsJson) ?? new PricingSettings();
        return (settings, version.Version);
    }

    public async Task<PricingSettings> ForRequestAsync(ServiceRequest request, CancellationToken ct = default)
    {
        var v = await db.PlatformSettingsVersions.FirstOrDefaultAsync(x => x.Version == request.SettingsVersion, ct);
        return v is null ? new PricingSettings() : JsonSerializer.Deserialize<PricingSettings>(v.SettingsJson) ?? new PricingSettings();
    }
}

/// <summary>Shared entity-to-DTO projections so no mapping logic leaks into controllers.</summary>
public static class Mappings
{
    public static VehicleDto Vehicle(Vehicle v) => new(v.Id, v.Make, v.Model, v.Year, v.Plate, v.Color, v.Fuel.ToString(), v.IsPrimary);

    public static RequestDto Request(ServiceRequest r) => new(
        r.Id, r.Code, r.Kind, r.Priority, r.Status, r.CustomerId, r.VehicleId,
        r.PickupLatitude, r.PickupLongitude, r.PickupAddress, r.DestinationLatitude, r.DestinationLongitude,
        r.DistanceKm, r.EstimateMinor, r.QuoteMinor, r.PaymentMethod, r.CreatedAt,
        StateMachines.RequestStep(r.Status), r.CancellationReason,
        r.AssignedProviderId, r.AssignedProvider?.FullName,
        r.AssignedProviderId is not null ? r.AssignedProvider?.Phone : null,
        null, null, null, null,
        r.Customer?.FullName, r.AssignedProviderId is not null ? r.Customer?.Phone : null,
        r.Vehicle?.Make, r.Vehicle?.Model, r.Vehicle?.Year, r.Vehicle?.Color, r.Vehicle?.Plate,
        r.DestinationAddress, r.Problem, r.Note,
        r.Photos?.Select(p => p.FileId).ToList(),
        r.AcceptedAt, r.CompletedAt);

    public static RequestEventDto Event(RequestEvent e) => new(e.Status, e.Note, e.At);

    public static OfferDto Offer(Offer o) => new(o.Id, o.RequestId, o.ProviderId, o.Status, o.ExpiresAt,
        o.PriceMinor, o.DistanceKm, o.EtaMinutes, o.IsP0);

    public static QuoteDto Quote(Quote q) => new(q.Id, q.RequestId, q.Version, q.Status, q.TotalMinor,
        q.ProviderNetMinor, q.CalloutMinor, q.LaborMinor, q.PartsMinor, q.ServiceFeeMinor, q.Diagnosis);

    public static PaymentMethodDto PaymentMethod(PaymentMethod p) => new(p.Id, p.Type, p.Brand, p.Last4,
        p.ExpMonth, p.ExpYear, p.Label, p.IsDefault);

    public static PaymentDto Payment(Payment p) => new(p.Id, p.AmountMinor, p.Method, p.Status, p.FailureReason, p.SettledAt);

    public static InvoiceDto Invoice(Invoice i) => new(i.Id, i.Number, i.SubtotalMinor, i.ServiceFeeMinor,
        i.TotalMinor, i.Status, i.Method, i.LinesJson, i.IssuedAt, i.CustomerCashConfirmed);

    public static WalletEntryDto WalletEntry(WalletEntry e) => new(e.Id, e.Type, e.AmountMinor, e.Reference, e.At);

    public static BankAccountDto BankAccount(BankAccount b) => new(b.Id, b.HolderName, b.BankName, b.IbanLast4, b.IsDefault, b.IsVerified);

    public static WithdrawalDto Withdrawal(Withdrawal w) => new(w.Id, w.Code, w.AmountMinor, w.FeeMinor, w.NetMinor, w.Status, w.FailureReason);

    public static CenterDto Center(ServiceCenter c)
    {
        var activeServices = c.Services?.Where(s => s.IsActive).OrderBy(s => s.PriceMinor).ToList();
        var serviceNames = activeServices?.Select(s => s.Name).ToList();
        var startingMinor = activeServices is { Count: > 0 } ? activeServices[0].PriceMinor : (long?)null;
        var verified = c.Owner is null || c.Owner.KycStatus == KycStatus.Approved;
        var effectiveRating = c.RatingCount > 0 ? c.Rating : 0m;
        var effectiveRecommend = c.RatingCount > 0 ? c.RecommendPercent : 0;
        return new(c.Id, c.Name, c.Address, effectiveRating, c.RatingCount,
            effectiveRecommend, c.Latitude, c.Longitude, c.Description, c.Phone,
            serviceNames, startingMinor, verified);
    }

    public static CenterServiceDto CenterService(FixNGo.Domain.Entities.CenterService s) =>
        new(s.Id, s.Name, s.PriceMinor, s.DurationMinutes, s.Description, s.IsActive);

    public static BookingDto Booking(Booking b)
    {
        var (cleanNote, extraDesc, extraMinor, baseMinor) = ParseBookingNote(b.Note, b.Service?.PriceMinor ?? b.PriceMinor, b.PriceMinor);
        var vehicleLabel = b.Vehicle is null ? null : $"{b.Vehicle.Year} {b.Vehicle.Make} {b.Vehicle.Model} ({b.Vehicle.Plate})";
        return new(b.Id, b.Code, b.CenterId, b.ServiceId, b.CustomerId,
            b.SlotStart, b.SlotEnd, b.PriceMinor, b.Status, cleanNote,
            b.Center?.Name, b.Service?.Name, b.Service?.DurationMinutes,
            b.Customer?.FullName, b.Customer?.Phone, vehicleLabel,
            extraDesc, extraMinor, baseMinor);
    }

    public static string EncodeBookingNote(string? note, string? extraDescription, long extraMinor, long baseMinor)
    {
        var (clean, _, _, _) = ParseBookingNote(note, baseMinor, baseMinor + extraMinor);
        var trimmed = clean?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(extraDescription) && extraMinor <= 0) return trimmed;
        var safeDesc = (extraDescription ?? string.Empty).Replace("|", "/").Replace("]]", "]").Trim();
        return $"{trimmed}[[EXTRA:{safeDesc}|{extraMinor}|{baseMinor}]]";
    }

    private static (string? CleanNote, string? ExtraDescription, long? ExtraMinor, long BaseMinor) ParseBookingNote(
        string? rawNote, long defaultBaseMinor, long totalPriceMinor)
    {
        if (string.IsNullOrEmpty(rawNote))
        {
            var diff = totalPriceMinor > defaultBaseMinor ? totalPriceMinor - defaultBaseMinor : (long?)null;
            return (rawNote, null, diff, defaultBaseMinor);
        }
        const string marker = "[[EXTRA:";
        var idx = rawNote.IndexOf(marker, StringComparison.Ordinal);
        if (idx < 0)
        {
            var diff = totalPriceMinor > defaultBaseMinor ? totalPriceMinor - defaultBaseMinor : (long?)null;
            return (rawNote, null, diff, defaultBaseMinor);
        }
        var clean = rawNote[..idx].Trim();
        var end = rawNote.IndexOf("]]", idx + marker.Length, StringComparison.Ordinal);
        var payload = end > idx ? rawNote[(idx + marker.Length)..end] : rawNote[(idx + marker.Length)..];
        var parts = payload.Split('|');
        var desc = parts.Length > 0 && !string.IsNullOrWhiteSpace(parts[0]) ? parts[0].Trim() : null;
        var extra = parts.Length > 1 && long.TryParse(parts[1], out var ex) && ex > 0 ? ex : (long?)null;
        var basePrice = parts.Length > 2 && long.TryParse(parts[2], out var bp) && bp > 0 ? bp : defaultBaseMinor;
        return (string.IsNullOrEmpty(clean) ? null : clean, desc, extra, basePrice);
    }

    public static WorkOrderDto WorkOrder(WorkOrder w)
    {
        var v = w.Booking?.Vehicle;
        var vehicleLabel = v is null ? null : $"{v.Year} {v.Make} {v.Model} ({v.Plate})";
        return new(w.Id, w.Code, w.BookingId, w.CenterId, w.Status, w.Notes,
            w.Booking?.Code, w.Booking?.Service?.Name, w.Booking?.Customer?.FullName, vehicleLabel,
            w.BayId, w.Bay?.Name, w.TechnicianId, w.Technician?.Name, w.SupervisorReviewed, w.StartedAt);
    }

    public static DisputeDto Dispute(Dispute d) => new(d.Id, d.RequestId, d.Reason, d.ProposedResolution, d.Resolved);

    public static KycApplicationDto Kyc(KycApplication a) => new(a.Id, a.Code, a.Status, a.ApplicantType,
        a.BusinessName, a.ReviewerNote, a.CreatedAt, a.UserId, a.User?.FullName, a.User?.Email, a.User?.Phone,
        a.Address, a.Documents?.Select(d => new KycDocumentDto(d.Id, d.DocumentType, d.FileId, d.Status.ToString(), d.ReviewNote, d.CreatedAt)).ToList());

    public static ProviderDto Provider(User u, ProviderProfile p) => Provider(u, p, 0);

    public static ProviderDto Provider(User u, ProviderProfile p, int recommendPercent) => new(
        u.Id, u.FullName, p.RatingCount > 0 ? p.Rating : 0m, p.RatingCount,
        p.CompletedJobs, p.IsOnline, p.Latitude ?? u.Latitude, p.Longitude ?? u.Longitude, p.CoverageArea ?? u.AreaLabel,
        u.Email, u.Phone, u.KycStatus, p.YearsExperience, p.CoverageRadiusKm, p.CoverageArea ?? u.AreaLabel,
        p.TruckMake, null, p.TruckPlate, p.TruckType?.ToString(), p.TruckCapacityTonnes, p.ExpertiseJson,
        p.RatingCount > 0 ? recommendPercent : 0);

    public static NotificationDto Notification(Notification n) => new(n.Id, n.Type, n.Title, n.Body, n.DeepLink, n.IsRead, n.CreatedAt);

    public static ChatMessageDto ChatMessage(ChatMessage m) => new(m.Id, m.ThreadId, m.SenderId, m.MessageType, m.Text, m.SentAt, m.ReadAt);

    public static ReviewDto Review(Review r) => Review(r, null, null);

    public static ReviewDto Review(Review r, string? authorName, string? contextLabel) =>
        new(r.Id, r.ProviderId, r.CenterId, r.Stars, r.Text, r.Recommend, r.CreatedAt, authorName, contextLabel);

    public static TicketDto Ticket(SupportTicket t) => new(t.Id, t.Code, t.Category, t.Subject, t.Status, t.CreatedAt);

    public static AuditLogDto Audit(AuditLog a) => new(a.Id, a.ActorId, a.Action, a.EntityType, a.EntityId, a.Reason, a.CreatedAt);
}
