using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using FixNGo.Infrastructure;
using FixNGo.Infrastructure.Services;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace FixNGo.Application.Tests;

/// <summary>
/// Proves brief 05 §5: providers are configuration-switchable and a 'Real'
/// selection fails fast with a clear message instead of silently using a fake.
/// </summary>
public class ProviderOptionsTests
{
    [Fact]
    public void FromValues_AllFake_ReturnsFakeForEveryProvider()
    {
        var options = ProviderOptions.FromValues("Fake", "Fake", "Fake", "Fake");

        options.Otp.Should().Be(ProviderMode.Fake);
        options.Payments.Should().Be(ProviderMode.Fake);
        options.Maps.Should().Be(ProviderMode.Fake);
        options.Push.Should().Be(ProviderMode.Fake);
    }

    [Fact]
    public void FromValues_NullOrEmpty_DefaultsToFake()
    {
        var options = ProviderOptions.FromValues(null, "", "   ", null);
        options.Should().Be(ProviderOptions.Fake);
    }

    [Fact]
    public void FromValues_IsCaseInsensitive()
    {
        var options = ProviderOptions.FromValues("fake", "FAKE", "FaKe", "fake");
        options.Should().Be(ProviderOptions.Fake);
    }

    [Theory]
    [InlineData("Otp")]
    [InlineData("Payments")]
    [InlineData("Maps")]
    [InlineData("Push")]
    public void FromValues_Real_FailsFastWithClearMessage(string provider)
    {
        var values = new[] { "Fake", "Fake", "Fake", "Fake" };
        values[Array.IndexOf(new[] { "Otp", "Payments", "Maps", "Push" }, provider)] = "Real";

        var act = () => ProviderOptions.FromValues(values[0], values[1], values[2], values[3]);

        var ex = act.Should().Throw<ProviderNotConfiguredException>().Which;
        ex.Provider.Should().Be(provider);
        ex.Message.Should().Contain(provider)
            .And.Contain("docs/PROVIDERS.md")
            .And.Contain("Fake");
    }

    [Fact]
    public void FromValues_UnknownValue_ThrowsWithConfigKey()
    {
        var act = () => ProviderOptions.FromValues("Twilio", "Fake", "Fake", "Fake");
        act.Should().Throw<ArgumentException>().WithMessage("*Providers:Otp*");
    }

    [Fact]
    public async Task RealStubs_ThrowOnFirstUse_NeverSilentlyUseFake()
    {
        var otp = new RealOtpSender();
        var payments = new RealPaymentGateway();

        (await otp.Invoking(x => x.SendAsync("01000000000", null, SimChannel.Sms, "123456", "Login"))
            .Should().ThrowAsync<ProviderNotConfiguredException>()).Which.Provider.Should().Be("Otp");
        (await payments.Invoking(x => x.ChargeAsync("tok_fake_x", 100, "key"))
            .Should().ThrowAsync<ProviderNotConfiguredException>()).Which.Provider.Should().Be("Payments");
    }

    [Fact]
    public void DependencyInjection_FakeMode_RegistersFunctionalFakes()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddFixNGoInfrastructure(new RuntimePaths(), "Data Source=:memory:", ProviderOptions.Fake);

        using var provider = services.BuildServiceProvider();
        provider.GetRequiredService<IOtpSender>().Should().BeOfType<FakeOtpSender>();
        provider.GetRequiredService<IPaymentGateway>().Should().BeOfType<FakePaymentGateway>();
    }

    [Fact]
    public void DependencyInjection_RealMode_RegistersThrowingStubs()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        var real = new ProviderOptions(ProviderMode.Real, ProviderMode.Real, ProviderMode.Fake, ProviderMode.Fake);
        services.AddFixNGoInfrastructure(new RuntimePaths(), "Data Source=:memory:", real);

        using var provider = services.BuildServiceProvider();
        provider.GetRequiredService<IOtpSender>().Should().BeOfType<RealOtpSender>();
        provider.GetRequiredService<IPaymentGateway>().Should().BeOfType<RealPaymentGateway>();
    }
}
