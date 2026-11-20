using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class SequenceConfig : IEntityTypeConfiguration<Sequence>
{
    public void Configure(EntityTypeBuilder<Sequence> e)
    {
        e.ToTable("Sequences"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.Prefix).IsUnique();
    }
}
