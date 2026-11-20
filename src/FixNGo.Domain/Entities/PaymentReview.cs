namespace FixNGo.Domain.Entities;

/// <summary>Admin reconciliation item for every cash payment and every dispute.</summary>
public class PaymentReview : BaseEntity
{
    public Guid? PaymentId { get; set; }
    public Payment? Payment { get; set; }
    public Guid? DisputeId { get; set; }
    public Dispute? Dispute { get; set; }
    public Guid RequestId { get; set; }
    public long CustomerConfirmedMinor { get; set; }
    public long ProviderCollectedMinor { get; set; }
    public long RecordedMinor { get; set; }
    public long? AdjustedMinor { get; set; }
    public PaymentReviewStatus Status { get; set; } = PaymentReviewStatus.Pending;
    public string? Note { get; set; }
    public Guid? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
}
