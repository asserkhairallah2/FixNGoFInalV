namespace FixNGo.Domain.Entities;

/// <summary>Offer sent to a provider. Accept is race-safe via conditional update.</summary>
public class Offer : BaseEntity
{
    public Guid RequestId { get; set; }
    public ServiceRequest Request { get; set; } = null!;
    public Guid ProviderId { get; set; }
    public User Provider { get; set; } = null!;
    public OfferStatus Status { get; set; } = OfferStatus.Pending;
    public DateTime ExpiresAt { get; set; }
    public long PriceMinor { get; set; }
    public double DistanceKm { get; set; }
    public int EtaMinutes { get; set; }
    public double Score { get; set; }
    public bool IsP0 { get; set; }
    public string? DeclineReason { get; set; }
    public byte[] RowVersion { get; set; } = new byte[8];
}
