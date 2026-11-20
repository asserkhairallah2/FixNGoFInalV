using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Application.Services;

/// <summary>Matching, offer dispatch and the first-accept-wins race.</summary>
public sealed class OfferService(
    IAppDbContext db, IClock clock, SettingsService settings, INotifier notifier) : IOfferService
{
    /// <summary>Ranked nearby online providers for a searching request.</summary>
    public async Task<IReadOnlyList<CandidateDto>> CandidatesAsync(Guid callerId, bool isAdmin,
        Guid requestId, string sort = "recommended", CancellationToken ct = default)
    {
        var r = await db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == requestId, ct)
            ?? throw new DomainException("request.not_found", "Request not found.");
        if (!isAdmin && r.CustomerId != callerId)
            throw new DomainException("auth.forbidden", "You cannot view candidates for this request.");
        var (s, _) = await settings.CurrentAsync(ct);
        var role = r.Kind == RequestKind.Tow ? Role.TowCaptain : Role.Mechanic;

        var providers = await (from p in db.ProviderProfiles
                               join u in db.Users on p.UserId equals u.Id
                               where u.Role == role && p.IsOnline && u.Status == UserStatus.Active
                                     && u.KycStatus == KycStatus.Approved
                               select new { p, u }).ToListAsync(ct);

        var providerIds = providers.Select(x => x.p.UserId).ToList();
        var recommendByProvider = providerIds.Count == 0
            ? new Dictionary<Guid, int>()
            : await db.Reviews
                .Where(rv => !rv.IsHidden && rv.ProviderId != null && providerIds.Contains(rv.ProviderId.Value))
                .GroupBy(rv => rv.ProviderId!.Value)
                .Select(g => new
                {
                    ProviderId = g.Key,
                    RecommendPct = (int)Math.Round(100.0 * g.Count(rv => rv.Recommend) / g.Count())
                })
                .ToDictionaryAsync(x => x.ProviderId, x => x.RecommendPct, ct);

        var maxRadiusKm = Math.Max(r.RadiusKm * 4.0, s.SearchRadiusKm * 4.0);
        var nearbyCandidates = new List<CandidateScore>();
        var extendedCandidates = new List<CandidateScore>();
        var baseTotal = r.EstimateMinor ?? (r.Kind == RequestKind.Tow
            ? Pricing.TowTotalMinor(r.DistanceKm, s) : Pricing.MechanicTotalMinor(s.MechanicBaseMinor, 0, 0, s));
        foreach (var x in providers)
        {
            var rawLat = x.p.Latitude ?? x.u.Latitude ?? 30.0444;
            var rawLon = x.p.Longitude ?? x.u.Longitude ?? 31.2357;
            var (pLat, pLon) = Geo.InferEgyptianCoordinates(x.p.CoverageArea ?? x.u.AreaLabel, rawLat, rawLon);
            var rawRoad = Geo.RoadDistanceKm(r.PickupLatitude, r.PickupLongitude, pLat, pLon);
            var road = Math.Max(0.5, Math.Round(rawRoad, 1));
            var cappedApproachKm = Math.Min(road, 25.0);
            var approachExtra = cappedApproachKm > 2.0 ? (long)(Math.Round((cappedApproachKm - 2.0) * 1.2) * 500L) : 0L;
            var candPrice = baseTotal + approachExtra;
            var effectiveRating = x.p.RatingCount > 0 ? x.p.Rating : 0m;
            var scoreItem = new CandidateScore(x.p.UserId, road, Geo.EtaMinutes(road), effectiveRating, candPrice);
            if (rawRoad <= maxRadiusKm) nearbyCandidates.Add(scoreItem);
            else extendedCandidates.Add(scoreItem);
        }
        var candidates = nearbyCandidates.Count >= 3
            ? nearbyCandidates
            : nearbyCandidates.Concat(extendedCandidates.OrderBy(c => c.DistanceKm).Take(12)).ToList();
        var ranked = Matching.Rank(candidates, sort);
        var result = new List<CandidateDto>();
        foreach (var c in ranked)
        {
            var x = providers.First(p => p.p.UserId == c.ProviderId);
            var recPct = x.p.RatingCount > 0 && recommendByProvider.TryGetValue(c.ProviderId, out var rp) ? rp : 0;
            result.Add(new CandidateDto(c.ProviderId, x.u.FullName, c.Rating, x.p.RatingCount,
                c.DistanceKm, c.EtaMinutes, c.PriceMinor, c.Score, x.p.CoverageArea ?? x.u.AreaLabel, x.p.TruckMake,
                recPct, x.p.CompletedJobs));
        }
        return result;
    }

    /// <summary>Customer selects a provider: create or re-dispatch a short-lived offer and move to Offered.</summary>
    public async Task<OfferDto> SendAsync(Guid customerId, Guid requestId, SelectProviderRequest req, CancellationToken ct = default)
    {
        var r = await db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == requestId, ct)
            ?? throw new DomainException("request.not_found", "Request not found.");
        if (r.CustomerId != customerId)
            throw new DomainException("auth.forbidden", "Only the request owner may select a provider.");
        if (r.Status is not (RequestStatus.Searching or RequestStatus.Offered or RequestStatus.NoProviders))
            throw new DomainException("offer.request_not_open", "This request is no longer searching.");
        var provider = await db.Users.FirstOrDefaultAsync(u => u.Id == req.ProviderId, ct)
            ?? throw new DomainException("provider.not_found", "Provider not found.");
        var expected = r.Kind == RequestKind.Tow ? Role.TowCaptain : Role.Mechanic;
        if (provider.Role != expected)
            throw new DomainException("offer.wrong_role", "Provider does not match the request type.");
        var existing = await db.Offers.FirstOrDefaultAsync(o => o.RequestId == requestId && o.ProviderId == req.ProviderId, ct);

        var (s, _) = await settings.CurrentAsync(ct);
        var profile = await db.ProviderProfiles.FirstOrDefaultAsync(p => p.UserId == req.ProviderId, ct);
        var rawLat = profile?.Latitude ?? provider.Latitude;
        var rawLon = profile?.Longitude ?? provider.Longitude;
        var rawDistance = rawLat is not null && rawLon is not null
            ? Geo.RoadDistanceKm(r.PickupLatitude, r.PickupLongitude, rawLat.Value, rawLon.Value)
            : r.DistanceKm;
        var distance = Math.Max(0.5, Math.Round(rawDistance, 1));
        var seconds = Math.Max(r.Priority == RequestPriority.P0 ? s.P0TimeoutSeconds : s.OfferTimeoutSeconds, 300);
        Offer offer;
        if (existing is not null)
        {
            existing.Status = OfferStatus.Pending;
            existing.ExpiresAt = clock.UtcNow.AddSeconds(seconds);
            existing.PriceMinor = r.EstimateMinor ?? 0;
            existing.DistanceKm = distance;
            existing.EtaMinutes = Geo.EtaMinutes(distance);
            existing.IsP0 = r.Priority == RequestPriority.P0;
            existing.DeclineReason = null;
            offer = existing;
        }
        else
        {
            offer = new Offer
            {
                RequestId = requestId, ProviderId = req.ProviderId, Status = OfferStatus.Pending,
                ExpiresAt = clock.UtcNow.AddSeconds(seconds), PriceMinor = r.EstimateMinor ?? 0,
                DistanceKm = distance, EtaMinutes = Geo.EtaMinutes(distance), IsP0 = r.Priority == RequestPriority.P0
            };
            db.Offers.Add(offer);
        }
        if (r.Status != RequestStatus.Offered)
            db.RequestEvents.Add(new RequestEvent { RequestId = r.Id, Status = RequestStatus.Offered, Note = "offer.sent", ActorId = customerId, At = clock.UtcNow });
        r.Status = RequestStatus.Offered;
        await db.SaveChangesAsync(ct);
        await notifier.NotifyUserAsync(req.ProviderId, NotificationType.NewOffer, "New offer",
            $"New {r.Kind} offer for {offer.PriceMinor / 100m:0.00} EGP.", $"offer:{offer.Id}", ct);
        return Mappings.Offer(offer);
    }

    /// <summary>First accept wins. Conditional updates + rowversion guarantee a single winner under concurrency.</summary>
    public async Task<OfferDto> AcceptAsync(Guid providerId, Guid offerId, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var offer = await db.Offers.FirstOrDefaultAsync(o => o.Id == offerId, ct)
            ?? throw new DomainException("offer.not_found", "Offer not found.");
        if (offer.ProviderId != providerId)
            throw new DomainException("auth.forbidden", "This offer is not yours.");

        // Atomic claim: only one pending, unexpired offer can be accepted.
        var claimed = await db.Offers
            .Where(o => o.Id == offerId && o.Status == OfferStatus.Pending && o.ExpiresAt > clock.UtcNow)
            .ExecuteUpdateAsync(set => set.SetProperty(o => o.Status, OfferStatus.Accepted), ct);
        if (claimed == 0)
            throw new DomainException("offer.no_longer_available", "The offer expired or was already handled.");

        var r = await db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == offer.RequestId, ct)
            ?? throw new DomainException("request.not_found", "Request not found.");
        var won = await db.ServiceRequests
            .Where(x => x.Id == r.Id && (x.Status == RequestStatus.Offered || x.Status == RequestStatus.Searching || x.Status == RequestStatus.NoProviders))
            .ExecuteUpdateAsync(set => set
                .SetProperty(x => x.Status, RequestStatus.Accepted)
                .SetProperty(x => x.AssignedProviderId, providerId)
                .SetProperty(x => x.AcceptedAt, clock.UtcNow), ct);
        if (won == 0)
        {
            // Another concurrent accept already assigned this request; roll this offer back.
            await db.Offers.Where(o => o.Id == offerId && o.Status == OfferStatus.Accepted)
                .ExecuteUpdateAsync(set => set.SetProperty(o => o.Status, OfferStatus.Withdrawn), ct);
            await tx.CommitAsync(ct);
            throw new DomainException("offer.request_already_assigned", "Another provider was assigned first.");
        }

        var siblingProviders = await db.Offers
            .Where(o => o.RequestId == r.Id && o.Id != offerId && o.Status == OfferStatus.Pending)
            .Select(o => o.ProviderId)
            .Distinct()
            .ToListAsync(ct);

        // Withdraw all sibling offers for the same request.
        await db.Offers.Where(o => o.RequestId == r.Id && o.Id != offerId && o.Status == OfferStatus.Pending)
            .ExecuteUpdateAsync(set => set.SetProperty(o => o.Status, OfferStatus.Withdrawn), ct);
        db.RequestEvents.Add(new RequestEvent { RequestId = r.Id, Status = RequestStatus.Accepted, Note = "offer.accepted", ActorId = providerId, At = clock.UtcNow });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        offer.Status = OfferStatus.Accepted;
        await notifier.NotifyUserAsync(r.CustomerId, NotificationType.RequestAccepted, "Provider assigned",
            "A provider accepted your request.", $"request:{r.Id}", ct);
        await notifier.BroadcastUserEventAsync(r.CustomerId, "offer.accepted", new { requestId = r.Id, providerId }, ct);
        foreach (var sibId in siblingProviders)
            await notifier.BroadcastUserEventAsync(sibId, "request.updated", new { requestId = r.Id, status = nameof(RequestStatus.Accepted) }, ct);
        return Mappings.Offer(offer);
    }

    public async Task<OfferDto> DeclineAsync(Guid providerId, Guid offerId, DeclineOfferRequest req, CancellationToken ct = default)
    {
        var offer = await db.Offers.FirstOrDefaultAsync(o => o.Id == offerId, ct)
            ?? throw new DomainException("offer.not_found", "Offer not found.");
        if (offer.ProviderId != providerId)
            throw new DomainException("auth.forbidden", "This offer is not yours.");
        var updated = await db.Offers.Where(o => o.Id == offerId && o.Status == OfferStatus.Pending)
            .ExecuteUpdateAsync(set => set
                .SetProperty(o => o.Status, OfferStatus.Declined)
                .SetProperty(o => o.DeclineReason, req.Reason), ct);
        if (updated == 0) throw new DomainException("offer.no_longer_available", "Offer already handled.");
        offer.Status = OfferStatus.Declined;
        await db.SaveChangesAsync(ct);
        var r = await db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == offer.RequestId, ct);
        if (r is not null)
            await notifier.BroadcastUserEventAsync(r.CustomerId, "request.updated", new { requestId = r.Id, offerId = offer.Id }, ct);
        return Mappings.Offer(offer);
    }

    public async Task<IReadOnlyList<OfferDto>> ForProviderAsync(Guid providerId, CancellationToken ct = default)
    {
        // When an approved provider is Online, dynamically materialize/refresh offers for open recent requests
        // matching their role (even if they went online AFTER the customer created the request).
        var caller = await (from u in db.Users
                            join p in db.ProviderProfiles on u.Id equals p.UserId
                            where u.Id == providerId
                            select new { u, p }).FirstOrDefaultAsync(ct);
        if (caller is not null
            && caller.p.IsOnline
            && caller.u.Status == UserStatus.Active
            && caller.u.KycStatus == KycStatus.Approved
            && caller.u.Role is Role.Mechanic or Role.TowCaptain)
        {
            var expectedKind = caller.u.Role == Role.TowCaptain ? RequestKind.Tow : RequestKind.Mechanic;
            var recentCutoff = clock.UtcNow.AddHours(-12);
            var openRequests = await db.ServiceRequests
                .Where(r => r.Kind == expectedKind
                            && r.AssignedProviderId == null
                            && (r.Status == RequestStatus.Searching || r.Status == RequestStatus.Offered)
                            && r.CreatedAt >= recentCutoff)
                .OrderByDescending(r => r.CreatedAt)
                .Take(10)
                .ToListAsync(ct);

            if (openRequests.Count > 0)
            {
                var (s, _) = await settings.CurrentAsync(ct);
                var rawLat = caller.p.Latitude ?? caller.u.Latitude ?? 30.0444;
                var rawLon = caller.p.Longitude ?? caller.u.Longitude ?? 31.2357;
                var (provLat, provLon) = Geo.InferEgyptianCoordinates(caller.p.CoverageArea ?? caller.u.AreaLabel, rawLat, rawLon);
                var openIds = openRequests.Select(x => x.Id).ToList();
                var existingByReq = await db.Offers
                    .Where(o => o.ProviderId == providerId && openIds.Contains(o.RequestId))
                    .ToDictionaryAsync(o => o.RequestId, ct);

                var changed = false;
                foreach (var openReq in openRequests)
                {
                    var road = Math.Max(0.5, Math.Round(Geo.RoadDistanceKm(openReq.PickupLatitude, openReq.PickupLongitude, provLat, provLon), 1));
                    var ttl = Math.Max(openReq.Priority == RequestPriority.P0 ? s.P0TimeoutSeconds : s.OfferTimeoutSeconds, 300);
                    var price = openReq.EstimateMinor ?? (openReq.Kind == RequestKind.Tow
                        ? Pricing.TowTotalMinor(openReq.DistanceKm, s)
                        : Pricing.MechanicTotalMinor(s.MechanicBaseMinor, 0, 0, s));

                    if (!existingByReq.TryGetValue(openReq.Id, out var existingOffer))
                    {
                        db.Offers.Add(new Offer
                        {
                            RequestId = openReq.Id,
                            ProviderId = providerId,
                            Status = OfferStatus.Pending,
                            ExpiresAt = clock.UtcNow.AddSeconds(ttl),
                            PriceMinor = price,
                            DistanceKm = road,
                            EtaMinutes = Geo.EtaMinutes(road),
                            IsP0 = openReq.Priority == RequestPriority.P0
                        });
                        changed = true;
                    }
                    else if (existingOffer.Status == OfferStatus.Expired)
                    {
                        existingOffer.Status = OfferStatus.Pending;
                        existingOffer.ExpiresAt = clock.UtcNow.AddSeconds(ttl);
                        existingOffer.PriceMinor = price;
                        existingOffer.DistanceKm = road;
                        existingOffer.EtaMinutes = Geo.EtaMinutes(road);
                        changed = true;
                    }
                }
                if (changed)
                {
                    try { await db.SaveChangesAsync(ct); }
                    catch (DbUpdateException) { /* concurrent materialization race is harmless */ }
                }
            }
        }

        var list = await db.Offers
            .Include(o => o.Request).ThenInclude(r => r.Customer)
            .Include(o => o.Request).ThenInclude(r => r.Vehicle)
            .Where(o => o.ProviderId == providerId
                        && o.Status == OfferStatus.Pending
                        && o.ExpiresAt > clock.UtcNow
                        && (o.Request == null || (o.Request.AssignedProviderId == null
                            && o.Request.Status != RequestStatus.Cancelled
                            && o.Request.Status != RequestStatus.Completed)))
            .ToListAsync(ct);

        var ordered = list
            .OrderByDescending(o => o.Request?.CreatedAt ?? o.CreatedAt)
            .ThenBy(o => o.DistanceKm)
            .ToList();

        return ordered.Select(o =>
        {
            var dto = Mappings.Offer(o);
            var req = o.Request;
            if (req is null) return dto;
            var firstName = req.Customer?.FullName?.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
            return dto with
            {
                RequestCode = req.Code,
                CustomerFirstName = firstName,
                PickupArea = req.PickupAddress,
                DestinationAddress = req.DestinationAddress,
                VehicleMake = req.Vehicle?.Make,
                VehicleModel = req.Vehicle?.Model,
                VehicleYear = req.Vehicle?.Year,
                VehicleColor = req.Vehicle?.Color,
                Problem = req.Problem,
                TripDistanceKm = Math.Round(req.DistanceKm, 1)
            };
        }).ToList();
    }

    public async Task<IReadOnlyList<OfferDto>> ForRequestAsync(Guid callerId, bool isAdmin, Guid requestId, CancellationToken ct = default)
    {
        var r = await db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == requestId, ct)
            ?? throw new DomainException("request.not_found", "Request not found.");
        if (!isAdmin && r.CustomerId != callerId)
            throw new DomainException("auth.forbidden", "You cannot view these offers.");
        return await db.Offers.Where(o => o.RequestId == requestId).OrderByDescending(o => o.CreatedAt)
            .Select(o => Mappings.Offer(o)).ToListAsync(ct);
    }
}
