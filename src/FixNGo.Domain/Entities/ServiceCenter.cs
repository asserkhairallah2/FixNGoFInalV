namespace FixNGo.Domain.Entities;

/// <summary>Service center business profile.</summary>
public class ServiceCenter : BaseEntity
{
    public Guid OwnerId { get; set; }
    public User Owner { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Phone { get; set; } = string.Empty;
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? LogoFileId { get; set; }
    public string? PhotoFileId { get; set; }
    public decimal Rating { get; set; }
    public int RatingCount { get; set; }
    public int RecommendPercent { get; set; }
    public ICollection<WorkingHours> WorkingHours { get; set; } = [];
    public ICollection<CenterService> Services { get; set; } = [];
    public ICollection<Bay> Bays { get; set; } = [];
    public ICollection<Technician> Technicians { get; set; } = [];
}
