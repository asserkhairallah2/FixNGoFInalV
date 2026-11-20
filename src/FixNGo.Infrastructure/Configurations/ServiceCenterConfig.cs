using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

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
