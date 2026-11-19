namespace FixNGo.Domain.Entities;

/// <summary>Center appointment with a snapshotted price and held slot.</summary>
public class Booking : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public Guid CenterId { get; set; }
    public ServiceCenter Center { get; set; } = null!;
    public Guid CustomerId { get; set; }
    public User Customer { get; set; } = null!;
    public Guid ServiceId { get; set; }
    public CenterService Service { get; set; } = null!;
    public Guid? VehicleId { get; set; }
    public Vehicle? Vehicle { get; set; }
    public DateTime SlotStart { get; set; }
    public DateTime SlotEnd { get; set; }
    public long PriceMinor { get; set; }
    public BookingStatus Status { get; set; } = BookingStatus.Pending;
    public string? Note { get; set; }
    public string? RejectReason { get; set; }
    public string? CancelReason { get; set; }
    public DateTime? CheckedInAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public byte[] RowVersion { get; set; } = new byte[8];
    public ICollection<WorkOrder> WorkOrders { get; set; } = [];
}

/// <summary>Work order in a center bay.</summary>
public class WorkOrder : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public Guid BookingId { get; set; }
    public Booking Booking { get; set; } = null!;
    public Guid CenterId { get; set; }
    public ServiceCenter Center { get; set; } = null!;
    public Guid? BayId { get; set; }
    public Bay? Bay { get; set; }
    public Guid? TechnicianId { get; set; }
    public Technician? Technician { get; set; }
    public WorkOrderStatus Status { get; set; } = WorkOrderStatus.Assigned;
    public string? ChecklistJson { get; set; } = "[]";
    public string? Notes { get; set; }
    public bool SupervisorReviewed { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? ReadyAt { get; set; }
}

/// <summary>Rating/review of a provider or center (one per request/booking).</summary>
public class Review : BaseEntity
{
    public ReviewTargetType TargetType { get; set; }
    public Guid? ProviderId { get; set; }
    public Guid? CenterId { get; set; }
    public Guid? RequestId { get; set; }
    public Guid? BookingId { get; set; }
    public Guid AuthorId { get; set; }
    public int Stars { get; set; }
    public string? Text { get; set; }
    public bool IsHidden { get; set; }
    public bool Recommend { get; set; } = true;
    public bool IsReported { get; set; }
}

/// <summary>In-app notification with deep link (screen id + entity id).</summary>
public class Notification : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public NotificationType Type { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string? DeepLink { get; set; }
    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }
}

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

/// <summary>Frequently asked question, bilingual.</summary>
public class Faq : BaseEntity
{
    public string QuestionEn { get; set; } = string.Empty;
    public string QuestionAr { get; set; } = string.Empty;
    public string AnswerEn { get; set; } = string.Empty;
    public string AnswerAr { get; set; } = string.Empty;
    public int SortOrder { get; set; }
}

/// <summary>Versioned legal document (privacy/terms), bilingual.</summary>
public class LegalDocument : BaseEntity
{
    public string Key { get; set; } = string.Empty; // privacy | terms
    public int Version { get; set; } = 1;
    public string TitleEn { get; set; } = string.Empty;
    public string TitleAr { get; set; } = string.Empty;
    public string BodyEn { get; set; } = string.Empty;
    public string BodyAr { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Safety report or complaint moderated by admin (UC-30).</summary>
public class SafetyReport : BaseEntity
{
    public string Category { get; set; } = string.Empty;
    public Guid ReporterId { get; set; }
    public User Reporter { get; set; } = null!;
    public Guid? ReportedUserId { get; set; }
    public User? ReportedUser { get; set; }
    public Guid? RequestId { get; set; }
    public string Description { get; set; } = string.Empty;
    public SafetyReportStatus Status { get; set; } = SafetyReportStatus.Open;
    public string? ReviewNote { get; set; }
    public ICollection<UploadedFile> Attachments { get; set; } = [];
}

/// <summary>SOS event created by SH19, visible in the admin safety queue.</summary>
public class EmergencyEvent : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid? RequestId { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string? Note { get; set; }
    public bool Resolved { get; set; }
}

/// <summary>Immutable admin audit log entry with before/after JSON.</summary>
public class AuditLog : BaseEntity
{
    public Guid ActorId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public string? EntityId { get; set; }
    public string? Reason { get; set; }
    public string? Note { get; set; }
    public string? BeforeJson { get; set; }
    public string? AfterJson { get; set; }
}

/// <summary>Versioned platform settings; old requests keep their price snapshot version.</summary>
public class PlatformSettingsVersion : BaseEntity
{
    public int Version { get; set; }
    public string SettingsJson { get; set; } = "{}";
    public Guid? ChangedBy { get; set; }
    public bool IsCurrent { get; set; }
    public DateTime EffectiveAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Atomic sequence allocator for human-readable codes.</summary>
public class Sequence : BaseEntity
{
    public string Prefix { get; set; } = string.Empty;
    public long NextValue { get; set; } = 1;
}

/// <summary>Validated uploaded file stored under data/uploads, served only via authorised endpoints.</summary>
public class UploadedFile : BaseEntity
{
    public string FileName { get; set; } = string.Empty;
    public string StoredName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public Guid? OwnerId { get; set; }
    public string Purpose { get; set; } = string.Empty;
}

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

/// <summary>Simulated payment gateway transaction shown in the Payments panel.</summary>
public class SimPaymentTransaction : BaseEntity
{
    public string Reference { get; set; } = string.Empty;
    public string Payer { get; set; } = string.Empty;
    public PaymentMethodType Method { get; set; }
    public long AmountMinor { get; set; }
    public string Status { get; set; } = "Pending";
    public string? FailureReason { get; set; }
    public Guid? PaymentId { get; set; }
    public bool RequiresApproval { get; set; }
}

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
