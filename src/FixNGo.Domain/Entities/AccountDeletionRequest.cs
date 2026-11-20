namespace FixNGo.Domain.Entities;

/// <summary>Account deletion request with a 14-day grace period.</summary>
public class AccountDeletionRequest : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public DateTime? ScheduledAt { get; set; }
    public string BlockersJson { get; set; } = "[]";
    public bool Anonymised { get; set; }
}
