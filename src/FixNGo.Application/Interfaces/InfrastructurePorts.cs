using FixNGo.Domain;

namespace FixNGo.Application.Interfaces;

/// <summary>Clock abstraction for deterministic time in tests.</summary>
public interface IClock
{
    DateTime UtcNow { get; }
}

/// <summary>Hashes and verifies passwords (PBKDF2 in production).</summary>
public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string hash, string password);
}

/// <summary>Issues and validates JWT access tokens and rotating refresh tokens.</summary>
public interface ITokenService
{
    string IssueAccessToken(Guid userId, Role role, string email);
    string GenerateRefreshToken();
    (Guid UserId, Role Role, string Email)? ValidateAccessToken(string token);
}

/// <summary>Fake-but-functional SMS/email sender. Codes are stored for the simulator panel.</summary>
public interface IOtpSender
{
    Task SendAsync(string recipient, string? recipientName, SimChannel channel, string code, string purpose, CancellationToken ct = default);
}

/// <summary>Fake payment gateway (test cards) / routing / push. Config-switchable to real stubs.</summary>
public interface IPaymentGateway
{
    Task<(bool Success, string? TransactionId, string? FailureReason)> ChargeAsync(string token, long amountMinor, string idempotencyKey, CancellationToken ct = default);
}

/// <summary>Local file store with validation; files are served only via authorised endpoints.</summary>
public interface IFileStore
{
    Task<(Guid Id, string StoredName)> SaveAsync(Stream content, string fileName, string contentType, string purpose, CancellationToken ct = default);
    Task<Stream?> OpenAsync(Guid id, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

/// <summary>Real-time notification fan-out (SignalR + fake push recorder).</summary>
public interface INotifier
{
    Task NotifyUserAsync(Guid userId, NotificationType type, string title, string body, string? deepLink, CancellationToken ct = default);
    Task PushAsync(Guid userId, string title, string body, string? deepLink, CancellationToken ct = default);
    Task NotifyLocationAsync(Guid userId, Guid? requestId, double latitude, double longitude, CancellationToken ct = default) => Task.CompletedTask;
    Task BroadcastRoleAsync(Role role, string eventName, object payload, CancellationToken ct = default) => Task.CompletedTask;
    Task BroadcastUserEventAsync(Guid userId, string eventName, object payload, CancellationToken ct = default) => Task.CompletedTask;
}
