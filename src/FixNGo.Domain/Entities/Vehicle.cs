namespace FixNGo.Domain.Entities;

/// <summary>Customer vehicle. Plate is normalised and unique per owner.</summary>
public class Vehicle : BaseEntity
{
    public Guid OwnerId { get; set; }
    public User Owner { get; set; } = null!;
    public string Make { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public int Year { get; set; }
    public string Plate { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public FuelType Fuel { get; set; }
    public bool IsPrimary { get; set; }
    public string? PhotoFileId { get; set; }
}
