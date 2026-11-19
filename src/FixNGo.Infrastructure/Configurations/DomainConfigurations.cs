using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class VehicleConfig : IEntityTypeConfiguration<Vehicle>
{
    public void Configure(EntityTypeBuilder<Vehicle> e)
    {
        e.ToTable("Vehicles"); e.HasKey(x => x.Id);
        e.HasOne(x => x.Owner).WithMany(x => x.Vehicles).HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Restrict);
        e.HasIndex(x => new { x.OwnerId, x.Plate }).IsUnique();
        e.Property(x => x.Plate).HasMaxLength(20).IsRequired();
    }
}

public sealed class ProviderProfileConfig : IEntityTypeConfiguration<ProviderProfile>
{
    public void Configure(EntityTypeBuilder<ProviderProfile> e)
    {
        e.ToTable("ProviderProfiles"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.UserId).IsUnique();
        e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class KycApplicationConfig : IEntityTypeConfiguration<KycApplication>
{
    public void Configure(EntityTypeBuilder<KycApplication> e)
    {
        e.ToTable("KycApplications"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.Code).IsUnique();
        e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        e.HasMany(x => x.Documents).WithOne(x => x.Application).HasForeignKey(x => x.ApplicationId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class KycDocumentConfig : IEntityTypeConfiguration<KycDocument>
{
    public void Configure(EntityTypeBuilder<KycDocument> e)
    {
        e.ToTable("KycDocuments"); e.HasKey(x => x.Id);
        e.HasOne(x => x.File).WithMany().HasForeignKey(x => x.FileId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ServiceCenterConfig : IEntityTypeConfiguration<ServiceCenter>
{
    public void Configure(EntityTypeBuilder<ServiceCenter> e)
    {
        e.ToTable("ServiceCenters"); e.HasKey(x => x.Id);
        e.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Restrict);
        e.Property(x => x.Name).HasMaxLength(160).IsRequired();
        e.HasMany(x => x.WorkingHours).WithOne(x => x.Center).HasForeignKey(x => x.CenterId).OnDelete(DeleteBehavior.Cascade);
        e.HasMany(x => x.Services).WithOne(x => x.Center).HasForeignKey(x => x.CenterId).OnDelete(DeleteBehavior.Cascade);
        e.HasMany(x => x.Bays).WithOne(x => x.Center).HasForeignKey(x => x.CenterId).OnDelete(DeleteBehavior.Cascade);
        e.HasMany(x => x.Technicians).WithOne(x => x.Center).HasForeignKey(x => x.CenterId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class WorkingHoursConfig : IEntityTypeConfiguration<WorkingHours>
{
    public void Configure(EntityTypeBuilder<WorkingHours> e) { e.ToTable("WorkingHours"); e.HasKey(x => x.Id); }
}

public sealed class CenterServiceConfig : IEntityTypeConfiguration<CenterService>
{
    public void Configure(EntityTypeBuilder<CenterService> e) { e.ToTable("CenterServices"); e.HasKey(x => x.Id); }
}

public sealed class BayConfig : IEntityTypeConfiguration<Bay>
{
    public void Configure(EntityTypeBuilder<Bay> e) { e.ToTable("Bays"); e.HasKey(x => x.Id); }
}

public sealed class TechnicianConfig : IEntityTypeConfiguration<Technician>
{
    public void Configure(EntityTypeBuilder<Technician> e) { e.ToTable("Technicians"); e.HasKey(x => x.Id); }
}

public sealed class ServiceRequestConfig : IEntityTypeConfiguration<ServiceRequest>
{
    public void Configure(EntityTypeBuilder<ServiceRequest> e)
    {
        e.ToTable("ServiceRequests"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.Code).IsUnique();
        e.HasIndex(x => new { x.Status, x.CreatedAt });
        e.Property(x => x.RowVersion).IsRowVersion().HasDefaultValue(new byte[8]);
        e.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne(x => x.Vehicle).WithMany().HasForeignKey(x => x.VehicleId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne(x => x.AssignedProvider).WithMany().HasForeignKey(x => x.AssignedProviderId).OnDelete(DeleteBehavior.Restrict);
        e.HasMany(x => x.Events).WithOne(x => x.Request).HasForeignKey(x => x.RequestId).OnDelete(DeleteBehavior.Cascade);
        e.HasMany(x => x.Photos).WithOne(x => x.Request).HasForeignKey(x => x.RequestId).OnDelete(DeleteBehavior.Cascade);
        e.HasMany(x => x.Offers).WithOne(x => x.Request).HasForeignKey(x => x.RequestId).OnDelete(DeleteBehavior.Cascade);
        e.HasMany(x => x.Quotes).WithOne(x => x.Request).HasForeignKey(x => x.RequestId).OnDelete(DeleteBehavior.Cascade);
        e.HasMany(x => x.Threads).WithOne(x => x.Request).HasForeignKey(x => x.RequestId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class RequestEventConfig : IEntityTypeConfiguration<RequestEvent>
{
    public void Configure(EntityTypeBuilder<RequestEvent> e) { e.ToTable("RequestEvents"); e.HasKey(x => x.Id); }
}

public sealed class RequestPhotoConfig : IEntityTypeConfiguration<RequestPhoto>
{
    public void Configure(EntityTypeBuilder<RequestPhoto> e)
    {
        e.ToTable("RequestPhotos"); e.HasKey(x => x.Id);
        e.HasOne(x => x.File).WithMany().HasForeignKey(x => x.FileId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class OfferConfig : IEntityTypeConfiguration<Offer>
{
    public void Configure(EntityTypeBuilder<Offer> e)
    {
        e.ToTable("Offers"); e.HasKey(x => x.Id);
        e.Property(x => x.RowVersion).IsRowVersion().HasDefaultValue(new byte[8]);
        e.HasOne(x => x.Provider).WithMany().HasForeignKey(x => x.ProviderId).OnDelete(DeleteBehavior.Restrict);
        e.HasIndex(x => new { x.RequestId, x.ProviderId }).IsUnique();
    }
}

public sealed class QuoteConfig : IEntityTypeConfiguration<Quote>
{
    public void Configure(EntityTypeBuilder<Quote> e)
    {
        e.ToTable("Quotes"); e.HasKey(x => x.Id);
        e.HasIndex(x => new { x.RequestId, x.Version }).IsUnique();
        e.HasMany(x => x.Lines).WithOne(x => x.Quote).HasForeignKey(x => x.QuoteId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class QuoteLineConfig : IEntityTypeConfiguration<QuoteLine>
{
    public void Configure(EntityTypeBuilder<QuoteLine> e) { e.ToTable("QuoteLines"); e.HasKey(x => x.Id); }
}

public sealed class DisputeConfig : IEntityTypeConfiguration<Dispute>
{
    public void Configure(EntityTypeBuilder<Dispute> e) { e.ToTable("Disputes"); e.HasKey(x => x.Id); }
}

public sealed class ChatThreadConfig : IEntityTypeConfiguration<ChatThread>
{
    public void Configure(EntityTypeBuilder<ChatThread> e)
    {
        e.ToTable("ChatThreads"); e.HasKey(x => x.Id);
        e.HasOne(x => x.Booking).WithMany().HasForeignKey(x => x.BookingId).OnDelete(DeleteBehavior.Restrict);
        e.HasMany(x => x.Messages).WithOne(x => x.Thread).HasForeignKey(x => x.ThreadId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ChatMessageConfig : IEntityTypeConfiguration<ChatMessage>
{
    public void Configure(EntityTypeBuilder<ChatMessage> e) { e.ToTable("ChatMessages"); e.HasKey(x => x.Id); }
}
