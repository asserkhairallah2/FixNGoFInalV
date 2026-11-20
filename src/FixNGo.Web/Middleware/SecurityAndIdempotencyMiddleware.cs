using FixNGo.Application.Interfaces;

namespace FixNGo.Web.Middleware;

/// <summary>Applies baseline HTTP security headers across MVC views and REST API endpoints.</summary>
public sealed class SecurityHeadersMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;
            headers.TryAdd("X-Content-Type-Options", "nosniff");
            headers.TryAdd("X-Frame-Options", "SAMEORIGIN");
            headers.TryAdd("Referrer-Policy", "strict-origin-when-cross-origin");
            headers.TryAdd("X-FixNGo-Host", "ASP.NET-Core-8-MVC");
            return Task.CompletedTask;
        });

        await next(context);
    }
}

/// <summary>
/// Enforces optional Idempotency-Key replay protection on mutating POST API requests (SDD §4.3 / NFR-15).
/// </summary>
public sealed class IdempotencyMiddleware(RequestDelegate next, IIdempotencyStore store)
{
    private static readonly TimeSpan ReplayTtl = TimeSpan.FromMinutes(10);

    public async Task InvokeAsync(HttpContext context)
    {
        if (!HttpMethods.IsPost(context.Request.Method)
            || !context.Request.Path.StartsWithSegments("/api/v1")
            || context.Request.HasFormContentType
            || !context.Request.Headers.TryGetValue("Idempotency-Key", out var rawKey))
        {
            await next(context);
            return;
        }

        var key = rawKey.ToString().Trim();
        if (string.IsNullOrEmpty(key) || key.Length > 128)
        {
            await next(context);
            return;
        }

        var userPart = context.User.FindFirst("sub")?.Value ?? "anon";
        var scopeKey = $"{userPart}:{context.Request.Path}:{key}";

        if (store.TryGetCachedResponse(scopeKey, out var statusCode, out var contentType, out var cachedBody))
        {
            context.Response.StatusCode = statusCode;
            if (!string.IsNullOrEmpty(contentType))
                context.Response.ContentType = contentType;
            context.Response.Headers["X-Idempotent-Replay"] = "true";
            await context.Response.WriteAsync(cachedBody);
            return;
        }

        var originalBody = context.Response.Body;
        await using var buffer = new MemoryStream();
        context.Response.Body = buffer;
        try
        {
            await next(context);
            buffer.Position = 0;
            var responseText = await new StreamReader(buffer).ReadToEndAsync();
            if (context.Response.StatusCode is >= 200 and < 300)
            {
                store.StoreResponse(scopeKey, context.Response.StatusCode,
                    context.Response.ContentType ?? "application/json", responseText, ReplayTtl);
            }
            buffer.Position = 0;
            await buffer.CopyToAsync(originalBody);
        }
        finally
        {
            context.Response.Body = originalBody;
        }
    }
}
