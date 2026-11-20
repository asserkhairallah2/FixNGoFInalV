using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class OfferConfig : IEntityTypeConfiguration<Offer>
{
    public void Configure(EntityTypeBuilder<Offer> e)
    {
        e.ToTable("Offers"); e.HasKey(x => x.Id);
        e.Property(x => x.RowVersion).IsRowVersion().HasDefaultValue(new byte[8]);
        e.HasOne(x => x.Provider).WithMany().HasForeignKey(x => x.ProviderId).OnDelete(DeleteBehavior.Restrict);
        e.HasIndex(x => new { x.RequestId, x.ProviderId }).IsUnique();
    }
}
