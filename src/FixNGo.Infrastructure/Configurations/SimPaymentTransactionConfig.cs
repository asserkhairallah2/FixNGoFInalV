using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class SimPaymentTransactionConfig : IEntityTypeConfiguration<SimPaymentTransaction>
{
    public void Configure(EntityTypeBuilder<SimPaymentTransaction> e)
    {
        e.ToTable("SimPaymentTransactions"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.Reference).IsUnique();
    }
}
