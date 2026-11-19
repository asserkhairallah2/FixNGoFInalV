namespace FixNGo.Domain;

/// <summary>Declarative finite-state machine used by all aggregates.</summary>
public sealed class StateMachine<TState>(TState initial, IReadOnlyDictionary<TState, TState[]> transitions)
    where TState : struct, Enum
{
    private readonly Dictionary<TState, TState[]> _transitions = transitions.ToDictionary(k => k.Key, v => v.Value);

    public TState Initial => initial;

    /// <summary>Throws <see cref="IllegalTransitionException"/> when the move is not allowed.</summary>
    public TState Transition(TState from, TState to)
    {
        if (from.Equals(to)) return to;
        if (!_transitions.TryGetValue(from, out var next) || !next.Contains(to))
        {
            var allowed = _transitions.TryGetValue(from, out var a) ? a.Select(x => x.ToString()) : [];
            throw new IllegalTransitionException(from.ToString()!, to.ToString()!, allowed);
        }
        return to;
    }

    public IReadOnlyList<TState> AllowedFrom(TState from) =>
        _transitions.TryGetValue(from, out var next) ? next : [];

    public bool CanTransition(TState from, TState to)
    {
        try { Transition(from, to); return true; }
        catch (IllegalTransitionException) { return false; }
    }
}

/// <summary>Central registry of the platform's legal state transitions.</summary>
public static class StateMachines
{
    public static readonly StateMachine<RequestStatus> Request = new(RequestStatus.Searching,
        new Dictionary<RequestStatus, RequestStatus[]>
        {
            [RequestStatus.Searching] = [RequestStatus.Offered, RequestStatus.NoProviders, RequestStatus.Cancelled],
            [RequestStatus.Offered] = [RequestStatus.Accepted, RequestStatus.Searching, RequestStatus.NoProviders, RequestStatus.Cancelled],
            [RequestStatus.Accepted] = [RequestStatus.EnRoute, RequestStatus.Cancelled],
            [RequestStatus.EnRoute] = [RequestStatus.Arrived, RequestStatus.Cancelled],
            [RequestStatus.Arrived] = [RequestStatus.QuotePending, RequestStatus.Working, RequestStatus.Cancelled],
            [RequestStatus.QuotePending] = [RequestStatus.QuoteApproved, RequestStatus.Disputed, RequestStatus.Cancelled],
            [RequestStatus.QuoteApproved] = [RequestStatus.Working, RequestStatus.Cancelled],
            [RequestStatus.Working] = [RequestStatus.AwaitingPayment, RequestStatus.Cancelled],
            [RequestStatus.AwaitingPayment] = [RequestStatus.Completed, RequestStatus.Cancelled, RequestStatus.Disputed],
            [RequestStatus.Disputed] = [RequestStatus.QuotePending, RequestStatus.Cancelled],
            [RequestStatus.Completed] = [],
            [RequestStatus.NoProviders] = [RequestStatus.Searching, RequestStatus.Cancelled],
            [RequestStatus.Cancelled] = []
        });

    public static readonly StateMachine<BookingStatus> Booking = new(BookingStatus.Pending,
        new Dictionary<BookingStatus, BookingStatus[]>
        {
            [BookingStatus.Pending] = [BookingStatus.Confirmed, BookingStatus.Rejected, BookingStatus.Cancelled, BookingStatus.Expired],
            [BookingStatus.Confirmed] = [BookingStatus.InProgress, BookingStatus.Cancelled],
            [BookingStatus.InProgress] = [BookingStatus.Completed],
            [BookingStatus.Completed] = [],
            [BookingStatus.Rejected] = [],
            [BookingStatus.Cancelled] = [],
            [BookingStatus.Expired] = []
        });

    public static readonly StateMachine<WorkOrderStatus> WorkOrder = new(WorkOrderStatus.Assigned,
        new Dictionary<WorkOrderStatus, WorkOrderStatus[]>
        {
            [WorkOrderStatus.Assigned] = [WorkOrderStatus.InProgress],
            [WorkOrderStatus.InProgress] = [WorkOrderStatus.ReadyForReview],
            [WorkOrderStatus.ReadyForReview] = [WorkOrderStatus.Closed],
            [WorkOrderStatus.Closed] = []
        });

    public static readonly StateMachine<WithdrawalStatus> Withdrawal = new(WithdrawalStatus.Requested,
        new Dictionary<WithdrawalStatus, WithdrawalStatus[]>
        {
            [WithdrawalStatus.Requested] = [WithdrawalStatus.Processing, WithdrawalStatus.Failed],
            [WithdrawalStatus.Processing] = [WithdrawalStatus.Sent, WithdrawalStatus.Failed],
            [WithdrawalStatus.Sent] = [WithdrawalStatus.Confirmed, WithdrawalStatus.Failed],
            [WithdrawalStatus.Confirmed] = [],
            [WithdrawalStatus.Failed] = []
        });

    public static readonly StateMachine<KycStatus> Kyc = new(KycStatus.None,
        new Dictionary<KycStatus, KycStatus[]>
        {
            [KycStatus.None] = [KycStatus.Submitted],
            [KycStatus.Submitted] = [KycStatus.UnderReview, KycStatus.ChangesNeeded, KycStatus.Approved, KycStatus.Rejected],
            [KycStatus.UnderReview] = [KycStatus.ChangesNeeded, KycStatus.Approved, KycStatus.Rejected],
            [KycStatus.ChangesNeeded] = [KycStatus.Submitted, KycStatus.Rejected],
            [KycStatus.Approved] = [],
            [KycStatus.Rejected] = [KycStatus.Submitted]
        });

    /// <summary>Customer-facing 7-step progress from a request status (1..7).</summary>
    public static int RequestStep(RequestStatus status) => status switch
    {
        RequestStatus.Searching or RequestStatus.Offered or RequestStatus.NoProviders => 1,
        RequestStatus.Accepted => 2,
        RequestStatus.EnRoute => 3,
        RequestStatus.Arrived => 4,
        RequestStatus.QuotePending or RequestStatus.QuoteApproved or RequestStatus.Disputed => 5,
        RequestStatus.Working or RequestStatus.AwaitingPayment => 6,
        RequestStatus.Completed => 7,
        _ => 1
    };
}
