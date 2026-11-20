namespace FixNGo.Domain.Entities;

/// <summary>Opening hours for one weekday.</summary>
public class WorkingHours : BaseEntity
{
    public Guid CenterId { get; set; }
    public ServiceCenter Center { get; set; } = null!;
    public int DayOfWeek { get; set; }
    public bool IsClosed { get; set; }
    public TimeSpan OpenTime { get; set; } = new(8, 0, 0);
    public TimeSpan CloseTime { get; set; } = new(18, 0, 0);
    public bool IsSpecial { get; set; }
}
