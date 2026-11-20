namespace FixNGo.Domain.Entities;

/// <summary>Simulated SMS/email message written by the fake OtpSender.</summary>
public class SimMessage : BaseEntity
{
    public SimChannel Channel { get; set; }
    public string Recipient { get; set; } = string.Empty;
    public string? RecipientName { get; set; }
    public string Body { get; set; } = string.Empty;
    public string? OtpCode { get; set; }
    public string? Purpose { get; set; }
    public bool IsRead { get; set; }
}
