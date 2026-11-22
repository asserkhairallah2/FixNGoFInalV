namespace FixNGo.Domain;

/// <summary>Platform roles. Admin is never self-registerable.</summary>
public enum Role { CarOwner, Mechanic, TowCaptain, ServiceCenter, Admin }

/// <summary>Account lifecycle state.</summary>
public enum UserStatus { PendingVerification, Active, Suspended, DeletionRequested, Deleted }

/// <summary>Admin verification state of a provider or service center.</summary>
public enum KycStatus { None, Submitted, UnderReview, ChangesNeeded, Approved, Rejected }

/// <summary>Roadside request kind; determines the code prefix (FG/MR).</summary>
public enum RequestKind { Tow, Mechanic }

/// <summary>Normal or accident-with-injury (P0) priority.</summary>
public enum RequestPriority { Normal, P0 }

/// <summary>Unified roadside request state machine.</summary>
public enum RequestStatus
{
    Searching, Offered, Accepted, EnRoute, Arrived, QuotePending, QuoteApproved,
    Working, AwaitingPayment, Completed, NoProviders, Cancelled, Disputed
}

/// <summary>Offer sub-state. First accept wins (conditional update).</summary>
public enum OfferStatus { Pending, Accepted, Declined, Expired, Withdrawn }

/// <summary>Quote lifecycle. Revisions create new versions.</summary>
public enum QuoteStatus { Pending, Approved, Disputed, Revised, Rejected }

/// <summary>Customer-selected payment method.</summary>
public enum PaymentMethodType { Cash, Card, ApplePay }

/// <summary>Payment transaction status (append-only audit records).</summary>
public enum PaymentStatus { Pending, Succeeded, Failed, Refunded }

/// <summary>Admin payment-review state.</summary>
public enum PaymentReviewStatus { Pending, Resolved }

/// <summary>Invoice settlement state.</summary>
public enum InvoiceStatus { Unpaid, Paid }

/// <summary>Service-center booking state.</summary>
public enum BookingStatus { Pending, Confirmed, InProgress, Completed, Rejected, Cancelled, Expired }

/// <summary>Work order state.</summary>
public enum WorkOrderStatus { Assigned, InProgress, ReadyForReview, Closed }

/// <summary>Withdrawal state, advanced by the bank simulator.</summary>
public enum WithdrawalStatus { Requested, Processing, Sent, Confirmed, Failed }

/// <summary>Append-only wallet ledger entry type.</summary>
public enum WalletEntryType { JobEarning, Withdrawal, Refund, Adjustment }

/// <summary>Notification catalogue code.</summary>
public enum NotificationType
{
    NewOffer, OfferWithdrawn, OfferExpired, RequestAccepted, RequestDeclined,
    StatusEnRoute, StatusArrived, StatusWorking, StatusCompleted, EstimateReady,
    EstimateApproved, EstimateDisputed, PaymentVerified, PaymentFailed, CashConfirmed,
    RateYourTrip, BookingCreated, BookingConfirmed, BookingRejected, BookingExpired,
    BookingRescheduled, BookingCancelled, WorkOrderAssigned, KycDecision,
    KycChangesNeeded, AccountSuspended, AccountRestored, DocumentReviewed,
    WithdrawalStatus, SupportTicketReply, SafetyOutcome, NewKycApplication,
    NewPaymentReview, NewSafetyReport, ChatMessage, SessionRevoked
}

/// <summary>What a review applies to.</summary>
public enum ReviewTargetType { Provider, Center, Customer }

/// <summary>Safety report / emergency escalation state.</summary>
public enum SafetyReportStatus { Open, Escalated, Closed }

/// <summary>Support ticket state.</summary>
public enum TicketStatus { Open, AwaitingSupport, Answered, Closed }

/// <summary>Uploaded KYC/document review state.</summary>
public enum DocumentStatus { Pending, Approved, Rejected, Replaced }

/// <summary>One-time password purpose.</summary>
public enum OtpPurpose { Signup, Login, Forgot, ContactChange, TwoFactor }

/// <summary>Simulated external channel.</summary>
public enum SimChannel { Sms, Email }

/// <summary>Truck body type for tow captains.</summary>
public enum TruckType { Flatbed, Hook, WheelLift, Carry }

/// <summary>Fuel type for vehicles.</summary>
public enum FuelType { Petrol, Diesel, Hybrid, Electric, Gas }

/// <summary>Weekday number for working hours (0 = Sunday).</summary>
public enum DayOfWeek2 { Sunday = 0, Monday = 1, Tuesday = 2, Wednesday = 3, Thursday = 4, Friday = 5, Saturday = 6 }
