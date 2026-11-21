using System.Security.Cryptography;
using System.Text;

namespace FixNGo.Web.Services;

public interface ISiteGateService
{
    bool IsEnabled { get; }
    bool VerifyCredentials(string? username, string? password);
    string IssueGateCookieValue(string username, TimeSpan ttl);
    bool ValidateGateCookieValue(string? cookieValue);
}

/// <summary>
/// Cookie-backed site-wide access gate compatible with Apache/Nginx .htpasswd ($apr1$ MD5 and {SHA}).
/// Eliminates HTTP 401 Basic-vs-Bearer browser header collisions and webview 401 dead-ends.
/// </summary>
public sealed class SiteGateService(string? htpasswdPath, byte[] signingKey) : ISiteGateService
{
    public const string CookieName = "fixngo_site_gate";

    public bool IsEnabled => !string.IsNullOrWhiteSpace(htpasswdPath) && File.Exists(htpasswdPath);

    public bool VerifyCredentials(string? username, string? password)
    {
        if (!IsEnabled || string.IsNullOrWhiteSpace(username) || password is null)
            return false;

        var entries = ReadEntries();
        if (!entries.TryGetValue(username.Trim(), out var storedHash) || string.IsNullOrWhiteSpace(storedHash))
            return false;

        return VerifyHash(password, storedHash);
    }

    public string IssueGateCookieValue(string username, TimeSpan ttl)
    {
        var exp = DateTimeOffset.UtcNow.Add(ttl).ToUnixTimeSeconds();
        var payload = $"{username.Trim()}|{exp}";
        var payloadB64 = Base64UrlEncode(Encoding.UTF8.GetBytes(payload));
        var sigBytes = HMACSHA256.HashData(signingKey, Encoding.UTF8.GetBytes(payloadB64));
        var sigB64 = Base64UrlEncode(sigBytes);
        return $"{payloadB64}.{sigB64}";
    }

    public bool ValidateGateCookieValue(string? cookieValue)
    {
        if (!IsEnabled || string.IsNullOrWhiteSpace(cookieValue))
            return false;

        var dot = cookieValue.IndexOf('.');
        if (dot <= 0 || dot >= cookieValue.Length - 1)
            return false;

        var payloadB64 = cookieValue[..dot];
        var sigB64 = cookieValue[(dot + 1)..];

        byte[] providedSig;
        byte[] payloadBytes;
        try
        {
            providedSig = Base64UrlDecode(sigB64);
            payloadBytes = Base64UrlDecode(payloadB64);
        }
        catch
        {
            return false;
        }

        var expectedSig = HMACSHA256.HashData(signingKey, Encoding.UTF8.GetBytes(payloadB64));
        if (!CryptographicOperations.FixedTimeEquals(providedSig, expectedSig))
            return false;

        var payload = Encoding.UTF8.GetString(payloadBytes);
        var sep = payload.LastIndexOf('|');
        if (sep <= 0) return false;

        var username = payload[..sep];
        if (!long.TryParse(payload[(sep + 1)..], out var expUnix))
            return false;
        if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() >= expUnix)
            return false;

        var entries = ReadEntries();
        return entries.ContainsKey(username);
    }

    private Dictionary<string, string> ReadEntries()
    {
        var dict = new Dictionary<string, string>(StringComparer.Ordinal);
        if (string.IsNullOrWhiteSpace(htpasswdPath) || !File.Exists(htpasswdPath))
            return dict;

        foreach (var rawLine in File.ReadAllLines(htpasswdPath))
        {
            var line = rawLine.Trim();
            if (line.Length == 0 || line.StartsWith('#')) continue;
            var idx = line.IndexOf(':');
            if (idx <= 0 || idx >= line.Length - 1) continue;
            dict[line[..idx].Trim()] = line[(idx + 1)..].Trim();
        }
        return dict;
    }

    public static bool VerifyHash(string password, string storedHash)
    {
        if (storedHash.StartsWith("$apr1$", StringComparison.Ordinal))
        {
            var rest = storedHash[6..];
            var dollar = rest.IndexOf('$');
            if (dollar < 0) return false;
            var salt = rest[..dollar];
            var computed = Apr1Md5Hash(password, salt);
            return CryptographicOperations.FixedTimeEquals(
                Encoding.ASCII.GetBytes(computed),
                Encoding.ASCII.GetBytes(storedHash));
        }

        if (storedHash.StartsWith("{SHA}", StringComparison.Ordinal))
        {
            var computed = "{SHA}" + Convert.ToBase64String(SHA1.HashData(Encoding.UTF8.GetBytes(password)));
            return CryptographicOperations.FixedTimeEquals(
                Encoding.ASCII.GetBytes(computed),
                Encoding.ASCII.GetBytes(storedHash));
        }

        if (storedHash.StartsWith("{PLAIN}", StringComparison.Ordinal))
        {
            var plain = storedHash[7..];
            return CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(password),
                Encoding.UTF8.GetBytes(plain));
        }

        return false;
    }

    /// <summary>Exact Apache APR1 MD5 ($apr1$salt$...) implementation matching `openssl passwd -apr1`.</summary>
    public static string Apr1Md5Hash(string password, string salt)
    {
        const string magic = "$apr1$";
        const string itoa64 = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

        if (salt.Length > 8) salt = salt[..8];
        var pwBytes = Encoding.UTF8.GetBytes(password);
        var saltBytes = Encoding.ASCII.GetBytes(salt);
        var magicBytes = Encoding.ASCII.GetBytes(magic);

        byte[] alt;
        using (var md5Alt = IncrementalHash.CreateHash(HashAlgorithmName.MD5))
        {
            md5Alt.AppendData(pwBytes);
            md5Alt.AppendData(saltBytes);
            md5Alt.AppendData(pwBytes);
            alt = md5Alt.GetHashAndReset();
        }

        byte[] final;
        using (var ctx = IncrementalHash.CreateHash(HashAlgorithmName.MD5))
        {
            ctx.AppendData(pwBytes);
            ctx.AppendData(magicBytes);
            ctx.AppendData(saltBytes);

            for (var pl = pwBytes.Length; pl > 0; pl -= 16)
            {
                ctx.AppendData(alt.AsSpan(0, Math.Min(16, pl)));
            }

            Span<byte> zero = [0];
            for (var i = pwBytes.Length; i != 0; i >>= 1)
            {
                if ((i & 1) != 0)
                    ctx.AppendData(zero);
                else if (pwBytes.Length > 0)
                    ctx.AppendData(pwBytes.AsSpan(0, 1));
                else
                    ctx.AppendData(zero);
            }

            final = ctx.GetHashAndReset();
        }

        using (var loopHash = IncrementalHash.CreateHash(HashAlgorithmName.MD5))
        {
            for (var i = 0; i < 1000; i++)
            {
                if ((i & 1) != 0) loopHash.AppendData(pwBytes);
                else loopHash.AppendData(final);

                if (i % 3 != 0) loopHash.AppendData(saltBytes);
                if (i % 7 != 0) loopHash.AppendData(pwBytes);

                if ((i & 1) != 0) loopHash.AppendData(final);
                else loopHash.AppendData(pwBytes);

                final = loopHash.GetHashAndReset();
            }
        }

        var sb = new StringBuilder(40);
        sb.Append(magic).Append(salt).Append('$');
        Append64(sb, itoa64, ((uint)final[0] << 16) | ((uint)final[6] << 8) | final[12], 4);
        Append64(sb, itoa64, ((uint)final[1] << 16) | ((uint)final[7] << 8) | final[13], 4);
        Append64(sb, itoa64, ((uint)final[2] << 16) | ((uint)final[8] << 8) | final[14], 4);
        Append64(sb, itoa64, ((uint)final[3] << 16) | ((uint)final[9] << 8) | final[15], 4);
        Append64(sb, itoa64, ((uint)final[4] << 16) | ((uint)final[10] << 8) | final[5], 4);
        Append64(sb, itoa64, final[11], 2);
        return sb.ToString();
    }

    private static void Append64(StringBuilder sb, string itoa64, uint v, int n)
    {
        while (--n >= 0)
        {
            sb.Append(itoa64[(int)(v & 0x3f)]);
            v >>= 6;
        }
    }

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] Base64UrlDecode(string input)
    {
        var padded = input.Replace('-', '+').Replace('_', '/');
        switch (padded.Length % 4)
        {
            case 2: padded += "=="; break;
            case 3: padded += "="; break;
        }
        return Convert.FromBase64String(padded);
    }
}
