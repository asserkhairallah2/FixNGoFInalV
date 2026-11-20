namespace FixNGo.Domain.Entities;

/// <summary>Checklist template used by provider and center workflows.</summary>
public class ChecklistTemplate : BaseEntity
{
    public string Key { get; set; } = string.Empty;
    public string ItemEn { get; set; } = string.Empty;
    public string ItemAr { get; set; } = string.Empty;
    public string Workflow { get; set; } = string.Empty; // tow-load | repair | center-complete
    public int SortOrder { get; set; }
}
