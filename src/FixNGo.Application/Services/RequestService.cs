using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Application.Services;

/// <summary>Customer roadside request lifecycle: estimate, create, timeline, cancel, status.</summary>
public sealed class RequestService(
    IAppDbContext db, IClock clock, SettingsService settings, INotifier notifier) : IRequestService
{
    public async Task<EstimateDto> EstimateAsync(EstimateRequest req, CancellationToken ct = default)
    {
        var st = await db.ServiceTypes.FirstOrDefaultAsync(s => s.Id == req.ServiceTypeId, ct)
            ?? throw new DomainException("request.service_type_invalid", "Unknown service type.");
        if (req.DistanceKm < 0 || req.DistanceKm > 2000)
            throw new DomainException("request.distance_invalid", "Invalid distance.");
        var (s, version) = await settings.CurrentAsync(ct);
        var total = st.Kind == RequestKind.Tow
            ? Pricing.TowTotalMinor(req.DistanceKm, s)
            : Pricing.MechanicTotalMinor(s.MechanicBaseMinor, 0, 0, s);
        var (low, high) = Pricing.EstimateRange(total);
        return new EstimateDto(low, high, total, version);
    }

    public async Task<RequestDto> CreateAsync(Guid customerId, CreateRequestRequest req, CancellationToken ct = default)
    {
        var st = await db.ServiceTypes.FirstOrDefaultAsync(s => s.Id == req.ServiceTypeId, ct)
            ?? throw new DomainException("request.service_type_invalid", "Unknown service type.");
        if (req.VehicleId is not null &&
            !await db.Vehicles.AnyAsync(v => v.Id == req.VehicleId && v.OwnerId == customerId, ct))
            throw new DomainException("request.vehicle_not_owned", "Vehicle not found.");
        if (req.DistanceKm < 0 || req.DistanceKm > 2000)
            throw new DomainException("request.distance_invalid", "Invalid distance.");
        if (string.IsNullOrWhiteSpace(req.PickupAddress))
            throw new DomainException("request.address_required", "Pickup address is required.");

        var (s, version) = await settings.CurrentAsync(ct);
        var (pickLat, pickLon) = Geo.InferEgyptianCoordinates(req.PickupAddress, req.PickupLatitude, req.PickupLongitude);
        double? destLat = req.DestinationLatitude;
        double? destLon = req.DestinationLongitude;
        if (st.Kind == RequestKind.Tow && !string.IsNullOrWhiteSpace(req.DestinationAddress) && destLat.HasValue && destLon.HasValue)
        {
            var inferredDest = Geo.InferEgyptianCoordinates(req.DestinationAddress, destLat.Value, destLon.Value, 30.0595, 31.4950);
            destLat = inferredDest.Lat;
            destLon = inferredDest.Lon;
        }

        var distKm = req.DistanceKm;
        if (st.Kind == RequestKind.Tow && distKm <= 0 && destLat.HasValue && destLon.HasValue)
        {
            distKm = Math.Max(1.0, Math.Round(Geo.RoadDistanceKm(pickLat, pickLon, destLat.Value, destLon.Value), 1));
        }

        var total = st.Kind == RequestKind.Tow
            ? Pricing.TowTotalMinor(distKm, s)
            : Pricing.MechanicTotalMinor(s.MechanicBaseMinor, 0, 0, s);
        var priority = req.Priority;
        if (priority == RequestPriority.Normal && await EscalatesAsync(req, ct)) priority = RequestPriority.P0;

        var r = new ServiceRequest
        {
            Code = await Codes.NextAsync(db, st.Kind == RequestKind.Tow ? "FG" : "MR", ct),
            CustomerId = customerId, VehicleId = req.VehicleId, Kind = st.Kind, Priority = priority,
            Status = RequestStatus.Searching, ServiceTypeId = st.Id, Problem = req.Problem,
            AnswersJson = req.AnswersJson ?? "{}", Note = req.Note,
            PickupLatitude = pickLat, PickupLongitude = pickLon,
            PickupAddress = req.PickupAddress.Trim(), DestinationLatitude = destLat,
            DestinationLongitude = destLon, DestinationAddress = req.DestinationAddress,
            DistanceKm = distKm, RadiusKm = s.SearchRadiusKm, SettingsVersion = version,
            EstimateMinor = total
        };
        db.ServiceRequests.Add(r);
        db.RequestEvents.Add(new RequestEvent { RequestId = r.Id, Status = r.Status, Note = "created", ActorId = customerId, At = clock.UtcNow });
        if (req.PhotoFileIds is not null)
        {
            foreach (var fid in req.PhotoFileIds.Take(5))
            {
                if (await db.UploadedFiles.AnyAsync(f => f.Id == fid, ct))
                    db.RequestPhotos.Add(new RequestPhoto { RequestId = r.Id, FileId = fid });
            }
        }
        await db.SaveChangesAsync(ct);

        // Auto-broadcast offers to currently online approved providers of matching role (keeping Status = Searching).
        var targetRole = st.Kind == RequestKind.Tow ? Role.TowCaptain : Role.Mechanic;
        var activeCutoff = clock.UtcNow.AddMinutes(-30);
        var onlineProviders = await (from p in db.ProviderProfiles
                                     join u in db.Users on p.UserId equals u.Id
                                     where u.Role == targetRole && p.IsOnline
                                           && p.LastHeartbeatAt != null && p.LastHeartbeatAt >= activeCutoff
                                           && u.Status == UserStatus.Active
                                           && u.KycStatus == KycStatus.Approved
                                     select new { p, u }).ToListAsync(ct);
        if (onlineProviders.Count > 0)
        {
            var ttlSeconds = Math.Max(priority == RequestPriority.P0 ? s.P0TimeoutSeconds : s.OfferTimeoutSeconds, 300);
            var scored = onlineProviders.Select(x =>
            {
                var pLat = x.p.Latitude ?? x.u.Latitude ?? pickLat;
                var pLon = x.p.Longitude ?? x.u.Longitude ?? pickLon;
                var road = Math.Max(0.5, Math.Round(Geo.RoadDistanceKm(pickLat, pickLon, pLat, pLon), 1));
                return new { x.p.UserId, RoadKm = road };
            }).OrderBy(x => x.RoadKm).ToList();

            var maxBroadcastKm = Math.Max(s.SearchRadiusKm * 12.0, 60.0);
            var recipients = scored.Where(x => x.RoadKm <= maxBroadcastKm).Take(25).ToList();
            if (recipients.Count == 0) recipients = scored.Take(15).ToList();

            var createdOffers = new List<Offer>();
            foreach (var rec in recipients)
            {
                var offer = new Offer
                {
                    RequestId = r.Id,
                    ProviderId = rec.UserId,
                    Status = OfferStatus.Pending,
                    ExpiresAt = clock.UtcNow.AddSeconds(ttlSeconds),
                    PriceMinor = total,
                    DistanceKm = rec.RoadKm,
                    EtaMinutes = Geo.EtaMinutes(rec.RoadKm),
                    IsP0 = priority == RequestPriority.P0
                };
                db.Offers.Add(offer);
                createdOffers.Add(offer);
            }
            await db.SaveChangesAsync(ct);

            foreach (var offer in createdOffers)
            {
                await notifier.NotifyUserAsync(offer.ProviderId, NotificationType.NewOffer,
                    $"New {r.Kind} request",
                    $"{r.Code} near {r.PickupAddress} · {offer.PriceMinor / 100m:0.00} EGP.",
                    $"offer:{offer.Id}", ct);
            }
        }
        await notifier.BroadcastRoleAsync(targetRole, "offer.new", new { requestId = r.Id, code = r.Code, kind = r.Kind.ToString() }, ct);
        await notifier.BroadcastRoleAsync(Role.Admin, "request.updated", new { requestId = r.Id, code = r.Code }, ct);

        return await GetAsync(customerId, true, r.Id, ct);
    }

    public async Task<RequestDto> AddPhotoAsync(Guid callerId, bool isAdmin, Guid id, Guid fileId, CancellationToken ct = default)
    {
        var r = await Visible(callerId, isAdmin, id, ct);
        if (!await db.UploadedFiles.AnyAsync(f => f.Id == fileId, ct))
            throw new DomainException("file.not_found", "Uploaded file not found.");
        if (!await db.RequestPhotos.AnyAsync(p => p.RequestId == r.Id && p.FileId == fileId, ct))
        {
            db.RequestPhotos.Add(new RequestPhoto { RequestId = r.Id, FileId = fileId });
            await db.SaveChangesAsync(ct);
        }
        return await GetAsync(callerId, isAdmin, id, ct);
    }

    public async Task<RequestDto> ExpandRadiusAsync(Guid callerId, bool isAdmin, Guid id, CancellationToken ct = default)
    {
        var r = await Visible(callerId, isAdmin, id, ct);
        r.RadiusKm = r.RadiusKm < 10 ? 10 : r.RadiusKm < 20 ? 20 : r.RadiusKm + 10;
        if (r.Status == RequestStatus.NoProviders)
        {
            r.Status = RequestStatus.Searching;
            db.RequestEvents.Add(new RequestEvent { RequestId = r.Id, Status = RequestStatus.Searching, Note = $"radius.{r.RadiusKm}km", ActorId = callerId, At = clock.UtcNow });
        }
        await db.SaveChangesAsync(ct);
        var targetRole = r.Kind == RequestKind.Tow ? Role.TowCaptain : Role.Mechanic;
        await notifier.BroadcastRoleAsync(targetRole, "offer.new", new { requestId = r.Id, code = r.Code, radiusKm = r.RadiusKm }, ct);
        return await GetAsync(callerId, isAdmin, id, ct);
    }

    /// <summary>Any escalates-to-P0 answer of "yes" turns the request into an accident priority.</summary>
    private async Task<bool> EscalatesAsync(CreateRequestRequest req, CancellationToken ct)
    {
        if (req.ServiceTypeId == Guid.Empty || string.IsNullOrWhiteSpace(req.AnswersJson)) return false;
        var ids = await db.FollowUpQuestions.Where(q => q.ServiceTypeId == req.ServiceTypeId && q.EscalatesToP0WhenYes)
            .Select(q => q.Key).ToListAsync(ct);
        if (ids.Count == 0) return false;
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(req.AnswersJson);
            foreach (var key in ids)
                if (doc.RootElement.TryGetProperty(key, out var v) &&
                    (v.ValueKind == System.Text.Json.JsonValueKind.True ||
                     string.Equals(v.GetString(), "yes", StringComparison.OrdinalIgnoreCase))) return true;
        }
        catch (System.Text.Json.JsonException) { /* invalid answer JSON treated as no escalation */ }
        return false;
    }

    public async Task<RequestDto> GetAsync(Guid callerId, bool isAdmin, Guid id, CancellationToken ct = default)
    {
        var r = await Visible(callerId, isAdmin, id, ct);
        return await EnrichAsync(r, ct);
    }

    public async Task<IReadOnlyList<RequestDto>> ListAsync(Guid callerId, bool isAdmin, CancellationToken ct = default)
    {
        var q = db.ServiceRequests
            .Include(r => r.Customer)
            .Include(r => r.AssignedProvider)
            .Include(r => r.Vehicle)
            .Include(r => r.Photos)
            .AsQueryable();
        if (!isAdmin) q = q.Where(r => r.CustomerId == callerId || r.AssignedProviderId == callerId);
        var list = await q.OrderByDescending(r => r.CreatedAt).Take(200).ToListAsync(ct);
        var providerIds = list.Where(r => r.AssignedProviderId is not null).Select(r => r.AssignedProviderId!.Value).Distinct().ToList();
        var profiles = providerIds.Count == 0
            ? new Dictionary<Guid, ProviderProfile>()
            : await db.ProviderProfiles.Where(p => providerIds.Contains(p.UserId)).ToDictionaryAsync(p => p.UserId, ct);
        return list.Select(r =>
        {
            var dto = Mappings.Request(r);
            if (r.AssignedProviderId is not null && profiles.TryGetValue(r.AssignedProviderId.Value, out var prof))
            {
                var pLat = prof.Latitude ?? r.AssignedProvider?.Latitude;
                var pLon = prof.Longitude ?? r.AssignedProvider?.Longitude;
                var pickupKm = pLat.HasValue && pLon.HasValue
                    ? Math.Round(Geo.RoadDistanceKm(r.PickupLatitude, r.PickupLongitude, pLat.Value, pLon.Value), 1)
                    : (double?)null;
                dto = dto with
                {
                    ProviderRating = prof.Rating,
                    ProviderJobs = prof.CompletedJobs,
                    ProviderTruckMake = prof.TruckMake,
                    ProviderTruckPlate = prof.TruckPlate,
                    ProviderTruckType = prof.TruckType?.ToString(),
                    ProviderLatitude = pLat,
                    ProviderLongitude = pLon,
                    PickupDistanceKm = pickupKm
                };
            }
            return dto;
        }).ToList();
    }

    public async Task<IReadOnlyList<RequestEventDto>> TimelineAsync(Guid callerId, bool isAdmin, Guid id, CancellationToken ct = default)
    {
        var r = await Visible(callerId, isAdmin, id, ct);
        return await db.RequestEvents.Where(e => e.RequestId == r.Id).OrderBy(e => e.At)
            .Select(e => Mappings.Event(e)).ToListAsync(ct);
    }

    public async Task<RequestDto> CancelAsync(Guid callerId, bool isAdmin, Guid id, CancelRequestRequest req, CancellationToken ct = default)
    {
        var r = await Visible(callerId, isAdmin, id, ct);
        if (!isAdmin && r.CustomerId != callerId)
            throw new DomainException("auth.forbidden", "Only the customer may cancel this request.");
        var assignedId = r.AssignedProviderId;
        var pendingProviderIds = await db.Offers
            .Where(o => o.RequestId == r.Id && o.Status == OfferStatus.Pending)
            .Select(o => o.ProviderId)
            .Distinct()
            .ToListAsync(ct);
        r.Status = StateMachines.Request.Transition(r.Status, RequestStatus.Cancelled);
        r.CancellationReason = req.ReasonKey;
        db.RequestEvents.Add(new RequestEvent { RequestId = r.Id, Status = r.Status, Note = req.ReasonKey ?? req.Note, ActorId = callerId, At = clock.UtcNow });
        foreach (var o in db.Offers.Where(o => o.RequestId == r.Id && o.Status == OfferStatus.Pending))
            o.Status = OfferStatus.Withdrawn;
        await db.SaveChangesAsync(ct);
        await notifier.NotifyUserAsync(r.CustomerId, NotificationType.StatusCompleted, "Request cancelled", $"Request {r.Code} was cancelled.", $"request:{r.Id}", ct);
        if (assignedId is not null)
            await notifier.NotifyUserAsync(assignedId.Value, NotificationType.OfferWithdrawn, "Request cancelled", $"Request {r.Code} was cancelled by the customer.", $"request:{r.Id}", ct);
        foreach (var pid in pendingProviderIds.Where(pid => pid != assignedId))
            await notifier.BroadcastUserEventAsync(pid, "request.updated", new { requestId = r.Id, status = nameof(RequestStatus.Cancelled) }, ct);
        return Mappings.Request(r);
    }

    /// <summary>Provider advances an assigned request through the legal state machine.</summary>
    public async Task<RequestDto> AdvanceAsync(Guid providerId, Guid id, StatusRequest req, CancellationToken ct = default)
    {
        var r = await db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new DomainException("request.not_found", "Request not found.");
        if (r.AssignedProviderId != providerId)
            throw new DomainException("auth.forbidden", "This request is not assigned to you.");
        var prevStatus = r.Status;
        r.Status = StateMachines.Request.Transition(r.Status, req.Status);
        if (req.Status == RequestStatus.Accepted) r.AcceptedAt = clock.UtcNow;
        if (req.Status == RequestStatus.Completed && prevStatus != RequestStatus.Completed)
        {
            r.CompletedAt = clock.UtcNow;
            var prof = await db.ProviderProfiles.FirstOrDefaultAsync(p => p.UserId == providerId, ct);
            if (prof is not null) prof.CompletedJobs++;

            var (s, _) = await settings.CurrentAsync(ct);
            var latestQuote = await db.Quotes
                .Where(q => q.RequestId == r.Id && q.Status != QuoteStatus.Rejected)
                .OrderByDescending(q => q.Status == QuoteStatus.Approved)
                .ThenByDescending(q => q.Version)
                .FirstOrDefaultAsync(ct);
            var total = latestQuote?.TotalMinor ?? r.QuoteMinor ?? r.EstimateMinor ?? 0;
            var fee = latestQuote?.ServiceFeeMinor ?? (total <= 0 ? 0 : total >= 25_000 ? s.ServiceFeeMinor : (long)Math.Round(total / 1.10 * 0.10));
            var subtotal = latestQuote?.ProviderNetMinor ?? Math.Max(0, total - fee);
            var inv = await db.Invoices.FirstOrDefaultAsync(i => i.RequestId == r.Id, ct);
            if (inv is null)
            {
                inv = new Invoice
                {
                    Number = await Codes.NextAsync(db, "INV", ct),
                    RequestId = r.Id,
                    CustomerId = r.CustomerId,
                    SubtotalMinor = subtotal,
                    ServiceFeeMinor = fee,
                    TotalMinor = total,
                    Method = r.PaymentMethod ?? PaymentMethodType.Cash,
                    Status = InvoiceStatus.Paid,
                    CustomerCashConfirmed = true,
                    LinesJson = System.Text.Json.JsonSerializer.Serialize(new[] { new { label = "Service", amountMinor = subtotal } })
                };
                db.Invoices.Add(inv);
            }
            else
            {
                if (inv.Status != InvoiceStatus.Paid)
                {
                    inv.SubtotalMinor = subtotal;
                    inv.ServiceFeeMinor = fee;
                    inv.TotalMinor = total;
                }
                inv.Status = InvoiceStatus.Paid;
                inv.Method ??= r.PaymentMethod ?? PaymentMethodType.Cash;
            }
            var wallet = await db.Wallets.FirstOrDefaultAsync(w => w.UserId == providerId, ct);
            if (wallet is null)
            {
                wallet = new Wallet { UserId = providerId };
                db.Wallets.Add(wallet);
                await db.SaveChangesAsync(ct);
            }
            if (!await db.WalletEntries.AnyAsync(e => e.WalletId == wallet.Id && e.Type == WalletEntryType.JobEarning && e.Reference == inv.Number, ct))
            {
                db.WalletEntries.Add(new WalletEntry
                {
                    WalletId = wallet.Id,
                    Type = WalletEntryType.JobEarning,
                    AmountMinor = inv.SubtotalMinor > 0 ? inv.SubtotalMinor : subtotal,
                    Reference = inv.Number,
                    At = clock.UtcNow
                });
            }
        }
        db.RequestEvents.Add(new RequestEvent { RequestId = r.Id, Status = r.Status, Note = req.Note, ActorId = providerId, At = clock.UtcNow });
        await db.SaveChangesAsync(ct);
        var map = new Dictionary<RequestStatus, NotificationType>
        {
            [RequestStatus.Accepted] = NotificationType.RequestAccepted,
            [RequestStatus.EnRoute] = NotificationType.StatusEnRoute,
            [RequestStatus.Arrived] = NotificationType.StatusArrived,
            [RequestStatus.Working] = NotificationType.StatusWorking,
            [RequestStatus.Completed] = NotificationType.StatusCompleted
        };
        if (map.TryGetValue(req.Status, out var nt))
            await notifier.NotifyUserAsync(r.CustomerId, nt, "Request update", $"{r.Code}: {req.Status}", $"request:{r.Id}", ct);
        return Mappings.Request(r);
    }

    private async Task<ServiceRequest> Visible(Guid callerId, bool isAdmin, Guid id, CancellationToken ct)
    {
        var r = await db.ServiceRequests
            .Include(x => x.Customer)
            .Include(x => x.AssignedProvider)
            .Include(x => x.Vehicle)
            .Include(x => x.Photos)
            .FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new DomainException("request.not_found", "Request not found.");
        if (!isAdmin && r.CustomerId != callerId && r.AssignedProviderId != callerId)
            throw new DomainException("auth.forbidden", "You cannot view this request.");
        return r;
    }

    private async Task<RequestDto> EnrichAsync(ServiceRequest r, CancellationToken ct)
    {
        var dto = Mappings.Request(r);
        if (r.AssignedProviderId is not null)
        {
            var prof = await db.ProviderProfiles.FirstOrDefaultAsync(p => p.UserId == r.AssignedProviderId, ct);
            if (prof is not null)
            {
                var pLat = prof.Latitude ?? r.AssignedProvider?.Latitude;
                var pLon = prof.Longitude ?? r.AssignedProvider?.Longitude;
                var pickupKm = pLat.HasValue && pLon.HasValue
                    ? Math.Round(Geo.RoadDistanceKm(r.PickupLatitude, r.PickupLongitude, pLat.Value, pLon.Value), 1)
                    : (double?)null;
                dto = dto with
                {
                    ProviderRating = prof.Rating,
                    ProviderJobs = prof.CompletedJobs,
                    ProviderTruckMake = prof.TruckMake,
                    ProviderTruckPlate = prof.TruckPlate,
                    ProviderTruckType = prof.TruckType?.ToString(),
                    ProviderLatitude = pLat,
                    ProviderLongitude = pLon,
                    PickupDistanceKm = pickupKm
                };
            }
        }
        return dto;
    }
}
