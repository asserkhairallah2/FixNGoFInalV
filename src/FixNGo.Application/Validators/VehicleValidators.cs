using FixNGo.Application.DTOs;
using FixNGo.Domain;
using FluentValidation;

namespace FixNGo.Application.Validators;

public sealed class VehicleRequestValidator : AbstractValidator<VehicleRequest>
{
    public VehicleRequestValidator()
    {
        RuleFor(x => x.Make).NotEmpty().MaximumLength(80);
        RuleFor(x => x.Model).NotEmpty().MaximumLength(80);
        RuleFor(x => x.Year).InclusiveBetween(1970, DateTime.UtcNow.Year + 2);
        RuleFor(x => x.Plate).NotEmpty().MinimumLength(2).MaximumLength(20);
        RuleFor(x => x.Color).NotEmpty().MaximumLength(40);
        RuleFor(x => x.Fuel)
            .NotEmpty()
            .Must(f => Enum.TryParse<FuelType>(f, ignoreCase: true, out _))
            .WithMessage("Fuel must be a supported fuel type.");
    }
}
