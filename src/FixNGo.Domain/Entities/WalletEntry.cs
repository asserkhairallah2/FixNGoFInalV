namespace FixNGo.Domain.Entities;

/// <summary>One immutable wallet ledger entry.</summary>
public class WalletEntry : BaseEntity
{
    public Guid WalletId { get; set; }
    public Wallet Wallet { get; set; } = null!;
    public WalletEntryType Type { get; set; }
    public long AmountMinor { get; set; } // signed
    public string Reference { get; set; } = string.Empty;
    public DateTime At { get; set; } = DateTime.UtcNow;
}
