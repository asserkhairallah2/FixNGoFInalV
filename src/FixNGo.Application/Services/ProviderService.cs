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
        var p = await db.ProviderProfiles.FirstOrDefaultAsync(x => x.UserId == userId, ct)
            ?? throw new DomainException("provider.profile_not_found", "Provider profile not found.");
        if (req.CoverageRadiusKm < 1 || req.CoverageRadiusKm > 200)
            throw new DomainException("provider.radius_invalid", "Invalid coverage radius.");
        p.YearsExperience = req.YearsExperience;
        p.ExpertiseJson = JsonSerializer.Serialize(req.Expertise);
        p.Latitude = req.Latitude; p.Longitude = req.Longitude;
        p.CoverageRadiusKm = req.CoverageRadiusKm; p.CoverageArea = req.CoverageArea;
        p.TruckMake = req.TruckMake; p.TruckPlate = req.TruckPlate;
        p.TruckCapacityTonnes = req.TruckCapacityTonnes;
        if (Enum.TryParse<TruckType>(req.TruckType, true, out var tt)) p.TruckType = tt;
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
        var existing = await db.KycApplications.FirstOrDefaultAsync(a => a.UserId == userId && a.Status != KycStatus.Rejected, ct);
        if (existing is not null && existing.Status is KycStatus.Submitted or KycStatus.UnderReview)
            throw new DomainException("kyc.in_review", "An application is already under review.");
        u.KycStatus = StateMachines.Kyc.Transition(u.KycStatus == KycStatus.Approved ? KycStatus.None : u.KycStatus, KycStatus.Submitted);
        var app = existing ?? new KycApplication { UserId = userId, Code = await Codes.NextAsync(db, "KYC", ct) };
        app.Status = KycStatus.Submitted;
        app.ApplicantType = req.ApplicantType;
        app.BusinessName = req.BusinessName;
        app.Address = req.Address;
        app.Latitude = req.Latitude; app.Longitude = req.Longitude;
        app.ServicesJson = JsonSerializer.Serialize(req.Services);
        app.ReviewerNote = null;
        if (existing is null) db.KycApplications.Add(app);
        foreach (var doc in req.Documents)
        {
            if (!await db.UploadedFiles.AnyAsync(f => f.Id == doc.FileId, ct))
                throw new DomainException("file.not_found", "Uploaded document not found.");
            app.Documents.Add(new KycDocument { DocumentType = doc.DocumentType, FileId = doc.FileId, Status = DocumentStatus.Pending });
        }
        await db.SaveChangesAsync(ct);
        await NotifyAdminsAsync(NotificationType.NewKycApplication, "New KYC application", $"{u.FullName} submitted KYC {app.Code}.", app.Id, ct);
        return Mappings.Kyc(app);
    }

    public async Task<KycApplicationDto> MyKycAsync(Guid userId, CancellationToken ct = default)
    {
        var app = await db.KycApplications.Where(a => a.UserId == userId).OrderByDescending(a => a.CreatedAt).FirstOrDefaultAsync(ct)
            ?? throw new DomainException("kyc.not_found", "No KYC application found.");
        return Mappings.Kyc(app);
    }

    public async Task<IReadOnlyList<KycApplicationDto>> KycQueueAsync(CancellationToken ct = default) =>
        await db.KycApplications.Where(a => a.Status == KycStatus.Submitted || a.Status == KycStatus.UnderReview)
            .OrderBy(a => a.CreatedAt).Select(a => Mappings.Kyc(a)).ToListAsync(ct);

    public async Task<KycApplicationDto> ReviewKycAsync(Guid adminId, Guid appId, ReviewKycRequest req, CancellationToken ct = default)
    {
        var app = await db.KycApplications.Include(a => a.Documents).FirstOrDefaultAsync(a => a.Id == appId, ct)
            ?? throw new DomainException("kyc.not_found", "KYC application not found.");
        if (app.Status is not (KycStatus.Submitted or KycStatus.UnderReview or KycStatus.ChangesNeeded))
            throw new DomainException("kyc.already_reviewed", "Application is already reviewed.");
        app.Status = StateMachines.Kyc.Transition(app.Status, req.Decision);
        app.ReviewerNote = req.Note;
        app.ReviewedBy = adminId;
        app.ReviewedAt = clock.UtcNow;
        var u = await db.Users.FirstAsync(x => x.Id == app.UserId, ct);
        u.KycStatus = app.Status;
        await db.SaveChangesAsync(ct);
        var type = req.Decision switch
        {
            KycStatus.Approved => NotificationType.KycDecision,
            KycStatus.ChangesNeeded => NotificationType.KycChangesNeeded,
            _ => NotificationType.KycDecision
        };
        await notifier.NotifyUserAsync(app.UserId, type, $"KYC {req.Decision}", req.Note ?? $"Application {app.Code}: {req.Decision}.", $"kyc:{app.Id}", ct);
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
