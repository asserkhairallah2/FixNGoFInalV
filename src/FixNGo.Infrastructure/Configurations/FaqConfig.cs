using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class FaqConfig : IEntityTypeConfiguration<Faq>
{
    public void Configure(EntityTypeBuilder<Faq> e) { e.ToTable("Faqs"); e.HasKey(x => x.Id); }
}
