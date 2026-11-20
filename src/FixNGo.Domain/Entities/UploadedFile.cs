namespace FixNGo.Domain.Entities;

/// <summary>Validated uploaded file stored under data/uploads, served only via authorised endpoints.</summary>
public class UploadedFile : BaseEntity
{
    public string FileName { get; set; } = string.Empty;
    public string StoredName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public Guid? OwnerId { get; set; }
    public string Purpose { get; set; } = string.Empty;
}
