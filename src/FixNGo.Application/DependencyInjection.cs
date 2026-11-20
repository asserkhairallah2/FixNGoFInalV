using FixNGo.Application.Interfaces;
using FixNGo.Application.Mapping;
using FixNGo.Application.Services;
using FixNGo.Application.Validators;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace FixNGo.Application;

/// <summary>
/// Registers all Clean Architecture Application layer services, AutoMapper profiles,
/// and FluentValidation validators with Scoped lifetimes.
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddFixNGoApplication(this IServiceCollection services)
    {
        services.AddAutoMapper(typeof(FixNGoMappingProfile).Assembly);
        services.AddValidatorsFromAssembly(typeof(SignupValidator).Assembly);

        RegisterScoped<ISystemStatusService, SystemStatusService>(services);
        RegisterScoped<ISettingsService, SettingsService>(services);
        RegisterScoped<IAuthService, AuthService>(services);
        RegisterScoped<IFileAccessService, FileAccessService>(services);
        RegisterScoped<IVehicleService, VehicleService>(services);
        RegisterScoped<ILookupService, LookupService>(services);
        RegisterScoped<IRequestService, RequestService>(services);
        RegisterScoped<IOfferService, OfferService>(services);
        RegisterScoped<IQuoteService, QuoteService>(services);
        RegisterScoped<IPaymentService, PaymentService>(services);
        RegisterScoped<ICenterService, CenterService>(services);
        RegisterScoped<IProviderService, ProviderService>(services);
        RegisterScoped<INotificationService, NotificationService>(services);
        RegisterScoped<IReviewService, ReviewService>(services);
        RegisterScoped<IChatService, ChatService>(services);
        RegisterScoped<ISupportService, SupportService>(services);
        RegisterScoped<IAdminService, AdminService>(services);

        return services;
    }

    private static void RegisterScoped<TInterface, TImplementation>(IServiceCollection services)
        where TInterface : class
        where TImplementation : class, TInterface
    {
        services.AddScoped<TImplementation>();
        services.AddScoped<TInterface>(sp => sp.GetRequiredService<TImplementation>());
    }
}
