using System.Text.Json;
using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Application.Services;

/// <summary>Admin dashboard, users, settings, payment reviews, safety, reports and audit.</summary>
public sealed class AdminService(IAppDbContext db, IClock clock, SettingsService settings, INotifier notifier)
{
    public async Task<DashboardDto> DashboardAsync(CancellationToken ct = default)
    {
        var today = clock.UtcNow.Date;
        return new DashboardDto(
            await db.Users.CountAsync(ct),
            await db.ServiceRequests.CountAsync(r => r.Status != RequestStatus.Completed && r.Status != RequestStatus.Cancelled, ct),
            await db.KycApplications.CountAsync(k => k.Status == KycStatus.Submitted || k.Status == KycStatus.UnderReview, ct),
            await db.PaymentReviews.CountAsync(p => p.Status == PaymentReviewStatus.Pending, ct),
            await db.SafetyReports.CountAsync(s => s.Status == SafetyReportStatus.Open, ct),
            await db.Invoices.Where(i => i.Status == InvoiceStatus.Paid && i.IssuedAt >= today).SumAsync(i => (long?)i.TotalMinor, ct) ?? 0,
            await db.ServiceRequests.CountAsync(r => r.CompletedAt >= today, ct));
    }

    public async Task<IReadOnlyList<AdminUserDto>> UsersAsync(CancellationToken ct = default) =>
        await db.Users.OrderByDescending(u => u.CreatedAt).Take(500)
            .Select(u => new AdminUserDto(u.Id, u.FullName, u.Email, u.Role, u.Status, u.KycStatus,
                u.IsSuperAdmin, u.CreatedAt, u.Sessions.Count(s => s.RevokedAt == null))).ToListAsync(ct);

    public async Task<AdminUserDto> SuspendAsync(Guid adminId, Guid userId, SuspendRequest req, CancellationToken ct = default)
    {
        var u = await User(userId, ct);
        if (u.IsSuperAdmin) throw new DomainException("admin.superadmin_protected", "A super admin cannot be suspended.");
        u.Status = UserStatus.Suspended;
        db.AuditLogs.Add(NewAudit(adminId, "user.suspend", "User", userId.ToString(), req.Reason));
        foreach (var s in db.Sessions.Where(s => s.UserId == userId)) s.RevokedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        await notifier.NotifyUserAsync(userId, NotificationType.AccountSuspended, "Account suspended", req.Reason, null, ct);
        return MapUser(u);
    }

    public async Task<AdminUserDto> RestoreAsync(Guid adminId, Guid userId, CancellationToken ct = default)
    {
        var u = await User(userId, ct);
        u.Status = UserStatus.Active;
        db.AuditLogs.Add(NewAudit(adminId, "user.restore", "User", userId.ToString(), null));
        await db.SaveChangesAsync(ct);
        await notifier.NotifyUserAsync(userId, NotificationType.AccountRestored, "Account restored", "Your account is active again.", null, ct);
        return MapUser(u);
    }

    public async Task<SettingsDto> SettingsAsync(CancellationToken ct = default)
    {
        var (p, v) = await settings.CurrentAsync(ct);
        return new SettingsDto(p, v);
    }

    public async Task<SettingsDto> UpdateSettingsAsync(Guid adminId, UpdateSettingsRequest req, CancellationToken ct = default)
    {
        foreach (var v in db.PlatformSettingsVersions.Where(v => v.IsCurrent)) v.IsCurrent = false;
        var next = await db.PlatformSettingsVersions.MaxAsync(v => (int?)v.Version, ct) ?? 0;
        var version = new PlatformSettingsVersion
        {
            Version = next + 1, IsCurrent = true, ChangedBy = adminId, EffectiveAt = clock.UtcNow,
            SettingsJson = JsonSerializer.Serialize(req.Pricing)
        };
        db.PlatformSettingsVersions.Add(version);
        db.AuditLogs.Add(NewAudit(adminId, "settings.update", "PlatformSettings", version.Version.ToString(), null,
            after: version.SettingsJson));
        await db.SaveChangesAsync(ct);
        return new SettingsDto(req.Pricing, version.Version);
    }

    public async Task<IReadOnlyList<PaymentReviewDto>> PaymentReviewsAsync(CancellationToken ct = default) =>
        await db.PaymentReviews.OrderByDescending(p => p.CreatedAt)
            .Select(p => new PaymentReviewDto(p.Id, p.RequestId, p.CustomerConfirmedMinor, p.ProviderCollectedMinor,
                p.RecordedMinor, p.AdjustedMinor, p.Status, p.Note, p.CreatedAt)).ToListAsync(ct);

    public async Task<PaymentReviewDto> ResolvePaymentReviewAsync(Guid adminId, Guid id, ResolvePaymentReviewRequest req, CancellationToken ct = default)
    {
        var p = await db.PaymentReviews.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new DomainException("payment_review.not_found", "Review not found.");
        if (p.Status == PaymentReviewStatus.Resolved) throw new DomainException("payment_review.resolved", "Already resolved.");
        p.Status = PaymentReviewStatus.Resolved;
        p.AdjustedMinor = req.AdjustedMinor;
        p.Note = req.Note;
        p.ReviewedBy = adminId;
        db.AuditLogs.Add(NewAudit(adminId, "payment_review.resolve", "PaymentReview", id.ToString(), req.Note));
        await db.SaveChangesAsync(ct);
        var r = await db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == p.RequestId, ct);
        if (r?.CustomerId is not null)
            await notifier.NotifyUserAsync(r.CustomerId, NotificationType.PaymentVerified, "Payment reviewed",
                req.Note ?? "Your payment review was resolved.", $"request:{r.Id}", ct);
        return new PaymentReviewDto(p.Id, p.RequestId, p.CustomerConfirmedMinor, p.ProviderCollectedMinor,
            p.RecordedMinor, p.AdjustedMinor, p.Status, p.Note, p.CreatedAt);
    }

    public async Task<IReadOnlyList<WithdrawalDto>> WithdrawalsAsync(CancellationToken ct = default) =>
        await db.Withdrawals.OrderByDescending(w => w.CreatedAt).Select(w => Mappings.Withdrawal(w)).ToListAsync(ct);

    public async Task<WithdrawalDto> ProcessWithdrawalAsync(Guid adminId, Guid id, WithdrawalProcessRequest req, CancellationToken ct = default)
    {
        var w = await db.Withdrawals.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new DomainException("withdrawal.not_found", "Withdrawal not found.");
        w.Status = StateMachines.Withdrawal.Transition(w.Status, req.Status);
        w.FailureReason = req.FailureReason;
        db.WithdrawalEvents.Add(new WithdrawalEvent { WithdrawalId = w.Id, Status = w.Status, At = clock.UtcNow });
        if (req.Status == WithdrawalStatus.Failed)
        {
            var wallet = await db.Wallets.FirstOrDefaultAsync(x => x.UserId == w.UserId, ct);
            if (wallet is not null)
                db.WalletEntries.Add(new WalletEntry { WalletId = wallet.Id, Type = WalletEntryType.Refund,
                    AmountMinor = w.AmountMinor, Reference = w.Code, At = clock.UtcNow });
        }
        db.AuditLogs.Add(NewAudit(adminId, "withdrawal.process", "Withdrawal", id.ToString(), req.FailureReason));
        await db.SaveChangesAsync(ct);
        await notifier.NotifyUserAsync(w.UserId, NotificationType.WithdrawalStatus, "Withdrawal update",
            $"{w.Code}: {w.Status}.", $"withdrawal:{w.Id}", ct);
        return Mappings.Withdrawal(w);
    }

    public async Task<IReadOnlyList<SosDto>> EmergenciesAsync(bool openOnly = false, CancellationToken ct = default)
    {
        var q = db.EmergencyEvents.AsQueryable();
        if (openOnly) q = q.Where(e => !e.Resolved);
        return await q.OrderByDescending(e => e.CreatedAt)
            .Select(e => new SosDto(e.Id, e.Latitude, e.Longitude, e.Resolved, e.CreatedAt)).ToListAsync(ct);
    }

    public async Task ResolveEmergencyAsync(Guid id, CancellationToken ct = default)
    {
        var e = await db.EmergencyEvents.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new DomainException("sos.not_found", "SOS event not found.");
        e.Resolved = true;
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<SessionDto>> SessionsAsync(Guid userId, CancellationToken ct = default) =>
        await db.Sessions.Where(s => s.UserId == userId).OrderByDescending(s => s.CreatedAt)
            .Select(s => new SessionDto(s.Id, s.DeviceLabel, s.IpAddress, s.ExpiresAt, s.RevokedAt)).ToListAsync(ct);

    public async Task RevokeSessionAsync(Guid adminId, Guid sessionId, CancellationToken ct = default)
    {
        var s = await db.Sessions.FirstOrDefaultAsync(x => x.Id == sessionId, ct)
            ?? throw new DomainException("session.not_found", "Session not found.");
        s.RevokedAt = clock.UtcNow;
        db.AuditLogs.Add(NewAudit(adminId, "session.revoke", "Session", sessionId.ToString(), null));
        await db.SaveChangesAsync(ct);
        await notifier.NotifyUserAsync(s.UserId, NotificationType.SessionRevoked, "Session revoked",
            "One of your sessions was revoked.", null, ct);
    }

    public async Task<IReadOnlyList<AuditLogDto>> AuditAsync(CancellationToken ct = default) =>
        await db.AuditLogs.OrderByDescending(a => a.CreatedAt).Take(300).Select(a => Mappings.Audit(a)).ToListAsync(ct);

    public async Task<object> ReportsAsync(CancellationToken ct = default)
    {
        var revenue = await db.Invoices.Where(i => i.Status == InvoiceStatus.Paid).SumAsync(i => (long?)i.TotalMinor, ct) ?? 0;
        var byKind = await db.ServiceRequests.GroupBy(r => r.Kind)
            .Select(g => new { kind = g.Key.ToString(), count = g.Count() }).ToListAsync(ct);
        var byStatus = await db.ServiceRequests.GroupBy(r => r.Status)
            .Select(g => new { status = g.Key.ToString(), count = g.Count() }).ToListAsync(ct);
        return new { revenueMinor = revenue, byKind, byStatus };
    }

    private static AuditLog NewAudit(Guid actor, string action, string entity, string? id, string? reason, string? after = null) =>
        new() { ActorId = actor, Action = action, EntityType = entity, EntityId = id, Reason = reason, AfterJson = after };

    private static AdminUserDto MapUser(User u) => new(u.Id, u.FullName, u.Email, u.Role, u.Status, u.KycStatus,
        u.IsSuperAdmin, u.CreatedAt, u.Sessions.Count(s => s.RevokedAt == null));

    private async Task<User> User(Guid id, CancellationToken ct) =>
        await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct) ?? throw new DomainException("user.not_found", "User not found.");
}
