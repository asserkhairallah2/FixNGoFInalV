namespace FixNGo.Domain.Entities;

/// <summary>Safety report or complaint moderated by admin (UC-30).</summary>
public class SafetyReport : BaseEntity
{
    public string Category { get; set; } = string.Empty;
    public Guid ReporterId { get; set; }
    public User Reporter { get; set; } = null!;
    public Guid? ReportedUserId { get; set; }
    public User? ReportedUser { get; set; }
    public Guid? RequestId { get; set; }
    public string Description { get; set; } = string.Empty;
    public SafetyReportStatus Status { get; set; } = SafetyReportStatus.Open;
    public string? ReviewNote { get; set; }
    public ICollection<UploadedFile> Attachments { get; set; } = [];
}
