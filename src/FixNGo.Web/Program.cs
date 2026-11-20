using FixNGo.Application;
using FixNGo.Application.Interfaces;
using FixNGo.Application.Services;
using FixNGo.Domain;
using FixNGo.Infrastructure;
using FixNGo.Infrastructure.Services;
using FixNGo.Web.Filters;
using FixNGo.Web.Mapping;
using FixNGo.Web.Middleware;
using FixNGo.Web.Services;
using FixNGo.Web.Workers;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using System.Text.Json.Serialization;

// ---- Runtime paths & logging ----
var paths = new RuntimePaths();
paths.EnsureDirectories();

var candidateWebRoots = new[]
{
    Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"),
    Path.Combine(AppContext.BaseDirectory, "wwwroot"),
    Path.Combine(paths.Root, "app", "web", "wwwroot"),
    Path.Combine(paths.Root, "src", "FixNGo.Web", "wwwroot")
};
var resolvedWebRoot = candidateWebRoots.FirstOrDefault(d => File.Exists(Path.Combine(d, "assets", "fixngo-app.js")))
    ?? candidateWebRoots.FirstOrDefault(Directory.Exists);
if (!string.IsNullOrEmpty(resolvedWebRoot))
{
    Directory.CreateDirectory(resolvedWebRoot);
}

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    WebRootPath = resolvedWebRoot
});

// Own our PID file so the start/stop helpers can manage the server process.
File.WriteAllText(paths.PidPath, Environment.ProcessId.ToString());
AppDomain.CurrentDomain.ProcessExit += (_, _) =>
{
    try { if (File.Exists(paths.PidPath)) File.Delete(paths.PidPath); } catch { /* best effort */ }
};

Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .MinimumLevel.Information()
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File(Path.Combine(paths.LogDir, "server-.log"), rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 14, outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();
builder.Host.UseSerilog();

// ---- Configuration ----
var simulatorsEnabled = builder.Configuration.GetValue("Simulators:Enabled", true);
var exposeDevCodes = simulatorsEnabled && builder.Configuration.GetValue("Simulators:ExposeOtpInResponse", true);
var accessMinutes = builder.Configuration.GetValue("Auth:AccessMinutes", 15);
var issuer = builder.Configuration["Auth:Issuer"] ?? "FixNGo";
var audience = builder.Configuration["Auth:Audience"] ?? "FixNGo.Client";
var databaseProvider = builder.Configuration["Database:Provider"] ?? "Sqlite";

// External providers are configuration-switched. A 'Real' selection with no bundled
// adapter/keys must fail fast at startup (never silently fall back to the fake).
ProviderOptions providers;
try
{
    providers = ProviderOptions.FromValues(
        builder.Configuration["Providers:Otp"],
        builder.Configuration["Providers:Payments"],
        builder.Configuration["Providers:Maps"],
        builder.Configuration["Providers:Push"]);
}
catch (ProviderNotConfiguredException ex)
{
    Log.Fatal(ex, "Provider configuration error: {Message}", ex.Message);
    Log.CloseAndFlush();
    throw;
}

var signingKey = DatabaseSetup.LoadOrCreateSigningKey(paths);
var connection = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? FixNGo.Infrastructure.DependencyInjection.ConnectionString(paths);

// Ensure the DB exists and reference data is seeded on startup (safe/idempotent).
if (!string.Equals(databaseProvider, "SqlServer", StringComparison.OrdinalIgnoreCase))
{
    await DatabaseSetup.EnsureAsync(paths);
}

// ---- Clean Architecture Layer Registration ----
builder.Services.AddFixNGoInfrastructure(paths, connection, providers, databaseProvider);
builder.Services.AddFixNGoTokenService(signingKey, issuer, audience, accessMinutes);
builder.Services.AddSingleton(new AuthOptions
{
    AccessMinutes = accessMinutes,
    RefreshDays = builder.Configuration.GetValue("Auth:RefreshDays", 30),
    ExposeDevCodes = exposeDevCodes
});
builder.Services.AddFixNGoApplication();
builder.Services.AddAutoMapper(typeof(WebViewModelMappingProfile).Assembly);
builder.Services.AddScoped<FluentValidationActionFilter>();

FixNGo.Web.Controllers.SimulatorApiRegistration.AddSimulatorApi(builder.Services, builder.Configuration);
builder.Services.AddScoped<INotifier, SignalRNotifier>();
builder.Services.AddScoped<IFileStore, LocalFileStore>();
builder.Services.AddHostedService<OfferExpiryWorker>();
builder.Services.AddHostedService<BookingExpiryWorker>();
builder.Services.AddHostedService<WithdrawalWorker>();
builder.Services.AddHostedService<HousekeepingWorker>();

// ---- Auth / RBAC ----
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false; // keep "sub"/"email"/"role" claim names verbatim
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true, ValidateAudience = true, ValidateLifetime = true,
            ValidateIssuerSigningKey = true, ValidIssuer = issuer, ValidAudience = audience,
            IssuerSigningKey = new SymmetricSecurityKey(signingKey), ClockSkew = TimeSpan.Zero,
            NameClaimType = System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub,
            RoleClaimType = "role"
        };
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) &&
                    ctx.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                    ctx.Token = token;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization(options =>
{
    foreach (var role in Enum.GetNames<Role>())
        options.AddPolicy(role, p => p.RequireClaim("role", role));
    options.AddPolicy("Provider", p => p.RequireAssertion(ctx =>
        ctx.User.IsInRole(nameof(Role.Mechanic)) || ctx.User.IsInRole(nameof(Role.TowCaptain))));
    options.AddPolicy("ApprovedProvider", p => p.RequireAssertion(_ => true));
});

// ---- ASP.NET Core 8 MVC + Razor Views + REST API ----
builder.Services.AddAntiforgery(o => o.HeaderName = "X-CSRF-TOKEN");
builder.Services.AddControllersWithViews()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        o.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(o => o.MultipartBodyLengthLimit = 10 * 1024 * 1024);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo { Title = "FixNGo API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        In = Microsoft.OpenApi.Models.ParameterLocation.Header, Description = "JWT Authorization header",
        Name = "Authorization", Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey, Scheme = "Bearer"
    });
    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        [new Microsoft.OpenApi.Models.OpenApiSecurityScheme
        {
            Reference = new Microsoft.OpenApi.Models.OpenApiReference { Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme, Id = "Bearer" }
        }] = []
    });
});
builder.Services.AddSignalR();
builder.Services.AddCors(o => o.AddPolicy("spa", p => p.WithOrigins("http://localhost:5173").AllowAnyHeader().AllowAnyMethod().AllowCredentials()));

var app = builder.Build();

app.UseSerilogRequestLogging();
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseMiddleware<ExceptionMiddleware>();
app.UseStaticFiles();
app.UseCors("spa");
app.UseSwagger();
if (simulatorsEnabled || app.Environment.IsDevelopment())
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "FixNGo API v1"));

app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<IdempotencyMiddleware>();

app.MapControllers();
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");
app.MapHub<FixNGo.Web.Hubs.AppHub>("/hubs/app");
app.MapGet("/health", () => Results.Ok(new { status = "ok", utc = DateTime.UtcNow }));
app.MapGet("/api/v1/system/status", async (ISystemStatusService statusService, CancellationToken ct) =>
{
    var st = await statusService.GetStatusAsync(simulatorsEnabled, ct);
    return Results.Ok(new
    {
        setupComplete = st.SetupComplete,
        mode = st.Mode,
        version = st.Version,
        simulatorsEnabled = st.SimulatorsEnabled
    });
});

// Route any unmatched UI path through the ASP.NET Core MVC HomeController Razor pipeline (no static index.html).
app.MapFallbackToController("Index", "Home");

try
{
    Log.Information("FixNGo ASP.NET Core 8 MVC host starting. Simulators={Simulators} DataDir={DataDir}", simulatorsEnabled, paths.DataDir);
    app.Run();
}
catch (Exception ex) { Log.Fatal(ex, "FixNGo host terminated unexpectedly"); }
finally { Log.CloseAndFlush(); }

/// <summary>Exposed for WebApplicationFactory integration tests.</summary>
public partial class Program { }
