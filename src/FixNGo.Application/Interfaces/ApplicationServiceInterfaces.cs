using FixNGo.Application.DTOs;
using FixNGo.Application.Services;
using FixNGo.Domain;
using FixNGo.Domain.Entities;

namespace FixNGo.Application.Interfaces;

public sealed record SystemStatusDto(
    bool SetupComplete,
    string Mode,
    string Version,
    bool SimulatorsEnabled,
    int TotalUsers,
    string DatabaseProvider);

public interface ISystemStatusService
{
    Task<SystemStatusDto> GetStatusAsync(bool simulatorsEnabled, CancellationToken ct = default);
}

public interface ISettingsService
{
    Task<(PricingSettings Settings, int Version)> CurrentAsync(CancellationToken ct = default);
    Task<PricingSettings> ForRequestAsync(ServiceRequest request, CancellationToken ct = default);
}

public interface IAuthService
{
    Task<OtpResponse> SignupAsync(SignupRequest req, CancellationToken ct = default);
    Task<UserDto> VerifyOtpAsync(VerifyOtpRequest req, CancellationToken ct = default);
    Task<AuthResponse> VerifyOtpAndIssueSessionAsync(VerifyOtpRequest req, string? device, string? ip, CancellationToken ct = default);
    Task<OtpResponse> ResendOtpAsync(ResendOtpRequest req, CancellationToken ct = default);
    Task<UserDto?> GetMeAsync(Guid userId, CancellationToken ct = default);
    Task<UserDto> UpdateMeAsync(Guid userId, UpdateMeRequest req, CancellationToken ct = default);
    Task<IReadOnlyList<SessionDto>> MySessionsAsync(Guid userId, CancellationToken ct = default);
    Task RevokeMySessionAsync(Guid userId, Guid sessionId, CancellationToken ct = default);
    Task<int> RevokeOtherSessionsAsync(Guid userId, Guid? keepSessionId, CancellationToken ct = default);
    Task<TwoFactorSetupDto> SetupTwoFactorAsync(Guid userId, CancellationToken ct = default);
    Task<TwoFactorEnableDto> EnableTwoFactorAsync(Guid userId, TwoFactorVerifyRequest req, CancellationToken ct = default);
    Task DisableTwoFactorAsync(Guid userId, TwoFactorDisableRequest req, CancellationToken ct = default);
    Task<AuthResponse> LoginAsync(LoginRequest req, string? device, string? ip, CancellationToken ct = default);
    Task<AuthResponse> VerifyLoginOtpAsync(VerifyOtpRequest req, string? device, string? ip, CancellationToken ct = default);
    Task<AuthResponse> RefreshAsync(RefreshRequest req, CancellationToken ct = default);
    Task LogoutAsync(string refreshToken, CancellationToken ct = default);
    Task<OtpResponse> ForgotPasswordAsync(ForgotPasswordRequest req, CancellationToken ct = default);
    Task<string> ExchangeResetOtpAsync(VerifyOtpRequest req, CancellationToken ct = default);
    Task ResetPasswordAsync(ResetPasswordRequest req, CancellationToken ct = default);
    Task ChangePasswordAsync(Guid userId, ChangePasswordRequest req, CancellationToken ct = default);
}

public interface IVehicleService
{
    Task<IReadOnlyList<VehicleDto>> ListAsync(Guid ownerId, CancellationToken ct = default);
    Task<VehicleDto> GetAsync(Guid ownerId, Guid id, CancellationToken ct = default);
    Task<VehicleDto> CreateAsync(Guid ownerId, VehicleRequest req, CancellationToken ct = default);
    Task<VehicleDto> UpdateAsync(Guid ownerId, Guid id, VehicleRequest req, CancellationToken ct = default);
    Task DeleteAsync(Guid ownerId, Guid id, CancellationToken ct = default);
    Task<VehicleDto> SetPrimaryAsync(Guid ownerId, Guid id, CancellationToken ct = default);
}

public interface ILookupService
{
    Task<LookupsDto> BootstrapAsync(CancellationToken ct = default);
}

public interface IRequestService
{
    Task<EstimateDto> EstimateAsync(EstimateRequest req, CancellationToken ct = default);
    Task<RequestDto> CreateAsync(Guid customerId, CreateRequestRequest req, CancellationToken ct = default);
    Task<RequestDto> AddPhotoAsync(Guid callerId, bool isAdmin, Guid id, Guid fileId, CancellationToken ct = default);
    Task<RequestDto> ExpandRadiusAsync(Guid callerId, bool isAdmin, Guid id, CancellationToken ct = default);
    Task<RequestDto> GetAsync(Guid callerId, bool isAdmin, Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<RequestDto>> ListAsync(Guid callerId, bool isAdmin, CancellationToken ct = default);
    Task<IReadOnlyList<RequestEventDto>> TimelineAsync(Guid callerId, bool isAdmin, Guid id, CancellationToken ct = default);
    Task<RequestDto> CancelAsync(Guid callerId, bool isAdmin, Guid id, CancelRequestRequest req, CancellationToken ct = default);
    Task<RequestDto> AdvanceAsync(Guid providerId, Guid id, StatusRequest req, CancellationToken ct = default);
}

public interface IOfferService
{
    Task<IReadOnlyList<CandidateDto>> CandidatesAsync(Guid callerId, bool isAdmin, Guid requestId, string sort = "recommended", CancellationToken ct = default);
    Task<OfferDto> SendAsync(Guid customerId, Guid requestId, SelectProviderRequest req, CancellationToken ct = default);
    Task<OfferDto> AcceptAsync(Guid providerId, Guid offerId, CancellationToken ct = default);
    Task<OfferDto> DeclineAsync(Guid providerId, Guid offerId, DeclineOfferRequest req, CancellationToken ct = default);
    Task<IReadOnlyList<OfferDto>> ForProviderAsync(Guid providerId, CancellationToken ct = default);
    Task<IReadOnlyList<OfferDto>> ForRequestAsync(Guid callerId, bool isAdmin, Guid requestId, CancellationToken ct = default);
}

public interface IQuoteService
{
    Task<QuoteDto> CreateAsync(Guid providerId, Guid requestId, CreateQuoteRequest req, CancellationToken ct = default);
    Task<IReadOnlyList<QuoteDto>> ForRequestAsync(Guid callerId, bool isAdmin, Guid requestId, CancellationToken ct = default);
    Task<QuoteDto> ApproveAsync(Guid customerId, Guid requestId, Guid quoteId, CancellationToken ct = default);
    Task<DisputeDto> DisputeAsync(Guid customerId, Guid requestId, DisputeRequest req, CancellationToken ct = default);
}

public interface IPaymentService
{
    Task<IReadOnlyList<PaymentMethodDto>> MethodsAsync(Guid userId, CancellationToken ct = default);
    Task<PaymentMethodDto> AddCardAsync(Guid userId, AddCardRequest req, CancellationToken ct = default);
    Task<PaymentMethodDto> AddApplePayAsync(Guid userId, string? label, CancellationToken ct = default);
    Task RemoveMethodAsync(Guid userId, Guid id, CancellationToken ct = default);
    Task<PaymentMethodDto> SetDefaultAsync(Guid userId, Guid id, CancellationToken ct = default);
    Task<InvoiceDto> InvoiceForRequestAsync(Guid callerId, bool isAdmin, Guid requestId, CancellationToken ct = default);
    Task<IReadOnlyList<InvoiceDto>> InvoicesAsync(Guid userId, CancellationToken ct = default);
    Task<InvoiceDto> EnsureInvoiceAsync(Guid requestId, CancellationToken ct = default);
    Task<PaymentDto> PayAsync(Guid userId, Guid invoiceId, PayRequest req, CancellationToken ct = default);
    Task<InvoiceDto> ConfirmCashAsync(Guid customerId, Guid invoiceId, CancellationToken ct = default);
    Task<WalletDto> WalletAsync(Guid userId, CancellationToken ct = default);
    Task<EarningsDto> EarningsAsync(Guid userId, CancellationToken ct = default);
    Task<IReadOnlyList<BankAccountDto>> BankAccountsAsync(Guid userId, CancellationToken ct = default);
    Task<BankAccountDto> AddBankAccountAsync(Guid userId, AddBankAccountRequest req, CancellationToken ct = default);
    Task<WithdrawalDto> WithdrawAsync(Guid userId, WithdrawRequest req, CancellationToken ct = default);
    Task<IReadOnlyList<WithdrawalDto>> WithdrawalsAsync(Guid userId, CancellationToken ct = default);
}

public interface ICenterService
{
    Task<IReadOnlyList<CenterDto>> CatalogAsync(CancellationToken ct = default);
    Task<CenterDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<ServiceCenter> OwnedAsync(Guid ownerId, CancellationToken ct = default);
    Task<CenterDto> UpdateProfileAsync(Guid ownerId, CenterProfileRequest req, CancellationToken ct = default);
    Task<IReadOnlyList<CenterServiceDto>> ServicesAsync(Guid centerId, CancellationToken ct = default);
    Task<IReadOnlyList<CenterServiceDto>> AllServicesAsync(Guid centerId, CancellationToken ct = default);
    Task<CenterServiceDto> AddServiceAsync(Guid ownerId, CenterServiceRequest req, CancellationToken ct = default);
    Task<CenterServiceDto> UpdateServiceAsync(Guid ownerId, Guid serviceId, CenterServiceRequest req, CancellationToken ct = default);
    Task RemoveServiceAsync(Guid ownerId, Guid serviceId, CancellationToken ct = default);
    Task<IReadOnlyList<object>> WorkingHoursAsync(Guid centerId, CancellationToken ct = default);
    Task SetWorkingHoursAsync(Guid ownerId, IReadOnlyList<WorkingHoursRequest> items, CancellationToken ct = default);
    Task<IReadOnlyList<object>> BaysAsync(Guid centerId, CancellationToken ct = default);
    Task<object> AddBayAsync(Guid ownerId, NamedRequest req, CancellationToken ct = default);
    Task<IReadOnlyList<object>> TechniciansAsync(Guid centerId, CancellationToken ct = default);
    Task<object> AddTechnicianAsync(Guid ownerId, TechnicianRequest req, CancellationToken ct = default);
    Task<IReadOnlyList<AvailabilityDto>> AvailabilityAsync(Guid centerId, Guid serviceId, DateTime day, CancellationToken ct = default);
    Task<BookingDto> CreateBookingAsync(Guid customerId, CreateBookingRequest req, CancellationToken ct = default);
    Task<IReadOnlyList<BookingDto>> BookingsAsync(Guid callerId, bool isAdmin, CancellationToken ct = default);
    Task<BookingDto> GetBookingAsync(Guid callerId, bool isAdmin, Guid id, CancellationToken ct = default);
    Task<BookingDto> DecideBookingAsync(Guid ownerId, Guid id, bool confirm, string? reason, CancellationToken ct = default);
    Task<BookingDto> StartBookingAsync(Guid ownerId, Guid id, CancellationToken ct = default);
    Task<BookingDto> CompleteBookingAsync(Guid ownerId, Guid id, CompleteBookingRequest? req = null, CancellationToken ct = default);
    Task<BookingDto> CancelBookingAsync(Guid callerId, bool isAdmin, Guid id, CancelBookingRequest req, CancellationToken ct = default);
    Task<BookingDto> RescheduleAsync(Guid callerId, Guid id, RescheduleRequest req, CancellationToken ct = default);
    Task<IReadOnlyList<WorkOrderDto>> WorkOrdersAsync(Guid callerId, bool isAdmin, Guid? bookingId, CancellationToken ct = default);
    Task<WorkOrderDto> AdvanceWorkOrderAsync(Guid ownerId, Guid id, WorkOrderNotesRequest req, CancellationToken ct = default);
    Task<WorkOrderDto> AssignWorkOrderAsync(Guid ownerId, Guid id, WorkOrderRequest req, CancellationToken ct = default);
    Task<object> ReportsAsync(Guid ownerId, CancellationToken ct = default);
}

public interface IProviderService
{
    Task<ProviderDto> ProfileAsync(Guid userId, CancellationToken ct = default);
    Task<ProviderDto> UpdateProfileAsync(Guid userId, UpdateProviderProfileRequest req, CancellationToken ct = default);
    Task<ProviderDto> SetOnlineAsync(Guid userId, OnlineRequest req, CancellationToken ct = default);
    Task HeartbeatAsync(Guid userId, HeartbeatRequest req, CancellationToken ct = default);
    Task<KycApplicationDto> SubmitKycAsync(Guid userId, SubmitKycRequest req, CancellationToken ct = default);
    Task<KycApplicationDto> UploadDocumentAsync(Guid userId, KycDocumentInput doc, CancellationToken ct = default);
    Task<KycApplicationDto> MyKycAsync(Guid userId, CancellationToken ct = default);
    Task<KycApplicationDto?> KycByIdAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<KycApplicationDto>> KycQueueAsync(CancellationToken ct = default);
    Task<KycApplicationDto> ReviewKycAsync(Guid adminId, Guid appId, ReviewKycRequest req, CancellationToken ct = default);
    Task<object> DocumentsAsync(Guid appId, CancellationToken ct = default);
    Task<IReadOnlyList<ProviderDto>> NearbyAsync(double lat, double lng, string role, CancellationToken ct = default);
}

public interface INotificationService
{
    Task<IReadOnlyList<NotificationDto>> ListAsync(Guid userId, bool unreadOnly = false, CancellationToken ct = default);
    Task<int> UnreadCountAsync(Guid userId, CancellationToken ct = default);
    Task MarkReadAsync(Guid userId, MarkReadRequest req, CancellationToken ct = default);
    Task MarkAllReadAsync(Guid userId, CancellationToken ct = default);
    Task<NotificationPreferencesDto> PreferencesAsync(Guid userId, CancellationToken ct = default);
    Task<NotificationPreferencesDto> UpdatePreferencesAsync(Guid userId, UpdateNotificationPreferencesRequest req, CancellationToken ct = default);
    Task AddDeviceTokenAsync(Guid userId, DeviceTokenRequest req, CancellationToken ct = default);
    Task RemoveDeviceTokenAsync(Guid userId, string token, CancellationToken ct = default);
}

public interface IReviewService
{
    Task<ReviewDto> CreateAsync(Guid authorId, ReviewTargetType target, Guid targetId, Guid? requestId, Guid? bookingId, CreateReviewRequest req, CancellationToken ct = default);
    Task<IReadOnlyList<ReviewDto>> ForProviderAsync(Guid providerId, CancellationToken ct = default);
    Task<IReadOnlyList<ReviewDto>> ForCenterAsync(Guid centerId, CancellationToken ct = default);
    Task ReportAsync(Guid reviewId, ReportReviewRequest req, CancellationToken ct = default);
    Task ModerateAsync(Guid reviewId, bool hide, CancellationToken ct = default);
}

public interface IChatService
{
    Task<IReadOnlyList<ChatThreadDto>> ThreadsAsync(Guid userId, CancellationToken ct = default);
    Task<ChatThreadDto> ThreadAsync(Guid userId, Guid threadId, CancellationToken ct = default);
    Task<ChatThreadDto> StartAsync(Guid userId, ChatThreadStartRequest req, CancellationToken ct = default);
    Task<ChatMessageDto> SendAsync(Guid userId, Guid threadId, SendMessageRequest req, CancellationToken ct = default);
    Task<ChatMessageDto> SendLocationAsync(Guid userId, Guid threadId, LocationMessageRequest req, CancellationToken ct = default);
    Task MarkReadAsync(Guid userId, Guid threadId, CancellationToken ct = default);
}

public interface ISupportService
{
    Task<SupportTicketView> CreateTicketAsync(Guid userId, CreateTicketRequest req, CancellationToken ct = default);
    Task<IReadOnlyList<SupportTicketView>> TicketsAsync(Guid userId, CancellationToken ct = default);
    Task<SupportTicketDetail> TicketAsync(Guid userId, bool isAdmin, Guid id, CancellationToken ct = default);
    Task<SupportThreadMessage> ReplyAsync(Guid userId, Guid id, TicketReplyRequest req, CancellationToken ct = default);
    Task<SupportThreadMessage> SupportReplyAsync(Guid adminId, Guid id, TicketReplyRequest req, CancellationToken ct = default);
    Task<IReadOnlyList<SupportTicketView>> AllTicketsAsync(CancellationToken ct = default);
    Task CloseTicketAsync(Guid adminId, Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<FaqDto>> FaqsAsync(CancellationToken ct = default);
    Task<LegalDto> LegalAsync(string key, CancellationToken ct = default);
    Task<SosDto> SosAsync(Guid userId, SosRequest req, CancellationToken ct = default);
    Task<IReadOnlyList<SosDto>> MySosAsync(Guid userId, CancellationToken ct = default);
    Task<SafetyReportDto> ReportAsync(Guid userId, SafetyReportRequest req, CancellationToken ct = default);
    Task<IReadOnlyList<SafetyReportDto>> MyReportsAsync(Guid userId, CancellationToken ct = default);
    Task<IReadOnlyList<SafetyReportDto>> AllReportsAsync(CancellationToken ct = default);
    Task<SafetyReportDto> ResolveReportAsync(Guid adminId, Guid id, ResolveSafetyRequest req, CancellationToken ct = default);
    Task<object> RequestDeletionAsync(Guid userId, DeletionRequest req, IPasswordHasher hasher, CancellationToken ct = default);
    Task CancelDeletionAsync(Guid userId, CancellationToken ct = default);
}

public interface IAdminService
{
    Task<DashboardDto> DashboardAsync(CancellationToken ct = default);
    Task<IReadOnlyList<AdminUserDto>> UsersAsync(CancellationToken ct = default);
    Task<AdminUserDto> SuspendAsync(Guid adminId, Guid userId, SuspendRequest req, CancellationToken ct = default);
    Task<AdminUserDto> RestoreAsync(Guid adminId, Guid userId, CancellationToken ct = default);
    Task<SettingsDto> SettingsAsync(CancellationToken ct = default);
    Task<SettingsDto> UpdateSettingsAsync(Guid adminId, UpdateSettingsRequest req, CancellationToken ct = default);
    Task<IReadOnlyList<PaymentReviewDto>> PaymentReviewsAsync(CancellationToken ct = default);
    Task<PaymentReviewDto> ResolvePaymentReviewAsync(Guid adminId, Guid id, ResolvePaymentReviewRequest req, CancellationToken ct = default);
    Task<IReadOnlyList<WithdrawalDto>> WithdrawalsAsync(CancellationToken ct = default);
    Task<WithdrawalDto> ProcessWithdrawalAsync(Guid adminId, Guid id, WithdrawalProcessRequest req, CancellationToken ct = default);
    Task<IReadOnlyList<SosDto>> EmergenciesAsync(bool openOnly = false, CancellationToken ct = default);
    Task ResolveEmergencyAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<SessionDto>> SessionsAsync(Guid userId, CancellationToken ct = default);
    Task RevokeSessionAsync(Guid adminId, Guid sessionId, CancellationToken ct = default);
    Task<IReadOnlyList<AuditLogDto>> AuditAsync(CancellationToken ct = default);
    Task<object> ReportsAsync(CancellationToken ct = default);
}

public interface IFileAccessService
{
    Task<bool> CanReadAsync(Guid callerId, bool isAdmin, Guid fileId, CancellationToken ct = default);
    Task<FileDto> AssignOwnerAsync(Guid fileId, Guid ownerId, CancellationToken ct = default);
    Task<FileDto?> GetMetadataAsync(Guid fileId, CancellationToken ct = default);
}
