using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class PaymentMethodConfig : IEntityTypeConfiguration<PaymentMethod>
{
    public void Configure(EntityTypeBuilder<PaymentMethod> e)
    {
        e.ToTable("PaymentMethods"); e.HasKey(x => x.Id);
        e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class PaymentConfig : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> e)
    {
        e.ToTable("Payments"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.IdempotencyKey).IsUnique().HasFilter("[IdempotencyKey] IS NOT NULL");
        e.HasOne(x => x.Request).WithMany().HasForeignKey(x => x.RequestId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne(x => x.Booking).WithMany().HasForeignKey(x => x.BookingId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class InvoiceConfig : IEntityTypeConfiguration<Invoice>
{
    public void Configure(EntityTypeBuilder<Invoice> e)
    {
        e.ToTable("Invoices"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.Number).IsUnique();
        e.HasOne(x => x.Request).WithMany().HasForeignKey(x => x.RequestId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne(x => x.Booking).WithMany().HasForeignKey(x => x.BookingId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class PaymentReviewConfig : IEntityTypeConfiguration<PaymentReview>
{
    public void Configure(EntityTypeBuilder<PaymentReview> e)
    {
        e.ToTable("PaymentReviews"); e.HasKey(x => x.Id);
        e.HasOne(x => x.Payment).WithMany().HasForeignKey(x => x.PaymentId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne(x => x.Dispute).WithMany().HasForeignKey(x => x.DisputeId).OnDelete(DeleteBehavior.Restrict);
    }
}

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

public sealed class WalletEntryConfig : IEntityTypeConfiguration<WalletEntry>
{
    public void Configure(EntityTypeBuilder<WalletEntry> e) { e.ToTable("WalletEntries"); e.HasKey(x => x.Id); }
}

public sealed class BankAccountConfig : IEntityTypeConfiguration<BankAccount>
{
    public void Configure(EntityTypeBuilder<BankAccount> e)
    {
        e.ToTable("BankAccounts"); e.HasKey(x => x.Id);
        e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

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

public sealed class WithdrawalEventConfig : IEntityTypeConfiguration<WithdrawalEvent>
{
    public void Configure(EntityTypeBuilder<WithdrawalEvent> e) { e.ToTable("WithdrawalEvents"); e.HasKey(x => x.Id); }
}
