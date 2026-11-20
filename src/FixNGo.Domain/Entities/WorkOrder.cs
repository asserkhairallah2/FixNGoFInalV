namespace FixNGo.Domain.Entities;

/// <summary>Work order in a center bay.</summary>
public class WorkOrder : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public Guid BookingId { get; set; }
    public Booking Booking { get; set; } = null!;
    public Guid CenterId { get; set; }
    public ServiceCenter Center { get; set; } = null!;
    public Guid? BayId { get; set; }
    public Bay? Bay { get; set; }
    public Guid? TechnicianId { get; set; }
    public Technician? Technician { get; set; }
    public WorkOrderStatus Status { get; set; } = WorkOrderStatus.Assigned;
    public string? ChecklistJson { get; set; } = "[]";
    public string? Notes { get; set; }
    public bool SupervisorReviewed { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? ReadyAt { get; set; }
}
