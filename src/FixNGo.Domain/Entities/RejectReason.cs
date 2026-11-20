namespace FixNGo.Domain.Entities;

/// <summary>Appointment rejection reason catalog.</summary>
public class RejectReason : BaseEntity
{
    public string Key { get; set; } = string.Empty;
    public string LabelEn { get; set; } = string.Empty;
    public string LabelAr { get; set; } = string.Empty;
}
