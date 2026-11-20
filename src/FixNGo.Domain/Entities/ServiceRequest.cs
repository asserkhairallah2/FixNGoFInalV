namespace FixNGo.Domain.Entities;

/// <summary>A roadside request (tow FG-#### or mechanic MR-####).</summary>
public class ServiceRequest : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public Guid CustomerId { get; set; }
    public User Customer { get; set; } = null!;
    public Guid? VehicleId { get; set; }
    public Vehicle? Vehicle { get; set; }
    public RequestKind Kind { get; set; }
    public RequestPriority Priority { get; set; } = RequestPriority.Normal;
    public RequestStatus Status { get; set; } = RequestStatus.Searching;
    public Guid? AssignedProviderId { get; set; }
    public User? AssignedProvider { get; set; }
    public Guid? ServiceTypeId { get; set; }
    public string? Problem { get; set; }
    public string? AnswersJson { get; set; } = "{}";
    public string? Note { get; set; }
    public double PickupLatitude { get; set; }
    public double PickupLongitude { get; set; }
    public string PickupAddress { get; set; } = string.Empty;
    public double? DestinationLatitude { get; set; }
    public double? DestinationLongitude { get; set; }
    public string? DestinationAddress { get; set; }
    public double DistanceKm { get; set; }
    public double RadiusKm { get; set; } = 5;
    public int SettingsVersion { get; set; }
    public long? EstimateMinor { get; set; }
    public long? QuoteMinor { get; set; }
    public PaymentMethodType? PaymentMethod { get; set; }
    public string? CancellationReason { get; set; }
    public DateTime? AcceptedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public bool CustomerCashConfirmed { get; set; }
    public byte[] RowVersion { get; set; } = new byte[8];

    public ICollection<RequestEvent> Events { get; set; } = [];
    public ICollection<RequestPhoto> Photos { get; set; } = [];
    public ICollection<Offer> Offers { get; set; } = [];
    public ICollection<Quote> Quotes { get; set; } = [];
    public ICollection<ChatThread> Threads { get; set; } = [];
}
