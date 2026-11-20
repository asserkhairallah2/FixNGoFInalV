namespace FixNGo.Domain.Entities;

/// <summary>Vehicle model lookup belonging to a make.</summary>
public class VehicleModel : BaseEntity
{
    public Guid MakeId { get; set; }
    public VehicleMake Make { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
}
