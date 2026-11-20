namespace FixNGo.Domain.Entities;

/// <summary>Bilingual problem type catalog.</summary>
public class ProblemType : BaseEntity
{
    public string Key { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public string NameAr { get; set; } = string.Empty;
    public string RecommendedServiceKey { get; set; } = "mechanic";
}
