using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class EmergencyEventConfig : IEntityTypeConfiguration<EmergencyEvent>
{
    public void Configure(EntityTypeBuilder<EmergencyEvent> e) { e.ToTable("EmergencyEvents"); e.HasKey(x => x.Id); }
}
