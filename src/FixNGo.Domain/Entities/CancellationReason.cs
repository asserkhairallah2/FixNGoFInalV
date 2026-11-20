namespace FixNGo.Domain.Entities;

/// <summary>Cancellation reason catalog.</summary>
public class CancellationReason : BaseEntity
{
    public string Key { get; set; } = string.Empty;
    public string LabelEn { get; set; } = string.Empty;
    public string LabelAr { get; set; } = string.Empty;
}
