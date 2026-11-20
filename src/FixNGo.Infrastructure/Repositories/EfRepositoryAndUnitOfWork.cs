using System.Collections.Concurrent;
using System.Linq.Expressions;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using FixNGo.Domain.Specifications;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Infrastructure.Repositories;

/// <summary>EF Core 8 generic repository implementation supporting predicates and Specifications.</summary>
public sealed class EfRepository<T>(AppDbContext context) : IRepository<T> where T : BaseEntity
{
    private readonly DbSet<T> _set = context.Set<T>();

    public async Task<T?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await _set.FirstOrDefaultAsync(x => x.Id == id, ct);

    public async Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default) =>
        await _set.FirstOrDefaultAsync(predicate, ct);

    public async Task<IReadOnlyList<T>> ListAsync(CancellationToken ct = default) =>
        await _set.ToListAsync(ct);

    public async Task<IReadOnlyList<T>> ListAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default) =>
        await _set.Where(predicate).ToListAsync(ct);

    public async Task<IReadOnlyList<T>> ListAsync(ISpecification<T> specification, CancellationToken ct = default)
    {
        IQueryable<T> query = _set;
        if (specification.Criteria is not null)
            query = query.Where(specification.Criteria);
        foreach (var include in specification.Includes)
            query = query.Include(include);
        if (specification.OrderBy is not null)
            query = query.OrderBy(specification.OrderBy);
        else if (specification.OrderByDescending is not null)
            query = query.OrderByDescending(specification.OrderByDescending);
        if (specification.Skip is int skip)
            query = query.Skip(skip);
        if (specification.Take is int take)
            query = query.Take(take);
        return await query.ToListAsync(ct);
    }

    public async Task<int> CountAsync(Expression<Func<T, bool>>? predicate = null, CancellationToken ct = default) =>
        predicate is null ? await _set.CountAsync(ct) : await _set.CountAsync(predicate, ct);

    public async Task<bool> AnyAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default) =>
        await _set.AnyAsync(predicate, ct);

    public async Task AddAsync(T entity, CancellationToken ct = default) =>
        await _set.AddAsync(entity, ct);

    public void Update(T entity) => _set.Update(entity);

    public void Remove(T entity) => _set.Remove(entity);
}

/// <summary>Coordinates atomic transactions and repository instances over a single scoped AppDbContext.</summary>
public sealed class UnitOfWork(AppDbContext context) : IUnitOfWork
{
    private readonly ConcurrentDictionary<Type, object> _repositories = new();

    public IRepository<T> Repository<T>() where T : BaseEntity =>
        (IRepository<T>)_repositories.GetOrAdd(typeof(T), _ => new EfRepository<T>(context));

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        context.SaveChangesAsync(ct);

    public async Task ExecuteInTransactionAsync(Func<CancellationToken, Task> operation, CancellationToken ct = default)
    {
        if (context.Database.CurrentTransaction is not null)
        {
            await operation(ct);
            await context.SaveChangesAsync(ct);
            return;
        }

        await using var tx = await context.Database.BeginTransactionAsync(ct);
        await operation(ct);
        await context.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }
}
