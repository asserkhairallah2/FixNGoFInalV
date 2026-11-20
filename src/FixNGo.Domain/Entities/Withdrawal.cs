namespace FixNGo.Domain.Entities;

/// <summary>Withdrawal requested by a provider, advanced by the bank simulator.</summary>
public class Withdrawal : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid BankAccountId { get; set; }
    public BankAccount BankAccount { get; set; } = null!;
    public long AmountMinor { get; set; }
    public long FeeMinor { get; set; }
    public long NetMinor { get; set; }
    public WithdrawalStatus Status { get; set; } = WithdrawalStatus.Requested;
    public string? FailureReason { get; set; }
    public string? IdempotencyKey { get; set; }
    public ICollection<WithdrawalEvent> Events { get; set; } = [];
}
