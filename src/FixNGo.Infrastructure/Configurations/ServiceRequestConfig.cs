using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

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
