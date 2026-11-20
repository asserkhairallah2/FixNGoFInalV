namespace FixNGo.Domain.Entities;

/// <summary>Customer-uploaded problem photo (validated, served via authorised endpoint).</summary>
public class RequestPhoto : BaseEntity
{
    public Guid RequestId { get; set; }
    public ServiceRequest Request { get; set; } = null!;
    public Guid FileId { get; set; }
    public UploadedFile File { get; set; } = null!;
}
