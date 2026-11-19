using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Application.Services;

/// <summary>Request/booking-scoped chat with resource-level authorization.</summary>
public sealed class ChatService(IAppDbContext db, IClock clock, INotifier notifier)
{
    public async Task<IReadOnlyList<ChatThreadDto>> ThreadsAsync(Guid userId, CancellationToken ct = default)
    {
        var threads = await db.ChatThreads.Where(t => t.CustomerId == userId || t.CounterpartId == userId)
            .OrderByDescending(t => t.CreatedAt).Take(100).ToListAsync(ct);
        var result = new List<ChatThreadDto>();
        foreach (var t in threads)
            result.Add(new ChatThreadDto(t.Id, t.CustomerId, t.CounterpartId, await MessagesAsync(t.Id, ct)));
        return result;
    }

    public async Task<ChatThreadDto> ThreadAsync(Guid userId, Guid threadId, CancellationToken ct = default)
    {
        var t = await Accessible(userId, threadId, ct);
        return new ChatThreadDto(t.Id, t.CustomerId, t.CounterpartId, await MessagesAsync(t.Id, ct));
    }

    public async Task<ChatThreadDto> StartAsync(Guid userId, ChatThreadStartRequest req, CancellationToken ct = default)
    {
        if (req.CounterpartId is null && req.RequestId is null && req.BookingId is null)
            throw new DomainException("chat.counterpart_required", "A counterpart or context is required.");
        Guid counterpart;
        if (req.RequestId is not null)
        {
            var r = await db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == req.RequestId, ct)
                ?? throw new DomainException("request.not_found", "Request not found.");
            if (userId == r.CustomerId) counterpart = r.AssignedProviderId ?? throw new DomainException("chat.no_provider", "No provider assigned yet.");
            else if (userId == r.AssignedProviderId) counterpart = r.CustomerId;
            else throw new DomainException("auth.forbidden", "You are not part of this request.");
        }
        else if (req.BookingId is not null)
        {
            var b = await db.Bookings.FirstOrDefaultAsync(x => x.Id == req.BookingId, ct)
                ?? throw new DomainException("booking.not_found", "Booking not found.");
            var center = await db.ServiceCenters.FirstOrDefaultAsync(c => c.Id == b.CenterId, ct);
            if (userId == b.CustomerId) counterpart = center?.OwnerId ?? throw new DomainException("chat.no_center", "Center not found.");
            else if (userId == center?.OwnerId) counterpart = b.CustomerId;
            else throw new DomainException("auth.forbidden", "You are not part of this booking.");
        }
        else counterpart = req.CounterpartId!.Value;

        var existing = await db.ChatThreads.FirstOrDefaultAsync(t =>
            ((t.CustomerId == userId && t.CounterpartId == counterpart) || (t.CustomerId == counterpart && t.CounterpartId == userId))
            && (req.RequestId == null || t.RequestId == req.RequestId)
            && (req.BookingId == null || t.BookingId == req.BookingId), ct);
        if (existing is not null) return await ThreadAsync(userId, existing.Id, ct);
        var thread = new ChatThread
        {
            CustomerId = userId, CounterpartId = counterpart, RequestId = req.RequestId, BookingId = req.BookingId
        };
        db.ChatThreads.Add(thread);
        await db.SaveChangesAsync(ct);
        return new ChatThreadDto(thread.Id, thread.CustomerId, thread.CounterpartId, []);
    }

    public async Task<ChatMessageDto> SendAsync(Guid userId, Guid threadId, SendMessageRequest req, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(req.Text)) throw new DomainException("chat.text_required", "Message cannot be empty.");
        var t = await Accessible(userId, threadId, ct);
        if (t.IsReadOnly) throw new DomainException("chat.read_only", "This thread is read-only.");
        var m = new ChatMessage { ThreadId = t.Id, SenderId = userId, MessageType = "text", Text = req.Text.Trim(), SentAt = clock.UtcNow };
        db.ChatMessages.Add(m);
        await db.SaveChangesAsync(ct);
        var other = t.CustomerId == userId ? t.CounterpartId : t.CustomerId;
        await notifier.NotifyUserAsync(other, NotificationType.ChatMessage, "New message", req.Text, $"chat:{t.Id}", ct);
        return Mappings.ChatMessage(m);
    }

    public async Task<ChatMessageDto> SendLocationAsync(Guid userId, Guid threadId, LocationMessageRequest req, CancellationToken ct = default)
    {
        var t = await Accessible(userId, threadId, ct);
        var m = new ChatMessage
        {
            ThreadId = t.Id, SenderId = userId, MessageType = "location",
            Latitude = req.Latitude, Longitude = req.Longitude, SentAt = clock.UtcNow
        };
        db.ChatMessages.Add(m);
        await db.SaveChangesAsync(ct);
        return Mappings.ChatMessage(m);
    }

    public async Task MarkReadAsync(Guid userId, Guid threadId, CancellationToken ct = default)
    {
        var t = await Accessible(userId, threadId, ct);
        foreach (var m in db.ChatMessages.Where(m => m.ThreadId == t.Id && m.SenderId != userId && m.ReadAt == null))
            m.ReadAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    private async Task<IReadOnlyList<ChatMessageDto>> MessagesAsync(Guid threadId, CancellationToken ct) =>
        await db.ChatMessages.Where(m => m.ThreadId == threadId).OrderBy(m => m.SentAt)
            .Select(m => Mappings.ChatMessage(m)).ToListAsync(ct);

    private async Task<ChatThread> Accessible(Guid userId, Guid threadId, CancellationToken ct)
    {
        var t = await db.ChatThreads.FirstOrDefaultAsync(x => x.Id == threadId, ct)
            ?? throw new DomainException("chat.not_found", "Thread not found.");
        if (t.CustomerId != userId && t.CounterpartId != userId)
            throw new DomainException("auth.forbidden", "You are not part of this conversation.");
        return t;
    }
}
