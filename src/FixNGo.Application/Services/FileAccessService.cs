using FixNGo.Application.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Application.Services;

/// <summary>
/// Decides who may download an uploaded file. A file is private by default and is visible to:
/// admins; the uploader; parties of a request whose photo it is (customer / assigned provider);
/// the owner of a support ticket it is attached to; the participants of a chat thread it was sent in;
/// and any signed-in user when it is a public profile image (service-center logo/photo, user avatar,
/// vehicle photo of a vehicle on a request the caller serves, truck photo).
/// </summary>
public sealed class FileAccessService(IAppDbContext db)
{
    /// <summary>Returns true when <paramref name="callerId"/> may read file <paramref name="fileId"/>.</summary>
    public async Task<bool> CanReadAsync(Guid callerId, bool isAdmin, Guid fileId, CancellationToken ct = default)
    {
        if (callerId == Guid.Empty) return false;
        if (isAdmin) return true;

        var file = await db.UploadedFiles.AsNoTracking().FirstOrDefaultAsync(f => f.Id == fileId, ct);
        if (file is null) return false;
        if (file.OwnerId == callerId) return true;

        // Request photos: visible to the customer and the assigned provider.
        var onRequest = await db.RequestPhotos.AsNoTracking()
            .Where(p => p.FileId == fileId)
            .Join(db.ServiceRequests.AsNoTracking(), p => p.RequestId, r => r.Id, (p, r) => r)
            .AnyAsync(r => r.CustomerId == callerId || r.AssignedProviderId == callerId, ct);
        if (onRequest) return true;

        // Support ticket attachments: the ticket owner (admins handled above).
        var onTicket = await db.SupportMessages.AsNoTracking()
            .Where(m => m.FileId == fileId)
            .Join(db.SupportTickets.AsNoTracking(), m => m.TicketId, t => t.Id, (m, t) => t)
            .AnyAsync(t => t.UserId == callerId, ct);
        if (onTicket) return true;

        // Chat attachments: both participants of the thread.
        var onChat = await db.ChatMessages.AsNoTracking()
            .Where(m => m.FileId == fileId)
            .AnyAsync(m => m.Thread.CustomerId == callerId || m.Thread.CounterpartId == callerId, ct);
        if (onChat) return true;

        // Public profile imagery shown to other signed-in users.
        var idText = fileId.ToString();
        if (await db.ServiceCenters.AsNoTracking().AnyAsync(c => c.LogoFileId == idText || c.PhotoFileId == idText, ct)) return true;
        if (await db.Users.AsNoTracking().AnyAsync(u => u.AvatarFileId == idText, ct)) return true;
        if (await db.ProviderProfiles.AsNoTracking().AnyAsync(p => p.TruckPhotoFileId == idText, ct)) return true;
        if (await db.Vehicles.AsNoTracking().AnyAsync(v => v.PhotoFileId == idText && v.OwnerId == callerId, ct)) return true;

        return false;
    }
}
