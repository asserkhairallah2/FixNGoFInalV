using FixNGo.Domain;

namespace FixNGo.Application.DTOs;

// ---- Vehicles ----
public sealed record VehicleRequest(string Make, string Model, int Year, string Plate, string Color, string Fuel, bool IsPrimary = false);
public sealed record VehicleDto(Guid Id, string Make, string Model, int Year, string Plate, string Color, string Fuel, bool IsPrimary);

// ---- Lookups ----
public sealed record LookupDto(Guid Id, string NameEn, string NameAr);
public sealed record FollowUpQuestionDto(Guid Id, string Key, string QuestionEn, string QuestionAr, string AnswerType, string? ChoicesJson, bool EscalatesToP0WhenYes);
public sealed record ServiceTypeDto(Guid Id, string Key, string NameEn, string NameAr, RequestKind Kind, IReadOnlyList<FollowUpQuestionDto> Questions);

// ---- Requests ----
public sealed record CreateRequestRequest(
    Guid? VehicleId, Guid ServiceTypeId, double PickupLatitude, double PickupLongitude,
    string PickupAddress, double? DestinationLatitude, double? DestinationLongitude,
    string? DestinationAddress, double DistanceKm, string? Problem, string? AnswersJson,
    string? Note, RequestPriority Priority = RequestPriority.Normal,
    IReadOnlyList<Guid>? PhotoFileIds = null);
public sealed record EstimateRequest(Guid ServiceTypeId, double DistanceKm);
public sealed record EstimateDto(long LowMinor, long HighMinor, long TotalMinor, int SettingsVersion);
public sealed record RequestDto(
    Guid Id, string Code, RequestKind Kind, RequestPriority Priority, RequestStatus Status,
    Guid CustomerId, Guid? VehicleId, double PickupLatitude, double PickupLongitude,
    string PickupAddress, double? DestinationLatitude, double? DestinationLongitude,
    double DistanceKm, long? EstimateMinor, long? QuoteMinor, PaymentMethodType? PaymentMethod,
    DateTime CreatedAt, int Step, string? CancellationReason,
    Guid? AssignedProviderId = null, string? ProviderName = null, string? ProviderPhone = null,
    decimal? ProviderRating = null, int? ProviderJobs = null, string? ProviderTruckMake = null,
    string? ProviderTruckPlate = null, string? CustomerName = null, string? CustomerPhone = null,
    string? VehicleMake = null, string? VehicleModel = null, int? VehicleYear = null,
    string? VehicleColor = null, string? VehiclePlate = null, string? DestinationAddress = null,
    string? Problem = null, string? Note = null, IReadOnlyList<Guid>? PhotoFileIds = null,
    DateTime? AcceptedAt = null, DateTime? CompletedAt = null);
public sealed record RequestEventDto(RequestStatus Status, string? Note, DateTime At);
public sealed record CancelRequestRequest(string ReasonKey, string? Note = null);
public sealed record StatusRequest(RequestStatus Status, string? Note = null);

// ---- Matching & offers ----
public sealed record CandidateDto(Guid ProviderId, string Name, decimal Rating, int RatingCount,
    double DistanceKm, int EtaMinutes, long PriceMinor, double Score, string? AreaLabel, string? TruckMake);
public sealed record SelectProviderRequest(Guid ProviderId);
public sealed record OfferDto(Guid Id, Guid RequestId, Guid ProviderId, OfferStatus Status,
    DateTime ExpiresAt, long PriceMinor, double DistanceKm, int EtaMinutes, bool IsP0,
    string? RequestCode = null, string? CustomerFirstName = null, string? PickupArea = null,
    string? DestinationAddress = null, string? VehicleMake = null, string? VehicleModel = null,
    int? VehicleYear = null, string? VehicleColor = null, string? Problem = null);
public sealed record DeclineOfferRequest(string? Reason = null);

// ---- Quotes ----
public sealed record CreateQuoteRequest(long CalloutMinor, long LaborMinor, long PartsMinor, string? Diagnosis);
public sealed record QuoteDto(Guid Id, Guid RequestId, int Version, QuoteStatus Status, long TotalMinor,
    long ProviderNetMinor, long CalloutMinor, long LaborMinor, long PartsMinor, long ServiceFeeMinor, string? Diagnosis);
public sealed record DisputeRequest(string Reason, string? ProposedResolution = null);
public sealed record DisputeDto(Guid Id, Guid RequestId, string Reason, string? ProposedResolution, bool Resolved);

// ---- Payments ----
public sealed record AddCardRequest(string Number, int ExpMonth, int ExpYear, string? Label, bool IsDefault = false);
public sealed record PaymentMethodDto(Guid Id, PaymentMethodType Type, string? Brand, string? Last4, int? ExpMonth, int? ExpYear, string? Label, bool IsDefault);
public sealed record PayRequest(PaymentMethodType Method, Guid? PaymentMethodId = null, string? CardToken = null, string? IdempotencyKey = null);
public sealed record PaymentDto(Guid Id, long AmountMinor, PaymentMethodType Method, PaymentStatus Status, string? FailureReason, DateTime? SettledAt);
public sealed record InvoiceDto(Guid Id, string Number, long SubtotalMinor, long ServiceFeeMinor, long TotalMinor,
    InvoiceStatus Status, PaymentMethodType? Method, string? LinesJson, DateTime IssuedAt, bool CustomerCashConfirmed);
public sealed record WalletDto(Guid Id, long BalanceMinor, IReadOnlyList<WalletEntryDto> Entries);
public sealed record WalletEntryDto(Guid Id, WalletEntryType Type, long AmountMinor, string Reference, DateTime At);
public sealed record AddBankAccountRequest(string HolderName, string BankCode, string Iban, bool IsDefault = true);
public sealed record BankAccountDto(Guid Id, string HolderName, string BankName, string IbanLast4, bool IsDefault, bool IsVerified);
public sealed record WithdrawRequest(long AmountMinor, string? IdempotencyKey = null);
public sealed record WithdrawalDto(Guid Id, string Code, long AmountMinor, long FeeMinor, long NetMinor, WithdrawalStatus Status, string? FailureReason);

// ---- Centers, bookings, work orders ----
public sealed record CenterDto(Guid Id, string Name, string Address, decimal Rating, int RatingCount,
    int RecommendPercent, double? Latitude, double? Longitude, string? Description, string? Phone = null);
public sealed record CenterServiceDto(Guid Id, string Name, long PriceMinor, int DurationMinutes, string? Description = null, bool IsActive = true);
public sealed record AvailabilityDto(DateTime SlotStart, DateTime SlotEnd, bool Available);
public sealed record CreateBookingRequest(Guid CenterId, Guid ServiceId, DateTime SlotStart, Guid? VehicleId, string? Note);
public sealed record BookingDto(Guid Id, string Code, Guid CenterId, Guid ServiceId, Guid CustomerId,
    DateTime SlotStart, DateTime SlotEnd, long PriceMinor, BookingStatus Status, string? Note,
    string? CenterName = null, string? ServiceName = null, int? DurationMinutes = null,
    string? CustomerName = null, string? CustomerPhone = null, string? VehicleLabel = null,
    string? ExtraDescription = null, long? ExtraMinor = null, long? BasePriceMinor = null);
public sealed record RescheduleRequest(DateTime SlotStart);
public sealed record CancelBookingRequest(string? Reason = null);
public sealed record WorkOrderDto(Guid Id, string Code, Guid BookingId, Guid CenterId, WorkOrderStatus Status, string? Notes,
    string? BookingCode = null, string? ServiceName = null, string? CustomerName = null, string? VehicleLabel = null,
    Guid? BayId = null, string? BayName = null, Guid? TechnicianId = null, string? TechnicianName = null,
    bool SupervisorReviewed = false, DateTime? StartedAt = null);

// ---- Providers / KYC ----
public sealed record MechanicApplicationRequest(string FullName, string Phone, int YearsExperience, IReadOnlyList<Guid> Expertise);
public sealed record CaptainApplicationRequest(string FullName, string Phone, string TruckMake, string TruckModel,
    string TruckType, decimal CapacityTonnes, string Plate);
public sealed record CenterApplicationRequest(string BusinessName, string Address, double? Latitude, double? Longitude,
    string Phone, IReadOnlyList<Guid> Services);
public sealed record KycDocumentDto(Guid Id, string DocumentType, Guid FileId, string Status, string? ReviewNote, DateTime CreatedAt);
public sealed record KycApplicationDto(Guid Id, string Code, KycStatus Status, string ApplicantType,
    string? BusinessName, string? ReviewerNote, DateTime SubmittedAt,
    Guid? UserId = null, string? FullName = null, string? Email = null, string? Phone = null,
    string? Address = null, IReadOnlyList<KycDocumentDto>? Documents = null);
public sealed record OnlineRequest(bool IsOnline, double? Latitude = null, double? Longitude = null);
public sealed record HeartbeatRequest(double? Latitude = null, double? Longitude = null);
public sealed record ProviderDto(Guid Id, string FullName, decimal Rating, int RatingCount, int CompletedJobs,
    bool IsOnline, double? Latitude, double? Longitude, string? AreaLabel,
    string? Email = null, string? Phone = null, KycStatus KycStatus = KycStatus.None,
    int YearsExperience = 0, double CoverageRadiusKm = 5, string? CoverageArea = null,
    string? TruckMake = null, string? TruckModel = null, string? TruckPlate = null,
    string? TruckType = null, decimal? TruckCapacityTonnes = null, string? ExpertiseJson = null);

// ---- Reviews, notifications, chat ----
public sealed record CreateReviewRequest(int Stars, string? Text, bool Recommend = true);
public sealed record ReviewDto(Guid Id, Guid? ProviderId, Guid? CenterId, int Stars, string? Text, bool Recommend, DateTime CreatedAt);
public sealed record NotificationDto(Guid Id, NotificationType Type, string Title, string Body, string? DeepLink, bool IsRead, DateTime CreatedAt);
public sealed record SendMessageRequest(string Text);
public sealed record ChatMessageDto(Guid Id, Guid ThreadId, Guid SenderId, string MessageType, string? Text, DateTime SentAt, DateTime? ReadAt);
public sealed record ChatThreadDto(Guid Id, Guid CustomerId, Guid CounterpartId, IReadOnlyList<ChatMessageDto> Messages);

// ---- Support / legal / safety ----
public sealed record CreateTicketRequest(string Category, string Subject, string Description, string? ReferenceType = null, Guid? ReferenceId = null);
public sealed record TicketDto(Guid Id, string Code, string Category, string Subject, TicketStatus Status, DateTime CreatedAt);
public sealed record TicketReplyRequest(string Text);
public sealed record SosRequest(double Latitude, double Longitude, string? Note = null);
public sealed record SafetyReportRequest(string Category, Guid? ReportedUserId, Guid? RequestId, string Description);
public sealed record DeletionRequest(string Password);
public sealed record PageDto<T>(IReadOnlyList<T> Items, int Page, int PageSize, int Total);
