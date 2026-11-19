using FixNGo.Domain;

namespace FixNGo.Application.DTOs;

// ---- Simulator dock: shared configuration ----

/// <summary>Simulator feature switch, bound from the Simulators configuration section.</summary>
public sealed class SimulatorOptions
{
    public bool Enabled { get; set; } = true;
}

// ---- SIM 1: notifications / fake push ----

public sealed record SimPushDto(Guid Id, string Source, Guid UserId, string? UserName,
    string Title, string Body, string? DeepLink, bool IsRead, DateTime CreatedAt);

public sealed record SimSendPushRequest(Guid? UserId, string Title, string Body, string? DeepLink = null);

public sealed record SimMarkReadRequest(IReadOnlyList<Guid> Ids, string? Source = null);

public sealed record SimMarkReadResult(int Updated);

// ---- SIM 2: payments / fake PSP ----

public sealed record SimMessageDto(Guid Id, string Channel, string Recipient, string? RecipientName,
    string Body, string? OtpCode, string? Purpose, bool IsRead, DateTime CreatedAt);

public sealed record SimSendMessageRequest(string Recipient, string? RecipientName, string Body,
    SimChannel Channel, string? OtpCode = null, string? Purpose = null);

public sealed record SimPaymentDto(Guid Id, string Reference, string Payer, string Method,
    long AmountMinor, string Status, string? FailureReason, bool RequiresApproval,
    Guid? PaymentId, DateTime CreatedAt);

public sealed record SimTokeniseRequest(string Number, int ExpMonth, int ExpYear, string? Label = null);

public sealed record SimCardTokenDto(string Token, string Last4, Guid PaymentMethodId);

public sealed record SimChargeRequest(string Token, long AmountMinor, string? Reference = null,
    bool RequiresApproval = false);

public sealed record SimChargeResult(Guid TransactionId, string Reference, Guid PaymentId,
    string Status, string? FailureReason);

public sealed record SimWithdrawalDto(Guid Id, string Code, Guid UserId, string? UserName,
    long AmountMinor, long NetMinor, string Status, string? FailureReason, DateTime CreatedAt);

public sealed record SimActionResult(bool Success, string? Message = null);

// ---- SIM 4: OTP ----

public sealed record SimOtpDto(Guid Id, string Target, string? RecipientName, string Purpose,
    string Code, string Channel, DateTime ExpiresAt, int SecondsRemaining,
    int AttemptsLeft, int ResendCount, bool Consumed);

public sealed record SimOtpGenerateRequest(string Target, OtpPurpose Purpose,
    SimChannel Channel = SimChannel.Sms, string? RecipientName = null);

public sealed record SimOtpVerifyRequest(string Target, OtpPurpose Purpose, string Code);

public sealed record SimOtpVerifyResult(bool Valid, string? Reason = null);

// ---- SIM 5: GPS / maps ----

public sealed record SimGpsDto(Guid UserId, string? FullName, double Latitude, double Longitude,
    string? AreaLabel, bool IsOnline, DateTime? LastHeartbeatAt, string Source);

public sealed record SimGpsSetRequest(Guid? UserId, double Latitude, double Longitude,
    string? AreaLabel = null);

public sealed record SimGpsPoint(double Latitude, double Longitude, int Sequence, int EtaSeconds);

public sealed record SimRouteDto(double DistanceKm, int EtaMinutes, IReadOnlyList<SimGpsPoint> Points);

public sealed record SimDriveRequest(Guid ProviderId, Guid? TargetUserId = null,
    double? TargetLatitude = null, double? TargetLongitude = null, int Steps = 5, double SpeedKmh = 30);

public sealed record SimDriveResult(Guid ProviderId, SimGpsDto Location, SimRouteDto Route);
