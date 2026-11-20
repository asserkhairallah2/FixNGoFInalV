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
