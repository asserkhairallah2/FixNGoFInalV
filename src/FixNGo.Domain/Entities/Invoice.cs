namespace FixNGo.Domain.Entities;

/// <summary>Invoice for a request (INV-YYYY-####) or center visit (INV-SC-####).</summary>
public class Invoice : BaseEntity
{
    public string Number { get; set; } = string.Empty;
    public Guid? RequestId { get; set; }
    public ServiceRequest? Request { get; set; }
    public Guid? BookingId { get; set; }
    public Booking? Booking { get; set; }
    public Guid CustomerId { get; set; }
    public long SubtotalMinor { get; set; }
    public long ServiceFeeMinor { get; set; }
    public long TotalMinor { get; set; }
    public InvoiceStatus Status { get; set; } = InvoiceStatus.Unpaid;
    public PaymentMethodType? Method { get; set; }
    public string? LinesJson { get; set; } = "[]";
    public bool CustomerCashConfirmed { get; set; }
    public DateTime IssuedAt { get; set; } = DateTime.UtcNow;
}
