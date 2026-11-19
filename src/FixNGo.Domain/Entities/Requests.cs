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

/// <summary>Immutable timeline event for a request.</summary>
public class RequestEvent : BaseEntity
{
    public Guid RequestId { get; set; }
    public ServiceRequest Request { get; set; } = null!;
    public RequestStatus Status { get; set; }
    public string? Note { get; set; }
    public Guid? ActorId { get; set; }
    public DateTime At { get; set; } = DateTime.UtcNow;
}

/// <summary>Customer-uploaded problem photo (validated, served via authorised endpoint).</summary>
public class RequestPhoto : BaseEntity
{
    public Guid RequestId { get; set; }
    public ServiceRequest Request { get; set; } = null!;
    public Guid FileId { get; set; }
    public UploadedFile File { get; set; } = null!;
}

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

/// <summary>Provider quote (versions for revisions) with itemised lines.</summary>
public class Quote : BaseEntity
{
    public Guid RequestId { get; set; }
    public ServiceRequest Request { get; set; } = null!;
    public int Version { get; set; } = 1;
    public QuoteStatus Status { get; set; } = QuoteStatus.Pending;
    public string? Diagnosis { get; set; }
    public long CalloutMinor { get; set; }
    public long LaborMinor { get; set; }
    public long PartsMinor { get; set; }
    public long ServiceFeeMinor { get; set; }
    public long TotalMinor { get; set; }
    public long ProviderNetMinor { get; set; }
    public Guid? CreatedBy { get; set; }
    public ICollection<QuoteLine> Lines { get; set; } = [];
}

/// <summary>One optional parts/extra line in a quote.</summary>
public class QuoteLine : BaseEntity
{
    public Guid QuoteId { get; set; }
    public Quote Quote { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public int Quantity { get; set; } = 1;
    public long UnitPriceMinor { get; set; }
}

/// <summary>Disputed estimate reviewed by admin payment review.</summary>
public class Dispute : BaseEntity
{
    public Guid RequestId { get; set; }
    public ServiceRequest Request { get; set; } = null!;
    public string Reason { get; set; } = string.Empty;
    public string? ProposedResolution { get; set; }
    public bool Resolved { get; set; }
}

/// <summary>Chat thread tied to a request or booking.</summary>
public class ChatThread : BaseEntity
{
    public Guid? RequestId { get; set; }
    public ServiceRequest? Request { get; set; }
    public Guid? BookingId { get; set; }
    public Booking? Booking { get; set; }
    public Guid CustomerId { get; set; }
    public Guid CounterpartId { get; set; }
    public bool IsReadOnly { get; set; }
    public ICollection<ChatMessage> Messages { get; set; } = [];
}

/// <summary>Chat message of type text, location or image.</summary>
public class ChatMessage : BaseEntity
{
    public Guid ThreadId { get; set; }
    public ChatThread Thread { get; set; } = null!;
    public Guid SenderId { get; set; }
    public string MessageType { get; set; } = "text";
    public string? Text { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public Guid? FileId { get; set; }
    public DateTime? ReadAt { get; set; }
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
}
