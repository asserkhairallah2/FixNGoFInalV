using System.Linq.Expressions;

namespace FixNGo.Domain.Specifications;

/// <summary>Encapsulates reusable domain filtering, ordering and eager-loading criteria.</summary>
public interface ISpecification<T>
{
    Expression<Func<T, bool>>? Criteria { get; }
    IReadOnlyList<Expression<Func<T, object>>> Includes { get; }
    Expression<Func<T, object>>? OrderBy { get; }
    Expression<Func<T, object>>? OrderByDescending { get; }
    int? Take { get; }
    int? Skip { get; }
}

/// <summary>Base implementation for strongly-typed query specifications.</summary>
public abstract class Specification<T> : ISpecification<T>
{
    private readonly List<Expression<Func<T, object>>> _includes = [];

    protected Specification() { }

    protected Specification(Expression<Func<T, bool>> criteria) => Criteria = criteria;

    public Expression<Func<T, bool>>? Criteria { get; protected init; }
    public IReadOnlyList<Expression<Func<T, object>>> Includes => _includes;
    public Expression<Func<T, object>>? OrderBy { get; private set; }
    public Expression<Func<T, object>>? OrderByDescending { get; private set; }
    public int? Take { get; private set; }
    public int? Skip { get; private set; }

    protected void AddInclude(Expression<Func<T, object>> includeExpression) => _includes.Add(includeExpression);
    protected void ApplyOrderBy(Expression<Func<T, object>> orderByExpression) => OrderBy = orderByExpression;
    protected void ApplyOrderByDescending(Expression<Func<T, object>> orderByDescExpression) => OrderByDescending = orderByDescExpression;
    protected void ApplyPaging(int skip, int take)
    {
        Skip = Math.Max(0, skip);
        Take = Math.Max(1, take);
    }
}
