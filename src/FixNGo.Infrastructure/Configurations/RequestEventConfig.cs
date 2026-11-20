using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class RequestEventConfig : IEntityTypeConfiguration<RequestEvent>
{
    public void Configure(EntityTypeBuilder<RequestEvent> e) { e.ToTable("RequestEvents"); e.HasKey(x => x.Id); }
}
