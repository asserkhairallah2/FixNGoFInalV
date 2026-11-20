namespace FixNGo.Domain.Entities;

/// <summary>Hashed one-time code with TTL, attempt and resend limits.</summary>
public class OtpCode : BaseEntity
{
    public string Target { get; set; } = string.Empty;
    public OtpPurpose Purpose { get; set; }
    public string CodeHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public int Attempts { get; set; }
    public int ResendCount { get; set; }
    public bool Consumed { get; set; }
}
