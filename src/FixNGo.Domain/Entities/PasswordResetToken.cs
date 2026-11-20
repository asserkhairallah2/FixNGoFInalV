namespace FixNGo.Domain.Entities;

/// <summary>Single-use token issued after OTP verification for a password reset.</summary>
public class PasswordResetToken : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public bool Consumed { get; set; }
}
