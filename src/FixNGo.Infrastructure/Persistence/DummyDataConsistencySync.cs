using FixNGo.Domain;
using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Infrastructure.Persistence;

/// <summary>
/// Ensures dummy datasets have distinct workshop names, varied service specializations,
/// realistic customer Review records, and 100% mathematically consistent Rating,
/// RatingCount, and RecommendPercent aggregates across ServiceCenters and ProviderProfiles.
/// Never touches non-dummy (production) databases.
/// </summary>
public static class DummyDataConsistencySync
{
    private static readonly string[] PositiveCenterComments =
    [
        "Transparent pricing, genuine parts, and on-time bay handover.",
        "Thorough multi-point check and clear explanation from the lead technician.",
        "Quick oil and filter service with zero hidden charges.",
        "Accurate diagnostics fixed the issue on the first visit.",
        "Clean waiting area, punctual appointment slot, and courteous staff.",
        "Excellent AC cooling performance after recharge and leak check."
    ];

    private static readonly string[] MixedCenterComments =
    [
        "Good mechanical work overall, though check-in took 15 extra minutes.",
        "Solid repair quality; parts pricing was slightly on the higher side.",
        "Issue resolved properly, communication on completion time could be faster."
    ];

    private static readonly string[] PositiveProviderComments =
    [
        "Arrived ahead of ETA and handled the vehicle with great care.",
        "Professional roadside diagnosis and fair transparent estimate.",
        "Fast response in heavy traffic and very polite specialist.",
        "Secured the car safely on the flatbed and delivered right to the workshop.",
        "Got my car running again on the spot within 20 minutes."
    ];

    private static readonly string[] MixedProviderComments =
    [
        "Completed the job well, arrived a few minutes after initial ETA.",
        "Helpful technician, traffic delayed arrival slightly."
    ];

    public static async Task SynchronizeIfDummyAsync(AppDbContext db, CancellationToken ct = default)
    {
        var hasDummyUsers = await db.Users.AnyAsync(u => u.Email.EndsWith("@dummy.fixngo.test"), ct);
        if (!hasDummyUsers) return;

        var centers = await db.ServiceCenters
            .Include(c => c.Owner)
            .Include(c => c.Services)
            .OrderBy(c => c.CreatedAt)
            .ThenBy(c => c.Id)
            .ToListAsync(ct);

        var profiles = await db.ProviderProfiles
            .OrderBy(p => p.UserId)
            .ToListAsync(ct);

        // Always reset stale or never-heartbeated online flags (e.g. seeded dummy providers with LastHeartbeatAt == null)
        // so matched-provider counts reflect only genuinely active online providers.
        var staleCutoff = DateTime.UtcNow.AddMinutes(-30);
        var staleOnlineFixed = false;
        foreach (var prof in profiles.Where(p => p.IsOnline && (p.LastHeartbeatAt == null || p.LastHeartbeatAt < staleCutoff)))
        {
            prof.IsOnline = false;
            staleOnlineFixed = true;
        }
        if (staleOnlineFixed)
        {
            await db.SaveChangesAsync(ct);
        }

        // Always enforce strict ChatThread participant integrity & seed realistic Customer reviews for providers to inspect
        await SynchronizeChatsAndCustomerRatingsAsync(db, ct);

        // Idempotency check: skip if centers already have consistent non-zero ratings & distinct names
        var duplicateCenterNames = centers.GroupBy(c => c.Name, StringComparer.OrdinalIgnoreCase).Any(g => g.Count() > 1);
        var inconsistentCenters = centers.Any(c => (c.RatingCount == 0 && c.RecommendPercent > 0) || (c.Owner != null && c.Owner.KycStatus == KycStatus.Approved && c.RatingCount == 0));
        var unratedApprovedProviders = await (from p in db.ProviderProfiles
                                              join u in db.Users on p.UserId equals u.Id
                                              where u.KycStatus == KycStatus.Approved && p.RatingCount == 0
                                              select p.UserId).AnyAsync(ct);

        if (!duplicateCenterNames && !inconsistentCenters && !unratedApprovedProviders)
            return;

        var owners = await db.Users
            .Where(u => u.Role == Role.CarOwner && u.Status == UserStatus.Active)
            .OrderBy(u => u.Email)
            .ToListAsync(ct);
        if (owners.Count == 0) return;

        var bookedServiceIds = (await db.Bookings.Select(b => b.ServiceId).Distinct().ToListAsync(ct)).ToHashSet();
        var rng = new Random(20261120);

        // 1. Disambiguate center names & diversify service catalogs + descriptions
        var usedNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < centers.Count; i++)
        {
            var center = centers[i];
            var ownerEmailPrefix = center.Owner?.Email.Split('@')[0] ?? $"center{i + 1}";
            var nameParts = System.Text.RegularExpressions.Regex.Replace(ownerEmailPrefix, @"\d+$", "").Split('.');
            var prettyOwner = string.Join(" ", nameParts.Select(CapWord));
            var district = (center.Address ?? "Cairo").Split(',')[0].Trim();

            var suffix = (i % 4) switch
            {
                0 => "Auto Center",
                1 => "Car Care Workshop",
                2 => "Precision Service Center",
                _ => "Service & Diagnostics"
            };
            var candidateName = $"{prettyOwner} {suffix}";
            if (!usedNames.Add(candidateName))
                candidateName = $"{prettyOwner} {suffix} ({district})";
            center.Name = candidateName;

            var profileKind = i % 3;
            center.Description = profileKind switch
            {
                0 => $"Authorized periodic maintenance, synthetic oil change, and multi-point safety workshop in {district}.",
                1 => $"Specialized computer OBD diagnostics, electrical repair, and AC cooling service in {district}.",
                _ => $"Complete brake overhaul, 3D wheel alignment, suspension, and periodic car care in {district}."
            };

            var desiredSpecs = GetDesiredServicesForProfile(profileKind, i);
            var existingList = center.Services.OrderBy(s => s.Id).ToList();

            for (var sIdx = 0; sIdx < desiredSpecs.Count; sIdx++)
            {
                var spec = desiredSpecs[sIdx];
                if (sIdx < existingList.Count)
                {
                    existingList[sIdx].Name = spec.Name;
                    existingList[sIdx].Description = spec.Description;
                    existingList[sIdx].PriceMinor = spec.PriceMinor;
                    existingList[sIdx].DurationMinutes = spec.DurationMinutes;
                    existingList[sIdx].IsActive = true;
                }
                else
                {
                    var added = new CenterService
                    {
                        CenterId = center.Id,
                        Name = spec.Name,
                        Description = spec.Description,
                        PriceMinor = spec.PriceMinor,
                        DurationMinutes = spec.DurationMinutes,
                        IsActive = true
                    };
                    db.CenterServices.Add(added);
                }
            }

            for (var extraIdx = desiredSpecs.Count; extraIdx < existingList.Count; extraIdx++)
            {
                var extraSvc = existingList[extraIdx];
                if (!bookedServiceIds.Contains(extraSvc.Id))
                    db.CenterServices.Remove(extraSvc);
                else
                    extraSvc.IsActive = false;
            }
        }

        await db.SaveChangesAsync(ct);

        // 2. Seed realistic Center Reviews for verified/active centers that have 0 reviews
        var existingCenterReviewCounts = await db.Reviews
            .Where(r => r.CenterId != null && !r.IsHidden)
            .GroupBy(r => r.CenterId!.Value)
            .Select(g => new { CenterId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.CenterId, x => x.Count, ct);

        var centerBookings = await db.Bookings
            .Where(b => b.Status == BookingStatus.Completed)
            .OrderBy(b => b.SlotStart)
            .ToListAsync(ct);

        for (var i = 0; i < centers.Count; i++)
        {
            var center = centers[i];
            var isApproved = center.Owner?.KycStatus == KycStatus.Approved;
            var hasReviews = existingCenterReviewCounts.TryGetValue(center.Id, out var cCount) && cCount > 0;

            if (!hasReviews && (isApproved || i % 2 == 0))
            {
                // Varied quality tiers so Top Rated filter clearly separates 4.6-4.9★ workshops from 3.8-4.3★ ones
                var tier = i % 3; // 0 => Top Rated (4.7-4.9), 1 => Solid (4.2-4.4), 2 => Standard (3.8-4.1)
                var reviewTargetCount = tier switch
                {
                    0 => 9 + (i % 5),
                    1 => 6 + (i % 4),
                    _ => 4 + (i % 4)
                };

                var matchedBookings = centerBookings.Where(b => b.CenterId == center.Id).ToList();
                for (var rIdx = 0; rIdx < reviewTargetCount; rIdx++)
                {
                    var author = owners[(i * 7 + rIdx * 3) % owners.Count];
                    var stars = PickStars(tier, rIdx);
                    var recommend = stars >= 4;
                    var commentPool = stars >= 4 ? PositiveCenterComments : MixedCenterComments;
                    var comment = commentPool[(i + rIdx) % commentPool.Length];
                    var linkedBooking = rIdx < matchedBookings.Count ? matchedBookings[rIdx] : null;

                    db.Reviews.Add(new Review
                    {
                        TargetType = ReviewTargetType.Center,
                        CenterId = center.Id,
                        BookingId = linkedBooking?.Id,
                        AuthorId = linkedBooking?.CustomerId ?? author.Id,
                        Stars = stars,
                        Recommend = recommend,
                        Text = comment,
                        CreatedAt = DateTime.UtcNow.AddDays(-(1 + (i * 2 + rIdx) % 26)).AddHours(-(rIdx % 9))
                    });
                }
            }
        }

        // 3. Seed realistic Provider Reviews for Mechanics & Tow Captains so every approved provider has varied ratings
        var providerUsers = await (from p in db.ProviderProfiles
                                   join u in db.Users on p.UserId equals u.Id
                                   orderby u.Email
                                   select new { Profile = p, User = u }).ToListAsync(ct);

        var existingProvReviews = await db.Reviews
            .Where(r => r.ProviderId != null && !r.IsHidden)
            .GroupBy(r => r.ProviderId!.Value)
            .Select(g => new { ProviderId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.ProviderId, x => x.Count, ct);

        for (var i = 0; i < providerUsers.Count; i++)
        {
            var item = providerUsers[i];
            existingProvReviews.TryGetValue(item.User.Id, out var currentCount);
            if (item.User.KycStatus == KycStatus.Approved && currentCount < 4)
            {
                var tier = i % 3;
                var needed = (tier == 0 ? 8 : tier == 1 ? 6 : 4) - currentCount;
                for (var rIdx = 0; rIdx < needed; rIdx++)
                {
                    var author = owners[(i * 5 + rIdx * 11) % owners.Count];
                    var stars = PickStars(tier, rIdx + currentCount);
                    var recommend = stars >= 4;
                    var commentPool = stars >= 4 ? PositiveProviderComments : MixedProviderComments;
                    db.Reviews.Add(new Review
                    {
                        TargetType = ReviewTargetType.Provider,
                        ProviderId = item.User.Id,
                        AuthorId = author.Id,
                        Stars = stars,
                        Recommend = recommend,
                        Text = commentPool[(i + rIdx) % commentPool.Length],
                        CreatedAt = DateTime.UtcNow.AddDays(-(1 + (i + rIdx * 2) % 28))
                    });
                }
            }
        }

        await db.SaveChangesAsync(ct);

        // 4. Recompute 100% exact Rating, RatingCount, and RecommendPercent from actual Reviews
        var centerAggs = await db.Reviews
            .Where(r => !r.IsHidden && r.CenterId != null)
            .GroupBy(r => r.CenterId!.Value)
            .Select(g => new
            {
                Id = g.Key,
                Count = g.Count(),
                Avg = g.Average(x => (double)x.Stars),
                RecPct = (int)Math.Round(100.0 * g.Count(x => x.Recommend) / g.Count())
            })
            .ToDictionaryAsync(x => x.Id, ct);

        foreach (var center in centers)
        {
            if (centerAggs.TryGetValue(center.Id, out var agg) && agg.Count > 0)
            {
                center.RatingCount = agg.Count;
                center.Rating = Math.Round((decimal)agg.Avg, 2);
                center.RecommendPercent = agg.RecPct;
            }
            else
            {
                center.RatingCount = 0;
                center.Rating = 0m;
                center.RecommendPercent = 0;
            }
        }

        var provAggs = await db.Reviews
            .Where(r => !r.IsHidden && r.ProviderId != null)
            .GroupBy(r => r.ProviderId!.Value)
            .Select(g => new
            {
                Id = g.Key,
                Count = g.Count(),
                Avg = g.Average(x => (double)x.Stars)
            })
            .ToDictionaryAsync(x => x.Id, ct);

        foreach (var prof in profiles)
        {
            if (provAggs.TryGetValue(prof.UserId, out var agg) && agg.Count > 0)
            {
                prof.RatingCount = agg.Count;
                prof.Rating = Math.Round((decimal)agg.Avg, 2);
            }
            else
            {
                prof.RatingCount = 0;
                prof.Rating = 0m;
            }
        }

        await db.SaveChangesAsync(ct);
    }

    private static readonly string[] CustomerFeedbackComments =
    [
        "Accurate GPS pickup pin, clear vehicle description, and polite driver.",
        "Ready at the vehicle with hazard lights on and smooth payment.",
        "Respectful car owner and responsive on direct chat.",
        "Clear communication on breakdown symptoms before arrival."
    ];

    private static async Task SynchronizeChatsAndCustomerRatingsAsync(AppDbContext db, CancellationToken ct)
    {
        var threads = await db.ChatThreads.Include(t => t.Messages).ToListAsync(ct);
        if (threads.Count > 0)
        {
            var reqIds = threads.Where(t => t.RequestId != null).Select(t => t.RequestId!.Value).Distinct().ToList();
            var bookIds = threads.Where(t => t.BookingId != null).Select(t => t.BookingId!.Value).Distinct().ToList();

            var reqMap = reqIds.Count == 0
                ? new Dictionary<Guid, ServiceRequest>()
                : await db.ServiceRequests.Where(r => reqIds.Contains(r.Id)).ToDictionaryAsync(r => r.Id, ct);
            var bkMap = bookIds.Count == 0
                ? new Dictionary<Guid, Booking>()
                : await db.Bookings.Include(b => b.Center).Where(b => bookIds.Contains(b.Id)).ToDictionaryAsync(b => b.Id, ct);

            var chatModified = false;
            foreach (var t in threads)
            {
                if (t.RequestId is Guid rid)
                {
                    if (!reqMap.TryGetValue(rid, out var req) || req.AssignedProviderId is null)
                    {
                        db.ChatThreads.Remove(t);
                        chatModified = true;
                        continue;
                    }
                    if (t.CustomerId != req.CustomerId || t.CounterpartId != req.AssignedProviderId.Value)
                    {
                        t.CustomerId = req.CustomerId;
                        t.CounterpartId = req.AssignedProviderId.Value;
                        chatModified = true;
                    }
                    foreach (var m in t.Messages)
                    {
                        if (m.SenderId != req.CustomerId && m.SenderId != req.AssignedProviderId.Value)
                        {
                            m.SenderId = req.AssignedProviderId.Value;
                            chatModified = true;
                        }
                    }
                }
                else if (t.BookingId is Guid bid)
                {
                    if (!bkMap.TryGetValue(bid, out var bk) || bk.Center is null)
                    {
                        db.ChatThreads.Remove(t);
                        chatModified = true;
                        continue;
                    }
                    if (t.CustomerId != bk.CustomerId || t.CounterpartId != bk.Center.OwnerId)
                    {
                        t.CustomerId = bk.CustomerId;
                        t.CounterpartId = bk.Center.OwnerId;
                        chatModified = true;
                    }
                }
            }
            if (chatModified)
                await db.SaveChangesAsync(ct);
        }

        var hasCustomerReviews = await db.Reviews.AnyAsync(r => r.CustomerId != null, ct);
        if (!hasCustomerReviews)
        {
            var completedReqs = await db.ServiceRequests
                .Where(r => r.Status == RequestStatus.Completed && r.AssignedProviderId != null)
                .OrderByDescending(r => r.CreatedAt)
                .Take(60)
                .ToListAsync(ct);

            var idx = 0;
            foreach (var r in completedReqs)
            {
                var provId = r.AssignedProviderId!.Value;
                if (await db.Reviews.AnyAsync(rv => rv.RequestId == r.Id && rv.AuthorId == provId, ct))
                    continue;
                var stars = idx % 5 == 3 ? 4 : 5;
                db.Reviews.Add(new Review
                {
                    TargetType = ReviewTargetType.Customer,
                    CustomerId = r.CustomerId,
                    RequestId = r.Id,
                    AuthorId = provId,
                    Stars = stars,
                    Recommend = true,
                    Text = CustomerFeedbackComments[idx % CustomerFeedbackComments.Length],
                    CreatedAt = (r.CompletedAt ?? r.CreatedAt).AddMinutes(12)
                });
                idx++;
            }
            if (idx > 0)
                await db.SaveChangesAsync(ct);
        }
    }

    private static int PickStars(int tier, int index) => tier switch
    {
        // Tier 0 (Top Rated ~4.7–4.9★): mostly 5s with occasional 4
        0 => (index % 5 == 3) ? 4 : 5,
        // Tier 1 (Solid ~4.2–4.4★): mix of 5s, 4s, and one 3
        1 => (index % 6 == 4) ? 3 : (index % 2 == 0 ? 5 : 4),
        // Tier 2 (Standard ~3.8–4.0★): mix of 4s, 3s, and occasional 5
        _ => (index % 4 == 0) ? 5 : (index % 3 == 1 ? 3 : 4)
    };

    private static string CapWord(string s)
    {
        if (string.IsNullOrWhiteSpace(s)) return "Metro";
        if (s.Equals("elsayed", StringComparison.OrdinalIgnoreCase)) return "El-Sayed";
        if (s.Equals("abdelaziz", StringComparison.OrdinalIgnoreCase)) return "Abdelaziz";
        return char.ToUpperInvariant(s[0]) + s[1..].ToLowerInvariant();
    }

    private sealed record ServiceSpec(string Name, string Description, long PriceMinor, int DurationMinutes);

    private static List<ServiceSpec> GetDesiredServicesForProfile(int profileKind, int index)
    {
        var delta = (index % 4) * 2_000L; // 0..60 EGP realistic workshop price variation
        return profileKind switch
        {
            0 =>
            [
                new("Engine oil & filter change", "Synthetic oil replacement + OEM oil filter + fluid check", 22_000L + delta, 35),
                new("10,000 km periodic maintenance", "Scheduled periodic maintenance, filters, belts, and safety points", 45_000L + delta, 60),
                new("Full safety inspection", "25-point mechanical and underbody inspection report", 18_000L + delta / 2, 30)
            ],
            1 =>
            [
                new("Full computer diagnostics", "OBD-II fault scan, sensor live-stream, and ECU health report", 24_000L + delta, 40),
                new("AC maintenance & recharge", "Refrigerant recharge, cabin cooling test, and compressor check", 38_000L + delta, 50),
                new("Battery & charging check", "Load test, starter draw, and charging system diagnostics", 15_000L + delta / 2, 25)
            ],
            _ =>
            [
                new("Brake inspection & pads", "Front/rear brake pad replacement and rotor thickness check", 36_000L + delta, 55),
                new("Tires & 3D wheel alignment", "4-wheel laser alignment, balancing, and suspension geometry", 28_000L + delta, 45),
                new("10,000 km periodic maintenance", "Comprehensive periodic maintenance package and fluids top-up", 48_000L + delta, 65),
                new("AC maintenance & recharge", "Full cabin AC servicing and pressure test", 40_000L + delta, 50)
            ]
        };
    }
}
