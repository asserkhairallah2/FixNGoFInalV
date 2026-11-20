using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Application.Services;

/// <summary>Provider quotes with versioned revisions, approval and disputes.</summary>
public sealed class QuoteService(IAppDbContext db, IClock clock, INotifier notifier) : IQuoteService
{
    public async Task<QuoteDto> CreateAsync(Guid providerId, Guid requestId, CreateQuoteRequest req, CancellationToken ct = default)
    {
        var r = await db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == requestId, ct)
            ?? throw new DomainException("request.not_found", "Request not found.");
        if (r.AssignedProviderId != providerId)
            throw new DomainException("auth.forbidden", "This request is not assigned to you.");
        if (r.Status is not (RequestStatus.Arrived or RequestStatus.QuotePending or RequestStatus.Disputed))
            throw new DomainException("quote.stage_invalid", "A quote cannot be issued at this stage.");
        if (req.CalloutMinor < 0 || req.LaborMinor < 0 || req.PartsMinor < 0)
            throw new DomainException("quote.amount_invalid", "Amounts cannot be negative.");
        var (s, _) = await new SettingsService(db).CurrentAsync(ct);
        var version = await db.Quotes.Where(q => q.RequestId == requestId).MaxAsync(q => (int?)q.Version, ct) ?? 0;
        var fee = s.ServiceFeeMinor;
        var quote = new Quote
        {
            RequestId = requestId, Version = version + 1, Status = QuoteStatus.Pending,
            Diagnosis = req.Diagnosis, CalloutMinor = req.CalloutMinor, LaborMinor = req.LaborMinor,
            PartsMinor = req.PartsMinor, ServiceFeeMinor = fee,
            TotalMinor = req.CalloutMinor + req.LaborMinor + req.PartsMinor + fee,
            ProviderNetMinor = req.CalloutMinor + req.LaborMinor + req.PartsMinor,
            CreatedBy = providerId
        };
        db.Quotes.Add(quote);
        r.QuoteMinor = quote.TotalMinor;
        if (r.Status != RequestStatus.QuotePending)
        {
            r.Status = StateMachines.Request.Transition(r.Status, RequestStatus.QuotePending);
            db.RequestEvents.Add(new RequestEvent { RequestId = r.Id, Status = r.Status, Note = "quote.created", ActorId = providerId, At = clock.UtcNow });
        }
        await db.SaveChangesAsync(ct);
        await notifier.NotifyUserAsync(r.CustomerId, NotificationType.EstimateReady, "Quote ready",
            $"Your quote for {r.Code} is {quote.TotalMinor / 100m:0.00} EGP.", $"quote:{quote.Id}", ct);
        return Mappings.Quote(quote);
    }

    public async Task<IReadOnlyList<QuoteDto>> ForRequestAsync(Guid callerId, bool isAdmin, Guid requestId, CancellationToken ct = default)
    {
        var r = await db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == requestId, ct)
            ?? throw new DomainException("request.not_found", "Request not found.");
        if (!isAdmin && r.CustomerId != callerId && r.AssignedProviderId != callerId)
            throw new DomainException("auth.forbidden", "You cannot view these quotes.");
        return await db.Quotes.Where(q => q.RequestId == requestId).OrderBy(q => q.Version)
            .Select(q => Mappings.Quote(q)).ToListAsync(ct);
    }

    public async Task<QuoteDto> ApproveAsync(Guid customerId, Guid requestId, Guid quoteId, CancellationToken ct = default)
    {
        var r = await db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == requestId, ct)
            ?? throw new DomainException("request.not_found", "Request not found.");
        if (r.CustomerId != customerId) throw new DomainException("auth.forbidden", "Only the customer may approve.");
        var q = await db.Quotes.FirstOrDefaultAsync(x => x.Id == quoteId && x.RequestId == requestId, ct)
            ?? throw new DomainException("quote.not_found", "Quote not found.");
        if (q.Status != QuoteStatus.Pending) throw new DomainException("quote.already_handled", "Quote already handled.");
        q.Status = QuoteStatus.Approved;
        foreach (var other in db.Quotes.Where(x => x.RequestId == requestId && x.Id != quoteId && x.Status == QuoteStatus.Pending))
            other.Status = QuoteStatus.Rejected;
        r.Status = StateMachines.Request.Transition(r.Status, RequestStatus.QuoteApproved);
        r.QuoteMinor = q.TotalMinor;
        db.RequestEvents.Add(new RequestEvent { RequestId = r.Id, Status = r.Status, Note = "quote.approved", ActorId = customerId, At = clock.UtcNow });
        await db.SaveChangesAsync(ct);
        if (r.AssignedProviderId is not null)
            await notifier.NotifyUserAsync(r.AssignedProviderId.Value, NotificationType.EstimateApproved, "Quote approved",
                $"The customer approved your quote for {r.Code}.", $"request:{r.Id}", ct);
        return Mappings.Quote(q);
    }

    public async Task<DisputeDto> DisputeAsync(Guid customerId, Guid requestId, DisputeRequest req, CancellationToken ct = default)
    {
        var r = await db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == requestId, ct)
            ?? throw new DomainException("request.not_found", "Request not found.");
        if (r.CustomerId != customerId) throw new DomainException("auth.forbidden", "Only the customer may dispute.");
        if (r.Status is not (RequestStatus.QuotePending or RequestStatus.AwaitingPayment))
            throw new DomainException("request.stage_invalid", "This request cannot be disputed now.");
        var dispute = new Dispute { RequestId = requestId, Reason = req.Reason, ProposedResolution = req.ProposedResolution };
        db.Disputes.Add(dispute);
        r.Status = StateMachines.Request.Transition(r.Status, RequestStatus.Disputed);
        db.RequestEvents.Add(new RequestEvent { RequestId = r.Id, Status = r.Status, Note = "quote.disputed", ActorId = customerId, At = clock.UtcNow });
        await db.SaveChangesAsync(ct);
        if (r.AssignedProviderId is not null)
            await notifier.NotifyUserAsync(r.AssignedProviderId.Value, NotificationType.EstimateDisputed, "Quote disputed",
                $"The customer disputed the quote for {r.Code}.", $"request:{r.Id}", ct);
        return Mappings.Dispute(dispute);
    }
}
