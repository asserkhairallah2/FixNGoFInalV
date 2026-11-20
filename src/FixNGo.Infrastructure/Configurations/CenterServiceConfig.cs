using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class CenterServiceConfig : IEntityTypeConfiguration<CenterService>
{
    public void Configure(EntityTypeBuilder<CenterService> e) { e.ToTable("CenterServices"); e.HasKey(x => x.Id); }
}
