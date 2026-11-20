using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Application.Services;

/// <summary>Reviews with one-per-completed-job rule and rolling provider/center rating aggregates.</summary>
public sealed class ReviewService(IAppDbContext db, IClock clock, INotifier? notifier = null) : IReviewService
{
    public async Task<ReviewDto> CreateAsync(Guid authorId, ReviewTargetType target, Guid targetId,
        Guid? requestId, Guid? bookingId, CreateReviewRequest req, CancellationToken ct = default)
    {
        if (req.Stars < 1 || req.Stars > 5) throw new DomainException("review.stars_invalid", "Stars must be 1–5.");
        if (requestId is not null)
        {
            var r = await db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == requestId, ct)
                ?? throw new DomainException("request.not_found", "Request not found.");
            if (r.CustomerId != authorId) throw new DomainException("auth.forbidden", "Only the customer may review.");
            if (r.Status is not (RequestStatus.Completed or RequestStatus.AwaitingPayment or RequestStatus.QuoteApproved or RequestStatus.Working))
                throw new DomainException("review.request_incomplete", "Request is not completed.");
            if (target == ReviewTargetType.Provider && r.AssignedProviderId is not null)
                targetId = r.AssignedProviderId.Value;
            if (await db.Reviews.AnyAsync(x => x.RequestId == requestId && x.AuthorId == authorId, ct))
                throw new DomainException("review.duplicate", "You already reviewed this job.");
        }
        if (bookingId is not null)
        {
            var b = await db.Bookings.FirstOrDefaultAsync(x => x.Id == bookingId, ct)
                ?? throw new DomainException("booking.not_found", "Booking not found.");
            if (b.CustomerId != authorId) throw new DomainException("auth.forbidden", "Only the customer may review.");
            if (b.Status != BookingStatus.Completed) throw new DomainException("review.booking_incomplete", "Booking is not completed.");
            if (target == ReviewTargetType.Center)
                targetId = b.CenterId;
            if (await db.Reviews.AnyAsync(x => x.BookingId == bookingId && x.AuthorId == authorId, ct))
                throw new DomainException("review.duplicate", "You already reviewed this visit.");
        }
        var review = new Review
        {
            TargetType = target, ProviderId = target == ReviewTargetType.Provider ? targetId : null,
            CenterId = target == ReviewTargetType.Center ? targetId : null,
            RequestId = requestId, BookingId = bookingId, AuthorId = authorId,
            Stars = req.Stars, Text = req.Text, Recommend = req.Recommend, CreatedAt = clock.UtcNow
        };
        db.Reviews.Add(review);
        await db.SaveChangesAsync(ct);
        await RefreshAggregateAsync(target, targetId, ct);
        await db.SaveChangesAsync(ct);
        if (notifier is not null)
        {
            if (target == ReviewTargetType.Provider)
            {
                await notifier.BroadcastUserEventAsync(targetId, "request.updated", new { reviewId = review.Id, stars = review.Stars }, ct);
            }
            else if (target == ReviewTargetType.Center)
            {
                var c = await db.ServiceCenters.FirstOrDefaultAsync(x => x.Id == targetId, ct);
                if (c is not null)
                    await notifier.BroadcastUserEventAsync(c.OwnerId, "request.updated", new { reviewId = review.Id, stars = review.Stars }, ct);
            }
        }
        var authorName = await db.Users.Where(u => u.Id == authorId).Select(u => u.FullName).FirstOrDefaultAsync(ct);
        return Mappings.Review(review, authorName, null);
    }

    private async Task RefreshAggregateAsync(ReviewTargetType target, Guid id, CancellationToken ct)
    {
        var reviews = await db.Reviews.Where(r => !r.IsHidden && (target == ReviewTargetType.Provider ? r.ProviderId == id : r.CenterId == id)).ToListAsync(ct);
        var count = reviews.Count;
        var avg = count == 0 ? 0 : (decimal)reviews.Sum(r => r.Stars) / count;
        var recommend = count == 0 ? 0 : (int)Math.Round(100.0 * reviews.Count(r => r.Recommend) / count);
        if (target == ReviewTargetType.Provider)
        {
            var p = await db.ProviderProfiles.FirstOrDefaultAsync(x => x.UserId == id, ct);
            if (p is not null) { p.Rating = Math.Round(avg, 2); p.RatingCount = count; }
        }
        else
        {
            var c = await db.ServiceCenters.FirstOrDefaultAsync(x => x.Id == id, ct);
            if (c is not null) { c.Rating = Math.Round(avg, 2); c.RatingCount = count; c.RecommendPercent = recommend; }
        }
    }

    public async Task<IReadOnlyList<ReviewDto>> ForProviderAsync(Guid providerId, CancellationToken ct = default)
    {
        var rows = await (from r in db.Reviews
                          where r.ProviderId == providerId && !r.IsHidden
                          join u in db.Users on r.AuthorId equals u.Id into uj
                          from author in uj.DefaultIfEmpty()
                          join req in db.ServiceRequests on r.RequestId equals req.Id into rq
                          from sreq in rq.DefaultIfEmpty()
                          orderby r.CreatedAt descending
                          select new { r, AuthorName = author != null ? author.FullName : null, Context = sreq != null ? sreq.Kind.ToString() : null })
                         .ToListAsync(ct);
        return rows.Select(x => Mappings.Review(x.r, x.AuthorName, x.Context)).ToList();
    }

    public async Task<IReadOnlyList<ReviewDto>> ForCenterAsync(Guid centerId, CancellationToken ct = default)
    {
        var rows = await (from r in db.Reviews
                          where r.CenterId == centerId && !r.IsHidden
                          join u in db.Users on r.AuthorId equals u.Id into uj
                          from author in uj.DefaultIfEmpty()
                          join b in db.Bookings.Include(bk => bk.Service) on r.BookingId equals b.Id into bj
                          from bk in bj.DefaultIfEmpty()
                          orderby r.CreatedAt descending
                          select new { r, AuthorName = author != null ? author.FullName : null, Context = bk != null && bk.Service != null ? bk.Service.Name : null })
                         .ToListAsync(ct);
        return rows.Select(x => Mappings.Review(x.r, x.AuthorName, x.Context)).ToList();
    }

    public async Task ReportAsync(Guid reviewId, ReportReviewRequest req, CancellationToken ct = default)
    {
        var r = await db.Reviews.FirstOrDefaultAsync(x => x.Id == reviewId, ct)
            ?? throw new DomainException("review.not_found", "Review not found.");
        r.IsReported = true;
        db.SafetyReports.Add(new SafetyReport
        {
            Category = "review", Description = req.Reason, ReporterId = r.AuthorId,
            RequestId = r.RequestId, Status = SafetyReportStatus.Open
        });
        await db.SaveChangesAsync(ct);
    }

    public async Task ModerateAsync(Guid reviewId, bool hide, CancellationToken ct = default)
    {
        var r = await db.Reviews.FirstOrDefaultAsync(x => x.Id == reviewId, ct)
            ?? throw new DomainException("review.not_found", "Review not found.");
        r.IsHidden = hide;
        await db.SaveChangesAsync(ct);
        if (r.ProviderId is not null) await RefreshAggregateAsync(ReviewTargetType.Provider, r.ProviderId.Value, ct);
        if (r.CenterId is not null) await RefreshAggregateAsync(ReviewTargetType.Center, r.CenterId.Value, ct);
        await db.SaveChangesAsync(ct);
    }
}
