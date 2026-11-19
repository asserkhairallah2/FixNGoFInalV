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

/// <summary>Append-only payment transaction (NFR-11).</summary>
public class Payment : BaseEntity
{
    public Guid? RequestId { get; set; }
    public ServiceRequest? Request { get; set; }
    public Guid? BookingId { get; set; }
    public Booking? Booking { get; set; }
    public Guid PayerId { get; set; }
    public PaymentMethodType Method { get; set; }
    public string? MethodReference { get; set; }
    public long AmountMinor { get; set; }
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;
    public string? FailureReason { get; set; }
    public string? GatewayTransactionId { get; set; }
    public string? IdempotencyKey { get; set; }
    public DateTime? SettledAt { get; set; }
}

/// <summary>Invoice for a request (INV-YYYY-####) or center visit (INV-SC-####).</summary>
public class Invoice : BaseEntity
{
    public string Number { get; set; } = string.Empty;
    public Guid? RequestId { get; set; }
    public ServiceRequest? Request { get; set; }
    public Guid? BookingId { get; set; }
    public Booking? Booking { get; set; }
    public Guid CustomerId { get; set; }
    public long SubtotalMinor { get; set; }
    public long ServiceFeeMinor { get; set; }
    public long TotalMinor { get; set; }
    public InvoiceStatus Status { get; set; } = InvoiceStatus.Unpaid;
    public PaymentMethodType? Method { get; set; }
    public string? LinesJson { get; set; } = "[]";
    public bool CustomerCashConfirmed { get; set; }
    public DateTime IssuedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Admin reconciliation item for every cash payment and every dispute.</summary>
public class PaymentReview : BaseEntity
{
    public Guid? PaymentId { get; set; }
    public Payment? Payment { get; set; }
    public Guid? DisputeId { get; set; }
    public Dispute? Dispute { get; set; }
    public Guid RequestId { get; set; }
    public long CustomerConfirmedMinor { get; set; }
    public long ProviderCollectedMinor { get; set; }
    public long RecordedMinor { get; set; }
    public long? AdjustedMinor { get; set; }
    public PaymentReviewStatus Status { get; set; } = PaymentReviewStatus.Pending;
    public string? Note { get; set; }
    public Guid? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
}

/// <summary>Wallet balance is derived from the append-only ledger, never stored free-floating.</summary>
public class Wallet : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public byte[] RowVersion { get; set; } = new byte[8];
    public ICollection<WalletEntry> Entries { get; set; } = [];
}

/// <summary>One immutable wallet ledger entry.</summary>
public class WalletEntry : BaseEntity
{
    public Guid WalletId { get; set; }
    public Wallet Wallet { get; set; } = null!;
    public WalletEntryType Type { get; set; }
    public long AmountMinor { get; set; } // signed
    public string Reference { get; set; } = string.Empty;
    public DateTime At { get; set; } = DateTime.UtcNow;
}

/// <summary>Bank payout destination; only verified default receives payouts.</summary>
public class BankAccount : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string HolderName { get; set; } = string.Empty;
    public string BankName { get; set; } = string.Empty;
    public string IbanLast4 { get; set; } = string.Empty;
    public string? IbanEncrypted { get; set; }
    public bool IsDefault { get; set; }
    public bool IsVerified { get; set; }
}

/// <summary>Withdrawal requested by a provider, advanced by the bank simulator.</summary>
public class Withdrawal : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid BankAccountId { get; set; }
    public BankAccount BankAccount { get; set; } = null!;
    public long AmountMinor { get; set; }
    public long FeeMinor { get; set; }
    public long NetMinor { get; set; }
    public WithdrawalStatus Status { get; set; } = WithdrawalStatus.Requested;
    public string? FailureReason { get; set; }
    public string? IdempotencyKey { get; set; }
    public ICollection<WithdrawalEvent> Events { get; set; } = [];
}

/// <summary>Withdrawal status timeline event.</summary>
public class WithdrawalEvent : BaseEntity
{
    public Guid WithdrawalId { get; set; }
    public Withdrawal Withdrawal { get; set; } = null!;
    public WithdrawalStatus Status { get; set; }
    public DateTime At { get; set; } = DateTime.UtcNow;
}
