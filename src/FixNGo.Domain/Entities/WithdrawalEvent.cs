namespace FixNGo.Domain.Entities;

/// <summary>Withdrawal status timeline event.</summary>
public class WithdrawalEvent : BaseEntity
{
    public Guid WithdrawalId { get; set; }
    public Withdrawal Withdrawal { get; set; } = null!;
    public WithdrawalStatus Status { get; set; }
    public DateTime At { get; set; } = DateTime.UtcNow;
}
