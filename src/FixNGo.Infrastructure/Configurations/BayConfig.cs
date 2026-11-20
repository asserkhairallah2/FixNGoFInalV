using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class BayConfig : IEntityTypeConfiguration<Bay>
{
    public void Configure(EntityTypeBuilder<Bay> e) { e.ToTable("Bays"); e.HasKey(x => x.Id); }
}
