using AutoMapper;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using FixNGo.Infrastructure.Configurations;
using FixNGo.Web.Mapping;
using FixNGo.Web.ViewModels;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FixNGo.Web.Controllers;

/// <summary>
/// Primary ASP.NET Core MVC Controller rendering the FixNGo mobile platform shell via Razor Views
/// and strongly-typed C# ViewModels (replacing static index.html file serving).
/// </summary>
[AllowAnonymous]
public sealed class HomeController(
    ISystemStatusService systemStatus,
    IConfiguration configuration,
    IMapper mapper) : Controller
{
    [HttpGet("/")]
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var simulatorsEnabled = configuration.GetValue("Simulators:Enabled", true);
        var statusDto = await systemStatus.GetStatusAsync(simulatorsEnabled, ct);
        var statusVm = mapper.Map<SystemStatusViewModel>(statusDto);

        var langCookie = Request.Cookies["fixngo.lang"];
        var themeCookie = Request.Cookies["fixngo.theme"];
        var prefs = new UiPreferencesViewModel
        {
            Language = string.Equals(langCookie, "ar", StringComparison.OrdinalIgnoreCase) ? "ar" : "en",
            Theme = string.Equals(themeCookie, "dark", StringComparison.OrdinalIgnoreCase) ? "dark" : "light"
        };

        string? initialRoute = null;
        var reqPath = HttpContext.Request.Path.Value;
        if (!string.IsNullOrWhiteSpace(reqPath) && !string.Equals(reqPath, "/", StringComparison.Ordinal))
        {
            var cleaned = reqPath.Trim('/');
            if (!string.IsNullOrWhiteSpace(cleaned))
                initialRoute = "#/" + cleaned + HttpContext.Request.QueryString.Value;
        }

        var vm = new AppShellViewModel
        {
            PageTitle = "FixNGo",
            SystemStatus = statusVm,
            Preferences = prefs,
            InitialRouteHint = initialRoute,
            ServerTimestampUtc = DateTime.UtcNow.ToString("O")
        };

        return View("~/Views/Home/Index.cshtml", vm);
    }
}

/// <summary>
/// Server-rendered ASP.NET Core MVC Controller for browsing, searching, filtering, sorting,
/// and paginating verified Service Centers using Razor Views and ViewModels (STATE.md Cycle 2).
/// </summary>
[AllowAnonymous]
[Route("mvc/centers")]
public sealed class ServiceCentersMvcController(
    ICenterService centerService,
    IReviewService reviewService,
    IMapper mapper) : Controller
{
    [HttpGet("")]
    public async Task<IActionResult> Index(
        [FromQuery] string? q = null,
        [FromQuery] string? city = null,
        [FromQuery] string? category = null,
        [FromQuery] string sort = "all",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 6,
        CancellationToken ct = default)
    {
        var dtos = await centerService.CatalogAsync(ct);
        var mapped = dtos.Select(c => mapper.Map<ServiceCenterItemViewModel>(c)).ToList();

        var cities = mapped.Select(c => c.City).Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(c => c).ToList();

        IEnumerable<ServiceCenterItemViewModel> filtered = mapped;
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            filtered = filtered.Where(c =>
                c.Name.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                c.Address.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                c.Services.Any(s => s.Contains(term, StringComparison.OrdinalIgnoreCase)) ||
                (c.Description?.Contains(term, StringComparison.OrdinalIgnoreCase) ?? false));
        }

        if (!string.IsNullOrWhiteSpace(city))
        {
            filtered = filtered.Where(c => string.Equals(c.City, city.Trim(), StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            var cat = category.Trim().ToLowerInvariant();
            filtered = cat switch
            {
                "periodic" => filtered.Where(c => c.Services.Any(s =>
                    s.Contains("periodic", StringComparison.OrdinalIgnoreCase) ||
                    s.Contains("oil", StringComparison.OrdinalIgnoreCase) ||
                    s.Contains("filter", StringComparison.OrdinalIgnoreCase))),
                "diagnostics" => filtered.Where(c => c.Services.Any(s =>
                    s.Contains("diagnostic", StringComparison.OrdinalIgnoreCase) ||
                    s.Contains("ac ", StringComparison.OrdinalIgnoreCase) ||
                    s.Contains("battery", StringComparison.OrdinalIgnoreCase))),
                "brakes" => filtered.Where(c => c.Services.Any(s =>
                    s.Contains("brake", StringComparison.OrdinalIgnoreCase) ||
                    s.Contains("alignment", StringComparison.OrdinalIgnoreCase) ||
                    s.Contains("tire", StringComparison.OrdinalIgnoreCase))),
                _ => filtered
            };
        }

        filtered = sort.ToLowerInvariant() switch
        {
            "rating" or "top" => filtered
                .Where(c => c.RatingCount > 0 && c.Rating >= 4.5m)
                .OrderByDescending(c => c.Rating)
                .ThenByDescending(c => c.RatingCount),
            "reviews" => filtered.OrderByDescending(c => c.RatingCount).ThenByDescending(c => c.Rating),
            "price" => filtered.OrderBy(c => c.StartingPriceEgp ?? decimal.MaxValue).ThenByDescending(c => c.Rating),
            "name" => filtered.OrderBy(c => c.Name, StringComparer.OrdinalIgnoreCase),
            _ => filtered.OrderBy(c => c.Name, StringComparer.OrdinalIgnoreCase)
        };

        var list = filtered.ToList();
        var safePageSize = Math.Clamp(pageSize, 1, 24);
        var totalPages = Math.Max(1, (int)Math.Ceiling(list.Count / (double)safePageSize));
        var safePage = Math.Clamp(page, 1, totalPages);
        var paged = list.Skip((safePage - 1) * safePageSize).Take(safePageSize).ToList();

        var vm = new ServiceCenterCatalogViewModel
        {
            SearchQuery = q,
            SelectedCity = city,
            SelectedCategory = category,
            SortBy = sort,
            CurrentPage = safePage,
            PageSize = safePageSize,
            TotalCount = list.Count,
            AvailableCities = cities,
            Centers = paged
        };

        return View("~/Views/ServiceCentersMvc/Index.cshtml", vm);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Details(Guid id, CancellationToken ct)
    {
        var center = await centerService.GetAsync(id, ct);
        var services = await centerService.ServicesAsync(id, ct);
        var reviews = await reviewService.ForCenterAsync(id, ct);
        var vm = new ServiceCenterDetailsViewModel
        {
            Center = mapper.Map<ServiceCenterItemViewModel>(center),
            Services = services.Select(s => mapper.Map<ServiceOfferingViewModel>(s)).ToList(),
            Reviews = reviews.Select(r => mapper.Map<CustomerReviewViewModel>(r)).ToList()
        };
        return View("~/Views/ServiceCentersMvc/Details.cshtml", vm);
    }
}

/// <summary>
/// Server-rendered ASP.NET Core MVC Diagnostics Controller inspecting the live Clean Architecture
/// layers, Entity Configurations, Application Service Interfaces, AutoMapper and FluentValidation.
/// </summary>
[AllowAnonymous]
[Route("mvc/architecture")]
public sealed class ArchitectureMvcController(
    ISystemStatusService systemStatus,
    IConfiguration configuration,
    IMapper mapper) : Controller
{
    [HttpGet("")]
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var simulatorsEnabled = configuration.GetValue("Simulators:Enabled", true);
        var statusDto = await systemStatus.GetStatusAsync(simulatorsEnabled, ct);
        var dbProvider = configuration["Database:Provider"] ?? "Sqlite";

        var domainAsm = typeof(BaseEntity).Assembly;
        var appAsm = typeof(IRequestService).Assembly;
        var infraAsm = typeof(UserConfig).Assembly;
        var webAsm = typeof(HomeController).Assembly;

        var entityCount = domainAsm.GetTypes().Count(t => t is { IsClass: true, IsAbstract: false } && typeof(BaseEntity).IsAssignableFrom(t));
        var configCount = infraAsm.GetTypes().Count(t => t is { IsClass: true, IsAbstract: false }
            && t.GetInterfaces().Any(i => i.IsGenericType && i.GetGenericTypeDefinition().Name.StartsWith("IEntityTypeConfiguration", StringComparison.Ordinal)));
        var serviceInterfaceCount = appAsm.GetTypes().Count(t => t.IsInterface && t.Name.EndsWith("Service", StringComparison.Ordinal));
        var validatorCount = appAsm.GetTypes().Count(t => t is { IsClass: true, IsAbstract: false } && typeof(IValidator).IsAssignableFrom(t));

        var vm = new ArchitectureOverviewViewModel
        {
            SystemStatus = mapper.Map<SystemStatusViewModel>(statusDto),
            ActiveDatabaseProvider = dbProvider,
            EntityCount = entityCount,
            EntityConfigurationCount = configCount,
            ApplicationServiceInterfaceCount = serviceInterfaceCount,
            ValidatorCount = validatorCount,
            Layers =
            [
                new("Domain Layer", domainAsm.GetName().Name!, "Entities, Value Objects, Domain Events, Specifications, Enums & State Machines (zero external dependencies)", ["None (Pure C# 12)"]),
                new("Application Layer", appAsm.GetName().Name!, "Use-Case Services & Interfaces, DTOs, AutoMapper Profiles, FluentValidation Validators, Repository/UoW Ports", ["FixNGo.Domain"]),
                new("Infrastructure Layer", infraAsm.GetName().Name!, "EF Core 8 AppDbContext, 1-per-entity IEntityTypeConfiguration<T>, Repositories & UnitOfWork, SQLite/SQL Server, Caching, Idempotency, Outbox & Adapters", ["FixNGo.Domain", "FixNGo.Application"]),
                new("Presentation Web Layer", webAsm.GetName().Name!, "ASP.NET Core 8 MVC Controllers, Razor Views (.cshtml), ViewModels, TagHelpers, ViewComponents, REST APIs & SignalR Hub", ["FixNGo.Application", "FixNGo.Infrastructure"])
            ],
            ImplementedPatterns =
            [
                "Clean Architecture (4 Strictly Separated Assemblies)",
                "ASP.NET Core 8 MVC + Razor Views + TagHelpers + ViewComponents",
                "Repository & Unit of Work Pattern (IRepository<T>, IUnitOfWork)",
                "Specification Pattern (ISpecification<T>)",
                "Strategy / Adapter Pattern (OTP, Payments, Routing, Geocoding, FileStore)",
                "Domain State Machines (ServiceRequest, Booking, Offer, KYC, Withdrawal)",
                "AutoMapper Profile Projections (Entity -> DTO -> ViewModel)",
                "FluentValidation Server Pipeline + RFC 7807 ProblemDetails",
                "Idempotency-Key Replay Middleware & IMemoryCache Service",
                "In-Process Domain Event Outbox & Hosted Background Workers"
            ]
        };

        return View("~/Views/ArchitectureMvc/Index.cshtml", vm);
    }
}
