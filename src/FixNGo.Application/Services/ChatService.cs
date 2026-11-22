using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Application.Services;

/// <summary>Request/booking-scoped chat with strict two-party participant isolation.</summary>
public sealed class ChatService(IAppDbContext db, IClock clock, INotifier notifier) : IChatService
{
    public async Task<IReadOnlyList<ChatThreadDto>> ThreadsAsync(Guid userId, CancellationToken ct = default)
    {
        var rawThreads = await db.ChatThreads
            .Where(t => t.CustomerId == userId || t.CounterpartId == userId)
            .OrderByDescending(t => t.CreatedAt)
            .Take(100)
            .ToListAsync(ct);

        if (rawThreads.Count == 0) return [];

        var reqIds = rawThreads.Where(t => t.RequestId != null).Select(t => t.RequestId!.Value).Distinct().ToList();
        var bookIds = rawThreads.Where(t => t.BookingId != null).Select(t => t.BookingId!.Value).Distinct().ToList();

        var requestsById = reqIds.Count == 0
            ? new Dictionary<Guid, ServiceRequest>()
            : await db.ServiceRequests.Where(r => reqIds.Contains(r.Id)).ToDictionaryAsync(r => r.Id, ct);

        var bookingsById = bookIds.Count == 0
            ? new Dictionary<Guid, Booking>()
            : await db.Bookings.Include(b => b.Center).Where(b => bookIds.Contains(b.Id)).ToDictionaryAsync(b => b.Id, ct);

        // Strict participant validation: filter out any thread whose linked request/booking belongs to different participants
        var validThreads = new List<ChatThread>();
        foreach (var t in rawThreads)
        {
            if (t.RequestId is Guid rid)
            {
                if (!requestsById.TryGetValue(rid, out var req) || req.AssignedProviderId is null) continue;
                var validPair =
                    (t.CustomerId == req.CustomerId && t.CounterpartId == req.AssignedProviderId.Value) ||
                    (t.CustomerId == req.AssignedProviderId.Value && t.CounterpartId == req.CustomerId);
                if (!validPair || (req.CustomerId != userId && req.AssignedProviderId != userId)) continue;
            }
            else if (t.BookingId is Guid bid)
            {
                if (!bookingsById.TryGetValue(bid, out var bk) || bk.Center is null) continue;
                var validPair =
                    (t.CustomerId == bk.CustomerId && t.CounterpartId == bk.Center.OwnerId) ||
                    (t.CustomerId == bk.Center.OwnerId && t.CounterpartId == bk.CustomerId);
                if (!validPair || (bk.CustomerId != userId && bk.Center.OwnerId != userId)) continue;
            }
            validThreads.Add(t);
        }

        if (validThreads.Count == 0) return [];

        var otherUserIds = validThreads
            .Select(t => t.CustomerId == userId ? t.CounterpartId : t.CustomerId)
            .Distinct()
            .ToList();

        var usersById = await db.Users
            .Where(u => otherUserIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, ct);

        var centersByOwnerId = await db.ServiceCenters
            .Where(c => otherUserIds.Contains(c.OwnerId))
            .GroupBy(c => c.OwnerId)
            .Select(g => g.First())
            .ToDictionaryAsync(c => c.OwnerId, ct);

        var threadIds = validThreads.Select(t => t.Id).ToList();
        var allMessages = await db.ChatMessages
            .Where(m => threadIds.Contains(m.ThreadId))
            .OrderBy(m => m.SentAt)
            .ToListAsync(ct);
        var messagesByThread = allMessages
            .GroupBy(m => m.ThreadId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<ChatMessageDto>)g.Select(Mappings.ChatMessage).ToList());

        var enriched = new List<(ChatThreadDto Dto, DateTime SortAt)>();
        foreach (var t in validThreads)
        {
            var msgs = messagesByThread.TryGetValue(t.Id, out var list) ? list : [];
            var otherId = t.CustomerId == userId ? t.CounterpartId : t.CustomerId;
            usersById.TryGetValue(otherId, out var otherUser);

            string? otherName = otherUser?.FullName;
            string? otherRole = otherUser?.Role.ToString();
            string? otherPhone = otherUser?.Phone;

            if (otherUser?.Role == Role.ServiceCenter && centersByOwnerId.TryGetValue(otherId, out var center))
            {
                otherName = center.Name;
                if (!string.IsNullOrWhiteSpace(center.Phone)) otherPhone = center.Phone;
            }

            ServiceRequest? req = t.RequestId is Guid rid && requestsById.TryGetValue(rid, out var hitReq) ? hitReq : null;
            Booking? bk = t.BookingId is Guid bid && bookingsById.TryGetValue(bid, out var hitBk) ? hitBk : null;
            if (bk?.Center is not null && otherId == bk.Center.OwnerId)
            {
                otherName = bk.Center.Name;
                otherRole = nameof(Role.ServiceCenter);
                if (!string.IsNullOrWhiteSpace(bk.Center.Phone)) otherPhone = bk.Center.Phone;
            }

            var unread = msgs.Count(m => m.SenderId != userId && m.ReadAt == null);
            var lastAt = msgs.Count > 0 ? msgs[^1].SentAt : t.CreatedAt;

            enriched.Add((new ChatThreadDto(
                t.Id,
                t.CustomerId,
                t.CounterpartId,
                msgs,
                t.RequestId,
                req?.Code,
                req?.Kind.ToString(),
                req?.Status.ToString(),
                t.BookingId,
                bk?.Code,
                bk?.Status.ToString(),
                otherName,
                otherRole,
                otherPhone,
                unread,
                t.IsReadOnly), lastAt));
        }

        return enriched
            .OrderByDescending(x => x.SortAt)
            .Select(x => x.Dto)
            .ToList();
    }

    public async Task<ChatThreadDto> ThreadAsync(Guid userId, Guid threadId, CancellationToken ct = default)
    {
        var t = await Accessible(userId, threadId, ct);
        var msgs = await MessagesAsync(t.Id, ct);
        var otherId = t.CustomerId == userId ? t.CounterpartId : t.CustomerId;
        var otherUser = await db.Users.FirstOrDefaultAsync(u => u.Id == otherId, ct);
        var otherName = otherUser?.FullName;
        var otherRole = otherUser?.Role.ToString();
        var otherPhone = otherUser?.Phone;

        ServiceRequest? req = t.RequestId is Guid rid
            ? await db.ServiceRequests.FirstOrDefaultAsync(r => r.Id == rid, ct)
            : null;
        Booking? bk = t.BookingId is Guid bid
            ? await db.Bookings.Include(b => b.Center).FirstOrDefaultAsync(b => b.Id == bid, ct)
            : null;

        if (bk?.Center is not null && otherId == bk.Center.OwnerId)
        {
            otherName = bk.Center.Name;
            otherRole = nameof(Role.ServiceCenter);
            if (!string.IsNullOrWhiteSpace(bk.Center.Phone)) otherPhone = bk.Center.Phone;
        }
        else if (otherUser?.Role == Role.ServiceCenter)
        {
            var center = await db.ServiceCenters.FirstOrDefaultAsync(c => c.OwnerId == otherId, ct);
            if (center is not null)
            {
                otherName = center.Name;
                if (!string.IsNullOrWhiteSpace(center.Phone)) otherPhone = center.Phone;
            }
        }

        var unread = msgs.Count(m => m.SenderId != userId && m.ReadAt == null);
        return new ChatThreadDto(
            t.Id,
            t.CustomerId,
            t.CounterpartId,
            msgs,
            t.RequestId,
            req?.Code,
            req?.Kind.ToString(),
            req?.Status.ToString(),
            t.BookingId,
            bk?.Code,
            bk?.Status.ToString(),
            otherName,
            otherRole,
            otherPhone,
            unread,
            t.IsReadOnly);
    }

    public async Task<ChatThreadDto> StartAsync(Guid userId, ChatThreadStartRequest req, CancellationToken ct = default)
    {
        if (req.CounterpartId is null && req.RequestId is null && req.BookingId is null)
            throw new DomainException("chat.counterpart_required", "A counterpart or context is required.");

        Guid actualCustomer;
        Guid actualCounterpart;

        if (req.RequestId is not null)
        {
            var r = await db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == req.RequestId, ct)
                ?? throw new DomainException("request.not_found", "Request not found.");
            var providerId = r.AssignedProviderId
                ?? throw new DomainException("chat.no_provider", "No provider assigned yet.");
            if (userId != r.CustomerId && userId != providerId)
                throw new DomainException("auth.forbidden", "You are not part of this request.");
            actualCustomer = r.CustomerId;
            actualCounterpart = providerId;

            var existingReqThread = await db.ChatThreads.FirstOrDefaultAsync(t =>
                t.RequestId == req.RequestId &&
                ((t.CustomerId == actualCustomer && t.CounterpartId == actualCounterpart) ||
                 (t.CustomerId == actualCounterpart && t.CounterpartId == actualCustomer)), ct);
            if (existingReqThread is not null)
                return await ThreadAsync(userId, existingReqThread.Id, ct);
        }
        else if (req.BookingId is not null)
        {
            var b = await db.Bookings.FirstOrDefaultAsync(x => x.Id == req.BookingId, ct)
                ?? throw new DomainException("booking.not_found", "Booking not found.");
            var center = await db.ServiceCenters.FirstOrDefaultAsync(c => c.Id == b.CenterId, ct)
                ?? throw new DomainException("chat.no_center", "Center not found.");
            if (userId != b.CustomerId && userId != center.OwnerId)
                throw new DomainException("auth.forbidden", "You are not part of this booking.");
            actualCustomer = b.CustomerId;
            actualCounterpart = center.OwnerId;

            var existingBkThread = await db.ChatThreads.FirstOrDefaultAsync(t =>
                t.BookingId == req.BookingId &&
                ((t.CustomerId == actualCustomer && t.CounterpartId == actualCounterpart) ||
                 (t.CustomerId == actualCounterpart && t.CounterpartId == actualCustomer)), ct);
            if (existingBkThread is not null)
                return await ThreadAsync(userId, existingBkThread.Id, ct);
        }
        else
        {
            var targetId = req.CounterpartId!.Value;
            if (targetId == userId)
                throw new DomainException("chat.self_forbidden", "Cannot open a conversation with yourself.");
            actualCustomer = userId;
            actualCounterpart = targetId;

            var existingDirect = await db.ChatThreads.FirstOrDefaultAsync(t =>
                t.RequestId == null && t.BookingId == null &&
                ((t.CustomerId == userId && t.CounterpartId == targetId) ||
                 (t.CustomerId == targetId && t.CounterpartId == userId)), ct);
            if (existingDirect is not null)
                return await ThreadAsync(userId, existingDirect.Id, ct);
        }

        var thread = new ChatThread
        {
            CustomerId = actualCustomer,
            CounterpartId = actualCounterpart,
            RequestId = req.RequestId,
            BookingId = req.BookingId
        };
        db.ChatThreads.Add(thread);
        await db.SaveChangesAsync(ct);
        return await ThreadAsync(userId, thread.Id, ct);
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
        await notifier.NotifyUserAsync(other, NotificationType.ChatMessage, "New message", m.Text!, $"chat:{t.Id}", ct);
        await notifier.BroadcastUserEventAsync(other, "chat.message", new { threadId = t.Id, messageId = m.Id, senderId = userId }, ct);
        await notifier.BroadcastUserEventAsync(userId, "chat.message", new { threadId = t.Id, messageId = m.Id, senderId = userId }, ct);
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
        var other = t.CustomerId == userId ? t.CounterpartId : t.CustomerId;
        await notifier.NotifyUserAsync(other, NotificationType.ChatMessage, "Location shared", "Shared live pin location.", $"chat:{t.Id}", ct);
        await notifier.BroadcastUserEventAsync(other, "chat.message", new { threadId = t.Id, messageId = m.Id, senderId = userId }, ct);
        await notifier.BroadcastUserEventAsync(userId, "chat.message", new { threadId = t.Id, messageId = m.Id, senderId = userId }, ct);
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
        if (t.RequestId is Guid rid)
        {
            var r = await db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == rid, ct);
            if (r is null || (r.CustomerId != userId && r.AssignedProviderId != userId))
                throw new DomainException("auth.forbidden", "You are not assigned to this request conversation.");
        }
        else if (t.BookingId is Guid bid)
        {
            var b = await db.Bookings.Include(x => x.Center).FirstOrDefaultAsync(x => x.Id == bid, ct);
            if (b is null || b.Center is null || (b.CustomerId != userId && b.Center.OwnerId != userId))
                throw new DomainException("auth.forbidden", "You are not part of this booking conversation.");
        }
        return t;
    }
}
