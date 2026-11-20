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
