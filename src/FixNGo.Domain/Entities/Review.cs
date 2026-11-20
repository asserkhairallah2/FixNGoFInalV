namespace FixNGo.Domain.Entities;

/// <summary>Rating/review of a provider or center (one per request/booking).</summary>
public class Review : BaseEntity
{
    public ReviewTargetType TargetType { get; set; }
    public Guid? ProviderId { get; set; }
    public Guid? CenterId { get; set; }
    public Guid? RequestId { get; set; }
    public Guid? BookingId { get; set; }
    public Guid AuthorId { get; set; }
    public int Stars { get; set; }
    public string? Text { get; set; }
    public bool IsHidden { get; set; }
    public bool Recommend { get; set; } = true;
    public bool IsReported { get; set; }
}
