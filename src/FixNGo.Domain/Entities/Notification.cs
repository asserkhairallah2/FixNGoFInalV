namespace FixNGo.Domain.Entities;

/// <summary>In-app notification with deep link (screen id + entity id).</summary>
public class Notification : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public NotificationType Type { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string? DeepLink { get; set; }
    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }
}
