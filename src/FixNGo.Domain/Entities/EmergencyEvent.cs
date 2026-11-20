namespace FixNGo.Domain.Entities;

/// <summary>SOS event created by SH19, visible in the admin safety queue.</summary>
public class EmergencyEvent : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid? RequestId { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string? Note { get; set; }
    public bool Resolved { get; set; }
}
