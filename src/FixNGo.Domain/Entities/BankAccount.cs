namespace FixNGo.Domain.Entities;

/// <summary>Bank payout destination; only verified default receives payouts.</summary>
public class BankAccount : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string HolderName { get; set; } = string.Empty;
    public string BankName { get; set; } = string.Empty;
    public string IbanLast4 { get; set; } = string.Empty;
    public string? IbanEncrypted { get; set; }
    public bool IsDefault { get; set; }
    public bool IsVerified { get; set; }
}
