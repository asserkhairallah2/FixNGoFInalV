using FixNGo.Application.Interfaces;
using FixNGo.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FixNGo.Infrastructure;

/// <summary>Registers infrastructure services and the EF Core context.</summary>
public static class DependencyInjection
{
    public static IServiceCollection AddFixNGoInfrastructure(this IServiceCollection services, RuntimePaths paths, string connectionString, ProviderOptions? providers = null)
    {
        providers ??= ProviderOptions.Fake;
        services.AddDbContext<AppDbContext>(options =>
        {
            options.UseSqlite(connectionString, o => o.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName));
        });
        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());
        services.AddSingleton<IClock, SystemClock>();
        services.AddSingleton<IPasswordHasher, PasswordHasherService>();
        // Provider selection is configuration-driven. A Real selection fails fast in
        // ProviderOptions.FromValues at startup; if constructed directly for tests, the
        // Real stubs throw ProviderNotConfiguredException on first use (never a silent fake).
        services.AddSingleton<FakeOtpSender>();
        services.AddScoped<FakePaymentGateway>();
        services.AddSingleton<IOtpSender>(sp => providers.Otp == ProviderMode.Real
            ? new RealOtpSender()
            : sp.GetRequiredService<FakeOtpSender>());
        services.AddScoped<IPaymentGateway>(sp => providers.Payments == ProviderMode.Real
            ? new RealPaymentGateway()
            : sp.GetRequiredService<FakePaymentGateway>());
        services.AddSingleton(paths);
        return services;
    }

    public static IServiceCollection AddFixNGoTokenService(this IServiceCollection services, byte[] signingKey, string issuer, string audience, int accessMinutes)
    {
        services.AddSingleton<ITokenService>(new TokenService(signingKey, issuer, audience, accessMinutes));
        return services;
    }

    /// <summary>Build a Sqlite connection string with WAL/busy timeout applied on every connection.</summary>
    public static string ConnectionString(RuntimePaths paths) =>
        $"Data Source={paths.DbPath};Cache=Shared;Pooling=True;Default Timeout=30";
}
