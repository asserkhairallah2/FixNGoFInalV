namespace FixNGo.Domain.Entities;

/// <summary>One optional parts/extra line in a quote.</summary>
public class QuoteLine : BaseEntity
{
    public Guid QuoteId { get; set; }
    public Quote Quote { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public int Quantity { get; set; } = 1;
    public long UnitPriceMinor { get; set; }
}
