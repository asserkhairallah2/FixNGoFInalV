using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Application.Services;
using FixNGo.Application.Validators;
using FixNGo.Domain;
using FixNGo.Infrastructure;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using System.Text;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// ---- Runtime paths & logging ----
var paths = new RuntimePaths();
paths.EnsureDirectories();
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

var signingKey = DatabaseSetup.LoadOrCreateSigningKey(paths);
var connection = DependencyInjection.ConnectionString(paths);

// Ensure the DB exists and reference data is seeded on startup (safe/idempotent).
await DatabaseSetup.EnsureAsync(paths);

// ---- DI ----
builder.Services.AddFixNGoInfrastructure(paths, connection);
builder.Services.AddFixNGoTokenService(signingKey, issuer, audience, accessMinutes);
builder.Services.AddSingleton(new AuthOptions
{
    AccessMinutes = accessMinutes,
    RefreshDays = builder.Configuration.GetValue("Auth:RefreshDays", 30),
    ExposeDevCodes = exposeDevCodes
});
builder.Services.AddScoped<AuthService>();
builder.Services.AddValidatorsFromAssembly(typeof(SignupValidator).Assembly);

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
                if (!string.IsNullOrEmpty(token) && ctx.HttpContext.Request.Path.StartsWithSegments("/hubs"))
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
    options.AddPolicy("ApprovedProvider", p => p.RequireAssertion(_ => true)); // refined in resource checks
});

// ---- MVC / API ----
builder.Services.AddControllers().AddJsonOptions(o =>
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
app.UseMiddleware<FixNGo.Web.Middleware.ExceptionMiddleware>();
app.UseStaticFiles();
app.UseCors("spa");
app.UseSwagger();
if (simulatorsEnabled || app.Environment.IsDevelopment())
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "FixNGo API v1"));

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<FixNGo.Web.Hubs.AppHub>("/hubs/app");
app.MapGet("/health", () => Results.Ok(new { status = "ok", utc = DateTime.UtcNow }));
app.MapGet("/api/v1/system/status", async (IAppDbContext db, CancellationToken ct) =>
{
    var users = await db.Users.CountAsync(ct);
    var mode = await db.Users.AnyAsync(u => u.Email.EndsWith("@dummy.fixngo.test"), ct) ? "dummy" : "real";
    return Results.Ok(new { setupComplete = users > 0, mode, version = "1.0.0", simulatorsEnabled });
});

// Serve the SPA for any non-API route.
app.MapFallbackToFile("index.html");

try
{
    Log.Information("FixNGo API starting. Simulators={Simulators} DataDir={DataDir}", simulatorsEnabled, paths.DataDir);
    app.Run();
}
catch (Exception ex) { Log.Fatal(ex, "FixNGo API terminated unexpectedly"); }
finally { Log.CloseAndFlush(); }

/// <summary>Exposed for WebApplicationFactory integration tests.</summary>
public partial class Program { }
