namespace FixNGo.Domain.Entities;

/// <summary>Wallet balance is derived from the append-only ledger, never stored free-floating.</summary>
public class Wallet : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public byte[] RowVersion { get; set; } = new byte[8];
    public ICollection<WalletEntry> Entries { get; set; } = [];
}
