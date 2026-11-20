using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class SimPushConfig : IEntityTypeConfiguration<SimPush>
{
    public void Configure(EntityTypeBuilder<SimPush> e) { e.ToTable("SimPushes"); e.HasKey(x => x.Id); }
}
