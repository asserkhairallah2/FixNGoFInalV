using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Application.Services;

/// <summary>Uber-style bidirectional matching: nearest-first candidates, broadcast/direct offers, customer 60s confirmation timer &amp; 3-strike auto-cancel.</summary>
public sealed class OfferService(
    IAppDbContext db, IClock clock, SettingsService settings, INotifier notifier) : IOfferService
{
    public async Task<IReadOnlyList<CandidateDto>> CandidatesAsync(Guid callerId, bool isAdmin,
        Guid requestId, string sort = "nearest", CancellationToken ct = default)
    {
        await RequestTimeoutEvaluator.EvaluateAsync(db, clock, notifier, requestId, ct);

        var r = await db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == requestId, ct)
            ?? throw new DomainException("request.not_found", "Request not found.");
        if (!isAdmin && r.CustomerId != callerId)
            throw new DomainException("auth.forbidden", "You cannot view candidates for this request.");
        var (s, _) = await settings.CurrentAsync(ct);
        var role = r.Kind == RequestKind.Tow ? Role.TowCaptain : Role.Mechanic;

        var activeCutoff = clock.UtcNow.AddMinutes(-30);
        var providers = await (from p in db.ProviderProfiles
                               join u in db.Users on p.UserId equals u.Id
                               where u.Role == role && p.IsOnline
                                     && p.LastHeartbeatAt != null && p.LastHeartbeatAt >= activeCutoff
                                     && u.Status == UserStatus.Active
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

        // Cohesive pricing: every candidate displays the exact upfront fare matching C06/C08 (zero mystery inflation).
        var baseTotal = r.EstimateMinor ?? (r.Kind == RequestKind.Tow
            ? Pricing.TowTotalMinor(r.DistanceKm, s)
            : Pricing.MechanicTotalMinor(s.MechanicBaseMinor, 0, 0, s));

        var maxRadiusKm = Math.Max(r.RadiusKm * 4.0, s.SearchRadiusKm * 4.0);
        var nearbyCandidates = new List<CandidateScore>();
        var extendedCandidates = new List<CandidateScore>();

        foreach (var x in providers)
        {
            var rawLat = x.p.Latitude ?? x.u.Latitude ?? 30.0444;
            var rawLon = x.p.Longitude ?? x.u.Longitude ?? 31.2357;
            var (pLat, pLon) = Geo.InferEgyptianCoordinates(x.p.CoverageArea ?? x.u.AreaLabel, rawLat, rawLon);
            var rawRoad = Geo.RoadDistanceKm(r.PickupLatitude, r.PickupLongitude, pLat, pLon);
            var road = Math.Max(0.5, Math.Round(rawRoad, 1));
            var effectiveRating = x.p.RatingCount > 0 ? x.p.Rating : 0m;
            var scoreItem = new CandidateScore(x.p.UserId, road, Geo.EtaMinutes(road), effectiveRating, baseTotal);
            if (rawRoad <= maxRadiusKm) nearbyCandidates.Add(scoreItem);
            else extendedCandidates.Add(scoreItem);
        }

        var candidates = nearbyCandidates.Count >= 3
            ? nearbyCandidates
            : nearbyCandidates.Concat(extendedCandidates.OrderBy(c => c.DistanceKm).Take(12)).ToList();

        var ranked = Matching.Rank(candidates, string.IsNullOrWhiteSpace(sort) ? "nearest" : sort);
        var result = new List<CandidateDto>();
        foreach (var c in ranked)
        {
            var x = providers.First(p => p.p.UserId == c.ProviderId);
            var recPct = x.p.RatingCount > 0 && recommendByProvider.TryGetValue(c.ProviderId, out var rp) ? rp : 0;
            var alreadyAccepted = r.PendingProviderId == c.ProviderId;
            result.Add(new CandidateDto(
                c.ProviderId,
                x.u.FullName,
                c.Rating,
                x.p.RatingCount,
                c.DistanceKm,
                c.EtaMinutes,
                c.PriceMinor,
                c.Score,
                x.p.CoverageArea ?? x.u.AreaLabel,
                x.p.TruckMake,
                recPct,
                x.p.CompletedJobs,
                alreadyAccepted));
        }

        // If a specialist has already clicked Accept and is awaiting customer confirmation, float them to index 0
        if (r.PendingProviderId is not null)
        {
            result = result
                .OrderByDescending(c => c.ProviderAccepted)
                .ToList();
        }
        return result;
    }

    public async Task<OfferDto> SendAsync(Guid customerId, Guid requestId, SelectProviderRequest req, CancellationToken ct = default)
    {
        await RequestTimeoutEvaluator.EvaluateAsync(db, clock, notifier, requestId, ct);

        var r = await db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == requestId, ct)
            ?? throw new DomainException("request.not_found", "Request not found.");
        if (r.CustomerId != customerId)
            throw new DomainException("auth.forbidden", "Only the request owner may select a provider.");
        if (r.Status is not (RequestStatus.Searching or RequestStatus.Offered or RequestStatus.NoProviders))
            throw new DomainException("offer.request_not_open", "This request is no longer searching.");

        // If this exact provider ALREADY clicked Accept on the broadcast request, confirm & assign immediately!
        if (r.PendingProviderId == req.ProviderId)
        {
            await ConfirmPendingProviderAsync(customerId, requestId, ct);
            var confirmedOffer = await db.Offers.FirstOrDefaultAsync(o => o.RequestId == requestId && o.ProviderId == req.ProviderId, ct);
            if (confirmedOffer is not null) return Mappings.Offer(confirmedOffer);
        }

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
        var price = r.EstimateMinor ?? (r.Kind == RequestKind.Tow
            ? Pricing.TowTotalMinor(r.DistanceKm, s)
            : Pricing.MechanicTotalMinor(s.MechanicBaseMinor, 0, 0, s));

        Offer offer;
        if (existing is not null)
        {
            existing.Status = OfferStatus.Pending;
            existing.ExpiresAt = clock.UtcNow.AddSeconds(seconds);
            existing.PriceMinor = price;
            existing.DistanceKm = distance;
            existing.EtaMinutes = Geo.EtaMinutes(distance);
            existing.IsP0 = r.Priority == RequestPriority.P0;
            existing.CustomerSelected = true;
            existing.DeclineReason = null;
            offer = existing;
        }
        else
        {
            offer = new Offer
            {
                RequestId = requestId, ProviderId = req.ProviderId, Status = OfferStatus.Pending,
                ExpiresAt = clock.UtcNow.AddSeconds(seconds), PriceMinor = price,
                DistanceKm = distance, EtaMinutes = Geo.EtaMinutes(distance),
                IsP0 = r.Priority == RequestPriority.P0, CustomerSelected = true
            };
            db.Offers.Add(offer);
        }
        if (r.Status != RequestStatus.Offered)
            db.RequestEvents.Add(new RequestEvent { RequestId = r.Id, Status = RequestStatus.Offered, Note = "offer.sent", ActorId = customerId, At = clock.UtcNow });
        r.Status = RequestStatus.Offered;
        await db.SaveChangesAsync(ct);
        await notifier.NotifyUserAsync(req.ProviderId, NotificationType.NewOffer, "Direct customer request",
            $"Customer selected you for {r.Code} ({offer.PriceMinor / 100m:0.00} EGP).", $"offer:{offer.Id}", ct);
        await notifier.BroadcastUserEventAsync(req.ProviderId, "offer.new", new { requestId = r.Id, offerId = offer.Id, direct = true }, ct);
        return Mappings.Offer(offer) with { CustomerSelected = true };
    }

    public async Task<OfferDto> AcceptAsync(Guid providerId, Guid offerId, CancellationToken ct = default)
    {
        var offerSnapshot = await db.Offers.AsNoTracking().FirstOrDefaultAsync(o => o.Id == offerId, ct)
            ?? throw new DomainException("offer.not_found", "Offer not found.");
        if (offerSnapshot.ProviderId != providerId)
            throw new DomainException("auth.forbidden", "This offer is not yours.");

        await RequestTimeoutEvaluator.EvaluateAsync(db, clock, notifier, offerSnapshot.RequestId, ct);

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var offer = await db.Offers.FirstOrDefaultAsync(o => o.Id == offerId, ct)
            ?? throw new DomainException("offer.not_found", "Offer not found.");

        var r = await db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == offer.RequestId, ct)
            ?? throw new DomainException("request.not_found", "Request not found.");

        if (r.AssignedProviderId is not null)
        {
            await tx.RollbackAsync(ct);
            throw new DomainException("offer.request_already_assigned", "Another provider was already assigned.");
        }

        var now = clock.UtcNow;

        // CASE A: Customer explicitly selected this provider -> both parties agreed, assign immediately!
        if (offer.CustomerSelected)
        {
            var claimed = await db.Offers
                .Where(o => o.Id == offerId && o.Status == OfferStatus.Pending && o.ExpiresAt > now)
                .ExecuteUpdateAsync(set => set.SetProperty(o => o.Status, OfferStatus.Accepted), ct);
            if (claimed == 0)
            {
                await tx.RollbackAsync(ct);
                throw new DomainException("offer.no_longer_available", "The offer expired or was already handled.");
            }

            var won = await db.ServiceRequests
                .Where(x => x.Id == r.Id && x.AssignedProviderId == null &&
                            (x.Status == RequestStatus.Offered || x.Status == RequestStatus.Searching || x.Status == RequestStatus.NoProviders))
                .ExecuteUpdateAsync(set => set
                    .SetProperty(x => x.Status, RequestStatus.Accepted)
                    .SetProperty(x => x.AssignedProviderId, providerId)
                    .SetProperty(x => x.PendingProviderId, (Guid?)null)
                    .SetProperty(x => x.PendingOfferId, (Guid?)null)
                    .SetProperty(x => x.CustomerConfirmDeadlineAt, (DateTime?)null)
                    .SetProperty(x => x.AcceptedAt, now), ct);
            if (won == 0)
            {
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

            await db.Offers.Where(o => o.RequestId == r.Id && o.Id != offerId && o.Status == OfferStatus.Pending)
                .ExecuteUpdateAsync(set => set.SetProperty(o => o.Status, OfferStatus.Withdrawn), ct);
            db.RequestEvents.Add(new RequestEvent { RequestId = r.Id, Status = RequestStatus.Accepted, Note = "offer.accepted", ActorId = providerId, At = now });
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            offer.Status = OfferStatus.Accepted;
            await notifier.NotifyUserAsync(r.CustomerId, NotificationType.RequestAccepted, "Provider assigned",
                "Your selected specialist accepted your request.", $"request:{r.Id}", ct);
            await notifier.BroadcastUserEventAsync(r.CustomerId, "offer.accepted", new { requestId = r.Id, providerId }, ct);
            foreach (var sibId in siblingProviders)
                await notifier.BroadcastUserEventAsync(sibId, "request.updated", new { requestId = r.Id, status = nameof(RequestStatus.Accepted) }, ct);
            return Mappings.Offer(offer) with { CustomerSelected = true };
        }

        // CASE B: Broadcast request -> start live 60s Customer Confirmation Timer!
        if (r.PendingProviderId is not null && r.PendingProviderId != providerId && r.CustomerConfirmDeadlineAt > now)
        {
            await tx.RollbackAsync(ct);
            throw new DomainException("offer.awaiting_customer", "Another specialist is currently awaiting customer confirmation.");
        }

        var confirmDeadline = now.AddSeconds(RequestTimeoutEvaluator.CustomerConfirmSeconds);
        var claimedBroadcast = await db.Offers
            .Where(o => o.Id == offerId && (o.Status == OfferStatus.Pending || (o.Status == OfferStatus.Accepted && r.PendingProviderId == providerId)) && o.ExpiresAt > now)
            .ExecuteUpdateAsync(set => set
                .SetProperty(o => o.Status, OfferStatus.Accepted)
                .SetProperty(o => o.ExpiresAt, confirmDeadline), ct);
        if (claimedBroadcast == 0)
        {
            await tx.RollbackAsync(ct);
            throw new DomainException("offer.no_longer_available", "The request expired or is no longer available.");
        }

        var lockedForConfirm = await db.ServiceRequests
            .Where(x => x.Id == r.Id && x.AssignedProviderId == null &&
                        (x.PendingProviderId == null || x.PendingProviderId == providerId) &&
                        (x.Status == RequestStatus.Searching || x.Status == RequestStatus.Offered || x.Status == RequestStatus.NoProviders))
            .ExecuteUpdateAsync(set => set
                .SetProperty(x => x.Status, RequestStatus.Offered)
                .SetProperty(x => x.PendingProviderId, providerId)
                .SetProperty(x => x.PendingOfferId, offerId)
                .SetProperty(x => x.CustomerConfirmDeadlineAt, confirmDeadline), ct);
        if (lockedForConfirm == 0)
        {
            await db.Offers.Where(o => o.Id == offerId)
                .ExecuteUpdateAsync(set => set.SetProperty(o => o.Status, OfferStatus.Pending), ct);
            await tx.CommitAsync(ct);
            throw new DomainException("offer.request_already_assigned", "Another specialist matched first.");
        }

        db.RequestEvents.Add(new RequestEvent
        {
            RequestId = r.Id,
            Status = RequestStatus.Offered,
            Note = "offer.provider_ready",
            ActorId = providerId,
            At = now
        });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        offer.Status = OfferStatus.Accepted;
        offer.ExpiresAt = confirmDeadline;

        var provName = await db.Users.Where(u => u.Id == providerId).Select(u => u.FullName).FirstOrDefaultAsync(ct) ?? "A specialist";
        await notifier.NotifyUserAsync(r.CustomerId, NotificationType.NewOffer, "Specialist ready — confirm now!",
            $"{provName} accepted {r.Code}. Confirm within {RequestTimeoutEvaluator.CustomerConfirmSeconds}s!", $"request:{r.Id}", ct);
        await notifier.BroadcastUserEventAsync(r.CustomerId, "request.updated",
            new { requestId = r.Id, pendingProviderId = providerId, deadline = confirmDeadline }, ct);
        await notifier.BroadcastUserEventAsync(providerId, "request.updated",
            new { requestId = r.Id, pendingProviderId = providerId, deadline = confirmDeadline }, ct);

        return Mappings.Offer(offer) with
        {
            AwaitingCustomerConfirm = true,
            CustomerConfirmDeadlineAt = confirmDeadline
        };
    }

    public async Task<RequestDto> ConfirmPendingProviderAsync(Guid customerId, Guid requestId, CancellationToken ct = default)
    {
        await RequestTimeoutEvaluator.EvaluateAsync(db, clock, notifier, requestId, ct);

        var r = await db.ServiceRequests
            .Include(x => x.Customer)
            .Include(x => x.Vehicle)
            .Include(x => x.Photos)
            .FirstOrDefaultAsync(x => x.Id == requestId, ct)
            ?? throw new DomainException("request.not_found", "Request not found.");
        if (r.CustomerId != customerId)
            throw new DomainException("auth.forbidden", "Only the customer may confirm this specialist.");
        if (r.Status == RequestStatus.Cancelled)
            throw new DomainException("request.cancelled", r.CancellationReason ?? "This request was cancelled.");
        if (r.AssignedProviderId is not null)
        {
            var reqSvcAlready = new RequestService(db, clock, settings, notifier);
            return await reqSvcAlready.GetAsync(customerId, false, requestId, ct);
        }
        if (r.PendingProviderId is null || r.CustomerConfirmDeadlineAt is null || r.CustomerConfirmDeadlineAt <= clock.UtcNow)
            throw new DomainException("offer.confirm_expired", "The confirmation timer expired. Searching for the next specialist.");

        var providerId = r.PendingProviderId.Value;
        var pendingOfferId = r.PendingOfferId;
        var now = clock.UtcNow;

        r.Status = RequestStatus.Accepted;
        r.AssignedProviderId = providerId;
        r.AcceptedAt = now;
        r.PendingProviderId = null;
        r.PendingOfferId = null;
        r.CustomerConfirmDeadlineAt = null;

        var siblingProviders = await db.Offers
            .Where(o => o.RequestId == r.Id && o.ProviderId != providerId && o.Status == OfferStatus.Pending)
            .Select(o => o.ProviderId)
            .Distinct()
            .ToListAsync(ct);

        foreach (var o in db.Offers.Where(o => o.RequestId == r.Id))
        {
            if (o.ProviderId == providerId) o.Status = OfferStatus.Accepted;
            else if (o.Status == OfferStatus.Pending) o.Status = OfferStatus.Withdrawn;
        }

        db.RequestEvents.Add(new RequestEvent
        {
            RequestId = r.Id,
            Status = RequestStatus.Accepted,
            Note = "customer.confirmed_provider",
            ActorId = customerId,
            At = now
        });
        await db.SaveChangesAsync(ct);

        await notifier.NotifyUserAsync(providerId, NotificationType.RequestAccepted, "Customer confirmed!",
            $"The customer confirmed your dispatch for {r.Code}. Proceed to pickup!", $"request:{r.Id}", ct);
        await notifier.BroadcastUserEventAsync(providerId, "offer.accepted", new { requestId = r.Id, providerId }, ct);
        await notifier.BroadcastUserEventAsync(providerId, "request.updated", new { requestId = r.Id, status = nameof(RequestStatus.Accepted) }, ct);
        await notifier.BroadcastUserEventAsync(customerId, "offer.accepted", new { requestId = r.Id, providerId }, ct);
        foreach (var sib in siblingProviders)
            await notifier.BroadcastUserEventAsync(sib, "request.updated", new { requestId = r.Id, status = nameof(RequestStatus.Accepted) }, ct);

        var reqSvc = new RequestService(db, clock, settings, notifier);
        return await reqSvc.GetAsync(customerId, false, requestId, ct);
    }

    public async Task<RequestDto> PassPendingProviderAsync(Guid customerId, Guid requestId, string? reason = null, CancellationToken ct = default)
    {
        var r = await db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == requestId, ct)
            ?? throw new DomainException("request.not_found", "Request not found.");
        if (r.CustomerId != customerId)
            throw new DomainException("auth.forbidden", "Only the customer may pass on a matched provider.");
        if (r.PendingProviderId is null)
        {
            var reqSvcNoop = new RequestService(db, clock, settings, notifier);
            return await reqSvcNoop.GetAsync(customerId, false, requestId, ct);
        }

        var passedProviderId = r.PendingProviderId.Value;
        var now = clock.UtcNow;

        if (r.PendingOfferId is Guid poid)
        {
            var po = await db.Offers.FirstOrDefaultAsync(o => o.Id == poid, ct);
            if (po is not null)
            {
                po.Status = OfferStatus.Declined;
                po.DeclineReason = string.IsNullOrWhiteSpace(reason) ? "passed_by_customer" : reason.Trim();
            }
        }

        r.CustomerRejectionCount++;
        r.PendingProviderId = null;
        r.PendingOfferId = null;
        r.CustomerConfirmDeadlineAt = null;

        if (r.CustomerRejectionCount >= RequestTimeoutEvaluator.MaxCustomerRejections)
        {
            r.Status = RequestStatus.Cancelled;
            r.CancellationReason = "Auto-cancelled: 3 provider matches were declined.";
            foreach (var o in db.Offers.Where(o => o.RequestId == r.Id && o.Status == OfferStatus.Pending))
                o.Status = OfferStatus.Withdrawn;
            db.RequestEvents.Add(new RequestEvent
            {
                RequestId = r.Id,
                Status = RequestStatus.Cancelled,
                Note = "auto_cancelled.max_rejections",
                ActorId = customerId,
                At = now
            });
            await db.SaveChangesAsync(ct);
            await notifier.NotifyUserAsync(customerId, NotificationType.StatusCompleted, "Request auto-cancelled",
                $"Request {r.Code} was automatically cancelled after passing on 3 specialists.", $"request:{r.Id}", ct);
            await notifier.BroadcastUserEventAsync(passedProviderId, "request.updated", new { requestId = r.Id, status = nameof(RequestStatus.Cancelled) }, ct);
        }
        else
        {
            r.Status = RequestStatus.Searching;
            db.RequestEvents.Add(new RequestEvent
            {
                RequestId = r.Id,
                Status = RequestStatus.Searching,
                Note = $"customer.passed.{r.CustomerRejectionCount}_of_{RequestTimeoutEvaluator.MaxCustomerRejections}",
                ActorId = customerId,
                At = now
            });
            await db.SaveChangesAsync(ct);
            await notifier.BroadcastUserEventAsync(passedProviderId, "request.updated", new { requestId = r.Id, status = nameof(RequestStatus.Searching) }, ct);
            var targetRole = r.Kind == RequestKind.Tow ? Role.TowCaptain : Role.Mechanic;
            await notifier.BroadcastRoleAsync(targetRole, "offer.new", new { requestId = r.Id, code = r.Code }, ct);
        }

        var reqSvc = new RequestService(db, clock, settings, notifier);
        return await reqSvc.GetAsync(customerId, false, requestId, ct);
    }

    public async Task<OfferDto> DeclineAsync(Guid providerId, Guid offerId, DeclineOfferRequest req, CancellationToken ct = default)
    {
        var offer = await db.Offers.FirstOrDefaultAsync(o => o.Id == offerId, ct)
            ?? throw new DomainException("offer.not_found", "Offer not found.");
        if (offer.ProviderId != providerId)
            throw new DomainException("auth.forbidden", "This offer is not yours.");
        var updated = await db.Offers.Where(o => o.Id == offerId && (o.Status == OfferStatus.Pending || o.Status == OfferStatus.Accepted))
            .ExecuteUpdateAsync(set => set
                .SetProperty(o => o.Status, OfferStatus.Declined)
                .SetProperty(o => o.DeclineReason, req.Reason ?? "ignored_by_provider"), ct);
        if (updated == 0) throw new DomainException("offer.no_longer_available", "Offer already handled.");
        offer.Status = OfferStatus.Declined;

        var r = await db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == offer.RequestId, ct);
        if (r is not null && r.AssignedProviderId == null)
        {
            if (r.PendingProviderId == providerId)
            {
                r.PendingProviderId = null;
                r.PendingOfferId = null;
                r.CustomerConfirmDeadlineAt = null;
            }
            var anyDirectPending = await db.Offers.AnyAsync(o =>
                o.RequestId == r.Id && o.Status == OfferStatus.Pending && o.CustomerSelected && o.ExpiresAt > clock.UtcNow, ct);
            if (!anyDirectPending && r.PendingProviderId == null && r.Status == RequestStatus.Offered)
            {
                r.Status = RequestStatus.Searching;
            }
            await db.SaveChangesAsync(ct);
            await notifier.BroadcastUserEventAsync(r.CustomerId, "request.updated", new { requestId = r.Id, offerId = offer.Id }, ct);
        }
        return Mappings.Offer(offer);
    }

    public async Task<IReadOnlyList<OfferDto>> ForProviderAsync(Guid providerId, CancellationToken ct = default)
    {
        await RequestTimeoutEvaluator.EvaluateAsync(db, clock, notifier, null, ct);

        var (s, _) = await settings.CurrentAsync(ct);
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
                            && (r.PendingProviderId == null || r.PendingProviderId == providerId)
                            && (r.Status == RequestStatus.Searching || r.Status == RequestStatus.Offered)
                            && r.CreatedAt >= recentCutoff)
                .OrderByDescending(r => r.CreatedAt)
                .Take(10)
                .ToListAsync(ct);

            if (openRequests.Count > 0)
            {
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
                            IsP0 = openReq.Priority == RequestPriority.P0,
                            CustomerSelected = false
                        });
                        changed = true;
                    }
                    else if (existingOffer.Status == OfferStatus.Expired && string.IsNullOrEmpty(existingOffer.DeclineReason) && openReq.PendingProviderId != providerId)
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

        var now = clock.UtcNow;
        var list = await db.Offers
            .Include(o => o.Request).ThenInclude(r => r.Customer)
            .Include(o => o.Request).ThenInclude(r => r.Vehicle)
            .Where(o => o.ProviderId == providerId
                        && o.ExpiresAt > now
                        && (o.Status == OfferStatus.Pending ||
                            (o.Status == OfferStatus.Accepted && o.Request != null && o.Request.PendingProviderId == providerId && o.Request.AssignedProviderId == null))
                        && (o.Request == null || (o.Request.AssignedProviderId == null
                            && o.Request.Status != RequestStatus.Cancelled
                            && o.Request.Status != RequestStatus.Completed
                            && (o.Request.PendingProviderId == null || o.Request.PendingProviderId == providerId))))
            .ToListAsync(ct);

        if (list.Count == 0) return [];

        var customerIds = list
            .Where(o => o.Request != null)
            .Select(o => o.Request!.CustomerId)
            .Distinct()
            .ToList();

        var custRatings = customerIds.Count == 0
            ? new Dictionary<Guid, (decimal Avg, int Count)>()
            : (await db.Reviews
                .Where(rv => !rv.IsHidden && rv.CustomerId != null && customerIds.Contains(rv.CustomerId.Value))
                .GroupBy(rv => rv.CustomerId!.Value)
                .Select(g => new { CustomerId = g.Key, Avg = Math.Round((decimal)g.Average(x => x.Stars), 1), Count = g.Count() })
                .ToListAsync(ct))
                .ToDictionary(x => x.CustomerId, x => (x.Avg, x.Count));

        var custTrips = customerIds.Count == 0
            ? new Dictionary<Guid, int>()
            : (await db.ServiceRequests
                .Where(sr => customerIds.Contains(sr.CustomerId) && sr.Status == RequestStatus.Completed)
                .GroupBy(sr => sr.CustomerId)
                .Select(g => new { CustomerId = g.Key, Count = g.Count() })
                .ToListAsync(ct))
                .ToDictionary(x => x.CustomerId, x => x.Count);

        var serviceTypeNames = await db.ServiceTypes.ToDictionaryAsync(st => st.Id, st => st.NameEn, ct);

        var ordered = list
            .OrderByDescending(o => o.Request?.PendingProviderId == providerId)
            .ThenByDescending(o => o.Request?.CreatedAt ?? o.CreatedAt)
            .ThenByDescending(o => o.CustomerSelected)
            .ThenBy(o => o.DistanceKm)
            .ToList();

        var fullFeeThreshold = s.MechanicBaseMinor + s.ServiceFeeMinor;
        return ordered.Select(o =>
        {
            var dto = Mappings.Offer(o);
            var req = o.Request;
            if (req is null) return dto;
            var fullName = req.Customer?.FullName ?? "Customer";
            var firstName = fullName.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? fullName;
            custRatings.TryGetValue(req.CustomerId, out var ratingTuple);
            custTrips.TryGetValue(req.CustomerId, out var tripsCount);
            string? stName = req.ServiceTypeId is Guid stId && serviceTypeNames.TryGetValue(stId, out var hitSt) ? hitSt : req.Kind.ToString();
            var fee = o.PriceMinor <= 0 ? 0L : o.PriceMinor >= fullFeeThreshold ? s.ServiceFeeMinor : (long)Math.Round(o.PriceMinor / 1.10 * 0.10);
            var net = Math.Max(0, o.PriceMinor - fee);
            var awaitingConfirm = req.PendingProviderId == providerId && req.AssignedProviderId == null;

            return dto with
            {
                RequestCode = req.Code,
                CustomerId = req.CustomerId,
                CustomerName = fullName,
                CustomerFirstName = firstName,
                CustomerRating = ratingTuple.Count > 0 ? ratingTuple.Avg : 5.0m,
                CustomerRatingCount = ratingTuple.Count,
                CustomerCompletedTrips = tripsCount,
                PickupArea = req.PickupAddress,
                DestinationAddress = req.DestinationAddress,
                VehicleMake = req.Vehicle?.Make,
                VehicleModel = req.Vehicle?.Model,
                VehicleYear = req.Vehicle?.Year,
                VehicleColor = req.Vehicle?.Color,
                VehiclePlate = req.Vehicle?.Plate,
                Problem = req.Problem,
                ServiceName = stName,
                CustomerSelected = o.CustomerSelected,
                ServiceFeeMinor = fee,
                ProviderNetMinor = net,
                AwaitingCustomerConfirm = awaitingConfirm,
                CustomerConfirmDeadlineAt = awaitingConfirm ? req.CustomerConfirmDeadlineAt : null,
                TripDistanceKm = Math.Round(req.DistanceKm, 1)
            };
        }).ToList();
    }

    public async Task<IReadOnlyList<OfferDto>> ForRequestAsync(Guid callerId, bool isAdmin, Guid requestId, CancellationToken ct = default)
    {
        await RequestTimeoutEvaluator.EvaluateAsync(db, clock, notifier, requestId, ct);
        var r = await db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == requestId, ct)
            ?? throw new DomainException("request.not_found", "Request not found.");
        if (!isAdmin && r.CustomerId != callerId)
            throw new DomainException("auth.forbidden", "You cannot view these offers.");
        return await db.Offers.Where(o => o.RequestId == requestId).OrderByDescending(o => o.CreatedAt)
            .Select(o => Mappings.Offer(o)).ToListAsync(ct);
    }
}
