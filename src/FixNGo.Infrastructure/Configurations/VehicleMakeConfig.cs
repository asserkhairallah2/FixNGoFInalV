using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class VehicleMakeConfig : IEntityTypeConfiguration<VehicleMake>
{
    public void Configure(EntityTypeBuilder<VehicleMake> e)
    {
        e.ToTable("VehicleMakes"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.Name).IsUnique();
        e.HasMany(x => x.Models).WithOne(x => x.Make).HasForeignKey(x => x.MakeId).OnDelete(DeleteBehavior.Cascade);
    }
}
