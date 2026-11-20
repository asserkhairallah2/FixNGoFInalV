using System.Text.Json;
using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Application.Services;

/// <summary>Provider profiles, KYC submission/review, availability and location.</summary>
public sealed class ProviderService(IAppDbContext db, IClock clock, INotifier notifier)
{
    public async Task<ProviderDto> ProfileAsync(Guid userId, CancellationToken ct = default)
    {
        var u = await db.Users.FirstOrDefaultAsync(x => x.Id == userId, ct)
            ?? throw new DomainException("user.not_found", "User not found.");
        var p = await db.ProviderProfiles.FirstOrDefaultAsync(x => x.UserId == userId, ct) ?? new ProviderProfile();
        return Mappings.Provider(u, p);
    }

    public async Task<ProviderDto> UpdateProfileAsync(Guid userId, UpdateProviderProfileRequest req, CancellationToken ct = default)
    {
        var u = await db.Users.FirstOrDefaultAsync(x => x.Id == userId, ct)
            ?? throw new DomainException("user.not_found", "User not found.");
        var p = await db.ProviderProfiles.FirstOrDefaultAsync(x => x.UserId == userId, ct);
        if (p is null)
        {
            p = new ProviderProfile { UserId = userId };
            db.ProviderProfiles.Add(p);
        }
        var radius = req.CoverageRadiusKm <= 0 ? 10 : req.CoverageRadiusKm;
        if (radius < 1 || radius > 200)
            throw new DomainException("provider.radius_invalid", "Invalid coverage radius.");
        if (!string.IsNullOrWhiteSpace(req.FullName)) u.FullName = req.FullName.Trim();
        if (!string.IsNullOrWhiteSpace(req.Phone)) u.Phone = Rules.NormalisePhone(req.Phone);
        if (!string.IsNullOrWhiteSpace(req.Email)) u.Email = req.Email.Trim().ToLowerInvariant();
        if (req.YearsExperience > 0) p.YearsExperience = req.YearsExperience;
        if (req.Expertise is not null) p.ExpertiseJson = JsonSerializer.Serialize(req.Expertise);
        if (req.Latitude.HasValue) { p.Latitude = req.Latitude; u.Latitude = req.Latitude; }
        if (req.Longitude.HasValue) { p.Longitude = req.Longitude; u.Longitude = req.Longitude; }
        p.CoverageRadiusKm = radius;
        if (req.CoverageArea is not null) { p.CoverageArea = req.CoverageArea; u.AreaLabel = req.CoverageArea; }
        if (req.TruckMake is not null) p.TruckMake = req.TruckMake;
        if (req.TruckPlate is not null) p.TruckPlate = req.TruckPlate;
        if (req.TruckCapacityTonnes.HasValue) p.TruckCapacityTonnes = req.TruckCapacityTonnes;
        if (!string.IsNullOrWhiteSpace(req.TruckType) && Enum.TryParse<TruckType>(req.TruckType, true, out var tt)) p.TruckType = tt;
        await db.SaveChangesAsync(ct);
        return await ProfileAsync(userId, ct);
    }

    public async Task<ProviderDto> SetOnlineAsync(Guid userId, OnlineRequest req, CancellationToken ct = default)
    {
        var p = await db.ProviderProfiles.FirstOrDefaultAsync(x => x.UserId == userId, ct)
            ?? throw new DomainException("provider.profile_not_found", "Provider profile not found.");
        if (req.IsOnline)
        {
            var u = await db.Users.FirstAsync(x => x.Id == userId, ct);
            if (u.KycStatus != KycStatus.Approved)
                throw new DomainException("provider.kyc_required", "KYC must be approved before going online.");
        }
        p.IsOnline = req.IsOnline;
        p.Latitude = req.Latitude ?? p.Latitude;
        p.Longitude = req.Longitude ?? p.Longitude;
        p.LastHeartbeatAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        return await ProfileAsync(userId, ct);
    }

    public async Task HeartbeatAsync(Guid userId, HeartbeatRequest req, CancellationToken ct = default)
    {
        var p = await db.ProviderProfiles.FirstOrDefaultAsync(x => x.UserId == userId, ct)
            ?? throw new DomainException("provider.profile_not_found", "Provider profile not found.");
        p.Latitude = req.Latitude ?? p.Latitude;
        p.Longitude = req.Longitude ?? p.Longitude;
        p.LastHeartbeatAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    public async Task<KycApplicationDto> SubmitKycAsync(Guid userId, SubmitKycRequest req, CancellationToken ct = default)
    {
        var u = await db.Users.FirstOrDefaultAsync(x => x.Id == userId, ct)
            ?? throw new DomainException("user.not_found", "User not found.");
        if (u.KycStatus == KycStatus.Approved)
            throw new DomainException("kyc.already_approved", "KYC is already approved.");

        if (!string.IsNullOrWhiteSpace(req.FullName)) u.FullName = req.FullName.Trim();
        if (!string.IsNullOrWhiteSpace(req.Phone)) u.Phone = Rules.NormalisePhone(req.Phone);
        if (req.Latitude.HasValue) u.Latitude = req.Latitude;
        if (req.Longitude.HasValue) u.Longitude = req.Longitude;
        if (!string.IsNullOrWhiteSpace(req.Address)) u.AreaLabel = req.Address.Trim();

        if (u.Role is Role.Mechanic or Role.TowCaptain)
        {
            var p = await db.ProviderProfiles.FirstOrDefaultAsync(x => x.UserId == userId, ct);
            if (p is null) { p = new ProviderProfile { UserId = userId }; db.ProviderProfiles.Add(p); }
            if (req.YearsExperience.HasValue) p.YearsExperience = req.YearsExperience.Value;
            if (req.Services is not null) p.ExpertiseJson = JsonSerializer.Serialize(req.Services);
            if (req.Latitude.HasValue) p.Latitude = req.Latitude;
            if (req.Longitude.HasValue) p.Longitude = req.Longitude;
            if (!string.IsNullOrWhiteSpace(req.Address)) p.CoverageArea = req.Address.Trim();
            if (!string.IsNullOrWhiteSpace(req.TruckMake)) p.TruckMake = req.TruckMake.Trim();
            if (!string.IsNullOrWhiteSpace(req.TruckPlate)) p.TruckPlate = req.TruckPlate.Trim();
            if (req.TruckCapacityTonnes.HasValue) p.TruckCapacityTonnes = req.TruckCapacityTonnes.Value;
            if (!string.IsNullOrWhiteSpace(req.TruckType) && Enum.TryParse<TruckType>(req.TruckType, true, out var tt)) p.TruckType = tt;
        }
        else if (u.Role == Role.ServiceCenter)
        {
            var center = await db.ServiceCenters.FirstOrDefaultAsync(c => c.OwnerId == userId, ct);
            if (center is null)
            {
                center = new ServiceCenter
                {
                    OwnerId = userId,
                    Name = req.BusinessName ?? u.FullName,
                    Address = req.Address ?? "Cairo, Egypt",
                    Phone = u.Phone ?? "+201000000000"
                };
                db.ServiceCenters.Add(center);
            }
            else
            {
                if (!string.IsNullOrWhiteSpace(req.BusinessName)) center.Name = req.BusinessName.Trim();
                if (!string.IsNullOrWhiteSpace(req.Address)) center.Address = req.Address.Trim();
                if (!string.IsNullOrWhiteSpace(req.Phone)) center.Phone = Rules.NormalisePhone(req.Phone);
                if (req.Latitude.HasValue) center.Latitude = req.Latitude;
                if (req.Longitude.HasValue) center.Longitude = req.Longitude;
            }
        }

        var existing = await db.KycApplications.Include(a => a.Documents)
            .FirstOrDefaultAsync(a => a.UserId == userId && a.Status != KycStatus.Rejected, ct);
        var fromState = (u.KycStatus == KycStatus.Approved || u.KycStatus == KycStatus.Submitted || u.KycStatus == KycStatus.UnderReview)
            ? KycStatus.None
            : u.KycStatus;
        u.KycStatus = StateMachines.Kyc.Transition(fromState, KycStatus.Submitted);
        var app = existing ?? new KycApplication { UserId = userId, Code = await Codes.NextAsync(db, "KYC", ct) };
        app.Status = KycStatus.Submitted;
        app.ApplicantType = string.IsNullOrWhiteSpace(req.ApplicantType) ? u.Role.ToString() : req.ApplicantType;
        app.BusinessName = req.BusinessName ?? app.BusinessName;
        app.Address = req.Address ?? app.Address;
        app.Latitude = req.Latitude ?? app.Latitude;
        app.Longitude = req.Longitude ?? app.Longitude;
        if (req.Services is not null) app.ServicesJson = JsonSerializer.Serialize(req.Services);
        app.ReviewerNote = null;
        if (existing is null) db.KycApplications.Add(app);
        foreach (var doc in req.Documents ?? [])
        {
            if (!await db.UploadedFiles.AnyAsync(f => f.Id == doc.FileId, ct))
                throw new DomainException("file.not_found", "Uploaded document not found.");
            app.Documents.Add(new KycDocument { DocumentType = doc.DocumentType, FileId = doc.FileId, Status = DocumentStatus.Pending });
        }
        await db.SaveChangesAsync(ct);
        await NotifyAdminsAsync(NotificationType.NewKycApplication, "New KYC application", $"{u.FullName} submitted KYC {app.Code}.", app.Id, ct);
        return Mappings.Kyc(app);
    }

    public async Task<KycApplicationDto> UploadDocumentAsync(Guid userId, KycDocumentInput doc, CancellationToken ct = default)
    {
        var u = await db.Users.FirstOrDefaultAsync(x => x.Id == userId, ct)
            ?? throw new DomainException("user.not_found", "User not found.");
        if (!await db.UploadedFiles.AnyAsync(f => f.Id == doc.FileId, ct))
            throw new DomainException("file.not_found", "Uploaded document not found.");
        var app = await db.KycApplications.Include(a => a.Documents)
            .OrderByDescending(a => a.CreatedAt)
            .FirstOrDefaultAsync(a => a.UserId == userId, ct);
        if (app is null)
        {
            app = new KycApplication
            {
                UserId = userId,
                Code = await Codes.NextAsync(db, "KYC", ct),
                Status = KycStatus.Submitted,
                ApplicantType = u.Role.ToString()
            };
            db.KycApplications.Add(app);
        }
        else if (app.Status is KycStatus.ChangesNeeded or KycStatus.Rejected)
        {
            app.Status = KycStatus.Submitted;
            app.ReviewerNote = null;
        }
        if (u.KycStatus != KycStatus.Approved) u.KycStatus = KycStatus.Submitted;
        app.Documents.Add(new KycDocument
        {
            DocumentType = string.IsNullOrWhiteSpace(doc.DocumentType) ? "NationalId" : doc.DocumentType.Trim(),
            FileId = doc.FileId,
            Status = DocumentStatus.Pending
        });
        await db.SaveChangesAsync(ct);
        app.User = u;
        return Mappings.Kyc(app);
    }

    public async Task<KycApplicationDto> MyKycAsync(Guid userId, CancellationToken ct = default)
    {
        var u = await db.Users.FirstOrDefaultAsync(x => x.Id == userId, ct);
        var app = await db.KycApplications.Include(a => a.Documents).Include(a => a.User)
            .Where(a => a.UserId == userId).OrderByDescending(a => a.CreatedAt).FirstOrDefaultAsync(ct);
        if (app is null)
        {
            return new KycApplicationDto(Guid.Empty, "KYC-0000", u?.KycStatus ?? KycStatus.Submitted,
                u?.Role.ToString() ?? "Mechanic", null, null, DateTime.UtcNow, userId, u?.FullName, u?.Email, u?.Phone, u?.AreaLabel, []);
        }
        return Mappings.Kyc(app);
    }

    public async Task<KycApplicationDto?> KycByIdAsync(Guid id, CancellationToken ct = default)
    {
        var app = await db.KycApplications.Include(a => a.Documents).Include(a => a.User)
            .FirstOrDefaultAsync(a => a.Id == id, ct);
        return app is null ? null : Mappings.Kyc(app);
    }

    public async Task<IReadOnlyList<KycApplicationDto>> KycQueueAsync(CancellationToken ct = default) =>
        await db.KycApplications.Include(a => a.Documents).Include(a => a.User)
            .OrderByDescending(a => a.Status == KycStatus.Submitted || a.Status == KycStatus.UnderReview)
            .ThenBy(a => a.CreatedAt)
            .Select(a => Mappings.Kyc(a)).ToListAsync(ct);

    public async Task<KycApplicationDto> ReviewKycAsync(Guid adminId, Guid appId, ReviewKycRequest req, CancellationToken ct = default)
    {
        var app = await db.KycApplications.Include(a => a.Documents).Include(a => a.User).FirstOrDefaultAsync(a => a.Id == appId, ct)
            ?? throw new DomainException("kyc.not_found", "KYC application not found.");
        if (app.Status is not (KycStatus.Submitted or KycStatus.UnderReview or KycStatus.ChangesNeeded))
            throw new DomainException("kyc.already_reviewed", "Application is already reviewed.");
        app.Status = StateMachines.Kyc.Transition(app.Status, req.Decision);
        app.ReviewerNote = req.Note;
        app.ReviewedBy = adminId;
        app.ReviewedAt = clock.UtcNow;
        var u = app.User ?? await db.Users.FirstAsync(x => x.Id == app.UserId, ct);
        u.KycStatus = app.Status;
        foreach (var doc in app.Documents)
        {
            if (req.Decision == KycStatus.Approved)
                doc.Status = DocumentStatus.Approved;
            else if (req.Decision == KycStatus.Rejected && doc.Status == DocumentStatus.Pending)
                doc.Status = DocumentStatus.Rejected;
            if (!string.IsNullOrWhiteSpace(req.Note))
                doc.ReviewNote = req.Note;
        }
        if (u.Role == Role.ServiceCenter && req.Decision == KycStatus.Approved)
        {
            var center = await db.ServiceCenters.FirstOrDefaultAsync(c => c.OwnerId == u.Id, ct);
            if (center is null)
            {
                center = new ServiceCenter
                {
                    OwnerId = u.Id,
                    Name = app.BusinessName ?? u.FullName,
                    Address = app.Address ?? u.AreaLabel ?? "Cairo, Egypt",
                    Phone = u.Phone ?? string.Empty,
                    Latitude = app.Latitude ?? u.Latitude,
                    Longitude = app.Longitude ?? u.Longitude
                };
                db.ServiceCenters.Add(center);
                await db.SaveChangesAsync(ct);
            }
            if (!await db.WorkingHours.AnyAsync(h => h.CenterId == center.Id, ct))
            {
                for (var dow = 0; dow < 7; dow++)
                {
                    db.WorkingHours.Add(new WorkingHours
                    {
                        CenterId = center.Id,
                        DayOfWeek = dow,
                        IsClosed = dow == 5, // Friday closed by default in Egypt
                        OpenTime = TimeSpan.FromHours(9),
                        CloseTime = TimeSpan.FromHours(17)
                    });
                }
            }
            if (!await db.Bays.AnyAsync(b => b.CenterId == center.Id, ct))
            {
                db.Bays.Add(new Bay { CenterId = center.Id, Name = "Bay 1", IsActive = true });
            }
        }
        await db.SaveChangesAsync(ct);
        var type = req.Decision switch
        {
            KycStatus.Approved => NotificationType.KycDecision,
            KycStatus.ChangesNeeded => NotificationType.KycChangesNeeded,
            _ => NotificationType.KycDecision
        };
        var defaultApprovedBody = u.Role switch
        {
            Role.TowCaptain => "Your tow captain application was approved. You can now go online and accept trips.",
            Role.ServiceCenter => "Your service center application was approved. You can now manage services and bookings.",
            _ => "Your mechanic application was approved. You can now go online and accept jobs."
        };
        var body = !string.IsNullOrWhiteSpace(req.Note)
            ? req.Note!
            : req.Decision == KycStatus.Approved
                ? defaultApprovedBody
                : $"Application {app.Code}: {req.Decision}.";
        await notifier.NotifyUserAsync(app.UserId, type, $"KYC {req.Decision}", body, $"kyc:{app.Id}", ct);
        return Mappings.Kyc(app);
    }

    public async Task<object> DocumentsAsync(Guid appId, CancellationToken ct = default) =>
        await db.KycDocuments.Where(d => d.ApplicationId == appId)
            .Select(d => new { d.Id, d.DocumentType, d.FileId, d.Status, d.ReviewNote }).ToListAsync(ct);

    public async Task<IReadOnlyList<ProviderDto>> NearbyAsync(double lat, double lng, string role, CancellationToken ct = default)
    {
        var result = new List<ProviderDto>();
        var rows = await (from p in db.ProviderProfiles join u in db.Users on p.UserId equals u.Id
                          where p.IsOnline && u.KycStatus == KycStatus.Approved && u.Role.ToString() == role
                          select new { p, u }).ToListAsync(ct);
        foreach (var x in rows)
        {
            if (x.p.Latitude is null || x.p.Longitude is null) continue;
            if (Geo.HaversineKm(lat, lng, x.p.Latitude.Value, x.p.Longitude.Value) <= x.p.CoverageRadiusKm * 4)
                result.Add(Mappings.Provider(x.u, x.p));
        }
        return result;
    }

    private async Task NotifyAdminsAsync(NotificationType type, string title, string body, Guid entityId, CancellationToken ct)
    {
        var admins = await db.Users.Where(u => u.Role == Role.Admin).Select(u => u.Id).ToListAsync(ct);
        foreach (var id in admins)
            await notifier.NotifyUserAsync(id, type, title, body, $"kyc:{entityId}", ct);
    }
}
