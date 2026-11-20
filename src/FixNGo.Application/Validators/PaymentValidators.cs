using FixNGo.Application.DTOs;
using FluentValidation;

namespace FixNGo.Application.Validators;

public sealed class AddCardRequestValidator : AbstractValidator<AddCardRequest>
{
    public AddCardRequestValidator()
    {
        RuleFor(x => x.Number)
            .NotEmpty()
            .Must(PassesLuhn)
            .WithMessage("Card number failed Luhn check.");
        RuleFor(x => x.ExpMonth).InclusiveBetween(1, 12);
        RuleFor(x => x.ExpYear).InclusiveBetween(DateTime.UtcNow.Year, DateTime.UtcNow.Year + 20);
        RuleFor(x => x.Label).MaximumLength(80);
    }

    public static bool PassesLuhn(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return false;
        var digits = raw.Where(char.IsDigit).ToArray();
        if (digits.Length is < 12 or > 19) return false;
        var sum = 0;
        var alternate = false;
        for (var i = digits.Length - 1; i >= 0; i--)
        {
            var n = digits[i] - '0';
            if (alternate)
            {
                n *= 2;
                if (n > 9) n -= 9;
            }
            sum += n;
            alternate = !alternate;
        }
        return sum % 10 == 0;
    }
}

public sealed class AddBankAccountRequestValidator : AbstractValidator<AddBankAccountRequest>
{
    public AddBankAccountRequestValidator()
    {
        RuleFor(x => x.HolderName).NotEmpty().MaximumLength(140);
        RuleFor(x => x.BankCode).NotEmpty().MaximumLength(32);
        RuleFor(x => x.Iban)
            .NotEmpty()
            .MinimumLength(14)
            .MaximumLength(34);
    }
}

public sealed class WithdrawRequestValidator : AbstractValidator<WithdrawRequest>
{
    public WithdrawRequestValidator()
    {
        RuleFor(x => x.AmountMinor).GreaterThan(0);
    }
}
