namespace FixNGo.Domain.Entities;

/// <summary>Versioned legal document (privacy/terms), bilingual.</summary>
public class LegalDocument : BaseEntity
{
    public string Key { get; set; } = string.Empty; // privacy | terms
    public int Version { get; set; } = 1;
    public string TitleEn { get; set; } = string.Empty;
    public string TitleAr { get; set; } = string.Empty;
    public string BodyEn { get; set; } = string.Empty;
    public string BodyAr { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
