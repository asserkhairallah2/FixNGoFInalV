using System.IO.Compression;
using System.Security.Cryptography;
using System.Text.Json;
using FixNGo.Infrastructure;

namespace FixNGo.Cli;

/// <summary>Metadata written beside every real-data snapshot (brief 04 §4 step 3).</summary>
public sealed record BackupManifest(
    string CreatedAt,
    string DbSha256,
    int UploadsFileCount,
    int UserCount,
    bool HadRealData,
    string AppVersion);

/// <summary>Creates, verifies, restores and archives consistent SQLite backups.</summary>
public static class BackupService
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true
    };

    private const string ManifestName = "manifest.json";
    private const string DbName = "fixngo.db";

    /// <summary>Create a verified snapshot at data\backups\real-&lt;timestamp&gt;.</summary>
    public static async Task<string> CreateRealBackupAsync(RuntimePaths paths)
    {
        paths.EnsureDirectories();
        if (!File.Exists(paths.DbPath)) await DatabaseSetup.EnsureAsync(paths);

        var dir = NewBackupDir(paths, "real");
        Directory.CreateDirectory(dir);

        var uploadCopy = Path.Combine(dir, "uploads");
        Directory.CreateDirectory(uploadCopy);
        CopyDirectory(paths.UploadsDir, uploadCopy);

        var consistent = Path.Combine(dir, "consistent-vacuum.db");
        await DatabaseSetup.VacuumIntoAsync(paths.DbPath, consistent);
        var dbCopy = await RawCopyAfterCheckpointAsync(paths.DbPath, Path.Combine(dir, DbName));

        var manifest = new BackupManifest(
            DateTime.UtcNow.ToString("o"),
            Sha256(dbCopy),
            CountFiles(uploadCopy),
            await DatabaseSetup.CountUsersAsync(consistent),
            await DatabaseSetup.CountUsersAsync(paths.DbPath) > 0,
            Version());
        try { File.Delete(consistent); } catch { /* SQLite may briefly hold the file; harmless artifact */ }
        File.WriteAllText(Path.Combine(dir, ManifestName), JsonSerializer.Serialize(manifest, JsonOpts));

        if (!Verify(dir, out var reason)) throw new InvalidOperationException($"Backup self-verification failed: {reason}");
        return dir;
    }

    /// <summary>Create a pre-reset safety snapshot. Keeps only the newest three.</summary>
    public static async Task<string> CreatePreResetSnapshotAsync(RuntimePaths paths)
    {
        paths.EnsureDirectories();
        if (!File.Exists(paths.DbPath)) await DatabaseSetup.EnsureAsync(paths);

        var dir = NewBackupDir(paths, "pre-reset");
        Directory.CreateDirectory(dir);
        var consistent = Path.Combine(dir, "consistent-vacuum.db");
        await DatabaseSetup.VacuumIntoAsync(paths.DbPath, consistent);
        var dbCopy = await RawCopyAfterCheckpointAsync(paths.DbPath, Path.Combine(dir, DbName));

        var zip = Path.Combine(dir, "uploads.zip");
        var uploadCount = 0;
        if (Directory.Exists(paths.UploadsDir))
        {
            var files = Directory.GetFiles(paths.UploadsDir, "*", SearchOption.AllDirectories);
            uploadCount = files.Length;
            if (uploadCount > 0) ZipFile.CreateFromDirectory(paths.UploadsDir, zip);
        }

        var manifest = new BackupManifest(
            DateTime.UtcNow.ToString("o"), Sha256(dbCopy), uploadCount,
            await DatabaseSetup.CountUsersAsync(consistent),
            await DatabaseSetup.CountUsersAsync(paths.DbPath) > 0, Version());
        try { File.Delete(consistent); } catch { /* SQLite may briefly hold the file; harmless artifact */ }
        File.WriteAllText(Path.Combine(dir, ManifestName), JsonSerializer.Serialize(manifest, JsonOpts));

        if (!Verify(dir, out var reason)) throw new InvalidOperationException($"Snapshot self-verification failed: {reason}");
        TrimSnapshots(paths, "pre-reset", 3);
        return dir;
    }

    /// <summary>Verify manifest hash, SQLite integrity, user count and uploads count.</summary>
    public static bool Verify(string dir, out string reason)
    {
        reason = string.Empty;
        var manifestPath = Path.Combine(dir, ManifestName);
        var dbPath = Path.Combine(dir, DbName);
        if (!File.Exists(manifestPath)) { reason = "manifest.json missing"; return false; }
        if (!File.Exists(dbPath)) { reason = "fixngo.db missing"; return false; }

        BackupManifest manifest;
        try { manifest = JsonSerializer.Deserialize<BackupManifest>(File.ReadAllText(manifestPath), JsonOpts)
                ?? throw new JsonException("empty manifest"); }
        catch (Exception ex) { reason = $"unreadable manifest: {ex.Message}"; return false; }

        var actualHash = Sha256(dbPath);
        if (!string.Equals(actualHash, manifest.DbSha256, StringComparison.OrdinalIgnoreCase))
        { reason = "db SHA-256 does not match manifest"; return false; }

        if (!DatabaseSetup.IntegrityOkAsync(dbPath).GetAwaiter().GetResult())
        { reason = "db integrity_check failed"; return false; }

        var users = DatabaseSetup.CountUsersAsync(dbPath).GetAwaiter().GetResult();
        if (users != manifest.UserCount)
        { reason = $"user count {users} != manifest {manifest.UserCount}"; return false; }

        var uploadsDir = Path.Combine(dir, "uploads");
        if (manifest.UploadsFileCount > 0)
        {
            if (!Directory.Exists(uploadsDir)) { reason = "uploads folder missing"; return false; }
            var count = CountFiles(uploadsDir);
            if (count != manifest.UploadsFileCount)
            { reason = $"uploads file count {count} != manifest {manifest.UploadsFileCount}"; return false; }
        }
        return true;
    }

    /// <summary>Load the manifest of a verified backup directory.</summary>
    public static BackupManifest LoadManifest(string dir) =>
        JsonSerializer.Deserialize<BackupManifest>(File.ReadAllText(Path.Combine(dir, ManifestName)), JsonOpts)
        ?? throw new InvalidOperationException("Backup manifest is empty.");

    /// <summary>Swap the verified backup back into the live data dir. Caller stops the server first.</summary>
    public static async Task<(bool Ok, int UserCount, string Message)> RestoreAsync(RuntimePaths paths, string dir)
    {
        if (!Verify(dir, out var reason)) return (false, 0, reason);
        var manifest = LoadManifest(dir);
        var backupDb = Path.Combine(dir, DbName);

        try
        {
            Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
            foreach (var f in new[] { paths.DbPath, paths.DbPath + "-wal", paths.DbPath + "-shm" })
                if (File.Exists(f)) File.Delete(f);
            if (Directory.Exists(paths.UploadsDir)) Directory.Delete(paths.UploadsDir, true);

            File.Copy(backupDb, paths.DbPath, true);
            var uploadCopy = Path.Combine(dir, "uploads");
            if (Directory.Exists(uploadCopy)) CopyDirectory(uploadCopy, paths.UploadsDir);
            else Directory.CreateDirectory(paths.UploadsDir);

            var store = new StateStore(paths);
            if (manifest.HadRealData)
            {
                var state = store.Load() ?? new StateData();
                state.Mode = "real";
                state.Dummy = null;
                if (state.SetupCompletedAt is null) state.SetupCompletedAt = DateTime.UtcNow;
                store.Save(state);
            }
            else store.FirstRun();

            var md = Path.Combine(paths.Root, "dummy-db.md");
            if (File.Exists(md)) File.Delete(md);

            ArchiveRestored(paths.BackupsDir, dir);

            var liveHash = Sha256(paths.DbPath);
            if (!string.Equals(liveHash, manifest.DbSha256, StringComparison.OrdinalIgnoreCase))
                return (false, 0, "restored db hash differs from manifest");
            var count = await DatabaseSetup.CountUsersAsync(paths.DbPath);
            if (count != manifest.UserCount)
                return (false, 0, $"restored user count {count} != manifest {manifest.UserCount}");
            return (true, count, "restored");
        }
        catch (Exception ex) { return (false, 0, ex.Message); }
    }

    /// <summary>Move a consumed backup into data\backups\archive\restored-&lt;timestamp&gt;.</summary>
    public static string ArchiveRestored(string backupsDir, string dir)
    {
        var archiveRoot = Path.Combine(backupsDir, "archive");
        Directory.CreateDirectory(archiveRoot);
        var target = Path.Combine(archiveRoot, "restored-" + DateTime.UtcNow.ToString("yyyyMMdd-HHmmss"));
        var n = 1;
        while (Directory.Exists(target)) target = Path.Combine(archiveRoot, "restored-" + DateTime.UtcNow.ToString("yyyyMMdd-HHmmss") + $"-{n++}");
        Directory.Move(dir, target);
        return target;
    }

    private static string NewBackupDir(RuntimePaths paths, string prefix)
    {
        var dir = Path.Combine(paths.BackupsDir, prefix + "-" + DateTime.UtcNow.ToString("yyyyMMdd-HHmmss"));
        var n = 1;
        while (Directory.Exists(dir)) dir = Path.Combine(paths.BackupsDir, prefix + "-" + DateTime.UtcNow.ToString("yyyyMMdd-HHmmss") + $"-{n++}");
        return dir;
    }

    private static void TrimSnapshots(RuntimePaths paths, string prefix, int keep)
    {
        if (!Directory.Exists(paths.BackupsDir)) return;
        var dirs = Directory.GetDirectories(paths.BackupsDir, prefix + "-*", SearchOption.TopDirectoryOnly)
            .OrderByDescending(Directory.GetLastWriteTimeUtc).Skip(keep);
        foreach (var d in dirs)
            try { Directory.Delete(d, true); } catch { /* never fail a snapshot over housekeeping */ }
    }

    private static async Task<string> RawCopyAfterCheckpointAsync(string source, string target)
    {
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        await using var conn = new Microsoft.Data.Sqlite.SqliteConnection($"Data Source={source}");
        await conn.OpenAsync();
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = "PRAGMA wal_checkpoint(TRUNCATE);";
            cmd.ExecuteNonQuery();
        }
        await conn.CloseAsync();
        File.Copy(source, target, true);
        return target;
    }

    private static void CopyDirectory(string source, string target)
    {
        if (!Directory.Exists(source)) return;
        foreach (var file in Directory.GetFiles(source, "*", SearchOption.AllDirectories))
        {
            var relative = Path.GetRelativePath(source, file);
            var dest = Path.Combine(target, relative);
            Directory.CreateDirectory(Path.GetDirectoryName(dest)!);
            File.Copy(file, dest, true);
        }
    }

    private static int CountFiles(string dir) =>
        Directory.Exists(dir) ? Directory.GetFiles(dir, "*", SearchOption.AllDirectories).Length : 0;

    private static string Sha256(string path)
    {
        using var stream = File.OpenRead(path);
        return Convert.ToHexString(SHA256.HashData(stream));
    }

    private static string Version() => typeof(BackupService).Assembly.GetName().Version?.ToString() ?? "1.0.0";
}
