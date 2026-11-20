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
    private static readonly IReadOnlyDictionary<Guid, string> CenterCatalogPresets = new Dictionary<Guid, string>
    {
        [Guid.Parse("00000000-0000-0000-00c0-000000000001")] = "Oil & filter change",
        [Guid.Parse("00000000-0000-0000-00c0-000000000002")] = "Brake inspection & pads",
        [Guid.Parse("00000000-0000-0000-00c0-000000000003")] = "Full computer diagnostics",
        [Guid.Parse("00000000-0000-0000-00c0-000000000004")] = "AC maintenance & recharge",
        [Guid.Parse("00000000-0000-0000-00c0-000000000005")] = "Tires & wheel alignment",
        [Guid.Parse("00000000-0000-0000-00c0-000000000006")] = "Periodic maintenance"
    };

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
        if (req.YearsExperience >= 0) p.YearsExperience = req.YearsExperience;
        if (req.Expertise is not null) p.ExpertiseJson = JsonSerializer.Serialize(req.Expertise);
        if (req.Latitude.HasValue) { p.Latitude = req.Latitude; u.Latitude = req.Latitude; }
        if (req.Longitude.HasValue) { p.Longitude = req.Longitude; u.Longitude = req.Longitude; }
        p.CoverageRadiusKm = radius;
        if (req.CoverageArea is not null) { p.CoverageArea = req.CoverageArea; u.AreaLabel = req.CoverageArea; }
        if (req.TruckMake is not null) p.TruckMake = req.TruckMake;
        if (req.TruckPlate is not null) p.TruckPlate = req.TruckPlate;
        if (req.TruckCapacityTonnes.HasValue) p.TruckCapacityTonnes = req.TruckCapacityTonnes;
        if (TryParseTruckType(req.TruckType, out var tt)) p.TruckType = tt;
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

        var businessName = !string.IsNullOrWhiteSpace(req.BusinessName) ? req.BusinessName.Trim() : null;
        ServiceCenter? center = null;

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
            if (TryParseTruckType(req.TruckType, out var tt)) p.TruckType = tt;
        }
        else if (u.Role == Role.ServiceCenter)
        {
            center = await db.ServiceCenters.FirstOrDefaultAsync(c => c.OwnerId == userId, ct);
            if (center is null)
            {
                center = new ServiceCenter
                {
                    OwnerId = userId,
                    Name = businessName ?? u.FullName,
                    Address = !string.IsNullOrWhiteSpace(req.Address) ? req.Address.Trim() : (u.AreaLabel ?? string.Empty),
                    Phone = !string.IsNullOrWhiteSpace(req.Phone) ? Rules.NormalisePhone(req.Phone) : (u.Phone ?? string.Empty),
                    Latitude = req.Latitude ?? u.Latitude,
                    Longitude = req.Longitude ?? u.Longitude
                };
                db.ServiceCenters.Add(center);
            }
            else
            {
                if (businessName is not null) center.Name = businessName;
                if (!string.IsNullOrWhiteSpace(req.Address)) center.Address = req.Address.Trim();
                if (!string.IsNullOrWhiteSpace(req.Phone)) center.Phone = Rules.NormalisePhone(req.Phone);
                if (req.Latitude.HasValue) center.Latitude = req.Latitude;
                if (req.Longitude.HasValue) center.Longitude = req.Longitude;
            }

            if (req.Services is not null)
            {
                var p = await db.ProviderProfiles.FirstOrDefaultAsync(x => x.UserId == userId, ct);
                if (p is null) { p = new ProviderProfile { UserId = userId }; db.ProviderProfiles.Add(p); }
                p.ExpertiseJson = JsonSerializer.Serialize(req.Services);
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
        app.ApplicantType = string.IsNullOrWhiteSpace(req.ApplicantType) ? u.Role.ToString() : req.ApplicantType.Trim();
        app.BusinessName = businessName ?? app.BusinessName;
        if (!string.IsNullOrWhiteSpace(req.Address)) app.Address = req.Address.Trim();
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

        if (center is not null && req.Services is { Count: > 0 })
        {
            await SeedInitialCenterServicesAsync(center.Id, req.Services, ct);
            await db.SaveChangesAsync(ct);
        }

        var applicantLabel = u.Role == Role.ServiceCenter && !string.IsNullOrWhiteSpace(app.BusinessName)
            ? app.BusinessName
            : u.FullName;
        await NotifyAdminsAsync(NotificationType.NewKycApplication, "New KYC application", $"{applicantLabel} submitted KYC {app.Code}.", app.Id, ct);
        app.User = u;
        return MapKyc(app);
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
            var center = u.Role == Role.ServiceCenter
                ? await db.ServiceCenters.FirstOrDefaultAsync(c => c.OwnerId == userId, ct)
                : null;
            app = new KycApplication
            {
                UserId = userId,
                Code = await Codes.NextAsync(db, "KYC", ct),
                Status = KycStatus.Submitted,
                ApplicantType = u.Role.ToString(),
                BusinessName = center?.Name
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
        return MapKyc(app);
    }

    public async Task<KycApplicationDto> MyKycAsync(Guid userId, CancellationToken ct = default)
    {
        var u = await db.Users.FirstOrDefaultAsync(x => x.Id == userId, ct);
        var app = await db.KycApplications.Include(a => a.Documents).Include(a => a.User)
            .Where(a => a.UserId == userId).OrderByDescending(a => a.CreatedAt).FirstOrDefaultAsync(ct);
        if (app is null)
        {
            var center = u?.Role == Role.ServiceCenter
                ? await db.ServiceCenters.FirstOrDefaultAsync(c => c.OwnerId == userId, ct)
                : null;
            var displayName = center?.Name ?? u?.FullName;
            return new KycApplicationDto(Guid.Empty, "KYC-0000", u?.KycStatus ?? KycStatus.Submitted,
                u?.Role.ToString() ?? "Mechanic", center?.Name, null, DateTime.UtcNow, userId, displayName, u?.Email, u?.Phone, center?.Address ?? u?.AreaLabel, []);
        }
        return MapKyc(app);
    }

    public async Task<KycApplicationDto?> KycByIdAsync(Guid id, CancellationToken ct = default)
    {
        var app = await db.KycApplications.Include(a => a.Documents).Include(a => a.User)
            .FirstOrDefaultAsync(a => a.Id == id, ct);
        return app is null ? null : MapKyc(app);
    }

    public async Task<IReadOnlyList<KycApplicationDto>> KycQueueAsync(CancellationToken ct = default)
    {
        var list = await db.KycApplications.Include(a => a.Documents).Include(a => a.User)
            .OrderByDescending(a => a.Status == KycStatus.Submitted || a.Status == KycStatus.UnderReview)
            .ThenBy(a => a.CreatedAt)
            .ToListAsync(ct);
        return list.Select(MapKyc).ToList();
    }

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
            {
                doc.Status = DocumentStatus.Approved;
                doc.ReviewedAt = clock.UtcNow;
            }
            else if (req.Decision == KycStatus.Rejected && doc.Status == DocumentStatus.Pending)
            {
                doc.Status = DocumentStatus.Rejected;
                doc.ReviewedAt = clock.UtcNow;
            }
            else if (req.Decision == KycStatus.ChangesNeeded && doc.Status == DocumentStatus.Pending)
            {
                doc.ReviewedAt = clock.UtcNow;
            }
            if (!string.IsNullOrWhiteSpace(req.Note))
                doc.ReviewNote = req.Note;
        }

        var effectiveRole = Enum.TryParse<Role>(app.ApplicantType, true, out var parsedRole) ? parsedRole : u.Role;

        if (u.Role == Role.ServiceCenter || effectiveRole == Role.ServiceCenter)
        {
            var center = await db.ServiceCenters.FirstOrDefaultAsync(c => c.OwnerId == u.Id, ct);
            if (center is null)
            {
                center = new ServiceCenter
                {
                    OwnerId = u.Id,
                    Name = !string.IsNullOrWhiteSpace(app.BusinessName) ? app.BusinessName.Trim() : u.FullName,
                    Address = !string.IsNullOrWhiteSpace(app.Address) ? app.Address.Trim() : (u.AreaLabel ?? string.Empty),
                    Phone = u.Phone ?? string.Empty,
                    Latitude = app.Latitude ?? u.Latitude,
                    Longitude = app.Longitude ?? u.Longitude
                };
                db.ServiceCenters.Add(center);
                await db.SaveChangesAsync(ct);
            }
            else
            {
                if (!string.IsNullOrWhiteSpace(app.BusinessName)) center.Name = app.BusinessName.Trim();
                if (!string.IsNullOrWhiteSpace(app.Address)) center.Address = app.Address.Trim();
                if (app.Latitude.HasValue) center.Latitude = app.Latitude;
                if (app.Longitude.HasValue) center.Longitude = app.Longitude;
                if (string.IsNullOrWhiteSpace(center.Phone) && !string.IsNullOrWhiteSpace(u.Phone)) center.Phone = u.Phone;
            }

            if (req.Decision == KycStatus.Approved)
            {
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
                var serviceIds = ParseServiceIds(app.ServicesJson);
                if (serviceIds.Count > 0)
                {
                    await SeedInitialCenterServicesAsync(center.Id, serviceIds, ct);
                }
            }
        }

        db.AuditLogs.Add(new AuditLog
        {
            ActorId = adminId,
            Action = req.Decision switch
            {
                KycStatus.Approved => "kyc.approve",
                KycStatus.Rejected => "kyc.reject",
                _ => "kyc.changes_needed"
            },
            EntityType = "KycApplication",
            EntityId = app.Id.ToString(),
            Reason = req.Note
        });

        await db.SaveChangesAsync(ct);

        var type = req.Decision switch
        {
            KycStatus.Approved => NotificationType.KycDecision,
            KycStatus.ChangesNeeded => NotificationType.KycChangesNeeded,
            _ => NotificationType.KycDecision
        };
        var defaultApprovedBody = effectiveRole switch
        {
            Role.TowCaptain => "Your tow captain application was approved. You can now go online and accept trips.",
            Role.ServiceCenter => "Your service center application was approved. You can now manage services and bookings.",
            _ => "Your mechanic application was approved. You can now go online and accept jobs."
        };
        var sanitizedNote = req.Note?.Trim();
        if (!string.IsNullOrEmpty(sanitizedNote) && effectiveRole != Role.ServiceCenter &&
            sanitizedNote.Contains("center", StringComparison.OrdinalIgnoreCase))
        {
            sanitizedNote = null;
        }
        var title = req.Decision switch
        {
            KycStatus.Approved => effectiveRole switch
            {
                Role.TowCaptain => "Tow Captain KYC Approved",
                Role.ServiceCenter => "Service Center KYC Approved",
                _ => "Mechanic KYC Approved"
            },
            KycStatus.ChangesNeeded => "KYC Changes Needed",
            KycStatus.Rejected => "KYC Application Rejected",
            _ => $"KYC {req.Decision}"
        };
        var body = req.Decision == KycStatus.Approved
            ? defaultApprovedBody
            : (!string.IsNullOrEmpty(sanitizedNote) ? sanitizedNote : $"Application {app.Code}: {req.Decision}.");

        await notifier.NotifyUserAsync(app.UserId, type, title, body, $"kyc:{app.Id}", ct);
        app.User = u;
        return MapKyc(app);
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

    private async Task SeedInitialCenterServicesAsync(Guid centerId, IReadOnlyList<Guid> serviceIds, CancellationToken ct)
    {
        if (serviceIds.Count == 0) return;
        if (await db.CenterServices.AnyAsync(s => s.CenterId == centerId && (s.IsActive || s.PriceMinor > 0), ct))
            return;

        var existingNames = (await db.CenterServices.Where(s => s.CenterId == centerId).Select(s => s.Name).ToListAsync(ct))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var serviceTypeNames = await db.ServiceTypes.Where(st => serviceIds.Contains(st.Id))
            .ToDictionaryAsync(st => st.Id, st => st.NameEn, ct);
        var problemNames = await db.ProblemTypes.Where(pt => serviceIds.Contains(pt.Id))
            .ToDictionaryAsync(pt => pt.Id, pt => pt.NameEn, ct);

        foreach (var id in serviceIds.Distinct())
        {
            string? resolved = null;
            if (CenterCatalogPresets.TryGetValue(id, out var presetName)) resolved = presetName;
            else if (serviceTypeNames.TryGetValue(id, out var stName)) resolved = stName;
            else if (problemNames.TryGetValue(id, out var ptName)) resolved = ptName;

            if (string.IsNullOrWhiteSpace(resolved) || !existingNames.Add(resolved)) continue;
            db.CenterServices.Add(new FixNGo.Domain.Entities.CenterService
            {
                CenterId = centerId,
                Name = resolved,
                Description = "Set price & activate in Service Catalog",
                PriceMinor = 0,
                DurationMinutes = 45,
                IsActive = false
            });
        }
    }

    private static List<Guid> ParseServiceIds(string? servicesJson)
    {
        if (string.IsNullOrWhiteSpace(servicesJson)) return [];
        try
        {
            using var doc = JsonDocument.Parse(servicesJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Array) return [];
            var result = new List<Guid>();
            foreach (var elem in doc.RootElement.EnumerateArray())
            {
                if (elem.ValueKind == JsonValueKind.String && Guid.TryParse(elem.GetString(), out var g) && g != Guid.Empty)
                    result.Add(g);
            }
            return result;
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static bool TryParseTruckType(string? raw, out TruckType truckType)
    {
        truckType = default;
        if (string.IsNullOrWhiteSpace(raw)) return false;
        var trimmed = raw.Trim();
        if (Enum.TryParse(trimmed, true, out truckType)) return true;
        if (string.Equals(trimmed, "HookAndChain", StringComparison.OrdinalIgnoreCase))
        {
            truckType = TruckType.Hook;
            return true;
        }
        if (string.Equals(trimmed, "Integrated", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(trimmed, "HeavyDuty", StringComparison.OrdinalIgnoreCase))
        {
            truckType = TruckType.Carry;
            return true;
        }
        return false;
    }

    private static KycApplicationDto MapKyc(KycApplication a)
    {
        var dto = Mappings.Kyc(a);
        if (!string.IsNullOrWhiteSpace(a.BusinessName) &&
            (string.Equals(a.ApplicantType, nameof(Role.ServiceCenter), StringComparison.OrdinalIgnoreCase) ||
             a.User?.Role == Role.ServiceCenter))
        {
            var biz = a.BusinessName.Trim();
            return dto with { BusinessName = biz, FullName = biz };
        }
        return dto;
    }

    private async Task NotifyAdminsAsync(NotificationType type, string title, string body, Guid entityId, CancellationToken ct)
    {
        var admins = await db.Users.Where(u => u.Role == Role.Admin).Select(u => u.Id).ToListAsync(ct);
        foreach (var id in admins)
            await notifier.NotifyUserAsync(id, type, title, body, $"kyc:{entityId}", ct);
    }
}
