namespace FixNGo.Domain.Entities;

/// <summary>Immutable admin audit log entry with before/after JSON.</summary>
public class AuditLog : BaseEntity
{
    public Guid ActorId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public string? EntityId { get; set; }
    public string? Reason { get; set; }
    public string? Note { get; set; }
    public string? BeforeJson { get; set; }
    public string? AfterJson { get; set; }
}
