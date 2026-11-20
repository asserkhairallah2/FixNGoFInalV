namespace FixNGo.Domain.Entities;

/// <summary>Tokenised card (never raw PAN/CVV) or Apple Pay method.</summary>
public class PaymentMethod : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public PaymentMethodType Type { get; set; } = PaymentMethodType.Card;
    public string? Brand { get; set; }
    public string? Last4 { get; set; }
    public int? ExpMonth { get; set; }
    public int? ExpYear { get; set; }
    public string? Token { get; set; }
    public string? Label { get; set; }
    public bool IsDefault { get; set; }
}
