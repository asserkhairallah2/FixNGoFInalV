using System.Text;
using FixNGo.Web.Services;

namespace FixNGo.Web.Middleware;

/// <summary>
/// Enforces optional site-wide access protection via signed HttpOnly cookie (or HTTP Basic header upgrade)
/// without ever emitting raw `401 Authorization Required` or colliding with JWT `Authorization: Bearer` headers.
/// </summary>
public sealed class SiteGateMiddleware(RequestDelegate next, ISiteGateService gate)
{
    public async Task InvokeAsync(HttpContext context)
    {
        if (!gate.IsEnabled)
        {
            await next(context);
            return;
        }

        var path = context.Request.Path;

        // Allow direct loopback /health checks (e.g. systemd / local monitoring) and the unlock endpoint itself.
        if (path.StartsWithSegments("/__site-gate"))
        {
            await next(context);
            return;
        }
        if (path.StartsWithSegments("/health") && !context.Request.Headers.ContainsKey("X-Forwarded-For"))
        {
            await next(context);
            return;
        }

        // 1. Check signed HttpOnly gate cookie.
        if (context.Request.Cookies.TryGetValue(SiteGateService.CookieName, out var cookieVal)
            && gate.ValidateGateCookieValue(cookieVal))
        {
            StripBasicAuthorizationHeader(context);
            await next(context);
            return;
        }

        // 2. Support seamless upgrade from `Authorization: Basic ...` (e.g. Playwright httpCredentials / cached Basic auth).
        var authHeader = context.Request.Headers.Authorization.ToString();
        if (authHeader.StartsWith("Basic ", StringComparison.OrdinalIgnoreCase))
        {
            if (TryVerifyBasicHeader(authHeader[6..].Trim(), out var username))
            {
                WriteGateCookie(context, gate.IssueGateCookieValue(username, TimeSpan.FromDays(30)));
                StripBasicAuthorizationHeader(context);
                await next(context);
                return;
            }
        }

        // 3. Unauthenticated request: never emit HTTP 401 (prevents browser Basic-Auth popup loops and nginx 401 pages).
        if (path.StartsWithSegments("/api") || path.StartsWithSegments("/hubs"))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/json; charset=utf-8";
            await context.Response.WriteAsync("{\"code\":\"site.gate_required\",\"detail\":\"Site access session required.\"}");
            return;
        }

        // Render the ASP.NET Core MVC Razor Unlock Gate directly on `/` with HTTP 200.
        context.Request.Method = HttpMethods.Get;
        context.Request.Path = "/__site-gate";
        await next(context);
    }

    public static void WriteGateCookie(HttpContext context, string value)
    {
        var isHttps = context.Request.IsHttps
            || string.Equals(context.Request.Headers["X-Forwarded-Proto"], "https", StringComparison.OrdinalIgnoreCase);

        context.Response.Cookies.Append(SiteGateService.CookieName, value, new CookieOptions
        {
            HttpOnly = true,
            Secure = isHttps,
            SameSite = SameSiteMode.Lax,
            Path = "/",
            MaxAge = TimeSpan.FromDays(30),
            IsEssential = true
        });
    }

    private static void StripBasicAuthorizationHeader(HttpContext context)
    {
        var raw = context.Request.Headers.Authorization.ToString();
        if (raw.StartsWith("Basic ", StringComparison.OrdinalIgnoreCase))
        {
            context.Request.Headers.Remove("Authorization");
        }
    }

    private bool TryVerifyBasicHeader(string encoded, out string username)
    {
        username = string.Empty;
        try
        {
            var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(encoded));
            var sep = decoded.IndexOf(':');
            if (sep <= 0) return false;
            var user = decoded[..sep];
            var pass = decoded[(sep + 1)..];
            if (!gate.VerifyCredentials(user, pass)) return false;
            username = user;
            return true;
        }
        catch
        {
            return false;
        }
    }
}
