namespace FixNGo.Domain.Entities;

/// <summary>Chat message of type text, location or image.</summary>
public class ChatMessage : BaseEntity
{
    public Guid ThreadId { get; set; }
    public ChatThread Thread { get; set; } = null!;
    public Guid SenderId { get; set; }
    public string MessageType { get; set; } = "text";
    public string? Text { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public Guid? FileId { get; set; }
    public DateTime? ReadAt { get; set; }
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
}
