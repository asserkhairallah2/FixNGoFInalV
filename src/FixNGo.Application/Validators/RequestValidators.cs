using FixNGo.Application.DTOs;
using FluentValidation;

namespace FixNGo.Application.Validators;

public sealed class CreateRequestValidator : AbstractValidator<CreateRequestRequest>
{
    public CreateRequestValidator()
    {
        RuleFor(x => x.ServiceTypeId).NotEmpty();
        RuleFor(x => x.PickupLatitude).InclusiveBetween(-90, 90);
        RuleFor(x => x.PickupLongitude).InclusiveBetween(-180, 180);
        RuleFor(x => x.PickupAddress).NotEmpty().MaximumLength(300);
        RuleFor(x => x.DistanceKm).GreaterThanOrEqualTo(0).LessThanOrEqualTo(1000);
        RuleFor(x => x.Problem).MaximumLength(500);
        RuleFor(x => x.Note).MaximumLength(1000);
    }
}

public sealed class EstimateRequestValidator : AbstractValidator<EstimateRequest>
{
    public EstimateRequestValidator()
    {
        RuleFor(x => x.ServiceTypeId).NotEmpty();
        RuleFor(x => x.DistanceKm).GreaterThanOrEqualTo(0).LessThanOrEqualTo(1000);
    }
}

public sealed class CreateQuoteValidator : AbstractValidator<CreateQuoteRequest>
{
    public CreateQuoteValidator()
    {
        RuleFor(x => x.CalloutMinor).GreaterThanOrEqualTo(0);
        RuleFor(x => x.LaborMinor).GreaterThanOrEqualTo(0);
        RuleFor(x => x.PartsMinor).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Diagnosis).MaximumLength(1000);
    }
}

public sealed class DisputeRequestValidator : AbstractValidator<DisputeRequest>
{
    public DisputeRequestValidator()
    {
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(800);
        RuleFor(x => x.ProposedResolution).MaximumLength(500);
    }
}

public sealed class CancelRequestValidator : AbstractValidator<CancelRequestRequest>
{
    public CancelRequestValidator()
    {
        RuleFor(x => x.ReasonKey).NotEmpty().MaximumLength(80);
        RuleFor(x => x.Note).MaximumLength(500);
    }
}
