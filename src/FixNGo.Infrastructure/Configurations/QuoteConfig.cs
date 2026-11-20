using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class QuoteConfig : IEntityTypeConfiguration<Quote>
{
    public void Configure(EntityTypeBuilder<Quote> e)
    {
        e.ToTable("Quotes"); e.HasKey(x => x.Id);
        e.HasIndex(x => new { x.RequestId, x.Version }).IsUnique();
        e.HasMany(x => x.Lines).WithOne(x => x.Quote).HasForeignKey(x => x.QuoteId).OnDelete(DeleteBehavior.Cascade);
    }
}
