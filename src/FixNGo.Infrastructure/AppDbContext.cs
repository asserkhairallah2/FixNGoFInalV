using FixNGo.Application.Interfaces;
using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Infrastructure;

/// <summary>EF Core context for SQLite. Configurations are applied via IEntityTypeConfiguration assemblies.</summary>
public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options), IAppDbContext
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<OtpCode> OtpCodes => Set<OtpCode>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<NotificationPreference> NotificationPreferences => Set<NotificationPreference>();
    public DbSet<DeviceToken> DeviceTokens => Set<DeviceToken>();
    public DbSet<AccountDeletionRequest> AccountDeletionRequests => Set<AccountDeletionRequest>();
    public DbSet<Vehicle> Vehicles => Set<Vehicle>();
    public DbSet<ProviderProfile> ProviderProfiles => Set<ProviderProfile>();
    public DbSet<KycApplication> KycApplications => Set<KycApplication>();
    public DbSet<KycDocument> KycDocuments => Set<KycDocument>();
    public DbSet<ServiceCenter> ServiceCenters => Set<ServiceCenter>();
    public DbSet<WorkingHours> WorkingHours => Set<WorkingHours>();
    public DbSet<CenterService> CenterServices => Set<CenterService>();
    public DbSet<Bay> Bays => Set<Bay>();
    public DbSet<Technician> Technicians => Set<Technician>();
    public DbSet<ServiceRequest> ServiceRequests => Set<ServiceRequest>();
    public DbSet<RequestEvent> RequestEvents => Set<RequestEvent>();
    public DbSet<RequestPhoto> RequestPhotos => Set<RequestPhoto>();
    public DbSet<Offer> Offers => Set<Offer>();
    public DbSet<Quote> Quotes => Set<Quote>();
    public DbSet<QuoteLine> QuoteLines => Set<QuoteLine>();
    public DbSet<Dispute> Disputes => Set<Dispute>();
    public DbSet<ChatThread> ChatThreads => Set<ChatThread>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
    public DbSet<PaymentMethod> PaymentMethods => Set<PaymentMethod>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<PaymentReview> PaymentReviews => Set<PaymentReview>();
    public DbSet<Wallet> Wallets => Set<Wallet>();
    public DbSet<WalletEntry> WalletEntries => Set<WalletEntry>();
    public DbSet<BankAccount> BankAccounts => Set<BankAccount>();
    public DbSet<Withdrawal> Withdrawals => Set<Withdrawal>();
    public DbSet<WithdrawalEvent> WithdrawalEvents => Set<WithdrawalEvent>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<WorkOrder> WorkOrders => Set<WorkOrder>();
    public DbSet<Review> Reviews => Set<Review>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<SupportTicket> SupportTickets => Set<SupportTicket>();
    public DbSet<SupportMessage> SupportMessages => Set<SupportMessage>();
    public DbSet<Faq> Faqs => Set<Faq>();
    public DbSet<LegalDocument> LegalDocuments => Set<LegalDocument>();
    public DbSet<SafetyReport> SafetyReports => Set<SafetyReport>();
    public DbSet<EmergencyEvent> EmergencyEvents => Set<EmergencyEvent>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<PlatformSettingsVersion> PlatformSettingsVersions => Set<PlatformSettingsVersion>();
    public DbSet<Sequence> Sequences => Set<Sequence>();
    public DbSet<UploadedFile> UploadedFiles => Set<UploadedFile>();
    public DbSet<SimMessage> SimMessages => Set<SimMessage>();
    public DbSet<SimPaymentTransaction> SimPaymentTransactions => Set<SimPaymentTransaction>();
    public DbSet<SimPush> SimPushes => Set<SimPush>();
    public DbSet<ServiceType> ServiceTypes => Set<ServiceType>();
    public DbSet<FollowUpQuestion> FollowUpQuestions => Set<FollowUpQuestion>();
    public DbSet<ProblemType> ProblemTypes => Set<ProblemType>();
    public DbSet<CancellationReason> CancellationReasons => Set<CancellationReason>();
    public DbSet<RejectReason> RejectReasons => Set<RejectReason>();
    public DbSet<Bank> Banks => Set<Bank>();
    public DbSet<VehicleMake> VehicleMakes => Set<VehicleMake>();
    public DbSet<VehicleModel> VehicleModels => Set<VehicleModel>();
    public DbSet<ChecklistTemplate> ChecklistTemplates => Set<ChecklistTemplate>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);

        // Enums are stored as strings (03 §3).
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                var clrType = Nullable.GetUnderlyingType(property.ClrType) ?? property.ClrType;
                if (clrType.IsEnum)
                {
                    var converterType = typeof(Microsoft.EntityFrameworkCore.Storage.ValueConversion.EnumToStringConverter<>).MakeGenericType(clrType);
                    property.SetValueConverter((Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter)Activator.CreateInstance(converterType)!);
                }
                if (property.ClrType == typeof(DateTime))
                    property.SetValueConverter(UtcDateConverter);
                else if (property.ClrType == typeof(DateTime?))
                    property.SetValueConverter(UtcNullableDateConverter);
            }
        }

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }

    private static readonly Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTime, DateTime> UtcDateConverter =
        new(v => v.Kind == DateTimeKind.Utc ? v : DateTime.SpecifyKind(v, DateTimeKind.Utc),
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

    private static readonly Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTime?, DateTime?> UtcNullableDateConverter =
        new(v => v.HasValue ? (v.Value.Kind == DateTimeKind.Utc ? v : DateTime.SpecifyKind(v.Value, DateTimeKind.Utc)) : v,
            v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);
}
