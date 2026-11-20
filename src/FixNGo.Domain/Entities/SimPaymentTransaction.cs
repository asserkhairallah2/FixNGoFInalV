namespace FixNGo.Domain.Entities;

/// <summary>Simulated payment gateway transaction shown in the Payments panel.</summary>
public class SimPaymentTransaction : BaseEntity
{
    public string Reference { get; set; } = string.Empty;
    public string Payer { get; set; } = string.Empty;
    public PaymentMethodType Method { get; set; }
    public long AmountMinor { get; set; }
    public string Status { get; set; } = "Pending";
    public string? FailureReason { get; set; }
    public Guid? PaymentId { get; set; }
    public bool RequiresApproval { get; set; }
}
