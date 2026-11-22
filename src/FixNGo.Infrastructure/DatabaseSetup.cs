using FixNGo.Domain;
using FixNGo.Domain.Entities;
using FixNGo.Infrastructure.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Infrastructure;

/// <summary>Creates/migrates the SQLite database, applies PRAGMAs, and seeds reference data.</summary>
public static class DatabaseSetup
{
    /// <summary>Ensure the database file, schema and reference seed exist. Idempotent.</summary>
    public static async Task<(bool Created, int UserCount)> EnsureAsync(RuntimePaths paths, CancellationToken ct = default)
    {
        paths.EnsureDirectories();
        SqliteConnection.ClearAllPools();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(DependencyInjection.ConnectionString(paths))
            .Options;
        await using var db = new AppDbContext(options);
        await using var conn = (SqliteConnection)db.Database.GetDbConnection();
        await conn.OpenAsync(ct);
        ApplyPragmas(conn);

        var created = await db.Database.EnsureCreatedAsync(ct);
        await EnsureSchemaUpgradesAsync(conn, ct);
        if (created) await ReferenceSeeder.SeedAsync(db, ct);
        // If the DB existed but has no reference data yet, seed it anyway.
        else if (!await db.ServiceTypes.AnyAsync(ct)) await ReferenceSeeder.SeedAsync(db, ct);

        await Persistence.DummyDataConsistencySync.SynchronizeIfDummyAsync(db, ct);

        var count = await db.Users.CountAsync(ct);
        return (created, count);
    }

    private static async Task EnsureSchemaUpgradesAsync(SqliteConnection conn, CancellationToken ct)
    {
        var upgrades = new (string Table, string Column, string Definition)[]
        {
            ("Reviews", "CustomerId", "TEXT NULL"),
            ("Offers", "CustomerSelected", "INTEGER NOT NULL DEFAULT 0"),
            ("ServiceRequests", "PendingProviderId", "TEXT NULL"),
            ("ServiceRequests", "PendingOfferId", "TEXT NULL"),
            ("ServiceRequests", "CustomerConfirmDeadlineAt", "TEXT NULL"),
            ("ServiceRequests", "CustomerRejectionCount", "INTEGER NOT NULL DEFAULT 0"),
            ("ServiceRequests", "SearchExpiresAt", "TEXT NULL")
        };

        foreach (var (table, column, def) in upgrades)
        {
            var exists = false;
            await using (var checkCmd = conn.CreateCommand())
            {
                checkCmd.CommandText = $"PRAGMA table_info(\"{table}\");";
                await using var reader = await checkCmd.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct))
                {
                    if (string.Equals(reader.GetString(1), column, StringComparison.OrdinalIgnoreCase))
                    {
                        exists = true;
                        break;
                    }
                }
            }
            if (!exists)
            {
                await using var alterCmd = conn.CreateCommand();
                alterCmd.CommandText = $"ALTER TABLE \"{table}\" ADD COLUMN \"{column}\" {def};";
                await alterCmd.ExecuteNonQueryAsync(ct);
            }
        }
    }

    /// <summary>Apply required SQLite PRAGMAs on a connection (03 §3).</summary>
    public static void ApplyPragmas(SqliteConnection conn)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;";
        cmd.ExecuteNonQuery();
    }

    /// <summary>Integrity check for backups/restore.</summary>
    public static async Task<bool> IntegrityOkAsync(string dbPath, CancellationToken ct = default)
    {
        if (!File.Exists(dbPath)) return false;
        await using var conn = new SqliteConnection($"Data Source={dbPath};Mode=ReadOnly");
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "PRAGMA integrity_check;";
        var result = (string?)await cmd.ExecuteScalarAsync(ct);
        return string.Equals(result, "ok", StringComparison.Ordinal);
    }

    /// <summary>Count users in a database file (for verification).</summary>
    public static async Task<int> CountUsersAsync(string dbPath, CancellationToken ct = default)
    {
        if (!File.Exists(dbPath)) return 0;
        await using var conn = new SqliteConnection($"Data Source={dbPath};Mode=ReadOnly");
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM Users;";
        return (int)(long)(await cmd.ExecuteScalarAsync(ct) ?? 0L);
    }

    /// <summary>Create a consistent snapshot of the live DB using VACUUM INTO.</summary>
    public static async Task VacuumIntoAsync(string sourcePath, string targetPath, CancellationToken ct = default)
    {
        SqliteConnection.ClearAllPools();
        await using var conn = new SqliteConnection($"Data Source={sourcePath}");
        await conn.OpenAsync(ct);
        Checkpoint(conn);
        var escaped = targetPath.Replace("'", "''", StringComparison.Ordinal);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"VACUUM INTO '{escaped}';";
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static void Checkpoint(SqliteConnection conn)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "PRAGMA wal_checkpoint(TRUNCATE);";
        cmd.ExecuteNonQuery();
    }

    /// <summary>Load or generate the JWT signing key in secrets.json.</summary>
    public static byte[] LoadOrCreateSigningKey(RuntimePaths paths)
    {
        paths.EnsureDirectories();
        if (File.Exists(paths.SecretsPath))
        {
            using var doc = System.Text.Json.JsonDocument.Parse(File.ReadAllText(paths.SecretsPath));
            if (doc.RootElement.TryGetProperty("jwtSigningKey", out var k))
                return Convert.FromBase64String(k.GetString()!);
        }
        var key = System.Security.Cryptography.RandomNumberGenerator.GetBytes(64);
        File.WriteAllText(paths.SecretsPath, System.Text.Json.JsonSerializer.Serialize(new
        {
            jwtSigningKey = Convert.ToBase64String(key),
            createdAt = DateTime.UtcNow
        }));
        return key;
    }
}
