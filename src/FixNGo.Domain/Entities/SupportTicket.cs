namespace FixNGo.Domain.Entities;

/// <summary>Support ticket created by a user, with auto-reply thread.</summary>
public class SupportTicket : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string Category { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? ReferenceType { get; set; }
    public Guid? ReferenceId { get; set; }
    public decimal? Amount { get; set; }
    public TicketStatus Status { get; set; } = TicketStatus.Open;
    public ICollection<SupportMessage> Messages { get; set; } = [];
}
