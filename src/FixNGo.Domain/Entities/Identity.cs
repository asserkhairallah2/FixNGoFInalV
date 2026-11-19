namespace FixNGo.Domain.Entities;

/// <summary>Any platform account. Passwords are stored only as PBKDF2 hashes.</summary>
public class User : BaseEntity
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string PasswordHash { get; set; } = string.Empty;
    public Role Role { get; set; }
    public UserStatus Status { get; set; } = UserStatus.PendingVerification;
    public KycStatus KycStatus { get; set; } = KycStatus.None;
    public bool EmailVerified { get; set; }
    public bool PhoneVerified { get; set; }
    public bool OtpOnLogin { get; set; }
    public bool TwoFactorEnabled { get; set; }
    public string? TwoFactorSecret { get; set; }
    public string? TwoFactorRecoveryHashes { get; set; }
    public bool IsSuperAdmin { get; set; }
    public string Language { get; set; } = "en";
    public string Theme { get; set; } = "light";
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? AreaLabel { get; set; }
    public DateTime? LastActiveAt { get; set; }
    public DateTime? DeletionRequestedAt { get; set; }
    public string? AvatarFileId { get; set; }
    public byte[] RowVersion { get; set; } = new byte[8];

    public ICollection<Session> Sessions { get; set; } = [];
    public ICollection<Vehicle> Vehicles { get; set; } = [];
    public ICollection<Notification> Notifications { get; set; } = [];
    public ICollection<WalletEntry> WalletEntries { get; set; } = [];
}

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

/// <summary>Single-use token issued after OTP verification for a password reset.</summary>
public class PasswordResetToken : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public bool Consumed { get; set; }
}

/// <summary>Per-user notification channel/type preferences.</summary>
public class NotificationPreference : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public bool Push { get; set; } = true;
    public bool Email { get; set; } = true;
    public bool TripsAndSafety { get; set; } = true; // locked ON
    public bool Bookings { get; set; } = true;
    public bool Offers { get; set; } = true;
}

/// <summary>Device token for push delivery (fake push records messages against it).</summary>
public class DeviceToken : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string Token { get; set; } = string.Empty;
    public string Platform { get; set; } = "web";
    public bool Active { get; set; } = true;
}

/// <summary>Account deletion request with a 14-day grace period.</summary>
public class AccountDeletionRequest : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public DateTime? ScheduledAt { get; set; }
    public string BlockersJson { get; set; } = "[]";
    public bool Anonymised { get; set; }
}
