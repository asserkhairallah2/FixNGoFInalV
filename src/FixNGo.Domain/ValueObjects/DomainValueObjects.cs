using System.Text.RegularExpressions;

namespace FixNGo.Domain.ValueObjects;

/// <summary>Validated Egyptian mobile phone number (+2010/+2011/+2012/+2015).</summary>
public readonly partial record struct EgyptianPhoneNumber
{
    private static readonly Regex Pattern = EgyptianPhoneRegex();

    public string Value { get; }

    public EgyptianPhoneNumber(string raw)
    {
        var normalized = Normalize(raw);
        if (!Pattern.IsMatch(normalized))
            throw new DomainException("phone.invalid", "Phone number must be a valid Egyptian mobile number (+201XXXXXXXXX).");
        Value = normalized;
    }

    public static string Normalize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return string.Empty;
        var digits = new string(raw.Where(c => char.IsDigit(c) || c == '+').ToArray());
        if (digits.StartsWith("0020", StringComparison.Ordinal))
            digits = "+20" + digits[4..];
        else if (digits.StartsWith("01", StringComparison.Ordinal) && digits.Length == 11)
            digits = "+2" + digits;
        else if (digits.StartsWith("201", StringComparison.Ordinal) && digits.Length == 12)
            digits = "+" + digits;
        return digits;
    }

    public static bool TryCreate(string? raw, out EgyptianPhoneNumber result)
    {
        var normalized = Normalize(raw);
        if (Pattern.IsMatch(normalized))
        {
            result = new EgyptianPhoneNumber(normalized);
            return true;
        }
        result = default;
        return false;
    }

    public override string ToString() => Value;

    [GeneratedRegex(@"^\+201[0125]\d{8}$", RegexOptions.Compiled)]
    private static partial Regex EgyptianPhoneRegex();
}

/// <summary>Normalized vehicle license plate value object.</summary>
public readonly record struct VehiclePlate
{
    public string Normalized { get; }

    public VehiclePlate(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            throw new DomainException("vehicle.plate_required", "Vehicle plate number is required.");
        var collapsed = string.Join(' ', raw.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries)).ToUpperInvariant();
        if (collapsed.Length is < 2 or > 20)
            throw new DomainException("vehicle.plate_length", "Vehicle plate must be between 2 and 20 characters.");
        Normalized = collapsed;
    }

    public override string ToString() => Normalized;
}

/// <summary>Geographic coordinate with Haversine distance calculation in Domain.</summary>
public readonly record struct GeoCoordinate
{
    private const double EarthRadiusKm = 6371.0;

    public double Latitude { get; }
    public double Longitude { get; }

    public GeoCoordinate(double latitude, double longitude)
    {
        if (double.IsNaN(latitude) || latitude is < -90 or > 90)
            throw new DomainException("geo.invalid_latitude", "Latitude must be between -90 and 90 degrees.");
        if (double.IsNaN(longitude) || longitude is < -180 or > 180)
            throw new DomainException("geo.invalid_longitude", "Longitude must be between -180 and 180 degrees.");
        Latitude = latitude;
        Longitude = longitude;
    }

    public double DistanceKmTo(GeoCoordinate other)
    {
        var dLat = DegreesToRadians(other.Latitude - Latitude);
        var dLon = DegreesToRadians(other.Longitude - Longitude);
        var lat1 = DegreesToRadians(Latitude);
        var lat2 = DegreesToRadians(other.Latitude);

        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
              + Math.Cos(lat1) * Math.Cos(lat2) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return Math.Round(EarthRadiusKm * c, 3);
    }

    private static double DegreesToRadians(double degrees) => degrees * Math.PI / 180.0;
}
