using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class SimMessageConfig : IEntityTypeConfiguration<SimMessage>
{
    public void Configure(EntityTypeBuilder<SimMessage> e) { e.ToTable("SimMessages"); e.HasKey(x => x.Id); }
}
