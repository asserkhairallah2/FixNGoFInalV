namespace FixNGo.Web.ViewModels;

/// <summary>Strongly-typed Razor ViewModel for the FixNGo ASP.NET Core MVC host shell.</summary>
public sealed class AppShellViewModel
{
    public required SystemStatusViewModel SystemStatus { get; init; }
    public required UiPreferencesViewModel Preferences { get; init; }
    public string PageTitle { get; init; } = "FixNGo";
    public string? InitialRouteHint { get; init; }
    public string ServerTimestampUtc { get; init; } = DateTime.UtcNow.ToString("O");
    public string JsBundlePath { get; init; } = "/assets/fixngo-app.js";
    public string CssBundlePath { get; init; } = "/assets/fixngo-app.css";
}

/// <summary>Platform status projection for Razor Views and ViewComponents (never a Domain entity).</summary>
public sealed class SystemStatusViewModel
{
    public bool SetupComplete { get; init; }
    public string Mode { get; init; } = "real";
    public string Version { get; init; } = "1.0.0";
    public bool SimulatorsEnabled { get; init; }
    public int TotalUsers { get; init; }
    public string DatabaseProvider { get; init; } = "Sqlite";
}

/// <summary>User interface language, direction and theme settings resolved on the server.</summary>
public sealed class UiPreferencesViewModel
{
    public string Language { get; init; } = "en";
    public string Theme { get; init; } = "light";
    public bool IsArabic => string.Equals(Language, "ar", StringComparison.OrdinalIgnoreCase);
    public bool IsDark => string.Equals(Theme, "dark", StringComparison.OrdinalIgnoreCase);
    public string Direction => IsArabic ? "rtl" : "ltr";
}

/// <summary>Single service center card ViewModel for the MVC Service Centers directory.</summary>
public sealed class ServiceCenterItemViewModel
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Address { get; init; } = string.Empty;
    public string City { get; init; } = string.Empty;
    public decimal Rating { get; init; }
    public int RatingCount { get; init; }
    public int RecommendPercent { get; init; }
    public string? Description { get; init; }
    public string? Phone { get; init; }
    public IReadOnlyList<string> Services { get; init; } = [];
    public decimal? StartingPriceEgp { get; init; }
    public bool IsVerified { get; init; } = true;
}

/// <summary>Searchable, filterable, sortable and paginated MVC ViewModel for Service Centers.</summary>
public sealed class ServiceCenterCatalogViewModel
{
    public string? SearchQuery { get; init; }
    public string? SelectedCity { get; init; }
    public string? SelectedCategory { get; init; }
    public string SortBy { get; init; } = "all";
    public int CurrentPage { get; init; } = 1;
    public int PageSize { get; init; } = 6;
    public int TotalCount { get; init; }
    public int TotalPages => Math.Max(1, (int)Math.Ceiling(TotalCount / (double)Math.Max(1, PageSize)));
    public IReadOnlyList<string> AvailableCities { get; init; } = [];
    public IReadOnlyList<ServiceCenterItemViewModel> Centers { get; init; } = [];
}

/// <summary>Detailed MVC ViewModel for a single verified Service Center, catalog, and customer reviews.</summary>
public sealed class ServiceCenterDetailsViewModel
{
    public required ServiceCenterItemViewModel Center { get; init; }
    public IReadOnlyList<ServiceOfferingViewModel> Services { get; init; } = [];
    public IReadOnlyList<CustomerReviewViewModel> Reviews { get; init; } = [];
}

public sealed class CustomerReviewViewModel
{
    public Guid Id { get; init; }
    public string AuthorName { get; init; } = "Verified Driver";
    public int Stars { get; init; }
    public string? Text { get; init; }
    public bool Recommend { get; init; }
    public string? ContextLabel { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class ServiceOfferingViewModel
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public decimal PriceEgp { get; init; }
    public int DurationMinutes { get; init; }
    public bool IsActive { get; init; }
}

/// <summary>Clean Architecture and runtime diagnostics ViewModel rendered by ArchitectureMvcController.</summary>
public sealed class ArchitectureOverviewViewModel
{
    public required SystemStatusViewModel SystemStatus { get; init; }
    public required string ActiveDatabaseProvider { get; init; }
    public int EntityCount { get; init; }
    public int EntityConfigurationCount { get; init; }
    public int ApplicationServiceInterfaceCount { get; init; }
    public int ValidatorCount { get; init; }
    public IReadOnlyList<ArchitectureLayerItemViewModel> Layers { get; init; } = [];
    public IReadOnlyList<string> ImplementedPatterns { get; init; } = [];
}

public sealed record ArchitectureLayerItemViewModel(
    string Name,
    string AssemblyName,
    string Responsibility,
    IReadOnlyList<string> AllowedDependencies);
