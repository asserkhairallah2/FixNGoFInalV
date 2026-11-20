using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class PlatformSettingsVersionConfig : IEntityTypeConfiguration<PlatformSettingsVersion>
{
    public void Configure(EntityTypeBuilder<PlatformSettingsVersion> e)
    {
        e.ToTable("PlatformSettingsVersions"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.Version).IsUnique();
    }
}
