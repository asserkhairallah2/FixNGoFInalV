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

/// <summary>KYC application submitted by a provider or service center.</summary>
public class KycApplication : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string Code { get; set; } = string.Empty;
    public KycStatus Status { get; set; } = KycStatus.Submitted;
    public string ApplicantType { get; set; } = string.Empty;
    public string? BusinessName { get; set; }
    public string? Address { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string ServicesJson { get; set; } = "[]";
    public string? ReviewerNote { get; set; }
    public Guid? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public ICollection<KycDocument> Documents { get; set; } = [];
}

/// <summary>One uploaded KYC document with review state.</summary>
public class KycDocument : BaseEntity
{
    public Guid ApplicationId { get; set; }
    public KycApplication Application { get; set; } = null!;
    public string DocumentType { get; set; } = string.Empty;
    public Guid FileId { get; set; }
    public UploadedFile File { get; set; } = null!;
    public DocumentStatus Status { get; set; } = DocumentStatus.Pending;
    public string? ReviewNote { get; set; }
    public DateTime? ReviewedAt { get; set; }
}

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

/// <summary>Center catalog service with snapshotted price at booking time.</summary>
public class CenterService : BaseEntity
{
    public Guid CenterId { get; set; }
    public ServiceCenter Center { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public long PriceMinor { get; set; }
    public int DurationMinutes { get; set; } = 30;
    public bool IsActive { get; set; } = true;
}

/// <summary>Physical service bay; capacity drives slot generation.</summary>
public class Bay : BaseEntity
{
    public Guid CenterId { get; set; }
    public ServiceCenter Center { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

/// <summary>Center technician assigned to work orders.</summary>
public class Technician : BaseEntity
{
    public Guid CenterId { get; set; }
    public ServiceCenter Center { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}
