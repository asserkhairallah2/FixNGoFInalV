namespace FixNGo.Domain.Entities;

/// <summary>Versioned platform settings; old requests keep their price snapshot version.</summary>
public class PlatformSettingsVersion : BaseEntity
{
    public int Version { get; set; }
    public string SettingsJson { get; set; } = "{}";
    public Guid? ChangedBy { get; set; }
    public bool IsCurrent { get; set; }
    public DateTime EffectiveAt { get; set; } = DateTime.UtcNow;
}
