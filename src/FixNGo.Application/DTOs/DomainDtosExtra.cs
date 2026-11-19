using FixNGo.Domain;

namespace FixNGo.Application.DTOs;

// ---- Settings / dashboard / admin ----
public sealed record SettingsDto(PricingSettings Pricing, int Version);
public sealed record UpdateSettingsRequest(PricingSettings Pricing);
public sealed record DashboardDto(int Users, int ActiveRequests, int PendingKyc, int PendingPaymentReviews,
    int OpenSafetyReports, long TodayRevenueMinor, int CompletedToday);
public sealed record AdminUserDto(Guid Id, string FullName, string Email, Role Role, UserStatus Status,
    KycStatus KycStatus, bool IsSuperAdmin, DateTime CreatedAt, int Sessions);
public sealed record ReviewKycRequest(KycStatus Decision, string? Note);
public sealed record ResolvePaymentReviewRequest(long? AdjustedMinor, string? Note);
public sealed record ResolveSafetyRequest(SafetyReportStatus Status, string? Note);
public sealed record SuspendRequest(string Reason);
public sealed record AuditLogDto(Guid Id, Guid ActorId, string Action, string EntityType, string? EntityId, string? Reason, DateTime CreatedAt);
public sealed record SessionDto(Guid Id, string? DeviceLabel, string? IpAddress, DateTime ExpiresAt, DateTime? RevokedAt);

// ---- Notifications / chat ----
public sealed record NotificationPreferencesDto(bool Push, bool Email, bool TripsAndSafety, bool Bookings, bool Offers);
public sealed record UpdateNotificationPreferencesRequest(bool Push, bool Email, bool Bookings, bool Offers);
public sealed record DeviceTokenRequest(string Token, string Platform);
public sealed record MarkReadRequest(IReadOnlyList<Guid> Ids);

// ---- Files ----
public sealed record FileDto(Guid Id, string FileName, string ContentType, long SizeBytes, string Purpose);

// ---- Health of flows ----
public sealed record TimelineDto(IReadOnlyList<RequestEventDto> Events);
public sealed record EarningsDto(long AvailableMinor, long LifetimeMinor, int CompletedJobs, decimal Rating, int RatingCount);

// ---- Legal / FAQ ----
public sealed record FaqDto(Guid Id, string QuestionEn, string QuestionAr, string AnswerEn, string AnswerAr);
public sealed record LegalDto(string Key, int Version, string TitleEn, string TitleAr, string BodyEn, string BodyAr, DateTime UpdatedAt);
