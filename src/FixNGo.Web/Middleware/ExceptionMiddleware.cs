using FixNGo.Domain;
using Microsoft.AspNetCore.Mvc;
using System.Net;
using System.Text.Json;

namespace FixNGo.Web.Middleware;

/// <summary>Maps exceptions to RFC 7807 ProblemDetails with a stable code.</summary>
public sealed class ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (IllegalTransitionException ex)
        {
            logger.LogWarning("Illegal transition {From}->{To}", ex.From, ex.To);
            await WriteProblem(context, HttpStatusCode.Conflict, ex.Code, new { allowed = ex.Allowed }, ex.Message);
        }
        catch (DomainException ex)
        {
            logger.LogWarning("Domain error {Code}: {Message}", ex.Code, ex.Message);
            var status = StatusForCode(ex.Code);
            await WriteProblem(context, status, ex.Code, ex.Message);
        }
        catch (FluentValidation.ValidationException ex)
        {
            var errors = ex.Errors.GroupBy(e => e.PropertyName)
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());
            await WriteProblem(context, HttpStatusCode.BadRequest, "validation.failed", errors, "Validation failed.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception");
            await WriteProblem(context, HttpStatusCode.InternalServerError, "server.error", "An unexpected error occurred.");
        }
    }

    private static async Task WriteProblem(HttpContext context, HttpStatusCode status, string code, object? extra = null, string? detail = null)
    {
        if (context.Response.HasStarted) return;
        context.Response.Clear();
        context.Response.StatusCode = (int)status;
        context.Response.ContentType = "application/problem+json";
        var problem = new Dictionary<string, object>
        {
            ["type"] = "https://tools.ietf.org/html/rfc7807",
            ["title"] = status switch
            {
                HttpStatusCode.BadRequest => "Validation failed",
                HttpStatusCode.Unauthorized => "Unauthorized",
                HttpStatusCode.Forbidden => "Forbidden",
                HttpStatusCode.NotFound => "Not found",
                HttpStatusCode.Conflict => "Conflict",
                _ => "Server error"
            },
            ["status"] = (int)status,
            ["code"] = code,
            ["detail"] = detail ?? string.Empty,
            ["traceId"] = context.TraceIdentifier
        };
        if (extra is not null) problem["errors"] = extra;
        await context.Response.WriteAsync(JsonSerializer.Serialize(problem));
    }

    /// <summary>Maps domain error codes to the correct HTTP status.</summary>
    private static HttpStatusCode StatusForCode(string code) => code switch
    {
        "auth.invalid_credentials" or "auth.refresh_invalid" or "auth.refresh_reuse"
            or "auth.refresh_expired" or "auth.reset_invalid" or "auth.reset_expired"
            or "auth.otp_required" => HttpStatusCode.Unauthorized,
        "auth.account_blocked" or "auth.account_suspended" or "auth.forbidden"
            => HttpStatusCode.Forbidden,
        "auth.email_exists" or "auth.phone_exists" or "auth.otp_rate_limit"
            or "auth.otp_cooldown" => HttpStatusCode.Conflict,
        _ => HttpStatusCode.Conflict
    };
}
