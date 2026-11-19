using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class BookingConfig : IEntityTypeConfiguration<Booking>
{
    public void Configure(EntityTypeBuilder<Booking> e)
    {
        e.ToTable("Bookings"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.Code).IsUnique();
        e.Property(x => x.RowVersion).IsRowVersion().HasDefaultValue(new byte[8]);
        e.HasOne(x => x.Center).WithMany().HasForeignKey(x => x.CenterId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne(x => x.Service).WithMany().HasForeignKey(x => x.ServiceId).OnDelete(DeleteBehavior.Restrict);
        e.HasMany(x => x.WorkOrders).WithOne(x => x.Booking).HasForeignKey(x => x.BookingId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class WorkOrderConfig : IEntityTypeConfiguration<WorkOrder>
{
    public void Configure(EntityTypeBuilder<WorkOrder> e)
    {
        e.ToTable("WorkOrders"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.Code).IsUnique();
        e.HasOne(x => x.Bay).WithMany().HasForeignKey(x => x.BayId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne(x => x.Technician).WithMany().HasForeignKey(x => x.TechnicianId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ReviewConfig : IEntityTypeConfiguration<Review>
{
    public void Configure(EntityTypeBuilder<Review> e)
    {
        e.ToTable("Reviews"); e.HasKey(x => x.Id);
        e.HasIndex(x => new { x.RequestId, x.AuthorId }).IsUnique().HasFilter("[RequestId] IS NOT NULL");
    }
}

public sealed class NotificationConfig : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> e)
    {
        e.ToTable("Notifications"); e.HasKey(x => x.Id);
        e.HasOne(x => x.User).WithMany(x => x.Notifications).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class SupportTicketConfig : IEntityTypeConfiguration<SupportTicket>
{
    public void Configure(EntityTypeBuilder<SupportTicket> e)
    {
        e.ToTable("SupportTickets"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.Code).IsUnique();
        e.HasMany(x => x.Messages).WithOne(x => x.Ticket).HasForeignKey(x => x.TicketId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class SupportMessageConfig : IEntityTypeConfiguration<SupportMessage>
{
    public void Configure(EntityTypeBuilder<SupportMessage> e) { e.ToTable("SupportMessages"); e.HasKey(x => x.Id); }
}

public sealed class FaqConfig : IEntityTypeConfiguration<Faq>
{
    public void Configure(EntityTypeBuilder<Faq> e) { e.ToTable("Faqs"); e.HasKey(x => x.Id); }
}

public sealed class LegalDocumentConfig : IEntityTypeConfiguration<LegalDocument>
{
    public void Configure(EntityTypeBuilder<LegalDocument> e)
    {
        e.ToTable("LegalDocuments"); e.HasKey(x => x.Id);
        e.HasIndex(x => new { x.Key, x.Version }).IsUnique();
    }
}

public sealed class SafetyReportConfig : IEntityTypeConfiguration<SafetyReport>
{
    public void Configure(EntityTypeBuilder<SafetyReport> e)
    {
        e.ToTable("SafetyReports"); e.HasKey(x => x.Id);
        e.HasMany(x => x.Attachments).WithMany().UsingEntity("SafetyReportAttachments");
    }
}

public sealed class EmergencyEventConfig : IEntityTypeConfiguration<EmergencyEvent>
{
    public void Configure(EntityTypeBuilder<EmergencyEvent> e) { e.ToTable("EmergencyEvents"); e.HasKey(x => x.Id); }
}

public sealed class AuditLogConfig : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> e) { e.ToTable("AuditLogs"); e.HasKey(x => x.Id); }
}

public sealed class PlatformSettingsVersionConfig : IEntityTypeConfiguration<PlatformSettingsVersion>
{
    public void Configure(EntityTypeBuilder<PlatformSettingsVersion> e)
    {
        e.ToTable("PlatformSettingsVersions"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.Version).IsUnique();
    }
}

public sealed class SequenceConfig : IEntityTypeConfiguration<Sequence>
{
    public void Configure(EntityTypeBuilder<Sequence> e)
    {
        e.ToTable("Sequences"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.Prefix).IsUnique();
    }
}

public sealed class UploadedFileConfig : IEntityTypeConfiguration<UploadedFile>
{
    public void Configure(EntityTypeBuilder<UploadedFile> e)
    {
        e.ToTable("UploadedFiles"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.StoredName).IsUnique();
    }
}

public sealed class SimMessageConfig : IEntityTypeConfiguration<SimMessage>
{
    public void Configure(EntityTypeBuilder<SimMessage> e) { e.ToTable("SimMessages"); e.HasKey(x => x.Id); }
}

public sealed class SimPaymentTransactionConfig : IEntityTypeConfiguration<SimPaymentTransaction>
{
    public void Configure(EntityTypeBuilder<SimPaymentTransaction> e)
    {
        e.ToTable("SimPaymentTransactions"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.Reference).IsUnique();
    }
}

public sealed class SimPushConfig : IEntityTypeConfiguration<SimPush>
{
    public void Configure(EntityTypeBuilder<SimPush> e) { e.ToTable("SimPushes"); e.HasKey(x => x.Id); }
}

public sealed class ServiceTypeConfig : IEntityTypeConfiguration<ServiceType>
{
    public void Configure(EntityTypeBuilder<ServiceType> e)
    {
        e.ToTable("ServiceTypes"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.Key).IsUnique();
        e.HasMany(x => x.Questions).WithOne(x => x.ServiceType).HasForeignKey(x => x.ServiceTypeId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class FollowUpQuestionConfig : IEntityTypeConfiguration<FollowUpQuestion>
{
    public void Configure(EntityTypeBuilder<FollowUpQuestion> e) { e.ToTable("FollowUpQuestions"); e.HasKey(x => x.Id); }
}

public sealed class ProblemTypeConfig : IEntityTypeConfiguration<ProblemType>
{
    public void Configure(EntityTypeBuilder<ProblemType> e)
    {
        e.ToTable("ProblemTypes"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.Key).IsUnique();
    }
}

public sealed class CancellationReasonConfig : IEntityTypeConfiguration<CancellationReason>
{
    public void Configure(EntityTypeBuilder<CancellationReason> e)
    {
        e.ToTable("CancellationReasons"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.Key).IsUnique();
    }
}

public sealed class RejectReasonConfig : IEntityTypeConfiguration<RejectReason>
{
    public void Configure(EntityTypeBuilder<RejectReason> e)
    {
        e.ToTable("RejectReasons"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.Key).IsUnique();
    }
}

public sealed class BankConfig : IEntityTypeConfiguration<Bank>
{
    public void Configure(EntityTypeBuilder<Bank> e)
    {
        e.ToTable("Banks"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.Code).IsUnique();
    }
}

public sealed class VehicleMakeConfig : IEntityTypeConfiguration<VehicleMake>
{
    public void Configure(EntityTypeBuilder<VehicleMake> e)
    {
        e.ToTable("VehicleMakes"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.Name).IsUnique();
        e.HasMany(x => x.Models).WithOne(x => x.Make).HasForeignKey(x => x.MakeId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class VehicleModelConfig : IEntityTypeConfiguration<VehicleModel>
{
    public void Configure(EntityTypeBuilder<VehicleModel> e) { e.ToTable("VehicleModels"); e.HasKey(x => x.Id); }
}

public sealed class ChecklistTemplateConfig : IEntityTypeConfiguration<ChecklistTemplate>
{
    public void Configure(EntityTypeBuilder<ChecklistTemplate> e) { e.ToTable("ChecklistTemplates"); e.HasKey(x => x.Id); }
}
