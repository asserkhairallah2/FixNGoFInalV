namespace FixNGo.Domain.Entities;

/// <summary>Physical service bay; capacity drives slot generation.</summary>
public class Bay : BaseEntity
{
    public Guid CenterId { get; set; }
    public ServiceCenter Center { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}
