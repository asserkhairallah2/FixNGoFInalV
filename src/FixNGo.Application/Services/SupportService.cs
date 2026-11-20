using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Application.Services;

/// <summary>Support tickets, legal/FAQ content, SOS and safety reports, account deletion.</summary>
public sealed class SupportService(IAppDbContext db, IClock clock, INotifier notifier) : ISupportService
{
    public async Task<SupportTicketView> CreateTicketAsync(Guid userId, CreateTicketRequest req, CancellationToken ct = default)
    {
        var subject = (req.Subject ?? string.Empty).Trim();
        var description = (req.Description ?? string.Empty).Trim();
        if (subject.Length == 0) throw new DomainException("ticket.subject_required", "Please enter a subject.");
        if (description.Length == 0) throw new DomainException("ticket.description_required", "Please describe the issue.");
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new DomainException("user.not_found", "User not found.");

        string? refType = null;
        Guid? refId = null;
        if (req.ReferenceId is Guid rid && rid != Guid.Empty)
        {
            (refType, _) = await ResolveReferenceAsync(userId, req.ReferenceType, rid, ct);
            refId = rid;
        }

        UploadedFile? file = null;
        if (req.AttachmentFileId is Guid fid && fid != Guid.Empty)
            file = await ValidateAttachmentAsync(userId, fid, ct);

        var ticket = new SupportTicket
        {
            Code = await Codes.NextAsync(db, "TK", ct), UserId = userId, Category = string.IsNullOrWhiteSpace(req.Category) ? "General" : req.Category.Trim(),
            Subject = subject, Description = description,
            ReferenceType = refType, ReferenceId = refId
        };
        db.SupportTickets.Add(ticket);
        db.SupportMessages.Add(new SupportMessage
        {
            TicketId = ticket.Id, FromSupport = false, AuthorName = user.FullName, Text = description, FileId = file?.Id
        });
        await db.SaveChangesAsync(ct);
        return (await ViewsAsync(db.SupportTickets.Where(t => t.Id == ticket.Id), ct)).Single();
    }

    public async Task<IReadOnlyList<SupportTicketView>> TicketsAsync(Guid userId, CancellationToken ct = default) =>
        await ViewsAsync(db.SupportTickets.Where(t => t.UserId == userId), ct);

    public async Task<SupportTicketDetail> TicketAsync(Guid userId, bool isAdmin, Guid id, CancellationToken ct = default)
    {
        var t = await db.SupportTickets.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new DomainException("ticket.not_found", "Ticket not found.");
        if (!isAdmin && t.UserId != userId) throw new DomainException("auth.forbidden", "This ticket is not yours.");
        var view = (await ViewsAsync(db.SupportTickets.Where(x => x.Id == id), ct)).Single();
        var raw = await db.SupportMessages.Where(m => m.TicketId == id).OrderBy(m => m.CreatedAt)
            .Select(m => new { m.Id, m.FromSupport, m.AuthorName, m.Text, m.CreatedAt, m.FileId }).ToListAsync(ct);
        var fileIds = raw.Where(m => m.FileId != null).Select(m => m.FileId!.Value).Distinct().ToList();
        var files = fileIds.Count == 0
            ? new Dictionary<Guid, UploadedFile>()
            : await db.UploadedFiles.Where(f => fileIds.Contains(f.Id)).ToDictionaryAsync(f => f.Id, ct);
        var messages = raw.Select(m =>
        {
            UploadedFile? f = m.FileId is Guid g && files.TryGetValue(g, out var hit) ? hit : null;
            // Legacy rows stored the literal "You" as author; always expose the real customer name instead.
            var author = m.FromSupport
                ? (string.IsNullOrWhiteSpace(m.AuthorName) ? "FixNGo Support" : m.AuthorName)
                : (string.IsNullOrWhiteSpace(m.AuthorName) || m.AuthorName == "You" ? view.CustomerName : m.AuthorName);
            return new SupportThreadMessage(m.Id, m.FromSupport, author, m.Text, m.CreatedAt,
                f?.Id, f?.FileName, f?.ContentType, f?.SizeBytes);
        }).ToList();
        return new SupportTicketDetail(view, messages);
    }

    public async Task<SupportThreadMessage> ReplyAsync(Guid userId, Guid id, TicketReplyRequest req, CancellationToken ct = default)
    {
        var t = await db.SupportTickets.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct)
            ?? throw new DomainException("ticket.not_found", "Ticket not found.");
        if (t.Status == TicketStatus.Closed) throw new DomainException("ticket.closed", "Ticket is closed.");
        var text = (req.Text ?? string.Empty).Trim();
        if (text.Length == 0) throw new DomainException("ticket.message_required", "Please type a message.");
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new DomainException("user.not_found", "User not found.");
        UploadedFile? file = req.FileId is Guid fid && fid != Guid.Empty ? await ValidateAttachmentAsync(userId, fid, ct) : null;
        var msg = new SupportMessage { TicketId = t.Id, FromSupport = false, AuthorName = user.FullName, Text = text, FileId = file?.Id };
        db.SupportMessages.Add(msg);
        t.Status = TicketStatus.AwaitingSupport;
        await db.SaveChangesAsync(ct);
        return new SupportThreadMessage(msg.Id, false, msg.AuthorName, msg.Text, msg.CreatedAt,
            file?.Id, file?.FileName, file?.ContentType, file?.SizeBytes);
    }

    public async Task<SupportThreadMessage> SupportReplyAsync(Guid adminId, Guid id, TicketReplyRequest req, CancellationToken ct = default)
    {
        var t = await db.SupportTickets.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new DomainException("ticket.not_found", "Ticket not found.");
        var text = (req.Text ?? string.Empty).Trim();
        if (text.Length == 0) throw new DomainException("ticket.message_required", "Please type a message.");
        var admin = await db.Users.FirstOrDefaultAsync(u => u.Id == adminId, ct);
        UploadedFile? file = req.FileId is Guid fid && fid != Guid.Empty ? await ValidateAttachmentAsync(adminId, fid, ct) : null;
        var msg = new SupportMessage
        {
            TicketId = t.Id, FromSupport = true,
            AuthorName = string.IsNullOrWhiteSpace(admin?.FullName) ? "FixNGo Support" : admin!.FullName,
            Text = text, FileId = file?.Id
        };
        db.SupportMessages.Add(msg);
        t.Status = TicketStatus.Answered;
        await db.SaveChangesAsync(ct);
        await notifier.NotifyUserAsync(t.UserId, NotificationType.SupportTicketReply, "Support reply", text, $"ticket:{t.Id}", ct);
        return new SupportThreadMessage(msg.Id, true, msg.AuthorName, msg.Text, msg.CreatedAt,
            file?.Id, file?.FileName, file?.ContentType, file?.SizeBytes);
    }

    public async Task<IReadOnlyList<SupportTicketView>> AllTicketsAsync(CancellationToken ct = default) =>
        await ViewsAsync(db.SupportTickets, ct);

    public async Task CloseTicketAsync(Guid adminId, Guid id, CancellationToken ct = default)
    {
        var t = await db.SupportTickets.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new DomainException("ticket.not_found", "Ticket not found.");
        t.Status = TicketStatus.Closed;
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Projects tickets with the customer's identity and the human code of the linked request/booking.</summary>
    private async Task<List<SupportTicketView>> ViewsAsync(IQueryable<SupportTicket> source, CancellationToken ct)
    {
        var rows = await source.OrderByDescending(t => t.CreatedAt)
            .Select(t => new
            {
                t.Id, t.Code, t.Category, t.Subject, t.Description, t.Status, t.CreatedAt, t.ReferenceType, t.ReferenceId,
                t.UserId, t.User.FullName, t.User.Email, t.User.Phone, t.User.Role,
                Attachments = t.Messages.Count(m => m.FileId != null)
            }).ToListAsync(ct);
        var refIds = rows.Where(r => r.ReferenceId != null).Select(r => r.ReferenceId!.Value).Distinct().ToList();
        var reqCodes = refIds.Count == 0 ? new Dictionary<Guid, string>()
            : await db.ServiceRequests.Where(r => refIds.Contains(r.Id)).ToDictionaryAsync(r => r.Id, r => r.Code, ct);
        var bookCodes = refIds.Count == 0 ? new Dictionary<Guid, string>()
            : await db.Bookings.Where(b => refIds.Contains(b.Id)).ToDictionaryAsync(b => b.Id, b => b.Code, ct);
        return rows.Select(r =>
        {
            string? code = null;
            if (r.ReferenceId is Guid g)
                code = reqCodes.TryGetValue(g, out var rc) ? rc : bookCodes.TryGetValue(g, out var bc) ? bc : null;
            return new SupportTicketView(r.Id, r.Code, r.Category, r.Subject, r.Description, r.Status, r.CreatedAt,
                r.ReferenceType, r.ReferenceId, code, r.UserId, r.FullName, r.Email, r.Phone, r.Role, r.Attachments);
        }).ToList();
    }

    /// <summary>A ticket may only reference the caller's own request (as customer or provider) or booking (as customer or center owner).</summary>
    private async Task<(string Type, string Code)> ResolveReferenceAsync(Guid userId, string? type, Guid id, CancellationToken ct)
    {
        if (!string.Equals(type, "Booking", StringComparison.OrdinalIgnoreCase))
        {
            var r = await db.ServiceRequests.Where(x => x.Id == id)
                .Select(x => new { x.Code, x.CustomerId, x.AssignedProviderId }).FirstOrDefaultAsync(ct);
            if (r is not null)
            {
                if (r.CustomerId != userId && r.AssignedProviderId != userId)
                    throw new DomainException("ticket.reference_forbidden", "You can only reference your own trips and bookings.");
                return ("Request", r.Code);
            }
        }
        var b = await db.Bookings.Where(x => x.Id == id)
            .Select(x => new { x.Code, x.CustomerId, OwnerId = x.Center.OwnerId }).FirstOrDefaultAsync(ct)
            ?? throw new DomainException("ticket.reference_not_found", "The selected trip or booking was not found.");
        if (b.CustomerId != userId && b.OwnerId != userId)
            throw new DomainException("ticket.reference_forbidden", "You can only reference your own trips and bookings.");
        return ("Booking", b.Code);
    }

    private async Task<UploadedFile> ValidateAttachmentAsync(Guid userId, Guid fileId, CancellationToken ct)
    {
        var file = await db.UploadedFiles.FirstOrDefaultAsync(f => f.Id == fileId, ct)
            ?? throw new DomainException("ticket.attachment_not_found", "The attachment could not be found. Please upload it again.");
        if (file.OwnerId is Guid owner && owner != userId)
            throw new DomainException("ticket.attachment_forbidden", "This attachment belongs to another account.");
        if (await db.SupportMessages.AnyAsync(m => m.FileId == fileId, ct))
            throw new DomainException("ticket.attachment_in_use", "This attachment is already linked to a ticket.");
        return file;
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
            && r.Status != RequestStatus.Completed && r.Status != RequestStatus.Cancelled && r.Status != RequestStatus.NoProviders, ct))
            blockers.Add("active_requests");
        if (await db.Bookings.AnyAsync(b => b.CustomerId == userId
            && b.Status != BookingStatus.Completed && b.Status != BookingStatus.Cancelled
            && b.Status != BookingStatus.Rejected && b.Status != BookingStatus.Expired, ct))
            blockers.Add("active_bookings");
        if (await db.Withdrawals.AnyAsync(w => w.UserId == userId
            && w.Status != WithdrawalStatus.Confirmed && w.Status != WithdrawalStatus.Failed, ct))
            blockers.Add("pending_withdrawals");
        if (blockers.Count > 0)
            throw new DomainException("deletion.blocked", "Resolve active requests, bookings, or pending withdrawals before deleting your account.");
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

/// <summary>Support ticket as seen by its owner and by admins (AD18): includes the customer identity and linked reference code.</summary>
public sealed record SupportTicketView(Guid Id, string Code, string Category, string Subject, string Description, TicketStatus Status,
    DateTime CreatedAt, string? ReferenceType, Guid? ReferenceId, string? ReferenceCode, Guid UserId, string? CustomerName,
    string? CustomerEmail, string? CustomerPhone, Role CustomerRole, int AttachmentCount);

/// <summary>One thread message with its optional attachment metadata (download via the scoped file URL).</summary>
public sealed record SupportThreadMessage(Guid Id, bool FromSupport, string? AuthorName, string Text, DateTime CreatedAt,
    Guid? FileId, string? FileName, string? FileContentType, long? FileSizeBytes);

public sealed record SupportTicketDetail(SupportTicketView Ticket, IReadOnlyList<SupportThreadMessage> Messages);
