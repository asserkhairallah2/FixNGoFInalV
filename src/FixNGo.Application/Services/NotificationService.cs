using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Application.Services;

/// <summary>Inbox, read state, per-channel preferences and device tokens.</summary>
public sealed class NotificationService(IAppDbContext db, IClock clock)
{
    public async Task<IReadOnlyList<NotificationDto>> ListAsync(Guid userId, bool unreadOnly = false, CancellationToken ct = default)
    {
        var q = db.Notifications.Where(n => n.UserId == userId);
        if (unreadOnly) q = q.Where(n => !n.IsRead);
        return await q.OrderByDescending(n => n.CreatedAt).Take(200).Select(n => Mappings.Notification(n)).ToListAsync(ct);
    }

    public async Task<int> UnreadCountAsync(Guid userId, CancellationToken ct = default) =>
        await db.Notifications.CountAsync(n => n.UserId == userId && !n.IsRead, ct);

    public async Task MarkReadAsync(Guid userId, MarkReadRequest req, CancellationToken ct = default)
    {
        var ids = req.Ids;
        foreach (var n in db.Notifications.Where(n => n.UserId == userId && ids.Contains(n.Id)))
        {
            n.IsRead = true; n.ReadAt = clock.UtcNow;
        }
        await db.SaveChangesAsync(ct);
    }

    public async Task MarkAllReadAsync(Guid userId, CancellationToken ct = default)
    {
        foreach (var n in db.Notifications.Where(n => n.UserId == userId && !n.IsRead))
        { n.IsRead = true; n.ReadAt = clock.UtcNow; }
        await db.SaveChangesAsync(ct);
    }

    public async Task<NotificationPreferencesDto> PreferencesAsync(Guid userId, CancellationToken ct = default)
    {
        var p = await db.NotificationPreferences.FirstOrDefaultAsync(x => x.UserId == userId, ct)
            ?? new NotificationPreference { UserId = userId };
        return new NotificationPreferencesDto(p.Push, p.Email, p.TripsAndSafety, p.Bookings, p.Offers);
    }

    public async Task<NotificationPreferencesDto> UpdatePreferencesAsync(Guid userId, UpdateNotificationPreferencesRequest req, CancellationToken ct = default)
    {
        var p = await db.NotificationPreferences.FirstOrDefaultAsync(x => x.UserId == userId, ct);
        if (p is null) { p = new NotificationPreference { UserId = userId }; db.NotificationPreferences.Add(p); }
        p.Push = req.Push; p.Email = req.Email; p.Bookings = req.Bookings; p.Offers = req.Offers;
        await db.SaveChangesAsync(ct);
        return await PreferencesAsync(userId, ct);
    }

    public async Task AddDeviceTokenAsync(Guid userId, DeviceTokenRequest req, CancellationToken ct = default)
    {
        if (await db.DeviceTokens.AnyAsync(t => t.UserId == userId && t.Token == req.Token, ct)) return;
        db.DeviceTokens.Add(new DeviceToken { UserId = userId, Token = req.Token, Platform = req.Platform });
        await db.SaveChangesAsync(ct);
    }

    public async Task RemoveDeviceTokenAsync(Guid userId, string token, CancellationToken ct = default)
    {
        var t = await db.DeviceTokens.FirstOrDefaultAsync(x => x.UserId == userId && x.Token == token, ct);
        if (t is not null) { db.DeviceTokens.Remove(t); await db.SaveChangesAsync(ct); }
    }
}
