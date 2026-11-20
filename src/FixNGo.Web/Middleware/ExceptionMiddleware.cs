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
            var field = FieldForDomainCode(ex.Code);
            var fieldErrors = field is null
                ? null
                : new Dictionary<string, string[]> { [field] = [ex.Message] };
            await WriteProblem(context, status, ex.Code, fieldErrors, ex.Message);
        }
        catch (FluentValidation.ValidationException ex)
        {
            var errors = ex.Errors
                .GroupBy(e => ToCamelCase(e.PropertyName))
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).Distinct().ToArray());
            var detail = string.Join(" ", ex.Errors.Select(e => e.ErrorMessage).Where(m => !string.IsNullOrWhiteSpace(m)).Distinct());
            if (string.IsNullOrWhiteSpace(detail)) detail = "Please check the highlighted fields and try again.";
            await WriteProblem(context, HttpStatusCode.BadRequest, "validation.failed", errors, detail);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // The client disconnected or cancelled the request (e.g. a browser navigating
            // away mid-fetch). This is not a server fault: do not write a ProblemDetails
            // response or log an error, since there is nobody left to receive it.
            logger.LogDebug("Request aborted by client: {Method} {Path}", context.Request.Method, context.Request.Path);
        }
        catch (OperationCanceledException)
        {
            // Cancellation without a client abort (e.g. an internal timeout). Still not a
            // code defect; log at debug level and do not attempt a 500 response.
            logger.LogDebug("Request cancelled: {Method} {Path}", context.Request.Method, context.Request.Path);
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

    private static string ToCamelCase(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "general";
        var leaf = name.Contains('.') ? name[(name.LastIndexOf('.') + 1)..] : name;
        return leaf.Length == 1
            ? leaf.ToLowerInvariant()
            : char.ToLowerInvariant(leaf[0]) + leaf[1..];
    }

    private static string? FieldForDomainCode(string code) => code switch
    {
        "auth.email_exists" => "email",
        "auth.phone_exists" => "phone",
        "auth.invalid_credentials" => "password",
        "auth.current_password_wrong" or "auth.wrong_password" => "currentPassword",
        "auth.otp_invalid" or "auth.otp_expired" or "auth.otp_attempts" => "code",
        "auth.reset_invalid" or "auth.reset_expired" => "resetToken",
        "vehicle.plate_exists" or "vehicle.plate_invalid" => "plate",
        "card.invalid" or "payment.card_invalid" => "number",
        "payment.iban_invalid" or "bank.iban_invalid" => "iban",
        "wallet.insufficient" or "payment.insufficient_balance" or "withdrawal.min_amount" => "amount",
        "request.address_required" => "pickupAddress",
        "review.stars_invalid" => "stars",
        _ => null
    };

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
