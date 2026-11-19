using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using Microsoft.AspNetCore.Cryptography.KeyDerivation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace FixNGo.Infrastructure.Services;

/// <summary>System clock (production) wrapping UTC now.</summary>
public sealed class SystemClock : IClock
{
    public DateTime UtcNow => DateTime.UtcNow;
}

/// <summary>PBKDF2 password hashing via ASP.NET Core primitives, no Identity UI.</summary>
public sealed class PasswordHasherService : IPasswordHasher
{
    private const int Iterations = 100_000;
    private const int SaltBytes = 16;
    private const int KeyBytes = 32;

    public string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltBytes);
        var key = KeyDerivation.Pbkdf2(password, salt, KeyDerivationPrf.HMACSHA256, Iterations, KeyBytes);
        return $"PBKDF2|{Iterations}|{Convert.ToBase64String(salt)}|{Convert.ToBase64String(key)}";
    }

    public bool Verify(string hash, string password)
    {
        var parts = hash.Split('|');
        if (parts.Length != 4 || parts[0] != "PBKDF2") return false;
        if (!int.TryParse(parts[1], out var iterations)) return false;
        var salt = Convert.FromBase64String(parts[2]);
        var expected = Convert.FromBase64String(parts[3]);
        var actual = KeyDerivation.Pbkdf2(password, salt, KeyDerivationPrf.HMACSHA256, iterations, expected.Length);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }
}

/// <summary>JWT access tokens + high-entropy refresh tokens. Signing key loaded from secrets.json.</summary>
public sealed class TokenService(byte[] signingKey, string issuer, string audience, int accessMinutes) : ITokenService
{
    private readonly SymmetricSecurityKey _key = new(signingKey);

    public string IssueAccessToken(Guid userId, Role role, string email)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new(JwtRegisteredClaimNames.Email, email),
            new(ClaimTypes.Role, role.ToString()),
            new("role", role.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };
        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            notBefore: DateTime.UtcNow.AddMinutes(-1),
            expires: DateTime.UtcNow.AddMinutes(accessMinutes),
            signingCredentials: new SigningCredentials(_key, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateRefreshToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));

    public (Guid UserId, Role Role, string Email)? ValidateAccessToken(string token)
    {
        try
        {
            var handler = new JwtSecurityTokenHandler { MapInboundClaims = false };
            var principal = handler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuer = true, ValidateAudience = true, ValidateLifetime = true,
                ValidateIssuerSigningKey = true, ValidIssuer = issuer, ValidAudience = audience,
                IssuerSigningKey = _key, ClockSkew = TimeSpan.Zero
            }, out _);
            var sub = principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
            var role = principal.FindFirst("role")?.Value;
            var email = principal.FindFirst(JwtRegisteredClaimNames.Email)?.Value;
            if (sub is null || role is null || !Guid.TryParse(sub, out var id) || !Enum.TryParse<Role>(role, out var r) || email is null)
                return null;
            return (id, r, email);
        }
        catch { return null; }
    }
}

/// <summary>Fake SMS/email sender: stores messages in the simulator message store.</summary>
public sealed class FakeOtpSender(IServiceScopeFactory scopes, ILogger<FakeOtpSender> logger) : IOtpSender
{
    public async Task SendAsync(string recipient, string? recipientName, SimChannel channel, string code, string purpose, CancellationToken ct = default)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
        db.SimMessages.Add(new Domain.Entities.SimMessage
        {
            Channel = channel, Recipient = recipient, RecipientName = recipientName,
            Body = channel == SimChannel.Sms ? $"FixNGo code: {code}" : $"Your FixNGo {purpose} code is {code}",
            OtpCode = code, Purpose = purpose
        });
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Fake {Channel} message queued for {Recipient}", channel, recipient);
    }
}

/// <summary>Fake payment gateway: documented test cards, idempotent by key.</summary>
public sealed class FakePaymentGateway(IAppDbContext db, IClock clock, ILogger<FakePaymentGateway> logger) : IPaymentGateway
{
    public async Task<(bool, string?, string?)> ChargeAsync(string token, long amountMinor, string idempotencyKey, CancellationToken ct = default)
    {
        var digits = new string(token.Where(char.IsDigit).ToArray());
        var existing = await db.SimPaymentTransactions.FirstOrDefaultAsync(t => t.Reference == idempotencyKey, ct);
        if (existing is not null) return (existing.Status == "Succeeded", existing.Reference, existing.FailureReason);

        bool success = digits switch
        {
            "4000000000000002" => false,
            "4000000000009995" => false,
            _ => true
        };
        var reason = digits == "4000000000009995" ? "insufficient_funds" : digits == "4000000000000002" ? "card_declined" : null;
        var tx = new Domain.Entities.SimPaymentTransaction
        {
            Reference = idempotencyKey,
            Payer = digits.Length >= 4 ? "Card" : "Wallet",
            Method = PaymentMethodType.Card,
            AmountMinor = amountMinor,
            Status = success ? "Succeeded" : "Failed",
            FailureReason = reason,
            CreatedAt = clock.UtcNow
        };
        db.SimPaymentTransactions.Add(tx);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Fake payment {Ref} {Status}", idempotencyKey, tx.Status);
        return (success, idempotencyKey, reason);
    }
}
