namespace FixNGo.Domain.Entities;

/// <summary>Disputed estimate reviewed by admin payment review.</summary>
public class Dispute : BaseEntity
{
    public Guid RequestId { get; set; }
    public ServiceRequest Request { get; set; } = null!;
    public string Reason { get; set; } = string.Empty;
    public string? ProposedResolution { get; set; }
    public bool Resolved { get; set; }
}
