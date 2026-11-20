using FixNGo.Domain;
using FixNGo.Domain.Entities;
using FixNGo.Domain.Specifications;
using FixNGo.Domain.ValueObjects;
using FluentAssertions;

namespace FixNGo.Domain.Tests;

public sealed class ActiveServiceCenterSpecification : Specification<ServiceCenter>
{
    public ActiveServiceCenterSpecification(decimal minRating)
        : base(c => c.Rating >= minRating)
    {
        ApplyOrderByDescending(c => c.Rating);
        ApplyPaging(0, 10);
    }
}

public sealed class ValueObjectsAndSpecsTests
{
    [Fact]
    public void Domain_Assembly_Has_Zero_External_Package_Dependencies()
    {
        var referenced = typeof(BaseEntity).Assembly.GetReferencedAssemblies()
            .Select(a => a.Name!)
            .Where(n => !n.StartsWith("System", StringComparison.Ordinal) && n != "netstandard")
            .ToList();

        referenced.Should().BeEmpty("FixNGo.Domain must remain pure C# with zero external framework dependencies");
    }

    [Theory]
    [InlineData("01012345678", "+201012345678")]
    [InlineData("+201198765432", "+201198765432")]
    [InlineData("00201234567890", "+201234567890")]
    public void EgyptianPhoneNumber_Normalizes_Valid_Numbers(string input, string expected)
    {
        var phone = new EgyptianPhoneNumber(input);
        phone.Value.Should().Be(expected);
    }

    [Fact]
    public void EgyptianPhoneNumber_Rejects_Invalid_Prefix()
    {
        var act = () => new EgyptianPhoneNumber("+19995551234");
        act.Should().Throw<DomainException>().Where(e => e.Code == "phone.invalid");
    }

    [Fact]
    public void VehiclePlate_Normalizes_Whitespace_And_Case()
    {
        var plate = new VehiclePlate("  e2e   9081 ");
        plate.Normalized.Should().Be("E2E 9081");
    }

    [Fact]
    public void GeoCoordinate_Computes_Positive_Cairo_Distance()
    {
        var downtown = new GeoCoordinate(30.0444, 31.2357);
        var newCairo = new GeoCoordinate(30.0074, 31.4913);
        downtown.DistanceKmTo(newCairo).Should().BeInRange(20, 30);
    }

    [Fact]
    public void Specification_Configures_Criteria_Sorting_And_Paging()
    {
        var spec = new ActiveServiceCenterSpecification(4.0m);
        spec.Criteria.Should().NotBeNull();
        spec.OrderByDescending.Should().NotBeNull();
        spec.Skip.Should().Be(0);
        spec.Take.Should().Be(10);
    }
}
