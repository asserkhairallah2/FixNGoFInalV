using FixNGo.Application.DTOs;
using FixNGo.Domain;
using FluentValidation;

namespace FixNGo.Application.Validators;

public sealed class SignupValidator : AbstractValidator<SignupRequest>
{
    public SignupValidator()
    {
        RuleFor(x => x.FullName).Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Full name is required.")
            .MinimumLength(2).WithMessage("Full name must be at least 2 characters.")
            .MaximumLength(120).WithMessage("Full name must not exceed 120 characters.");
        RuleFor(x => x.Email).Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Email address is required.")
            .EmailAddress().WithMessage("Please enter a valid email address.")
            .MaximumLength(254).WithMessage("Email address is too long.");
        RuleFor(x => x.Phone).Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Mobile number is required.")
            .Must(Rules.EgyptianMobile).WithMessage("Enter a valid Egyptian mobile number (e.g. 01012345678 or +201012345678).");
        RuleFor(x => x.Password).Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Password is required.")
            .Must(Rules.PasswordPolicy).WithMessage(x => Rules.DescribePasswordError(x.Password));
        RuleFor(x => x.Role).Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Please choose an account role.")
            .Must(r => r is "CarOwner" or "Mechanic" or "TowCaptain" or "ServiceCenter")
            .WithMessage("Admin cannot self-register.");
        RuleFor(x => x.BusinessName).MaximumLength(160).When(x => x.BusinessName is not null);
    }
}

public sealed class LoginValidator : AbstractValidator<LoginRequest>
{
    public LoginValidator()
    {
        RuleFor(x => x.Email).Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Email address is required.")
            .EmailAddress().WithMessage("Please enter a valid email address.");
        RuleFor(x => x.Password).NotEmpty().WithMessage("Password is required.");
    }
}

public sealed class ForgotValidator : AbstractValidator<ForgotPasswordRequest>
{
    public ForgotValidator() => RuleFor(x => x.Email).Cascade(CascadeMode.Stop)
        .NotEmpty().WithMessage("Email address is required.")
        .EmailAddress().WithMessage("Please enter a valid email address.");
}

public sealed class ResetValidator : AbstractValidator<ResetPasswordRequest>
{
    public ResetValidator()
    {
        RuleFor(x => x.ResetToken).NotEmpty().WithMessage("Reset verification token is required.");
        RuleFor(x => x.NewPassword).Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("New password is required.")
            .Must(Rules.PasswordPolicy).WithMessage(x => Rules.DescribePasswordError(x.NewPassword));
    }
}

public sealed class ChangePasswordValidator : AbstractValidator<ChangePasswordRequest>
{
    public ChangePasswordValidator()
    {
        RuleFor(x => x.CurrentPassword).NotEmpty().WithMessage("Current password is required.");
        RuleFor(x => x.NewPassword).Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("New password is required.")
            .Must(Rules.PasswordPolicy).WithMessage(x => Rules.DescribePasswordError(x.NewPassword));
    }
}
