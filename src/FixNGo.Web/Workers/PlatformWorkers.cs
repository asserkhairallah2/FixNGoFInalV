using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Web.Workers;

/// <summary>Expires stale offers and returns untouched requests to Searching / NoProviders.</summary>
public sealed class OfferExpiryWorker(IServiceScopeFactory scopes, ILogger<OfferExpiryWorker> logger, IClock clock)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(3));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
                var notifier = scope.ServiceProvider.GetService<INotifier>();
                await FixNGo.Application.Services.RequestTimeoutEvaluator.EvaluateAsync(db, clock, notifier, null, stoppingToken);

                var now = clock.UtcNow;
                var expired = await db.Offers.CountAsync(o => o.Status == OfferStatus.Pending && o.ExpiresAt <= now, stoppingToken);
                if (expired == 0) continue;
                foreach (var o in db.Offers.Where(o => o.Status == OfferStatus.Pending && o.ExpiresAt <= now))
                    o.Status = OfferStatus.Expired;
                var stale = await db.ServiceRequests.Where(r => r.Status == RequestStatus.Offered && r.PendingProviderId == null).ToListAsync(stoppingToken);
                foreach (var r in stale)
                {
                    var any = await db.Offers.AnyAsync(o => o.RequestId == r.Id && o.Status == OfferStatus.Pending, stoppingToken);
                    if (any) continue;
                    var hadOffer = await db.Offers.AnyAsync(o => o.RequestId == r.Id, stoppingToken);
                    r.Status = hadOffer ? RequestStatus.Searching : RequestStatus.NoProviders;
                    db.RequestEvents.Add(new RequestEvent { RequestId = r.Id, Status = r.Status, Note = "offers.expired", At = now });
                }
                await db.SaveChangesAsync(stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex) { logger.LogWarning(ex, "Offer expiry pass failed"); }
        }
    }
}

/// <summary>Expires unconfirmed center bookings once their slot has passed.</summary>
public sealed class BookingExpiryWorker(IServiceScopeFactory scopes, ILogger<BookingExpiryWorker> logger, IClock clock)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
                var now = clock.UtcNow;
                var stale = await db.Bookings.Where(b => b.Status == BookingStatus.Pending && b.SlotEnd < now).ToListAsync(stoppingToken);
                foreach (var b in stale) b.Status = BookingStatus.Expired;
                if (stale.Count > 0) await db.SaveChangesAsync(stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex) { logger.LogWarning(ex, "Booking expiry pass failed"); }
        }
    }
}

/// <summary>Bank simulator advances withdrawals through Processing → Sent → Confirmed.</summary>
public sealed class WithdrawalWorker(IServiceScopeFactory scopes, ILogger<WithdrawalWorker> logger, IClock clock)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(10));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
                var now = clock.UtcNow;
                var changed = false;
                foreach (var w in db.Withdrawals.Where(w => w.Status == WithdrawalStatus.Requested && w.CreatedAt <= now.AddSeconds(-10)))
                {
                    w.Status = WithdrawalStatus.Processing; changed = true;
                    db.WithdrawalEvents.Add(new WithdrawalEvent { WithdrawalId = w.Id, Status = w.Status, At = now });
                }
                foreach (var w in db.Withdrawals.Where(w => w.Status == WithdrawalStatus.Processing && w.CreatedAt <= now.AddSeconds(-20)))
                {
                    w.Status = WithdrawalStatus.Sent; changed = true;
                    db.WithdrawalEvents.Add(new WithdrawalEvent { WithdrawalId = w.Id, Status = w.Status, At = now });
                }
                foreach (var w in db.Withdrawals.Where(w => w.Status == WithdrawalStatus.Sent && w.CreatedAt <= now.AddSeconds(-30)))
                {
                    w.Status = WithdrawalStatus.Confirmed; changed = true;
                    db.WithdrawalEvents.Add(new WithdrawalEvent { WithdrawalId = w.Id, Status = w.Status, At = now });
                    if (w.NetMinor > 0)
                    {
                        var wallet = await db.Wallets.FirstOrDefaultAsync(x => x.UserId == w.UserId, stoppingToken);
                        if (wallet is not null)
                            db.WalletEntries.Add(new WalletEntry { WalletId = wallet.Id, Type = WalletEntryType.Withdrawal,
                                AmountMinor = -w.AmountMinor, Reference = w.Code, At = now });
                    }
                }
                if (changed) await db.SaveChangesAsync(stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex) { logger.LogWarning(ex, "Withdrawal pass failed"); }
        }
    }
}

/// <summary>Marks providers offline when their heartbeat is stale, and anonymises deleted accounts.</summary>
public sealed class HousekeepingWorker(IServiceScopeFactory scopes, ILogger<HousekeepingWorker> logger, IClock clock)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
                var now = clock.UtcNow;
                foreach (var p in db.ProviderProfiles.Where(p => p.IsOnline && (p.LastHeartbeatAt == null || p.LastHeartbeatAt < now.AddMinutes(-30))))
                    p.IsOnline = false;
                foreach (var req in db.AccountDeletionRequests.Where(r => r.ScheduledAt != null && r.ScheduledAt <= now && !r.Anonymised))
                {
                    var user = await db.Users.FirstOrDefaultAsync(u => u.Id == req.UserId, stoppingToken);
                    if (user is null) continue;
                    user.FullName = "Deleted user";
                    user.Email = $"deleted-{user.Id:N}@dummy.fixngo.test";
                    user.Phone = null;
                    user.PasswordHash = string.Empty;
                    user.Status = UserStatus.Deleted;
                    req.Anonymised = true;
                }
                await db.SaveChangesAsync(stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex) { logger.LogWarning(ex, "Housekeeping pass failed"); }
        }
    }
}
