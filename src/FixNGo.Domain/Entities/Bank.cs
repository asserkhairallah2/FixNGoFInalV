namespace FixNGo.Domain.Entities;

/// <summary>Egyptian bank catalog with IBAN validation metadata.</summary>
public class Bank : BaseEntity
{
    public string NameEn { get; set; } = string.Empty;
    public string NameAr { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
}
