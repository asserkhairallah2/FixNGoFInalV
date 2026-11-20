namespace FixNGo.Domain.Entities;

/// <summary>Provider quote (versions for revisions) with itemised lines.</summary>
public class Quote : BaseEntity
{
    public Guid RequestId { get; set; }
    public ServiceRequest Request { get; set; } = null!;
    public int Version { get; set; } = 1;
    public QuoteStatus Status { get; set; } = QuoteStatus.Pending;
    public string? Diagnosis { get; set; }
    public long CalloutMinor { get; set; }
    public long LaborMinor { get; set; }
    public long PartsMinor { get; set; }
    public long ServiceFeeMinor { get; set; }
    public long TotalMinor { get; set; }
    public long ProviderNetMinor { get; set; }
    public Guid? CreatedBy { get; set; }
    public ICollection<QuoteLine> Lines { get; set; } = [];
}
