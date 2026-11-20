namespace FixNGo.Domain.Entities;

/// <summary>One support thread message (user or FixNGo Support).</summary>
public class SupportMessage : BaseEntity
{
    public Guid TicketId { get; set; }
    public SupportTicket Ticket { get; set; } = null!;
    public bool FromSupport { get; set; }
    public string? AuthorName { get; set; }
    public string Text { get; set; } = string.Empty;
    public Guid? FileId { get; set; }
}
