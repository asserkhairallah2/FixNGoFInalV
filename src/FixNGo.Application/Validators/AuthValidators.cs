using FixNGo.Application.DTOs;
using FixNGo.Domain;
using FluentValidation;

namespace FixNGo.Application.Validators;

public sealed class SignupValidator : AbstractValidator<SignupRequest>
{
    public SignupValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MinimumLength(2).MaximumLength(120);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(254);
        RuleFor(x => x.Phone).NotEmpty().Must(Rules.EgyptianMobile).WithMessage("A valid Egyptian mobile number is required.");
        RuleFor(x => x.Password).NotEmpty().Must(Rules.PasswordPolicy)
            .WithMessage("Password must be 8+ chars with upper, lower, digit and symbol.");
        RuleFor(x => x.Role).NotEmpty().Must(r => r is "CarOwner" or "Mechanic" or "TowCaptain" or "ServiceCenter")
            .WithMessage("Admin cannot self-register.");
        RuleFor(x => x.BusinessName).MaximumLength(160).When(x => x.BusinessName is not null);
    }
}

public sealed class LoginValidator : AbstractValidator<LoginRequest>
{
    public LoginValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty();
    }
}

public sealed class ForgotValidator : AbstractValidator<ForgotPasswordRequest>
{
    public ForgotValidator() => RuleFor(x => x.Email).NotEmpty().EmailAddress();
}

public sealed class ResetValidator : AbstractValidator<ResetPasswordRequest>
{
    public ResetValidator()
    {
        RuleFor(x => x.ResetToken).NotEmpty();
        RuleFor(x => x.NewPassword).NotEmpty().Must(Rules.PasswordPolicy)
            .WithMessage("Password must be 8+ chars with upper, lower, digit and symbol.");
    }
}

public sealed class ChangePasswordValidator : AbstractValidator<ChangePasswordRequest>
{
    public ChangePasswordValidator()
    {
        RuleFor(x => x.CurrentPassword).NotEmpty();
        RuleFor(x => x.NewPassword).NotEmpty().Must(Rules.PasswordPolicy)
            .WithMessage("Password must be 8+ chars with upper, lower, digit and symbol.");
    }
}
