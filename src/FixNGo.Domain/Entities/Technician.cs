namespace FixNGo.Domain.Entities;

/// <summary>Center technician assigned to work orders.</summary>
public class Technician : BaseEntity
{
    public Guid CenterId { get; set; }
    public ServiceCenter Center { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}
