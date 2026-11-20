namespace FixNGo.Domain.Entities;

/// <summary>Shared professional profile data for mechanics and tow captains.</summary>
public class ProviderProfile : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public int YearsExperience { get; set; }
    public string ExpertiseJson { get; set; } = "[]";
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public double CoverageRadiusKm { get; set; } = 5;
    public string? CoverageArea { get; set; }
    public bool IsOnline { get; set; }
    public DateTime? LastHeartbeatAt { get; set; }
    public decimal Rating { get; set; }
    public int RatingCount { get; set; }
    public int CompletedJobs { get; set; }
    public string? TruckMake { get; set; }
    public string? TruckPlate { get; set; }
    public TruckType? TruckType { get; set; }
    public decimal? TruckCapacityTonnes { get; set; }
    public string? TruckPhotoFileId { get; set; }
}
