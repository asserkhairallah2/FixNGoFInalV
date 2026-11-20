namespace FixNGo.Domain.Entities;

/// <summary>Chat thread tied to a request or booking.</summary>
public class ChatThread : BaseEntity
{
    public Guid? RequestId { get; set; }
    public ServiceRequest? Request { get; set; }
    public Guid? BookingId { get; set; }
    public Booking? Booking { get; set; }
    public Guid CustomerId { get; set; }
    public Guid CounterpartId { get; set; }
    public bool IsReadOnly { get; set; }
    public ICollection<ChatMessage> Messages { get; set; } = [];
}
