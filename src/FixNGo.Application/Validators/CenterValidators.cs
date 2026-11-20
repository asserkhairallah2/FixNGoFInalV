using FixNGo.Application.DTOs;
using FluentValidation;

namespace FixNGo.Application.Validators;

public sealed class CreateBookingValidator : AbstractValidator<CreateBookingRequest>
{
    public CreateBookingValidator()
    {
        RuleFor(x => x.CenterId).NotEmpty();
        RuleFor(x => x.ServiceId).NotEmpty();
        RuleFor(x => x.SlotStart).NotEqual(default(DateTime));
        RuleFor(x => x.Note).MaximumLength(600);
    }
}

public sealed class CenterServiceRequestValidator : AbstractValidator<CenterServiceRequest>
{
    public CenterServiceRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(140);
        RuleFor(x => x.Description).MaximumLength(600);
        RuleFor(x => x.PriceMinor).GreaterThan(0);
        RuleFor(x => x.DurationMinutes).InclusiveBetween(10, 480);
    }
}

public sealed class CenterProfileRequestValidator : AbstractValidator<CenterProfileRequest>
{
    public CenterProfileRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(160);
        RuleFor(x => x.Address).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Phone).NotEmpty().MaximumLength(30);
        RuleFor(x => x.Description).MaximumLength(1000);
    }
}

public sealed class CompleteBookingRequestValidator : AbstractValidator<CompleteBookingRequest>
{
    public CompleteBookingRequestValidator()
    {
        RuleFor(x => x.ExtraMinor).GreaterThanOrEqualTo(0);
        RuleFor(x => x.ExtraDescription).MaximumLength(240);
        RuleFor(x => x.Notes).MaximumLength(600);
    }
}
