using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Application.Services;

/// <summary>Matching, offer dispatch and the first-accept-wins race.</summary>
public sealed class OfferService(
    IAppDbContext db, IClock clock, SettingsService settings, INotifier notifier)
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
                                     && u.KycStatus == KycStatus.Approved && p.Latitude != null && p.Longitude != null
                               select new { p, u }).ToListAsync(ct);

        var candidates = new List<CandidateScore>();
        var total = r.EstimateMinor ?? (r.Kind == RequestKind.Tow
            ? Pricing.TowTotalMinor(r.DistanceKm, s) : Pricing.MechanicTotalMinor(s.MechanicBaseMinor, 0, 0, s));
        foreach (var x in providers)
        {
            var road = Geo.RoadDistanceKm(r.PickupLatitude, r.PickupLongitude, x.p.Latitude!.Value, x.p.Longitude!.Value);
            if (road > s.SearchRadiusKm * 4) continue;
            candidates.Add(new CandidateScore(x.p.UserId, road, Geo.EtaMinutes(road), x.p.Rating, total)
            {
                // stash seconds in a side lookup by id below
            });
        }
        var ranked = Matching.Rank(candidates, sort);
        var result = new List<CandidateDto>();
        foreach (var c in ranked)
        {
            var x = providers.First(p => p.p.UserId == c.ProviderId);
            result.Add(new CandidateDto(c.ProviderId, x.u.FullName, c.Rating, x.p.RatingCount,
                c.DistanceKm, c.EtaMinutes, c.PriceMinor, c.Score, x.u.AreaLabel, x.p.TruckMake));
        }
        return result;
    }

    /// <summary>Customer selects a provider: create a short-lived offer and move to Offered.</summary>
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
        if (await db.Offers.AnyAsync(o => o.RequestId == requestId && o.ProviderId == req.ProviderId && o.Status == OfferStatus.Pending, ct))
            throw new DomainException("offer.already_sent", "An offer is already pending for this provider.");

        var (s, _) = await settings.CurrentAsync(ct);
        var profile = await db.ProviderProfiles.FirstOrDefaultAsync(p => p.UserId == req.ProviderId, ct);
        var distance = profile?.Latitude is not null
            ? Geo.RoadDistanceKm(r.PickupLatitude, r.PickupLongitude, profile.Latitude!.Value, profile.Longitude!.Value)
            : r.DistanceKm;
        var seconds = r.Priority == RequestPriority.P0 ? s.P0TimeoutSeconds : s.OfferTimeoutSeconds;
        var offer = new Offer
        {
            RequestId = requestId, ProviderId = req.ProviderId, Status = OfferStatus.Pending,
            ExpiresAt = clock.UtcNow.AddSeconds(seconds), PriceMinor = r.EstimateMinor ?? 0,
            DistanceKm = distance, EtaMinutes = Geo.EtaMinutes(distance), IsP0 = r.Priority == RequestPriority.P0
        };
        db.Offers.Add(offer);
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

        // Withdraw all sibling offers for the same request.
        await db.Offers.Where(o => o.RequestId == r.Id && o.Id != offerId && o.Status == OfferStatus.Pending)
            .ExecuteUpdateAsync(set => set.SetProperty(o => o.Status, OfferStatus.Withdrawn), ct);
        db.RequestEvents.Add(new RequestEvent { RequestId = r.Id, Status = RequestStatus.Accepted, Note = "offer.accepted", ActorId = providerId, At = clock.UtcNow });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        offer.Status = OfferStatus.Accepted;
        await notifier.NotifyUserAsync(r.CustomerId, NotificationType.RequestAccepted, "Provider assigned",
            "A provider accepted your request.", $"request:{r.Id}", ct);
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
        return Mappings.Offer(offer);
    }

    public async Task<IReadOnlyList<OfferDto>> ForProviderAsync(Guid providerId, CancellationToken ct = default)
    {
        var list = await db.Offers
            .Include(o => o.Request).ThenInclude(r => r.Customer)
            .Include(o => o.Request).ThenInclude(r => r.Vehicle)
            .Where(o => o.ProviderId == providerId && o.Status == OfferStatus.Pending)
            .OrderBy(o => o.ExpiresAt).ToListAsync(ct);
        return list.Select(o =>
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
                Problem = req.Problem
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
