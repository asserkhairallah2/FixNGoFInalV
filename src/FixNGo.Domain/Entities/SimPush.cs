namespace FixNGo.Domain.Entities;

/// <summary>Simulated push notification shown in the Notifications panel.</summary>
public class SimPush : BaseEntity
{
    public Guid UserId { get; set; }
    public string? UserName { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string? DeepLink { get; set; }
    public bool IsRead { get; set; }
}
