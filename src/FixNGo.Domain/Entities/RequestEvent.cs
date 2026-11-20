namespace FixNGo.Domain.Entities;

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
