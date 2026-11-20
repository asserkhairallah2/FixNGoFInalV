namespace FixNGo.Domain.Entities;

/// <summary>Atomic sequence allocator for human-readable codes.</summary>
public class Sequence : BaseEntity
{
    public string Prefix { get; set; } = string.Empty;
    public long NextValue { get; set; } = 1;
}
