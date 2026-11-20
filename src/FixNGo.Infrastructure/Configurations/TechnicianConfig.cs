using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class TechnicianConfig : IEntityTypeConfiguration<Technician>
{
    public void Configure(EntityTypeBuilder<Technician> e) { e.ToTable("Technicians"); e.HasKey(x => x.Id); }
}
