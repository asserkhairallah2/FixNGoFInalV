using FixNGo.Application.DTOs;
using FixNGo.Domain;

namespace FixNGo.Application.Interfaces;

/// <summary>
/// Dev-only simulator dock operations. Every method reads or writes real database rows through
/// the existing providers (IOtpSender / IPaymentGateway / INotifier) and IAppDbContext.
/// </summary>
public interface ISimulatorService
{
    // Notifications
    Task<IReadOnlyList<SimPushDto>> ListPushesAsync(Guid callerId, bool all, CancellationToken ct = default);
    Task<SimActionResult> SendPushAsync(Guid callerId, SimSendPushRequest req, CancellationToken ct = default);
    Task<SimMarkReadResult> MarkPushesReadAsync(SimMarkReadRequest req, CancellationToken ct = default);
    Task<SimMarkReadResult> MarkAllPushesReadAsync(Guid callerId, CancellationToken ct = default);

    // Fake PSP transactions / withdrawals
    Task<IReadOnlyList<SimPaymentDto>> ListPaymentsAsync(CancellationToken ct = default);
    Task<SimCardTokenDto> TokeniseCardAsync(Guid userId, SimTokeniseRequest req, CancellationToken ct = default);
    Task<SimChargeResult> ChargeAsync(Guid userId, SimChargeRequest req, CancellationToken ct = default);
    Task<SimPaymentDto> SetPaymentStatusAsync(Guid transactionId, string status, CancellationToken ct = default);
    Task<IReadOnlyList<SimWithdrawalDto>> ListWithdrawalsAsync(CancellationToken ct = default);
    Task<SimWithdrawalDto> AdvanceWithdrawalAsync(Guid id, CancellationToken ct = default);
    Task<SimWithdrawalDto> FailWithdrawalAsync(Guid id, string? reason, CancellationToken ct = default);

    // Fake SMS / email inbox
    Task<IReadOnlyList<SimMessageDto>> ListMessagesAsync(SimChannel? channel, CancellationToken ct = default);
    Task<SimMessageDto> SendMessageAsync(SimSendMessageRequest req, CancellationToken ct = default);
    Task<SimMarkReadResult> MarkMessagesReadAsync(IReadOnlyList<Guid> ids, CancellationToken ct = default);

    // OTP panel
    Task<IReadOnlyList<SimOtpDto>> ListOtpsAsync(CancellationToken ct = default);
    Task<SimOtpDto> GenerateOtpAsync(SimOtpGenerateRequest req, CancellationToken ct = default);
    Task<SimOtpVerifyResult> VerifyOtpAsync(SimOtpVerifyRequest req, CancellationToken ct = default);

    // GPS / maps panel
    Task<IReadOnlyList<SimGpsDto>> ListGpsAsync(Guid callerId, Guid? userId, bool all, CancellationToken ct = default);
    Task<SimGpsDto> SetGpsAsync(Guid callerId, SimGpsSetRequest req, CancellationToken ct = default);
    Task<SimDriveResult> DriveAsync(SimDriveRequest req, CancellationToken ct = default);
    Task<SimActionResult> GoStaleAsync(Guid providerId, CancellationToken ct = default);
}
