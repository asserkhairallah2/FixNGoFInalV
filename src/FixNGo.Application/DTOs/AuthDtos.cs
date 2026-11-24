using FixNGo.Domain;

namespace FixNGo.Application.DTOs;

public sealed record SignupRequest(string FullName, string Email, string Phone, string Password, string Role, string? BusinessName = null);
public sealed record VerifyOtpRequest(string Target, string Code, OtpPurpose Purpose, bool IssueSession = false);
public sealed record ResendOtpRequest(string Target, OtpPurpose Purpose = OtpPurpose.Signup);
public sealed record LoginRequest(string Email, string Password, string? TotpCode = null, string? TwoFactorMethod = null);
public sealed record RefreshRequest(string RefreshToken);
public sealed record ForgotPasswordRequest(string Email);
public sealed record ResetPasswordRequest(string ResetToken, string NewPassword);
public sealed record ChangePasswordRequest(
    string CurrentPassword,
    string NewPassword,
    string? StepUpToken = null,
    string? TwoFactorMethod = null,
    string? TwoFactorCode = null);
public sealed record UpdateMeRequest(
    string? FullName = null, string? Email = null, string? Phone = null,
    string? Language = null, string? Theme = null, bool? OtpOnLogin = null,
    double? Latitude = null, double? Longitude = null, string? AreaLabel = null,
    string? StepUpToken = null, string? TwoFactorMethod = null, string? TwoFactorCode = null);

public sealed record TwoFactorSetupDto(string Secret, string OtpauthUri, string CurrentCode);
public sealed record TwoFactorVerifyRequest(string Code, string? StepUpToken = null);
public sealed record TwoFactorEnableDto(
    bool Enabled,
    IReadOnlyList<string> RecoveryCodes,
    bool TotpEnabled = false,
    bool SmsEnabled = false,
    string? StepUpToken = null);
public sealed record TwoFactorDisableRequest(
    string? Password = null,
    string? Code = null,
    string? Method = null,
    string? StepUpToken = null);

public sealed record TwoFactorStatusDto(
    bool TwoFactorEnabled,
    bool TotpEnabled,
    bool SmsEnabled,
    IReadOnlyList<string> AvailableMethods,
    string? MaskedPhone,
    string? Phone,
    bool HasRecoveryCodes);

public sealed record LoginFlowResult(
    bool RequiresTwoFactor,
    AuthResponse? Session,
    string? ChallengeToken = null,
    IReadOnlyList<string>? AvailableMethods = null,
    string? MaskedPhone = null,
    string? DefaultMethod = null,
    bool SmsSent = false,
    string? DevCode = null);

public sealed record ResetOtpFlowResult(
    bool RequiresTwoFactor,
    string? ResetToken,
    string? ChallengeToken = null,
    IReadOnlyList<string>? AvailableMethods = null,
    string? MaskedPhone = null,
    string? DefaultMethod = null,
    bool SmsSent = false,
    string? DevCode = null);

public sealed record VerifyTwoFactorChallengeRequest(string ChallengeToken, string Method, string Code);
public sealed record SendTwoFactorSmsRequest(string? ChallengeToken = null, string? StepUpToken = null);
public sealed record TwoFactorSmsDispatchDto(string MaskedPhone, int ExpiresInSeconds, string? DevCode = null);
public sealed record StepUpVerifyRequest(string Method, string Code);
public sealed record StepUpTokenDto(string StepUpToken, DateTime ExpiresAt);

public sealed record InAppResetStartDto(
    string Target,
    int ExpiresInSeconds,
    bool RequiresTwoFactor,
    IReadOnlyList<string> AvailableMethods,
    string? MaskedPhone,
    string? DevCode = null);

public sealed record InAppResetCompleteRequest(
    string EmailCode,
    string NewPassword,
    string? TwoFactorMethod = null,
    string? TwoFactorCode = null,
    string? StepUpToken = null);

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
    string? AreaLabel = null,
    bool TotpEnabled = false,
    bool SmsTwoFactorEnabled = false,
    string? MaskedPhone = null);

public sealed record OtpResponse(string Target, int ExpiresInSeconds, string? DevCode);

public static class UserDtoMapper
{
    public static string? MaskPhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return null;
        var p = phone.Trim();
        if (p.Length <= 6) return p;
        return $"{p[..4]}{new string('•', Math.Max(4, p.Length - 8))}{p[^4..]}";
    }

    public static UserDto ToDto(Domain.Entities.User u)
    {
        var totp = u.TotpEnabled || (u.TwoFactorEnabled && !string.IsNullOrWhiteSpace(u.TwoFactorSecret));
        var sms = u.SmsTwoFactorEnabled;
        var any2Fa = totp || sms || u.TwoFactorEnabled;
        return new(
            u.Id, u.FullName, u.Email, u.Phone, u.Role, u.Status, u.KycStatus,
            u.Language, u.Theme, any2Fa, u.IsSuperAdmin,
            u.OtpOnLogin, u.Latitude, u.Longitude, u.AreaLabel,
            totp, sms, MaskPhone(u.Phone));
    }
}
