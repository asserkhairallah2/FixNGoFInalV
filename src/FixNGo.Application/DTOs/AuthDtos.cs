using FixNGo.Domain;

namespace FixNGo.Application.DTOs;

public sealed record SignupRequest(string FullName, string Email, string Phone, string Password, string Role, string? BusinessName = null);
public sealed record VerifyOtpRequest(string Target, string Code, OtpPurpose Purpose, bool IssueSession = false);
public sealed record ResendOtpRequest(string Target, OtpPurpose Purpose = OtpPurpose.Signup);
public sealed record LoginRequest(string Email, string Password, string? TotpCode = null);
public sealed record RefreshRequest(string RefreshToken);
public sealed record ForgotPasswordRequest(string Email);
public sealed record ResetPasswordRequest(string ResetToken, string NewPassword);
public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public sealed record UpdateMeRequest(
    string? FullName = null, string? Email = null, string? Phone = null,
    string? Language = null, string? Theme = null, bool? OtpOnLogin = null,
    double? Latitude = null, double? Longitude = null, string? AreaLabel = null);
public sealed record TwoFactorSetupDto(string Secret, string OtpauthUri, string CurrentCode);
public sealed record TwoFactorVerifyRequest(string Code);
public sealed record TwoFactorEnableDto(bool Enabled, IReadOnlyList<string> RecoveryCodes);
public sealed record TwoFactorDisableRequest(string? Password = null, string? Code = null);

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
    bool IsSuperAdmin,
    bool OtpOnLogin = false,
    double? Latitude = null,
    double? Longitude = null,
    string? AreaLabel = null);

public sealed record OtpResponse(string Target, int ExpiresInSeconds, string? DevCode);

public static class UserDtoMapper
{
    public static UserDto ToDto(Domain.Entities.User u) => new(
        u.Id, u.FullName, u.Email, u.Phone, u.Role, u.Status, u.KycStatus,
        u.Language, u.Theme, u.TwoFactorEnabled, u.IsSuperAdmin,
        u.OtpOnLogin, u.Latitude, u.Longitude, u.AreaLabel);
}
