using FixNGo.Application.Interfaces;
using FixNGo.Infrastructure.Repositories;
using FixNGo.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FixNGo.Infrastructure;

/// <summary>
/// Registers Infrastructure persistence (SQLite for local/portable dev or SQL Server for production),
/// generic Repositories, Unit of Work, Caching, Idempotency, Outbox, and Strategy/Adapter providers.
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddFixNGoInfrastructure(
        this IServiceCollection services,
        RuntimePaths paths,
        string connectionString,
        ProviderOptions? providers = null,
        string databaseProvider = "Sqlite")
    {
        providers ??= ProviderOptions.Fake;
        var useSqlServer = string.Equals(databaseProvider, "SqlServer", StringComparison.OrdinalIgnoreCase);

        services.AddMemoryCache();
        services.AddDbContext<AppDbContext>(options =>
        {
            if (useSqlServer)
            {
                options.UseSqlServer(connectionString, o =>
                {
                    o.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName);
                    o.EnableRetryOnFailure(3);
                });
            }
            else
            {
                options.UseSqlite(connectionString, o => o.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName));
            }
        });

        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());
        services.AddScoped(typeof(IRepository<>), typeof(EfRepository<>));
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        services.AddSingleton<ICacheService, MemoryCacheService>();
        services.AddSingleton<IIdempotencyStore, IdempotencyStore>();
        services.AddSingleton<IOutboxPublisher, InMemoryOutboxPublisher>();
        services.AddSingleton<IRoutingService, HaversineRoutingService>();
        services.AddSingleton<IGeocoderService, CairoGeocoderService>();

        services.AddSingleton<IClock, SystemClock>();
        services.AddSingleton<IPasswordHasher, PasswordHasherService>();

        // Provider selection is configuration-driven (Strategy/Adapter pattern, SDD §4.3).
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
