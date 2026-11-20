namespace FixNGo.Domain.Entities;

/// <summary>A login session with a rotating hashed refresh token.</summary>
public class Session : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string RefreshTokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public string? DeviceLabel { get; set; }
    public string? IpAddress { get; set; }
    public string? CityLabel { get; set; }
    public bool IsCurrent { get; set; }
}
