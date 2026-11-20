using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

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
