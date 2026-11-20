using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class WalletConfig : IEntityTypeConfiguration<Wallet>
{
    public void Configure(EntityTypeBuilder<Wallet> e)
    {
        e.ToTable("Wallets"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.UserId).IsUnique();
        e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        e.Property(x => x.RowVersion).IsRowVersion().HasDefaultValue(new byte[8]);
        e.HasMany(x => x.Entries).WithOne(x => x.Wallet).HasForeignKey(x => x.WalletId).OnDelete(DeleteBehavior.Cascade);
    }
}
