using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace FixNGo.Application.Interfaces;

/// <summary>Abstraction over EF Core context so application services can be tested without a real database.</summary>
public interface IAppDbContext
{
    DbSet<User> Users { get; }
    DbSet<Session> Sessions { get; }
    DbSet<OtpCode> OtpCodes { get; }
    DbSet<PasswordResetToken> PasswordResetTokens { get; }
    DbSet<NotificationPreference> NotificationPreferences { get; }
    DbSet<DeviceToken> DeviceTokens { get; }
    DbSet<AccountDeletionRequest> AccountDeletionRequests { get; }
    DbSet<Vehicle> Vehicles { get; }
    DbSet<ProviderProfile> ProviderProfiles { get; }
    DbSet<KycApplication> KycApplications { get; }
    DbSet<KycDocument> KycDocuments { get; }
    DbSet<ServiceCenter> ServiceCenters { get; }
    DbSet<WorkingHours> WorkingHours { get; }
    DbSet<CenterService> CenterServices { get; }
    DbSet<Bay> Bays { get; }
    DbSet<Technician> Technicians { get; }
    DbSet<ServiceRequest> ServiceRequests { get; }
    DbSet<RequestEvent> RequestEvents { get; }
    DbSet<RequestPhoto> RequestPhotos { get; }
    DbSet<Offer> Offers { get; }
    DbSet<Quote> Quotes { get; }
    DbSet<QuoteLine> QuoteLines { get; }
    DbSet<Dispute> Disputes { get; }
    DbSet<ChatThread> ChatThreads { get; }
    DbSet<ChatMessage> ChatMessages { get; }
    DbSet<PaymentMethod> PaymentMethods { get; }
    DbSet<Payment> Payments { get; }
    DbSet<Invoice> Invoices { get; }
    DbSet<PaymentReview> PaymentReviews { get; }
    DbSet<Wallet> Wallets { get; }
    DbSet<WalletEntry> WalletEntries { get; }
    DbSet<BankAccount> BankAccounts { get; }
    DbSet<Withdrawal> Withdrawals { get; }
    DbSet<WithdrawalEvent> WithdrawalEvents { get; }
    DbSet<Booking> Bookings { get; }
    DbSet<WorkOrder> WorkOrders { get; }
    DbSet<Review> Reviews { get; }
    DbSet<Notification> Notifications { get; }
    DbSet<SupportTicket> SupportTickets { get; }
    DbSet<SupportMessage> SupportMessages { get; }
    DbSet<Faq> Faqs { get; }
    DbSet<LegalDocument> LegalDocuments { get; }
    DbSet<SafetyReport> SafetyReports { get; }
    DbSet<EmergencyEvent> EmergencyEvents { get; }
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<PlatformSettingsVersion> PlatformSettingsVersions { get; }
    DbSet<Sequence> Sequences { get; }
    DbSet<UploadedFile> UploadedFiles { get; }
    DbSet<SimMessage> SimMessages { get; }
    DbSet<SimPaymentTransaction> SimPaymentTransactions { get; }
    DbSet<SimPush> SimPushes { get; }
    DbSet<ServiceType> ServiceTypes { get; }
    DbSet<FollowUpQuestion> FollowUpQuestions { get; }
    DbSet<ProblemType> ProblemTypes { get; }
    DbSet<CancellationReason> CancellationReasons { get; }
    DbSet<RejectReason> RejectReasons { get; }
    DbSet<Bank> Banks { get; }
    DbSet<VehicleMake> VehicleMakes { get; }
    DbSet<VehicleModel> VehicleModels { get; }
    DbSet<ChecklistTemplate> ChecklistTemplates { get; }

    DatabaseFacade Database { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
