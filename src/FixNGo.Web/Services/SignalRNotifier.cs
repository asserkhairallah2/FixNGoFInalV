using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using FixNGo.Domain.Entities;
using FixNGo.Web.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Web.Services;

/// <summary>Persists an in-app notification + fake push record, then fans out over SignalR.</summary>
public sealed class SignalRNotifier(IAppDbContext db, IHubContext<AppHub> hub) : INotifier
{
    public async Task NotifyUserAsync(Guid userId, NotificationType type, string title, string body,
        string? deepLink, CancellationToken ct = default)
    {
        db.Notifications.Add(new Notification { UserId = userId, Type = type, Title = title, Body = body, DeepLink = deepLink });
        await db.SaveChangesAsync(ct);
        await hub.Clients.Group($"user:{userId}").SendAsync("notification",
            new { type = type.ToString(), title, body, deepLink }, ct);
    }

    public async Task PushAsync(Guid userId, string title, string body, string? deepLink, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        db.SimPushes.Add(new SimPush { UserId = userId, UserName = user?.FullName, Title = title, Body = body, DeepLink = deepLink });
        await db.SaveChangesAsync(ct);
        await hub.Clients.Group($"user:{userId}").SendAsync("push", new { title, body, deepLink }, ct);
    }

    public Task NotifyLocationAsync(Guid userId, Guid? requestId, double latitude, double longitude, CancellationToken ct = default) =>
        hub.Clients.Group($"user:{userId}").SendAsync("location.updated", new { requestId, latitude, longitude }, ct);
}
