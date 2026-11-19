using System.IdentityModel.Tokens.Jwt;
using FixNGo.Domain;
using Microsoft.AspNetCore.Mvc;

namespace FixNGo.Web.Controllers;

/// <summary>Claim helpers shared by all controllers (claims are set by the JWT handler with mapping disabled).</summary>
internal static class ControllerClaims
{
    public static Guid UserId(this ControllerBase c) =>
        Guid.TryParse(c.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out var id) ? id : Guid.Empty;

    public static bool IsAdmin(this ControllerBase c) => c.User.IsInRole(nameof(Role.Admin));

    public static bool IsIn(this ControllerBase c, params Role[] roles) => roles.Any(r => c.User.IsInRole(r.ToString()));
}
