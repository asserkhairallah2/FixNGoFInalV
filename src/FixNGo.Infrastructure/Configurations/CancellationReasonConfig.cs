using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class CancellationReasonConfig : IEntityTypeConfiguration<CancellationReason>
{
    public void Configure(EntityTypeBuilder<CancellationReason> e)
    {
        e.ToTable("CancellationReasons"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.Key).IsUnique();
    }
}
