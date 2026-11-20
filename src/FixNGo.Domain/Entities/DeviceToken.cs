namespace FixNGo.Domain.Entities;

/// <summary>Device token for push delivery (fake push records messages against it).</summary>
public class DeviceToken : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string Token { get; set; } = string.Empty;
    public string Platform { get; set; } = "web";
    public bool Active { get; set; } = true;
}
