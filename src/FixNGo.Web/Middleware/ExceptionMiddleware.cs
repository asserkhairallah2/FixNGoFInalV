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
            await WriteProblem(context, HttpStatusCode.Conflict, ex.Code, ex.Message);
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
            ["title"] = status == HttpStatusCode.BadRequest ? "Validation failed"
                : status == HttpStatusCode.Conflict ? "Conflict" : "Server error",
            ["status"] = (int)status,
            ["code"] = code,
            ["detail"] = detail ?? string.Empty,
            ["traceId"] = context.TraceIdentifier
        };
        if (extra is not null) problem["errors"] = extra;
        await context.Response.WriteAsync(JsonSerializer.Serialize(problem));
    }
}
