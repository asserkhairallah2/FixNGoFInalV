namespace FixNGo.Domain.Entities;

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
