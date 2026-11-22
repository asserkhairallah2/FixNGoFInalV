namespace FixNGo.Domain;

/// <summary>Platform settings snapshot used by pricing and matching.</summary>
public sealed record PricingSettings(
    long TowBaseMinor = 45000,
    long MechanicBaseMinor = 15000,
    long ServiceFeeMinor = 5000,
    decimal TowRatePerKm = 18.30m,
    decimal Surge = 1.0m,
    int SearchRadiusKm = 5,
    int OfferTimeoutSeconds = 30,
    int P0TimeoutSeconds = 15,
    int BookingExpiryHours = 24,
    long MinWithdrawalMinor = 10000,
    long WithdrawalFeeMinor = 0,
    string AmbulanceNumber = "123",
    string PoliceNumber = "122");

/// <summary>Pure pricing formulas. All inputs are raw values; the client formats them.</summary>
public static class Pricing
{
    /// <summary>tow: (base + km × rate) × surge + serviceFee, rounded to whole piasters.</summary>
    public static long TowTotalMinor(double distanceKm, PricingSettings s) =>
        decimal.ToInt64(decimal.Round(((s.TowBaseMinor + (decimal)distanceKm * s.TowRatePerKm * 100m) * s.Surge), 0, MidpointRounding.AwayFromZero)) + s.ServiceFeeMinor;

    /// <summary>mechanic: callout × surge + labor + parts + serviceFee.</summary>
    public static long MechanicTotalMinor(long calloutMinor, long laborMinor, long partsMinor, PricingSettings s) =>
        decimal.ToInt64(decimal.Round(calloutMinor * s.Surge, 0, MidpointRounding.AwayFromZero)) + laborMinor + partsMinor + s.ServiceFeeMinor;

    /// <summary>Estimate range shown in C08: ±8 %, rounded to 10 EGP.</summary>
    public static (long Low, long High) EstimateRange(long totalMinor)
    {
        var low = Math.Round(totalMinor * 0.92m / 1000m, MidpointRounding.AwayFromZero) * 1000;
        var high = Math.Round(totalMinor * 1.08m / 1000m, MidpointRounding.AwayFromZero) * 1000;
        return ((long)low, (long)high);
    }

    public static long ProviderNet(long totalMinor, PricingSettings s) => totalMinor - s.ServiceFeeMinor;
}

/// <summary>Haversine distance, circuity factor and ETA used by the fake routing provider.</summary>
public static class Geo
{
    public static double HaversineKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double r = 6371.0;
        var dLat = (lat2 - lat1) * Math.PI / 180.0;
        var dLon = (lon2 - lon1) * Math.PI / 180.0;
        var sinDLat = Math.Sin(dLat / 2);
        var sinDLon = Math.Sin(dLon / 2);
        var a = sinDLat * sinDLat + Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180) * sinDLon * sinDLon;
        return 2 * r * Math.Asin(Math.Sqrt(a));
    }

    public static double RoadDistanceKm(double lat1, double lon1, double lat2, double lon2) =>
        HaversineKm(lat1, lon1, lat2, lon2) * 1.3;

    public static int EtaMinutes(double roadDistanceKm) =>
        (int)Math.Ceiling(roadDistanceKm / 30.0 * 60.0) + 2;

    /// <summary>2–6 interpolated route points for the fake map polyline.</summary>
    public static List<(double Lat, double Lng)> RoutePoints(double lat1, double lon1, double lat2, double lon2)
    {
        var n = Math.Clamp((int)Math.Ceiling(HaversineKm(lat1, lon1, lat2, lon2)) + 2, 2, 6);
        return Enumerable.Range(0, n)
            .Select(i => (lat1 + (lat2 - lat1) * i / (n - 1.0), lon1 + (lon2 - lon1) * i / (n - 1.0)))
            .ToList();
    }

    private static readonly (string[] Keywords, double Lat, double Lon)[] EgyptianDistricts =
    [
        (["new cairo", "5th settlement", "fifth settlement", "90th", "التجمع", "القاهرة الجديدة", "شارع التسعين"], 30.0276, 31.4913),
        (["rehab", "الرحاب"], 30.0595, 31.4950),
        (["madinaty", "مدينتي"], 30.0826, 31.6295),
        (["nasr city", "مدينة نصر", "عباس العقاد", "مكرم عبيد"], 30.0561, 31.3301),
        (["heliopolis", "korba", "مصر الجديدة", "الكوربة", "روكسي"], 30.0909, 31.3227),
        (["maadi", "المعادي", "زهراء المعادي"], 29.9602, 31.2569),
        (["mokattam", "المقطم"], 30.0131, 31.2859),
        (["zamalek", "الزمالك"], 30.0609, 31.2197),
        (["downtown", "tahrir", "ramses", "وسط البلد", "التحرير", "رمسيس"], 30.0444, 31.2357),
        (["shubra", "شبرا"], 30.0778, 31.2456),
        (["dokki", "الدقي"], 30.0385, 31.2122),
        (["mohandessin", "mohandeseen", "المهندسين"], 30.0540, 31.2019),
        (["agouza", "العجوزة"], 30.0600, 31.2089),
        (["haram", "faisal", "giza", "الهرم", "فيصل", "الجيزة"], 29.9943, 31.1605),
        (["sheikh zayed", "zayed", "الشيخ زايد", "زايد"], 30.0381, 31.0124),
        (["6th of october", "october", "أكتوبر", "السادس من أكتوبر", "6 اكتوبر"], 29.9723, 30.9401),
        (["smouha", "سموحة"], 31.2156, 29.9420),
        (["sidi gaber", "سيدي جابر"], 31.2240, 29.9424),
        (["gleem", "stanley", "جليم", "ستانلي"], 31.2370, 29.9570),
        (["miami", "sidi bishr", "ميامي", "سيدي بشر"], 31.2640, 29.9950),
        (["alexandria", "alex", "الإسكندرية", "اسكندرية"], 31.2001, 29.9187),
        (["mansoura", "المنصورة"], 31.0409, 31.3785),
        (["tanta", "طنطا"], 30.7865, 31.0004)
    ];

    /// <summary>Resolves Egyptian neighborhood/city coordinates from free-text address when default coordinates were left unchanged.</summary>
    public static (double Lat, double Lon) InferEgyptianCoordinates(
        string? address,
        double currentLat,
        double currentLon,
        double defaultLat = 30.0444,
        double defaultLon = 31.2357)
    {
        if (string.IsNullOrWhiteSpace(address)) return (currentLat, currentLon);
        if (Math.Abs(currentLat - defaultLat) > 0.0006 || Math.Abs(currentLon - defaultLon) > 0.0006)
            return (currentLat, currentLon);

        var norm = address.Trim().ToLowerInvariant();
        foreach (var (keywords, lat, lon) in EgyptianDistricts)
        {
            foreach (var kw in keywords)
            {
                if (norm.Contains(kw, StringComparison.OrdinalIgnoreCase))
                    return (lat, lon);
            }
        }
        return (currentLat, currentLon);
    }
}

/// <summary>Ranking of nearby candidates: 0.4·distance + 0.3·ETA + 0.2·(5−rating) + 0.1·price.</summary>
public sealed class CandidateScore
{
    public CandidateScore(Guid providerId, double distanceKm, int etaMinutes, decimal rating, long priceMinor)
    {
        ProviderId = providerId;
        DistanceKm = distanceKm;
        EtaMinutes = etaMinutes;
        Rating = rating;
        PriceMinor = priceMinor;
    }

    public Guid ProviderId { get; }
    public double DistanceKm { get; }
    public int EtaMinutes { get; }
    public decimal Rating { get; }
    public long PriceMinor { get; }
    public double Score { get; set; }
}

public static class Matching
{
    public static IReadOnlyList<CandidateScore> Rank(IEnumerable<CandidateScore> candidates, string sort = "recommended")
    {
        var list = candidates.ToList();
        if (list.Count == 0) return list;
        double Norm(Func<CandidateScore, double> v)
        {
            var min = list.Min(v); var max = list.Max(v);
            return max - min < 1e-9 ? 0 : 1.0;
        }
        foreach (var c in list)
        {
            var dNorm = Norm(x => x.DistanceKm) == 0 ? 0 : (c.DistanceKm - list.Min(x => x.DistanceKm)) / (list.Max(x => x.DistanceKm) - list.Min(x => x.DistanceKm));
            var eNorm = Norm(x => x.EtaMinutes) == 0 ? 0 : (c.EtaMinutes - list.Min(x => x.EtaMinutes)) / (double)(list.Max(x => x.EtaMinutes) - list.Min(x => x.EtaMinutes));
            var pNorm = Norm(x => x.PriceMinor) == 0 ? 0 : (c.PriceMinor - list.Min(x => x.PriceMinor)) / (double)(list.Max(x => x.PriceMinor) - list.Min(x => x.PriceMinor));
            c.Score = 0.4 * dNorm + 0.3 * eNorm + 0.2 * (5 - (double)c.Rating) / 5 + 0.1 * pNorm;
        }
        return sort switch
        {
            "nearest" or "distance" => list.OrderBy(c => c.DistanceKm).ThenBy(c => c.EtaMinutes).ThenByDescending(c => c.Rating).ToList(),
            "fastest" => list.OrderBy(c => c.EtaMinutes).ThenBy(c => c.DistanceKm).ThenBy(c => c.Score).ToList(),
            "price" or "lowest" => list.OrderBy(c => c.PriceMinor).ThenBy(c => c.EtaMinutes).ThenBy(c => c.Score).ToList(),
            "top_rated" or "rating" or "top" => list.OrderByDescending(c => c.Rating).ThenBy(c => c.EtaMinutes).ThenBy(c => c.Score).ToList(),
            _ => list.OrderBy(c => c.DistanceKm).ThenBy(c => c.Score).ThenByDescending(c => c.Rating).ToList()
        };
    }

    /// <summary>Radius expansion ladder used by C28 and P0 re-dispatch.</summary>
    public static IEnumerable<int> RadiusLadder(int start) { yield return start; yield return start == 5 ? 10 : start * 2; yield return start == 5 ? 20 : start * 4; }
}

/// <summary>Validation helpers shared by domain and application layers.</summary>
public static class Rules
{
    public static bool PasswordPolicy(string? password) =>
        password is { Length: >= 8 } && password.Any(char.IsUpper) && password.Any(char.IsLower)
        && password.Any(char.IsDigit) && password.Any(c => !char.IsLetterOrDigit(c));

    public static string DescribePasswordError(string? password)
    {
        if (string.IsNullOrEmpty(password))
            return "Password is required (8+ chars with uppercase, lowercase, number, and symbol).";

        var missing = new List<string>();
        if (password.Length < 8) missing.Add("at least 8 characters");
        if (!password.Any(char.IsUpper)) missing.Add("an uppercase letter (A-Z)");
        if (!password.Any(char.IsLower)) missing.Add("a lowercase letter (a-z)");
        if (!password.Any(char.IsDigit)) missing.Add("a number (0-9)");
        if (!password.Any(c => !char.IsLetterOrDigit(c))) missing.Add("a symbol (e.g. @ # $ !)");

        return missing.Count == 0
            ? string.Empty
            : $"Password is missing: {string.Join(", ", missing)}.";
    }

    public static bool Luhn(string number)
    {
        var digits = number.Where(char.IsDigit).ToArray();
        if (digits.Length < 13 || digits.Length > 19) return false;
        var sum = 0;
        for (var i = 0; i < digits.Length; i++)
        {
            var d = digits[digits.Length - 1 - i] - '0';
            if (i % 2 == 1) { d *= 2; if (d > 9) d -= 9; }
            sum += d;
        }
        return sum % 10 == 0;
    }

    /// <summary>IBAN mod-97 for Egypt: EG + 2 check digits + 27 alphanumeric characters.</summary>
    public static bool IbanValid(string iban)
    {
        var s = new string(iban.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        if (s.Length != 29 || !s.StartsWith("EG", StringComparison.Ordinal)) return false;
        var rearranged = s[4..] + s[..4];
        var numeric = string.Concat(rearranged.Select(c => char.IsDigit(c) ? c.ToString() : ((c - 'A' + 10)).ToString()));
        int remainder = 0;
        foreach (var ch in numeric) remainder = (remainder * 10 + (ch - '0')) % 97;
        return remainder == 1;
    }

    public static string NormalisePlate(string plate)
    {
        var s = new string(plate.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        return s;
    }

    public static string NormalisePhone(string phone)
    {
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        if (digits.StartsWith("00", StringComparison.Ordinal)) digits = digits[2..];
        if (digits.StartsWith("20", StringComparison.Ordinal) && digits.Length == 12) return "+" + digits;
        if (digits.StartsWith("01", StringComparison.Ordinal) && digits.Length == 11) return "+2" + digits;
        return "+" + digits;
    }

    public static bool EgyptianMobile(string phone)
    {
        var p = NormalisePhone(phone);
        return p.Length == 13 && p.StartsWith("+201", StringComparison.Ordinal) && "0125".Contains(p[4]);
    }

    public static bool ValidEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email) || email.Length > 254) return false;
        var at = email.IndexOf('@');
        return at > 0 && at < email.Length - 1 && email.IndexOf('.', at + 1) > at + 1 && !email.Contains("..", StringComparison.Ordinal);
    }

    /// <summary>Next OTP attempt allowed? TTL, attempts and consumed flags are checked by the service.</summary>
    public static bool OtpAllowed(DateTime expiresAt, int attempts, bool consumed, DateTime now) =>
        !consumed && attempts < 5 && now < expiresAt;
}
