namespace FixNGo.Domain.Events;

/// <summary>Marker contract for immutable domain events raised within an aggregate boundary.</summary>
public interface IDomainEvent
{
    Guid EventId { get; }
    DateTime OccurredAtUtc { get; }
    string EventType { get; }
}

public sealed record RequestCreatedDomainEvent(
    Guid EventId,
    DateTime OccurredAtUtc,
    Guid RequestId,
    string RequestCode,
    Guid CustomerId,
    RequestKind Kind,
    RequestPriority Priority) : IDomainEvent
{
    public string EventType => "request.created";
}

public sealed record RequestStatusChangedDomainEvent(
    Guid EventId,
    DateTime OccurredAtUtc,
    Guid RequestId,
    RequestStatus PreviousStatus,
    RequestStatus NextStatus,
    Guid? ActorId) : IDomainEvent
{
    public string EventType => "request.status_changed";
}

public sealed record OfferAcceptedDomainEvent(
    Guid EventId,
    DateTime OccurredAtUtc,
    Guid OfferId,
    Guid RequestId,
    Guid ProviderId,
    long PriceMinor) : IDomainEvent
{
    public string EventType => "offer.accepted";
}

public sealed record BookingStatusChangedDomainEvent(
    Guid EventId,
    DateTime OccurredAtUtc,
    Guid BookingId,
    string BookingCode,
    BookingStatus Status) : IDomainEvent
{
    public string EventType => "booking.status_changed";
}

public sealed record PaymentSettledDomainEvent(
    Guid EventId,
    DateTime OccurredAtUtc,
    Guid PaymentId,
    Guid? RequestId,
    Guid? BookingId,
    long AmountMinor,
    PaymentMethodType Method) : IDomainEvent
{
    public string EventType => "payment.settled";
}

public sealed record KycDecisionRecordedDomainEvent(
    Guid EventId,
    DateTime OccurredAtUtc,
    Guid ApplicationId,
    Guid ApplicantUserId,
    KycStatus Decision,
    Guid AdminId) : IDomainEvent
{
    public string EventType => "kyc.reviewed";
}
