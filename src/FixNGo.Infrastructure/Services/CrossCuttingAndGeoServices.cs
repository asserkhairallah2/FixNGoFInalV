using System.Collections.Concurrent;
using FixNGo.Application.Interfaces;
using FixNGo.Domain.Events;
using FixNGo.Domain.ValueObjects;
using Microsoft.Extensions.Caching.Memory;

namespace FixNGo.Infrastructure.Services;

/// <summary>Thread-safe IMemoryCache adapter with prefix invalidation support (SDD §4.2).</summary>
public sealed class MemoryCacheService(IMemoryCache memoryCache) : ICacheService
{
    private readonly ConcurrentDictionary<string, byte> _keys = new(StringComparer.Ordinal);

    public async Task<T> GetOrCreateAsync<T>(string key, TimeSpan ttl, Func<CancellationToken, Task<T>> factory, CancellationToken ct = default)
    {
        if (memoryCache.TryGetValue(key, out T? existing) && existing is not null)
            return existing;

        var created = await factory(ct);
        _keys.TryAdd(key, 0);
        memoryCache.Set(key, created, ttl);
        return created;
    }

    public void Remove(string key)
    {
        _keys.TryRemove(key, out _);
        memoryCache.Remove(key);
    }

    public void RemoveByPrefix(string prefix)
    {
        foreach (var k in _keys.Keys.Where(k => k.StartsWith(prefix, StringComparison.Ordinal)))
        {
            _keys.TryRemove(k, out _);
            memoryCache.Remove(k);
        }
    }
}

/// <summary>TTL-bounded idempotency response cache for weak-network retry safety (SDD §4.3 / NFR-15).</summary>
public sealed class IdempotencyStore(IMemoryCache memoryCache) : IIdempotencyStore
{
    private sealed record CachedEntry(int StatusCode, string ContentType, string Body);

    public bool TryGetCachedResponse(string scopeKey, out int statusCode, out string contentType, out string body)
    {
        if (memoryCache.TryGetValue("idem:" + scopeKey, out CachedEntry? entry) && entry is not null)
        {
            statusCode = entry.StatusCode;
            contentType = entry.ContentType;
            body = entry.Body;
            return true;
        }
        statusCode = 0;
        contentType = string.Empty;
        body = string.Empty;
        return false;
    }

    public void StoreResponse(string scopeKey, int statusCode, string contentType, string body, TimeSpan ttl)
    {
        memoryCache.Set("idem:" + scopeKey, new CachedEntry(statusCode, contentType, body), ttl);
    }
}

/// <summary>In-process outbox event queue for reliable domain event dispatch (SDD §4.3 Outbox).</summary>
public sealed class InMemoryOutboxPublisher : IOutboxPublisher
{
    private readonly ConcurrentQueue<IDomainEvent> _queue = new();

    public ValueTask EnqueueAsync(IDomainEvent domainEvent, CancellationToken ct = default)
    {
        _queue.Enqueue(domainEvent);
        return ValueTask.CompletedTask;
    }

    public IReadOnlyCollection<IDomainEvent> DrainPendingEvents()
    {
        var list = new List<IDomainEvent>();
        while (_queue.TryDequeue(out var ev))
            list.Add(ev);
        return list;
    }
}

/// <summary>Haversine road-circuity routing adapter with 1.3x Cairo street factor (03_ARCHITECTURE §6.2).</summary>
public sealed class HaversineRoutingService : IRoutingService
{
    public Task<RouteEstimate> EstimateRouteAsync(double originLat, double originLng, double destLat, double destLng, CancellationToken ct = default)
    {
        var origin = new GeoCoordinate(originLat, originLng);
        var destination = new GeoCoordinate(destLat, destLng);
        var roadKm = Math.Round(origin.DistanceKmTo(destination) * 1.3, 2);
        var etaMinutes = Math.Max(2, (int)Math.Ceiling((roadKm / 30.0) * 60.0) + 2);
        return Task.FromResult(new RouteEstimate(roadKm, etaMinutes, IsApproximateFallback: false));
    }
}

/// <summary>Deterministic Greater Cairo & Alexandria district reverse-geocoder adapter.</summary>
public sealed class CairoGeocoderService : IGeocoderService
{
    private static readonly (string En, string Ar, double Lat, double Lng)[] Districts =
    [
        ("Downtown Cairo", "وسط البلد، القاهرة", 30.0444, 31.2357),
        ("New Cairo", "القاهرة الجديدة", 30.0074, 31.4913),
        ("Nasr City", "مدينة نصر", 30.0511, 31.3656),
        ("Heliopolis", "مصر الجديدة", 30.0866, 31.3220),
        ("Maadi", "المعادي", 29.9602, 31.2569),
        ("Dokki & Mohandessin", "الدقي والمهندسين", 30.0499, 31.2045),
        ("6th of October City", "مدينة ٦ أكتوبر", 29.9728, 30.9435),
        ("Sheikh Zayed", "الشيخ زايد", 30.0385, 30.9806),
        ("Alexandria Corniche", "كورنيش الإسكندرية", 31.2001, 29.9187)
    ];

    public Task<string> ReverseGeocodeAsync(double latitude, double longitude, string language = "en", CancellationToken ct = default)
    {
        var target = new GeoCoordinate(latitude, longitude);
        var nearest = Districts
            .OrderBy(d => target.DistanceKmTo(new GeoCoordinate(d.Lat, d.Lng)))
            .First();
        var isAr = string.Equals(language, "ar", StringComparison.OrdinalIgnoreCase);
        return Task.FromResult(isAr ? nearest.Ar : nearest.En);
    }
}
