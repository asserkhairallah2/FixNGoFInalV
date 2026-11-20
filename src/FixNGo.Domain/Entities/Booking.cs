namespace FixNGo.Domain.Entities;

/// <summary>Center appointment with a snapshotted price and held slot.</summary>
public class Booking : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public Guid CenterId { get; set; }
    public ServiceCenter Center { get; set; } = null!;
    public Guid CustomerId { get; set; }
    public User Customer { get; set; } = null!;
    public Guid ServiceId { get; set; }
    public CenterService Service { get; set; } = null!;
    public Guid? VehicleId { get; set; }
    public Vehicle? Vehicle { get; set; }
    public DateTime SlotStart { get; set; }
    public DateTime SlotEnd { get; set; }
    public long PriceMinor { get; set; }
    public BookingStatus Status { get; set; } = BookingStatus.Pending;
    public string? Note { get; set; }
    public string? RejectReason { get; set; }
    public string? CancelReason { get; set; }
    public DateTime? CheckedInAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public byte[] RowVersion { get; set; } = new byte[8];
    public ICollection<WorkOrder> WorkOrders { get; set; } = [];
}
