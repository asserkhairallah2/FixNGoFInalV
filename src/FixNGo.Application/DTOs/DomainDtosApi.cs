using FixNGo.Domain;

namespace FixNGo.Application.DTOs;

// ---- Bootstrap lookups ----
public sealed record ReasonDto(Guid Id, string Key, string LabelEn, string LabelAr);
public sealed record ProblemDto(Guid Id, string Key, string NameEn, string NameAr, string RecommendedServiceKey);
public sealed record BankDto(Guid Id, string NameEn, string NameAr, string Code);
public sealed record VehicleModelDto(Guid Id, Guid MakeId, string Name);
public sealed record VehicleMakeDto(Guid Id, string Name, IReadOnlyList<VehicleModelDto> Models);
public sealed record ChecklistDto(Guid Id, string Key, string ItemEn, string ItemAr, string Workflow);
public sealed record LookupsDto(
    IReadOnlyList<ServiceTypeDto> ServiceTypes, IReadOnlyList<ProblemDto> Problems,
    IReadOnlyList<ReasonDto> CancellationReasons, IReadOnlyList<ReasonDto> RejectReasons,
    IReadOnlyList<BankDto> Banks, IReadOnlyList<VehicleMakeDto> VehicleMakes,
    IReadOnlyList<ChecklistDto> Checklists, IReadOnlyList<FaqDto> Faqs,
    PricingSettings Pricing, IReadOnlyList<LegalDto> Legal);

// ---- KYC / provider profile ----
public sealed record KycDocumentInput(string DocumentType, Guid FileId);
public sealed record SubmitKycRequest(string ApplicantType, string? BusinessName = null, string? Address = null,
    double? Latitude = null, double? Longitude = null, IReadOnlyList<Guid>? Services = null,
    IReadOnlyList<KycDocumentInput>? Documents = null, string? FullName = null, string? Phone = null,
    int? YearsExperience = null, string? TruckMake = null, string? TruckModel = null,
    string? TruckType = null, decimal? TruckCapacityTonnes = null, string? TruckPlate = null);
public sealed record UpdateProviderProfileRequest(int YearsExperience, IReadOnlyList<Guid>? Expertise = null,
    double? Latitude = null, double? Longitude = null, double CoverageRadiusKm = 10, string? CoverageArea = null,
    string? TruckMake = null, string? TruckModel = null, string? TruckPlate = null, string? TruckType = null,
    decimal? TruckCapacityTonnes = null, string? FullName = null, string? Phone = null, string? Email = null);
public sealed record UpdateProfileRequest(string FullName, string? Phone, string Language, string Theme, bool OtpOnLogin);

// ---- Center management ----
public sealed record WorkingHoursRequest(int DayOfWeek, bool IsClosed, TimeSpan OpenTime, TimeSpan CloseTime, bool IsSpecial = false);
public sealed record CenterServiceRequest(string Name, string? Description, long PriceMinor, int DurationMinutes, bool IsActive = true);
public sealed record CenterProfileRequest(string Name, string Address, string? Description, string Phone, double? Latitude, double? Longitude);
public sealed record NamedRequest(string Name);
public sealed record TechnicianRequest(string Name, string Phone);
public sealed record WorkOrderRequest(Guid? BayId, Guid? TechnicianId, string? Notes);
public sealed record WorkOrderNotesRequest(string? Notes, bool SupervisorReviewed = false);
public sealed record CompleteBookingRequest(string? ExtraDescription = null, long ExtraMinor = 0, string? Notes = null);

// ---- Payments admin / support ----
public sealed record PaymentReviewDto(Guid Id, Guid RequestId, long CustomerConfirmedMinor, long ProviderCollectedMinor,
    long RecordedMinor, long? AdjustedMinor, PaymentReviewStatus Status, string? Note, DateTime CreatedAt);
public sealed record SafetyReportDto(Guid Id, string Category, Guid ReporterId, Guid? ReportedUserId, Guid? RequestId,
    string Description, SafetyReportStatus Status, string? ReviewNote, DateTime CreatedAt);
public sealed record SupportMessageDto(Guid Id, bool FromSupport, string? AuthorName, string Text, DateTime CreatedAt);
public sealed record TicketDetailDto(TicketDto Ticket, IReadOnlyList<SupportMessageDto> Messages);
public sealed record SosDto(Guid Id, double Latitude, double Longitude, bool Resolved, DateTime CreatedAt, string? Note = null);
public sealed record WithdrawalProcessRequest(WithdrawalStatus Status, string? FailureReason = null);

// ---- Reviews / chat ----
public sealed record ReportReviewRequest(string Reason);
public sealed record LocationMessageRequest(double Latitude, double Longitude);
public sealed record ChatThreadStartRequest(Guid? RequestId = null, Guid? BookingId = null, Guid? CounterpartId = null);
