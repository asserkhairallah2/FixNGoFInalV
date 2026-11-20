using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class WithdrawalConfig : IEntityTypeConfiguration<Withdrawal>
{
    public void Configure(EntityTypeBuilder<Withdrawal> e)
    {
        e.ToTable("Withdrawals"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.Code).IsUnique();
        e.HasIndex(x => x.IdempotencyKey).IsUnique().HasFilter("[IdempotencyKey] IS NOT NULL");
        e.HasOne(x => x.BankAccount).WithMany().HasForeignKey(x => x.BankAccountId).OnDelete(DeleteBehavior.Restrict);
        e.HasMany(x => x.Events).WithOne(x => x.Withdrawal).HasForeignKey(x => x.WithdrawalId).OnDelete(DeleteBehavior.Cascade);
    }
}
