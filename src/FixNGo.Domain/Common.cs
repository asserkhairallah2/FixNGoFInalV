namespace FixNGo.Domain;

/// <summary>Base class for all persisted entities.</summary>
public abstract class BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Money as integer minor units (piasters) plus an ISO currency code.</summary>
public readonly record struct Money(long AmountMinor, string Currency = "EGP")
{
    public decimal Amount => AmountMinor / 100m;
    public static Money FromEgps(decimal amount) => new(decimal.ToInt64(amount * 100m));
    public override string ToString() => $"{Amount:0.00} {Currency}";
}

/// <summary>Latitude/longitude pair with an optional area label.</summary>
public readonly record struct GeoPoint(double Latitude, double Longitude, string? AreaLabel = null);

/// <summary>Domain rule violation mapped to HTTP 409 by the API.</summary>
public class DomainException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}

/// <summary>Illegal state transition with the allowed next states attached.</summary>
public class IllegalTransitionException(string from, string to, IEnumerable<string> allowed)
    : DomainException("request.illegal_transition", $"Cannot move from {from} to {to}.")
{
    public string From { get; } = from;
    public string To { get; } = to;
    public IReadOnlyList<string> Allowed { get; } = allowed.ToList().AsReadOnly();
}
