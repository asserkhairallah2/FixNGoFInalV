namespace FixNGo.Domain.Entities;

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
