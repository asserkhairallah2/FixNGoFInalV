using System.Linq.Expressions;
using FixNGo.Domain;
using FixNGo.Domain.Events;
using FixNGo.Domain.Specifications;

namespace FixNGo.Application.Interfaces;

/// <summary>Generic repository abstraction over Domain entities (SDD §4.3 Repository pattern).</summary>
public interface IRepository<T> where T : BaseEntity
{
    Task<T?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default);
    Task<IReadOnlyList<T>> ListAsync(CancellationToken ct = default);
    Task<IReadOnlyList<T>> ListAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default);
    Task<IReadOnlyList<T>> ListAsync(ISpecification<T> specification, CancellationToken ct = default);
    Task<int> CountAsync(Expression<Func<T, bool>>? predicate = null, CancellationToken ct = default);
    Task<bool> AnyAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default);
    Task AddAsync(T entity, CancellationToken ct = default);
    void Update(T entity);
    void Remove(T entity);
}

/// <summary>Unit of Work boundary coordinating atomic persistence across repositories (SDD §4.3).</summary>
public interface IUnitOfWork
{
    IRepository<T> Repository<T>() where T : BaseEntity;
    Task<int> SaveChangesAsync(CancellationToken ct = default);
    Task ExecuteInTransactionAsync(Func<CancellationToken, Task> operation, CancellationToken ct = default);
}

/// <summary>Application-level caching port (SDD §4.2 In-Memory / Distributed Cache).</summary>
public interface ICacheService
{
    Task<T> GetOrCreateAsync<T>(string key, TimeSpan ttl, Func<CancellationToken, Task<T>> factory, CancellationToken ct = default);
    void Remove(string key);
    void RemoveByPrefix(string prefix);
}

/// <summary>Idempotency key store preventing duplicate mutations on weak networks (SDD §4.3 / NFR-15).</summary>
public interface IIdempotencyStore
{
    bool TryGetCachedResponse(string scopeKey, out int statusCode, out string contentType, out string body);
    void StoreResponse(string scopeKey, int statusCode, string contentType, string body, TimeSpan ttl);
}

/// <summary>Outbox publisher port for reliable post-commit domain event dispatch (SDD §4.3).</summary>
public interface IOutboxPublisher
{
    ValueTask EnqueueAsync(IDomainEvent domainEvent, CancellationToken ct = default);
    IReadOnlyCollection<IDomainEvent> DrainPendingEvents();
}

/// <summary>Road routing & ETA calculation adapter port (Strategy/Adapter pattern, SDD §4.3).</summary>
public interface IRoutingService
{
    Task<RouteEstimate> EstimateRouteAsync(double originLat, double originLng, double destLat, double destLng, CancellationToken ct = default);
}

public sealed record RouteEstimate(double DistanceKm, int EtaMinutes, bool IsApproximateFallback);

/// <summary>Geocoding adapter port resolving Egyptian coordinates to human-readable district labels.</summary>
public interface IGeocoderService
{
    Task<string> ReverseGeocodeAsync(double latitude, double longitude, string language = "en", CancellationToken ct = default);
}
