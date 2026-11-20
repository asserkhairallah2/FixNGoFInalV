namespace FixNGo.Domain.Entities;

/// <summary>Center catalog service with snapshotted price at booking time.</summary>
public class CenterService : BaseEntity
{
    public Guid CenterId { get; set; }
    public ServiceCenter Center { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public long PriceMinor { get; set; }
    public int DurationMinutes { get; set; } = 30;
    public bool IsActive { get; set; } = true;
}
