namespace FixNGo.Domain.Entities;

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
