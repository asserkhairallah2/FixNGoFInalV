using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class ServiceTypeConfig : IEntityTypeConfiguration<ServiceType>
{
    public void Configure(EntityTypeBuilder<ServiceType> e)
    {
        e.ToTable("ServiceTypes"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.Key).IsUnique();
        e.HasMany(x => x.Questions).WithOne(x => x.ServiceType).HasForeignKey(x => x.ServiceTypeId).OnDelete(DeleteBehavior.Cascade);
    }
}
