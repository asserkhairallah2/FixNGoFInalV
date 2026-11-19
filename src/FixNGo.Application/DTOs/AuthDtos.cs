using FixNGo.Domain;

namespace FixNGo.Application.DTOs;

public sealed record SignupRequest(string FullName, string Email, string Phone, string Password, string Role, string? BusinessName = null);
public sealed record VerifyOtpRequest(string Target, string Code, OtpPurpose Purpose);
public sealed record LoginRequest(string Email, string Password);
public sealed record RefreshRequest(string RefreshToken);
public sealed record ForgotPasswordRequest(string Email);
public sealed record ResetPasswordRequest(string ResetToken, string NewPassword);
public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public sealed record AuthResponse(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAt,
    UserDto User);

public sealed record UserDto(
    Guid Id,
    string FullName,
    string Email,
    string? Phone,
    Role Role,
    UserStatus Status,
    KycStatus KycStatus,
    string Language,
    string Theme,
    bool TwoFactorEnabled,
    bool IsSuperAdmin);

public sealed record OtpResponse(string Target, int ExpiresInSeconds, string? DevCode);

public static class UserDtoMapper
{
    public static UserDto ToDto(Domain.Entities.User u) => new(
        u.Id, u.FullName, u.Email, u.Phone, u.Role, u.Status, u.KycStatus,
        u.Language, u.Theme, u.TwoFactorEnabled, u.IsSuperAdmin);
}
