using FixNGo.Application.Interfaces;
using FixNGo.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FixNGo.Web.Controllers;

[ApiController]
[Route("api/v1/lookups")]
[Authorize]
public sealed class LookupController(ILookupService svc, GoogleMapsService maps) : ControllerBase
{
    [HttpGet("bootstrap")]
    public async Task<IActionResult> Bootstrap(CancellationToken ct) =>
        Ok(await svc.BootstrapAsync(ct));

    [AllowAnonymous]
    [HttpGet("geocode")]
    public async Task<IActionResult> Geocode([FromQuery] string? q, CancellationToken ct) =>
        Ok(await maps.SearchPlacesAsync(q ?? string.Empty, ct));

    [AllowAnonymous]
    [HttpGet("reverse-geocode")]
    public async Task<IActionResult> ReverseGeocode([FromQuery] double lat, [FromQuery] double lng, CancellationToken ct) =>
        Ok(await maps.ReverseGeocodeAsync(lat, lng, ct));

    [AllowAnonymous]
    [HttpGet("route")]
    public async Task<IActionResult> Route(
        [FromQuery] double originLat,
        [FromQuery] double originLng,
        [FromQuery] double destLat,
        [FromQuery] double destLng,
        CancellationToken ct) =>
        Ok(await maps.ComputeRouteAsync(originLat, originLng, destLat, destLng, ct));
}
