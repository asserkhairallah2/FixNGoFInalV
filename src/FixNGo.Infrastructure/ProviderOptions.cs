using FixNGo.Application.Interfaces;
using FixNGo.Domain;

namespace FixNGo.Infrastructure;

/// <summary>Thrown when a provider is set to Real but no real implementation or credentials are bundled.</summary>
public sealed class ProviderNotConfiguredException : Exception
{
    public ProviderNotConfiguredException(string provider)
        : base($"Provider '{provider}' is configured as 'Real', but this build bundles no real {provider} adapter or credentials. " +
              $"Set Providers:{provider}=Fake to use the functional fake, or add the real adapter and keys described in docs/PROVIDERS.md.")
    {
        Provider = provider;
    }

    public string Provider { get; }
}

/// <summary>Selection for an external provider. Fake is the only bundled implementation.</summary>
public enum ProviderMode { Fake, Real }

/// <summary>Provider configuration parsed from Providers:Otp|Payments|Maps|Push.</summary>
public sealed record ProviderOptions(ProviderMode Otp, ProviderMode Payments, ProviderMode Maps, ProviderMode Push)
{
    public static ProviderOptions Fake => new(ProviderMode.Fake, ProviderMode.Fake, ProviderMode.Fake, ProviderMode.Fake);

    /// <summary>Parses raw config; a Real selection fails fast instead of silently falling back to Fake.</summary>
    public static ProviderOptions FromValues(string? otp, string? payments, string? maps, string? push) =>
        new(Parse("Otp", otp), Parse("Payments", payments), Parse("Maps", maps), Parse("Push", push));

    private static ProviderMode Parse(string name, string? value)
    {
        var mode = string.IsNullOrWhiteSpace(value) ? "Fake" : value.Trim();
        if (mode.Equals("Fake", StringComparison.OrdinalIgnoreCase)) return ProviderMode.Fake;
        if (mode.Equals("Real", StringComparison.OrdinalIgnoreCase)) throw new ProviderNotConfiguredException(name);
        throw new ArgumentException($"Providers:{name} must be 'Fake' or 'Real' (got '{mode}'). See docs/PROVIDERS.md.", nameof(value));
    }
}

/// <summary>Real-provider stubs. They throw on first use so an unconfigured Real provider never silently uses a fake.</summary>
public sealed class RealOtpSender : IOtpSender
{
    public Task SendAsync(string recipient, string? recipientName, SimChannel channel, string code, string purpose, CancellationToken ct = default) =>
        throw new ProviderNotConfiguredException("Otp");
}

public sealed class RealPaymentGateway : IPaymentGateway
{
    public Task<(bool Success, string? TransactionId, string? FailureReason)> ChargeAsync(
        string token, long amountMinor, string idempotencyKey, CancellationToken ct = default) =>
        throw new ProviderNotConfiguredException("Payments");
}
