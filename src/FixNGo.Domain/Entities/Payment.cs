namespace FixNGo.Domain.Entities;

/// <summary>Append-only payment transaction (NFR-11).</summary>
public class Payment : BaseEntity
{
    public Guid? RequestId { get; set; }
    public ServiceRequest? Request { get; set; }
    public Guid? BookingId { get; set; }
    public Booking? Booking { get; set; }
    public Guid PayerId { get; set; }
    public PaymentMethodType Method { get; set; }
    public string? MethodReference { get; set; }
    public long AmountMinor { get; set; }
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;
    public string? FailureReason { get; set; }
    public string? GatewayTransactionId { get; set; }
    public string? IdempotencyKey { get; set; }
    public DateTime? SettledAt { get; set; }
}
