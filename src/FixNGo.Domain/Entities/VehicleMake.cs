namespace FixNGo.Domain.Entities;

/// <summary>Vehicle make lookup.</summary>
public class VehicleMake : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public ICollection<VehicleModel> Models { get; set; } = [];
}
