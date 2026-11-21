using FixNGo.Web.Middleware;
using FixNGo.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FixNGo.Web.Controllers;

[AllowAnonymous]
public sealed class GateController(ISiteGateService gate) : Controller
{
    [HttpGet("/__site-gate")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public IActionResult Unlock()
    {
        if (!gate.IsEnabled)
            return Redirect("/");
        return View("~/Views/Gate/Unlock.cshtml", new GateUnlockViewModel());
    }

    [HttpPost("/__site-gate")]
    [IgnoreAntiforgeryToken]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public IActionResult UnlockSubmit([FromForm] string? username, [FromForm] string? password)
    {
        if (!gate.IsEnabled)
            return Redirect("/");

        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrEmpty(password))
        {
            return View("~/Views/Gate/Unlock.cshtml", new GateUnlockViewModel
            {
                Username = username ?? string.Empty,
                ErrorMessage = "Please enter both username and password. / يرجى إدخال اسم المستخدم وكلمة المرور.",
                UsernameMissing = string.IsNullOrWhiteSpace(username),
                PasswordMissing = string.IsNullOrEmpty(password)
            });
        }

        if (!gate.VerifyCredentials(username, password))
        {
            return View("~/Views/Gate/Unlock.cshtml", new GateUnlockViewModel
            {
                Username = username.Trim(),
                ErrorMessage = "Invalid access credentials. Please check username and password. / بيانات الدخول غير صحيحة.",
                UsernameMissing = true,
                PasswordMissing = true
            });
        }

        var token = gate.IssueGateCookieValue(username.Trim(), TimeSpan.FromDays(30));
        SiteGateMiddleware.WriteGateCookie(HttpContext, token);
        return Redirect("/");
    }
}

public sealed class GateUnlockViewModel
{
    public string Username { get; init; } = string.Empty;
    public string? ErrorMessage { get; init; }
    public bool UsernameMissing { get; init; }
    public bool PasswordMissing { get; init; }
}
