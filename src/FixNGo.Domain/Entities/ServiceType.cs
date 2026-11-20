namespace FixNGo.Domain.Entities;

/// <summary>Bilingual service type (Flatbed Tow, Mechanic, Battery, Tire, Fuel, Other).</summary>
public class ServiceType : BaseEntity
{
    public string Key { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public string NameAr { get; set; } = string.Empty;
    public RequestKind Kind { get; set; }
    public int SortOrder { get; set; }
    public ICollection<FollowUpQuestion> Questions { get; set; } = [];
}
