using AutoMapper;
using FixNGo.Application;
using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Application.Mapping;
using FixNGo.Application.Validators;
using FixNGo.Domain;
using FixNGo.Domain.Entities;
using FluentAssertions;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace FixNGo.Application.Tests;

public sealed class CleanArchitectureApplicationTests
{
    [Fact]
    public void Application_Assembly_Does_Not_Reference_Infrastructure_Or_Web()
    {
        var refs = typeof(IRequestService).Assembly.GetReferencedAssemblies()
            .Select(a => a.Name!)
            .ToList();

        refs.Should().Contain("FixNGo.Domain");
        refs.Should().NotContain("FixNGo.Infrastructure");
        refs.Should().NotContain("FixNGo.Web");
    }

    [Fact]
    public void AutoMapper_FixNGoMappingProfile_Maps_Domain_Entities_To_Dtos()
    {
        var config = new MapperConfiguration(cfg => cfg.AddProfile<FixNGoMappingProfile>());
        var mapper = config.CreateMapper();

        var vehicle = new Vehicle
        {
            Make = "Toyota",
            Model = "Corolla",
            Year = 2023,
            Plate = "CAI-401",
            Color = "Silver",
            Fuel = FuelType.Petrol,
            IsPrimary = true
        };

        var dto = mapper.Map<VehicleDto>(vehicle);
        dto.Make.Should().Be("Toyota");
        dto.Model.Should().Be("Corolla");
        dto.Year.Should().Be(2023);
        dto.Fuel.Should().Be("Petrol");
        dto.IsPrimary.Should().BeTrue();
    }

    [Fact]
    public async Task FluentValidation_Validators_Are_Registered_Across_Core_Modules()
    {
        var services = new ServiceCollection();
        services.AddFixNGoApplication();
        using var provider = services.BuildServiceProvider();

        var vehicleValidator = provider.GetRequiredService<IValidator<VehicleRequest>>();
        var invalidVehicle = await vehicleValidator.ValidateAsync(new VehicleRequest("", "", 1800, "", "", "Steam"));
        invalidVehicle.IsValid.Should().BeFalse();

        var reviewValidator = provider.GetRequiredService<IValidator<CreateReviewRequest>>();
        var invalidReview = await reviewValidator.ValidateAsync(new CreateReviewRequest(9, "Out of bounds"));
        invalidReview.IsValid.Should().BeFalse();

        var ticketValidator = provider.GetRequiredService<IValidator<CreateTicketRequest>>();
        var validTicket = await ticketValidator.ValidateAsync(new CreateTicketRequest("Account", "Help", "Need assistance"));
        validTicket.IsValid.Should().BeTrue();
    }
}
