using System.Collections.Concurrent;
using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using FixNGo.Domain;
using Microsoft.Extensions.Logging;

namespace FixNGo.Infrastructure.Services;

public sealed class GoogleMapsOptions
{
    public string ApiKey { get; set; } = string.Empty;
    public string AllowedReferer { get; set; } = "https://depi-v2.nerot.dev/";
    public bool IsConfigured => !string.IsNullOrWhiteSpace(ApiKey);
}

public sealed record GeoPlaceResult(string Label, string Address, double Latitude, double Longitude);
public sealed record GeoRouteResult(double DistanceKm, int DurationMinutes, string? EncodedPolyline, string Source);

/// <summary>
/// Google Cloud Places API (New) &amp; Routes API client with in-memory caching and deterministic Cairo fallback.
/// </summary>
public sealed class GoogleMapsService(
    HttpClient http,
    GoogleMapsOptions options,
    ILogger<GoogleMapsService> logger)
{
    private readonly ConcurrentDictionary<string, IReadOnlyList<GeoPlaceResult>> _searchCache = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, GeoPlaceResult> _reverseCache = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, GeoRouteResult> _routeCache = new(StringComparer.OrdinalIgnoreCase);

    private static readonly (string Name, string Address, double Lat, double Lng)[] CairoDistricts =
    [
        ("Downtown Cairo", "El-Tahrir Square, Downtown, Cairo Governorate, Egypt", 30.0444, 31.2357),
        ("Nasr City", "Abbas El-Akkad St, Nasr City, Cairo Governorate, Egypt", 30.0561, 31.3301),
        ("New Cairo (5th Settlement)", "90th Street, New Cairo, Cairo Governorate, Egypt", 30.0074, 31.4913),
        ("Maadi", "Road 9, Maadi, Cairo Governorate, Egypt", 29.9602, 31.2569),
        ("Heliopolis", "Korba, Heliopolis, Cairo Governorate, Egypt", 30.0866, 31.3225),
        ("Dokki & Mohandessin", "Gameat El-Dowal St, Dokki, Giza Governorate, Egypt", 30.0385, 31.2122),
        ("6th of October City", "Central Axis, 6th of October, Giza Governorate, Egypt", 29.9728, 30.9435),
        ("Sheikh Zayed", "26th of July Corridor, Sheikh Zayed, Giza Governorate, Egypt", 30.0449, 30.9762)
    ];

    public async Task<IReadOnlyList<GeoPlaceResult>> SearchPlacesAsync(string query, CancellationToken ct = default)
    {
        var trimmed = (query ?? string.Empty).Trim();
        if (trimmed.Length < 2) return [];
        if (_searchCache.TryGetValue(trimmed, out var cached)) return cached;

        if (options.IsConfigured)
        {
            try
            {
                using var req = new HttpRequestMessage(HttpMethod.Post, "https://places.googleapis.com/v1/places:searchText");
                req.Headers.TryAddWithoutValidation("X-Goog-Api-Key", options.ApiKey);
                req.Headers.TryAddWithoutValidation("X-Goog-FieldMask", "places.displayName,places.formattedAddress,places.location");
                req.Headers.TryAddWithoutValidation("Referer", options.AllowedReferer);
                req.Content = JsonContent.Create(new
                {
                    textQuery = trimmed.Contains("Egypt", StringComparison.OrdinalIgnoreCase) ? trimmed : $"{trimmed}, Egypt",
                    maxResultCount = 5,
                    locationBias = new
                    {
                        circle = new
                        {
                            center = new { latitude = 30.0444, longitude = 31.2357 },
                            radius = 50000.0
                        }
                    }
                });

                using var res = await http.SendAsync(req, ct);
                if (res.IsSuccessStatusCode)
                {
                    using var doc = await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
                    if (doc.RootElement.TryGetProperty("places", out var placesEl) && placesEl.ValueKind == JsonValueKind.Array)
                    {
                        var list = new List<GeoPlaceResult>();
                        foreach (var p in placesEl.EnumerateArray())
                        {
                            if (!p.TryGetProperty("location", out var loc)) continue;
                            var lat = loc.TryGetProperty("latitude", out var latEl) ? latEl.GetDouble() : 30.0444;
                            var lng = loc.TryGetProperty("longitude", out var lngEl) ? lngEl.GetDouble() : 31.2357;
                            var display = p.TryGetProperty("displayName", out var dn) && dn.TryGetProperty("text", out var txt)
                                ? txt.GetString()
                                : null;
                            var addr = p.TryGetProperty("formattedAddress", out var fa) ? fa.GetString() : null;
                            var finalAddr = !string.IsNullOrWhiteSpace(addr) ? addr! : (display ?? trimmed);
                            var finalLabel = !string.IsNullOrWhiteSpace(display) ? display! : finalAddr;
                            list.Add(new GeoPlaceResult(finalLabel, finalAddr, Math.Round(lat, 6), Math.Round(lng, 6)));
                        }

                        if (list.Count > 0)
                        {
                            _searchCache[trimmed] = list;
                            return list;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Google Places text search fallback triggered for query {Query}", trimmed);
            }
        }

        var localMatches = CairoDistricts
            .Where(d => d.Name.Contains(trimmed, StringComparison.OrdinalIgnoreCase) || d.Address.Contains(trimmed, StringComparison.OrdinalIgnoreCase))
            .Select(d => new GeoPlaceResult(d.Name, d.Address, d.Lat, d.Lng))
            .ToList();
        if (localMatches.Count == 0)
        {
            localMatches.Add(new GeoPlaceResult(trimmed, $"{trimmed}, Cairo, Egypt", 30.0444, 31.2357));
        }
        return localMatches;
    }

    public async Task<GeoPlaceResult> ReverseGeocodeAsync(double latitude, double longitude, CancellationToken ct = default)
    {
        var key = string.Create(CultureInfo.InvariantCulture, $"{latitude:F4},{longitude:F4}");
        if (_reverseCache.TryGetValue(key, out var cached)) return cached;

        if (options.IsConfigured)
        {
            foreach (var radius in new[] { 300.0, 2500.0 })
            {
                try
                {
                    using var req = new HttpRequestMessage(HttpMethod.Post, "https://places.googleapis.com/v1/places:searchNearby");
                    req.Headers.TryAddWithoutValidation("X-Goog-Api-Key", options.ApiKey);
                    req.Headers.TryAddWithoutValidation("X-Goog-FieldMask", "places.displayName,places.formattedAddress,places.location");
                    req.Headers.TryAddWithoutValidation("Referer", options.AllowedReferer);
                    req.Content = JsonContent.Create(new
                    {
                        maxResultCount = 3,
                        locationRestriction = new
                        {
                            circle = new
                            {
                                center = new { latitude, longitude },
                                radius
                            }
                        }
                    });

                    using var res = await http.SendAsync(req, ct);
                    if (!res.IsSuccessStatusCode) break;

                    using var doc = await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
                    if (doc.RootElement.TryGetProperty("places", out var placesEl) &&
                        placesEl.ValueKind == JsonValueKind.Array &&
                        placesEl.GetArrayLength() > 0)
                    {
                        var first = placesEl[0];
                        var display = first.TryGetProperty("displayName", out var dn) && dn.TryGetProperty("text", out var txt)
                            ? txt.GetString()
                            : null;
                        var addr = first.TryGetProperty("formattedAddress", out var fa) ? fa.GetString() : null;
                        if (!string.IsNullOrWhiteSpace(addr) || !string.IsNullOrWhiteSpace(display))
                        {
                            var finalAddr = !string.IsNullOrWhiteSpace(addr) ? addr! : display!;
                            var finalLabel = !string.IsNullOrWhiteSpace(display) ? display! : finalAddr;
                            var result = new GeoPlaceResult(finalLabel, finalAddr, Math.Round(latitude, 6), Math.Round(longitude, 6));
                            _reverseCache[key] = result;
                            return result;
                        }
                    }
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Google Places reverse geocode fallback triggered for {Lat},{Lng}", latitude, longitude);
                    break;
                }
            }
        }

        var nearest = CairoDistricts
            .OrderBy(d => Geo.HaversineKm(latitude, longitude, d.Lat, d.Lng))
            .First();
        var distKm = Geo.HaversineKm(latitude, longitude, nearest.Lat, nearest.Lng);
        var fallbackAddress = distKm <= 12
            ? $"Near {nearest.Address}"
            : string.Create(CultureInfo.InvariantCulture, $"Pinned Location ({latitude:F4}, {longitude:F4}), Egypt");
        return new GeoPlaceResult(nearest.Name, fallbackAddress, Math.Round(latitude, 6), Math.Round(longitude, 6));
    }

    public async Task<GeoRouteResult> ComputeRouteAsync(
        double originLat,
        double originLng,
        double destLat,
        double destLng,
        CancellationToken ct = default)
    {
        var key = string.Create(CultureInfo.InvariantCulture, $"{originLat:F4},{originLng:F4}->{destLat:F4},{destLng:F4}");
        if (_routeCache.TryGetValue(key, out var cached)) return cached;

        if (options.IsConfigured)
        {
            try
            {
                using var req = new HttpRequestMessage(HttpMethod.Post, "https://routes.googleapis.com/directions/v2:computeRoutes");
                req.Headers.TryAddWithoutValidation("X-Goog-Api-Key", options.ApiKey);
                req.Headers.TryAddWithoutValidation("X-Goog-FieldMask", "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline");
                req.Headers.TryAddWithoutValidation("Referer", options.AllowedReferer);
                req.Content = JsonContent.Create(new
                {
                    origin = new { location = new { latLng = new { latitude = originLat, longitude = originLng } } },
                    destination = new { location = new { latLng = new { latitude = destLat, longitude = destLng } } },
                    travelMode = "DRIVE"
                });

                using var res = await http.SendAsync(req, ct);
                if (res.IsSuccessStatusCode)
                {
                    using var doc = await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
                    if (doc.RootElement.TryGetProperty("routes", out var routesEl) &&
                        routesEl.ValueKind == JsonValueKind.Array &&
                        routesEl.GetArrayLength() > 0)
                    {
                        var r0 = routesEl[0];
                        var meters = r0.TryGetProperty("distanceMeters", out var dm) ? dm.GetDouble() : 0;
                        var durRaw = r0.TryGetProperty("duration", out var du) ? du.GetString() : null;
                        var seconds = 0.0;
                        if (!string.IsNullOrWhiteSpace(durRaw) && durRaw.EndsWith('s'))
                        {
                            double.TryParse(durRaw.AsSpan(0, durRaw.Length - 1), NumberStyles.Float, CultureInfo.InvariantCulture, out seconds);
                        }
                        var poly = r0.TryGetProperty("polyline", out var pl) && pl.TryGetProperty("encodedPolyline", out var ep)
                            ? ep.GetString()
                            : null;
                        var km = Math.Max(0.5, Math.Round(meters / 1000.0, 1));
                        var mins = Math.Max(2, (int)Math.Ceiling(seconds / 60.0));
                        var route = new GeoRouteResult(km, mins, poly, "google_routes");
                        _routeCache[key] = route;
                        return route;
                    }
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Google Routes fallback triggered for {Key}", key);
            }
        }

        var straightKm = Math.Max(0.5, Math.Round(Geo.HaversineKm(originLat, originLng, destLat, destLng) * 1.25, 1));
        var etaMin = Geo.EtaMinutes(straightKm);
        return new GeoRouteResult(straightKm, etaMin, null, "haversine");
    }
}
