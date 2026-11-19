using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Application.Services;

/// <summary>Support tickets, legal/FAQ content, SOS and safety reports, account deletion.</summary>
public sealed class SupportService(IAppDbContext db, IClock clock, INotifier notifier)
{
    public async Task<TicketDto> CreateTicketAsync(Guid userId, CreateTicketRequest req, CancellationToken ct = default)
    {
        var ticket = new SupportTicket
        {
            Code = await Codes.NextAsync(db, "TK", ct), UserId = userId, Category = req.Category,
            Subject = req.Subject.Trim(), Description = req.Description.Trim(),
            ReferenceType = req.ReferenceType, ReferenceId = req.ReferenceId
        };
        db.SupportTickets.Add(ticket);
        db.SupportMessages.Add(new SupportMessage
        {
            TicketId = ticket.Id, FromSupport = false, AuthorName = "You", Text = req.Description.Trim()
        });
        await db.SaveChangesAsync(ct);
        return Mappings.Ticket(ticket);
    }

    public async Task<IReadOnlyList<TicketDto>> TicketsAsync(Guid userId, CancellationToken ct = default) =>
        await db.SupportTickets.Where(t => t.UserId == userId).OrderByDescending(t => t.CreatedAt)
            .Select(t => Mappings.Ticket(t)).ToListAsync(ct);

    public async Task<TicketDetailDto> TicketAsync(Guid userId, bool isAdmin, Guid id, CancellationToken ct = default)
    {
        var t = await db.SupportTickets.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new DomainException("ticket.not_found", "Ticket not found.");
        if (!isAdmin && t.UserId != userId) throw new DomainException("auth.forbidden", "This ticket is not yours.");
        var messages = await db.SupportMessages.Where(m => m.TicketId == id).OrderBy(m => m.CreatedAt)
            .Select(m => new SupportMessageDto(m.Id, m.FromSupport, m.AuthorName, m.Text, m.CreatedAt)).ToListAsync(ct);
        return new TicketDetailDto(Mappings.Ticket(t), messages);
    }

    public async Task<SupportMessageDto> ReplyAsync(Guid userId, Guid id, TicketReplyRequest req, CancellationToken ct = default)
    {
        var t = await db.SupportTickets.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct)
            ?? throw new DomainException("ticket.not_found", "Ticket not found.");
        if (t.Status == TicketStatus.Closed) throw new DomainException("ticket.closed", "Ticket is closed.");
        var msg = new SupportMessage { TicketId = t.Id, FromSupport = false, AuthorName = "You", Text = req.Text.Trim() };
        db.SupportMessages.Add(msg);
        t.Status = TicketStatus.AwaitingSupport;
        await db.SaveChangesAsync(ct);
        return new SupportMessageDto(msg.Id, msg.FromSupport, msg.AuthorName, msg.Text, msg.CreatedAt);
    }

    public async Task<SupportMessageDto> SupportReplyAsync(Guid adminId, Guid id, TicketReplyRequest req, CancellationToken ct = default)
    {
        var t = await db.SupportTickets.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new DomainException("ticket.not_found", "Ticket not found.");
        var msg = new SupportMessage { TicketId = t.Id, FromSupport = true, AuthorName = "FixNGo Support", Text = req.Text.Trim() };
        db.SupportMessages.Add(msg);
        t.Status = TicketStatus.Answered;
        await db.SaveChangesAsync(ct);
        await notifier.NotifyUserAsync(t.UserId, NotificationType.SupportTicketReply, "Support reply", req.Text, $"ticket:{t.Id}", ct);
        return new SupportMessageDto(msg.Id, msg.FromSupport, msg.AuthorName, msg.Text, msg.CreatedAt);
    }

    public async Task<IReadOnlyList<TicketDto>> AllTicketsAsync(CancellationToken ct = default) =>
        await db.SupportTickets.OrderByDescending(t => t.CreatedAt).Select(t => Mappings.Ticket(t)).ToListAsync(ct);

    public async Task CloseTicketAsync(Guid adminId, Guid id, CancellationToken ct = default)
    {
        var t = await db.SupportTickets.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new DomainException("ticket.not_found", "Ticket not found.");
        t.Status = TicketStatus.Closed;
        await db.SaveChangesAsync(ct);
    }

    // ---- Legal / FAQ ----
    public async Task<IReadOnlyList<FaqDto>> FaqsAsync(CancellationToken ct = default) =>
        await db.Faqs.OrderBy(f => f.SortOrder).Select(f => new FaqDto(f.Id, f.QuestionEn, f.QuestionAr, f.AnswerEn, f.AnswerAr)).ToListAsync(ct);

    public async Task<LegalDto> LegalAsync(string key, CancellationToken ct = default)
    {
        var doc = await db.LegalDocuments.Where(l => l.Key == key).OrderByDescending(l => l.Version).FirstOrDefaultAsync(ct)
            ?? throw new DomainException("legal.not_found", "Document not found.");
        return new LegalDto(doc.Key, doc.Version, doc.TitleEn, doc.TitleAr, doc.BodyEn, doc.BodyAr, doc.UpdatedAt);
    }

    // ---- SOS / safety ----
    public async Task<SosDto> SosAsync(Guid userId, SosRequest req, CancellationToken ct = default)
    {
        var e = new EmergencyEvent { UserId = userId, Latitude = req.Latitude, Longitude = req.Longitude, Note = req.Note };
        db.EmergencyEvents.Add(e);
        await db.SaveChangesAsync(ct);
        var admins = await db.Users.Where(u => u.Role == Role.Admin).Select(u => u.Id).ToListAsync(ct);
        foreach (var id in admins)
            await notifier.NotifyUserAsync(id, NotificationType.NewSafetyReport, "SOS triggered", $"SOS at {req.Latitude},{req.Longitude}.", $"sos:{e.Id}", ct);
        return new SosDto(e.Id, e.Latitude, e.Longitude, e.Resolved, e.CreatedAt);
    }

    public async Task<IReadOnlyList<SosDto>> MySosAsync(Guid userId, CancellationToken ct = default) =>
        await db.EmergencyEvents.Where(e => e.UserId == userId).OrderByDescending(e => e.CreatedAt)
            .Select(e => new SosDto(e.Id, e.Latitude, e.Longitude, e.Resolved, e.CreatedAt)).ToListAsync(ct);

    public async Task<SafetyReportDto> ReportAsync(Guid userId, SafetyReportRequest req, CancellationToken ct = default)
    {
        var report = new SafetyReport
        {
            Category = req.Category, ReporterId = userId, ReportedUserId = req.ReportedUserId,
            RequestId = req.RequestId, Description = req.Description, Status = SafetyReportStatus.Open
        };
        db.SafetyReports.Add(report);
        await db.SaveChangesAsync(ct);
        var admins = await db.Users.Where(u => u.Role == Role.Admin).Select(u => u.Id).ToListAsync(ct);
        foreach (var id in admins)
            await notifier.NotifyUserAsync(id, NotificationType.NewSafetyReport, "Safety report", req.Category, $"safety:{report.Id}", ct);
        return MapReport(report);
    }

    public async Task<IReadOnlyList<SafetyReportDto>> MyReportsAsync(Guid userId, CancellationToken ct = default) =>
        await db.SafetyReports.Where(s => s.ReporterId == userId).OrderByDescending(s => s.CreatedAt)
            .Select(s => new SafetyReportDto(s.Id, s.Category, s.ReporterId, s.ReportedUserId, s.RequestId,
                s.Description, s.Status, s.ReviewNote, s.CreatedAt)).ToListAsync(ct);

    public async Task<IReadOnlyList<SafetyReportDto>> AllReportsAsync(CancellationToken ct = default) =>
        await db.SafetyReports.OrderByDescending(s => s.CreatedAt)
            .Select(s => new SafetyReportDto(s.Id, s.Category, s.ReporterId, s.ReportedUserId, s.RequestId,
                s.Description, s.Status, s.ReviewNote, s.CreatedAt)).ToListAsync(ct);

    public async Task<SafetyReportDto> ResolveReportAsync(Guid adminId, Guid id, ResolveSafetyRequest req, CancellationToken ct = default)
    {
        var s = await db.SafetyReports.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new DomainException("safety.not_found", "Report not found.");
        s.Status = req.Status; s.ReviewNote = req.Note;
        await db.SaveChangesAsync(ct);
        await notifier.NotifyUserAsync(s.ReporterId, NotificationType.SafetyOutcome, "Safety outcome",
            $"Your report was {req.Status}.", $"safety:{s.Id}", ct);
        return MapReport(s);
    }

    private static SafetyReportDto MapReport(SafetyReport s) => new(s.Id, s.Category, s.ReporterId, s.ReportedUserId,
        s.RequestId, s.Description, s.Status, s.ReviewNote, s.CreatedAt);

    // ---- Account deletion ----
    public async Task<object> RequestDeletionAsync(Guid userId, DeletionRequest req, IPasswordHasher hasher, CancellationToken ct = default)
    {
        var u = await db.Users.FirstOrDefaultAsync(x => x.Id == userId, ct)
            ?? throw new DomainException("user.not_found", "User not found.");
        if (!hasher.Verify(u.PasswordHash, req.Password))
            throw new DomainException("auth.invalid_credentials", "Password is incorrect.");
        var blockers = new List<string>();
        if (await db.ServiceRequests.AnyAsync(r => (r.CustomerId == userId || r.AssignedProviderId == userId)
            && r.Status != RequestStatus.Completed && r.Status != RequestStatus.Cancelled, ct))
            blockers.Add("active_requests");
        if (await db.Bookings.AnyAsync(b => b.CustomerId == userId && b.Status != BookingStatus.Completed && b.Status != BookingStatus.Cancelled, ct))
            blockers.Add("active_bookings");
        if (await db.Withdrawals.AnyAsync(w => w.UserId == userId && w.Status != WithdrawalStatus.Confirmed, ct))
            blockers.Add("pending_withdrawals");
        var request = await db.AccountDeletionRequests.FirstOrDefaultAsync(x => x.UserId == userId, ct);
        if (request is null)
        {
            request = new AccountDeletionRequest { UserId = userId, BlockersJson = System.Text.Json.JsonSerializer.Serialize(blockers) };
            db.AccountDeletionRequests.Add(request);
        }
        u.Status = UserStatus.DeletionRequested;
        u.DeletionRequestedAt = clock.UtcNow;
        request.ScheduledAt = blockers.Count == 0 ? clock.UtcNow.AddDays(14) : null;
        await db.SaveChangesAsync(ct);
        return new { u.Status, request.ScheduledAt, blockers };
    }

    public async Task CancelDeletionAsync(Guid userId, CancellationToken ct = default)
    {
        var u = await db.Users.FirstOrDefaultAsync(x => x.Id == userId, ct)
            ?? throw new DomainException("user.not_found", "User not found.");
        if (u.Status == UserStatus.DeletionRequested) u.Status = UserStatus.Active;
        var request = await db.AccountDeletionRequests.FirstOrDefaultAsync(x => x.UserId == userId, ct);
        if (request is not null) db.AccountDeletionRequests.Remove(request);
        await db.SaveChangesAsync(ct);
    }
}
