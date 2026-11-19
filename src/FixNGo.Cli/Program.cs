using FixNGo.Domain;
using FixNGo.Domain.Entities;
using FixNGo.Infrastructure;
using FixNGo.Infrastructure.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace FixNGo.Cli;

/// <summary>Console tool invoked by the five .bat scripts and by script tests.</summary>
public static class Program
{
    private static readonly RuntimePaths Paths = new();

    public static async Task<int> Main(string[] args)
    {
        try
        {
            if (args.Length == 0) { PrintUsage(); return 2; }
            return args[0].ToLowerInvariant() switch
            {
                "check-setup" => CheckSetup(args),
                "setup" => await SetupAsync(args),
                "selftest" => SelfTest(),
                "db-status" => DbStatus(args),
                "db-reset" => await DbResetAsync(args),
                "stop-server" => StopServer(),
                _ => Unknown(args[0])
            };
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[ERR] {ex.Message}");
            return 3;
        }
    }

    private static int CheckSetup(string[] args)
    {
        var hasDb = File.Exists(Paths.DbPath);
        var count = hasDb ? CountUsers() : 0;
        var stateFile = new StateStore(Paths);
        var state = stateFile.Load();
        var setup = count > 0 || state?.SetupCompletedAt is not null;
        var json = args.Contains("--json", StringComparer.OrdinalIgnoreCase);

        if (json)
        {
            Console.WriteLine(JsonSerializer.Serialize(new
            {
                setupComplete = setup,
                firstRun = !setup,
                userCount = count,
                dbPath = Paths.DbPath,
                dbExists = hasDb,
                mode = state?.Mode ?? "real"
            }));
        }
        else
        {
            Console.WriteLine(setup ? $"[OK] System is set up ({count} accounts)." : "[INFO] First run — no accounts found.");
        }
        return setup ? 0 : 10;
    }

    private static async Task<int> SetupAsync(string[] args)
    {
        // Env-driven setup (FIXNGO_SETUP_*) is implicitly non-interactive so start.bat can call setup.bat
        // in automated first-run scenarios without forwarding the flag.
        var nonInteractive = args.Contains("--non-interactive", StringComparer.OrdinalIgnoreCase)
            || Env("FIXNGO_SETUP_EMAIL") is not null;
        if (CountUsers() > 0)
        {
            Console.WriteLine("[WARN] System already has accounts. Use remove-db.bat to reset.");
            return 2;
        }

        Console.WriteLine("=== FixNGo first-time setup ===");
        Console.WriteLine("Create the first Super Administrator.");

        string name, email, phone, password;
        if (nonInteractive)
        {
            name = Env("FIXNGO_SETUP_NAME") ?? throw new InvalidOperationException("FIXNGO_SETUP_NAME is required.");
            email = Env("FIXNGO_SETUP_EMAIL") ?? throw new InvalidOperationException("FIXNGO_SETUP_EMAIL is required.");
            phone = Env("FIXNGO_SETUP_PHONE") ?? throw new InvalidOperationException("FIXNGO_SETUP_PHONE is required.");
            password = Env("FIXNGO_SETUP_PASSWORD") ?? throw new InvalidOperationException("FIXNGO_SETUP_PASSWORD is required.");
            var bad = Validate(name, email, phone, password);
            if (bad is not null) throw new InvalidOperationException(bad);
        }
        else
        {
            name = Prompt("Full name", v => v.Length >= 2 ? null : "Name must be at least 2 characters.");
            email = Prompt("Email", v => Rules.ValidEmail(v) ? null : "Enter a valid email.");
            phone = Prompt("Phone (Egyptian mobile)", v => Rules.EgyptianMobile(v) ? null : "Enter a valid Egyptian mobile.");
            password = PromptSecret("Password", v => Rules.PasswordPolicy(v) ? null
                : "Password needs 8+ chars with upper, lower, digit and symbol.");
            var confirm = PromptSecret("Confirm password", _ => null);
            if (password != confirm) { Console.WriteLine("[ERR] Passwords do not match."); return 2; }
        }

        var supportEmail = nonInteractive ? Env("FIXNGO_SETUP_SUPPORT_EMAIL") ?? "support@fixngo.local"
            : PromptDefault("Platform support email", "support@fixngo.local", _ => null);
        var ambulance = nonInteractive ? Env("FIXNGO_SETUP_AMBULANCE") ?? "123"
            : PromptDefault("Ambulance number", "123", _ => null);
        var police = nonInteractive ? Env("FIXNGO_SETUP_POLICE") ?? "122"
            : PromptDefault("Police number", "122", _ => null);
        var simulators = (nonInteractive ? Env("FIXNGO_SETUP_SIMULATORS") ?? "Y"
            : PromptDefault("Enable simulators [Y/n]", "Y", _ => null)).Trim().ToUpperInvariant() != "N";

        Console.WriteLine("\n--- Review ---");
        Console.WriteLine($"Name: {name}");
        Console.WriteLine($"Email: {email}");
        Console.WriteLine($"Phone: {Rules.NormalisePhone(phone)}");
        Console.WriteLine("Password: ********");
        Console.WriteLine($"Simulators: {(simulators ? "on" : "off")}");
        if (!nonInteractive)
        {
            var ok = PromptDefault("Create this administrator? [Y/n]", "Y", _ => null).Trim().ToUpperInvariant();
            if (ok == "N") { Console.WriteLine("[INFO] Aborted. Nothing was written."); return 1; }
        }

        await DatabaseSetup.EnsureAsync(Paths);
        DatabaseSetup.LoadOrCreateSigningKey(Paths);

        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(DependencyInjection.ConnectionString(Paths)).Options;
        await using var db = new AppDbContext(options);
        var hasher = new PasswordHasherService();
        var admin = new User
        {
            FullName = name.Trim(),
            Email = email.Trim().ToLowerInvariant(),
            Phone = Rules.NormalisePhone(phone),
            PasswordHash = hasher.Hash(password),
            Role = Role.Admin,
            Status = UserStatus.Active,
            EmailVerified = true,
            PhoneVerified = true,
            IsSuperAdmin = true,
            Language = "en",
            Theme = "light"
        };
        db.Users.Add(admin);
        var settings = await CurrentSettings();
        if (settings is not null)
        {
            var json = JsonSerializer.Deserialize<Dictionary<string, object>>(settings.SettingsJson) ?? [];
            json["ambulanceNumber"] = ambulance;
            json["policeNumber"] = police;
            settings.SettingsJson = JsonSerializer.Serialize(json);
            db.Entry(settings).State = EntityState.Modified;
        }
        db.NotificationPreferences.Add(new NotificationPreference { UserId = admin.Id });
        db.Wallets.Add(new Wallet { UserId = admin.Id });
        await db.SaveChangesAsync();

        var state = new StateData
        {
            SetupCompletedAt = DateTime.UtcNow,
            Mode = "real",
            PlatformEmail = supportEmail,
            AmbulanceNumber = ambulance,
            PoliceNumber = police,
            SimulatorsEnabled = simulators
        };
        new StateStore(Paths).Save(state);

        var verify = await db.Users.CountAsync(u => u.Email == admin.Email && u.Role == Role.Admin);
        if (verify == 0) throw new InvalidOperationException("Could not verify the administrator account.");
        Console.WriteLine($"[OK] Administrator created: {admin.Email}");
        return 0;
    }

    private static async Task<PlatformSettingsVersion?> CurrentSettings()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(DependencyInjection.ConnectionString(Paths)).Options;
        await using var db = new AppDbContext(options);
        return await db.PlatformSettingsVersions.FirstOrDefaultAsync(s => s.IsCurrent);
    }

    private static int SelfTest()
    {
        Console.WriteLine("FixNGo self-test");
        Console.WriteLine($"  dotnet:    {Environment.Version}");
        Console.WriteLine($"  OS:        {System.Runtime.InteropServices.RuntimeInformation.OSDescription}");
        Console.WriteLine($"  root:      {Paths.Root}");
        Console.WriteLine($"  data dir:  {Paths.DataDir}");
        Console.WriteLine($"  db path:   {Paths.DbPath}");
        var ok = File.Exists(Paths.DbPath) && DatabaseSetup.IntegrityOkAsync(Paths.DbPath).GetAwaiter().GetResult();
        Console.WriteLine(ok ? "[OK] Database connectivity and integrity: PASS" : "[WARN] No valid database (first run is expected before setup).");
        Console.WriteLine("[OK] self-test complete");
        return 0;
    }

    private static int DbStatus(string[] args)
    {
        var state = new StateStore(Paths).Load();
        var json = args.Contains("--json", StringComparer.OrdinalIgnoreCase);
        var data = new
        {
            mode = state?.Mode ?? "real",
            dbPath = Paths.DbPath,
            dbExists = File.Exists(Paths.DbPath),
            dbBytes = File.Exists(Paths.DbPath) ? new FileInfo(Paths.DbPath).Length : 0,
            userCount = CountUsers(),
            backups = Directory.Exists(Paths.BackupsDir) ? Directory.GetDirectories(Paths.BackupsDir).Length : 0
        };
        if (json) Console.WriteLine(JsonSerializer.Serialize(data));
        else Console.WriteLine($"mode={data.mode} users={data.userCount} db={data.dbPath}");
        return 0;
    }

    private static async Task<int> DbResetAsync(string[] args)
    {
        if (!args.Contains("--yes", StringComparer.OrdinalIgnoreCase))
        {
            Console.WriteLine("[WARN] db-reset requires --yes (remove-db.bat handles confirmation).");
            return 2;
        }
        SqliteConnection.ClearAllPools();
        new StateStore(Paths).FirstRun();
        foreach (var f in new[] { Paths.DbPath, Paths.DbPath + "-wal", Paths.DbPath + "-shm", Paths.SecretsPath, Paths.PidPath, Paths.PortPath })
            if (File.Exists(f)) File.Delete(f);
        if (Directory.Exists(Paths.UploadsDir)) Directory.Delete(Paths.UploadsDir, true);
        await Task.CompletedTask;
        Console.WriteLine("[OK] System reset to first run.");
        return 0;
    }

    private static int StopServer()
    {
        if (!File.Exists(Paths.PidPath)) { Console.WriteLine("[INFO] No server.pid found."); return 0; }
        var pid = File.ReadAllText(Paths.PidPath).Trim();
        if (int.TryParse(pid, out var p))
        {
            try
            {
                var proc = System.Diagnostics.Process.GetProcessById(p);
                proc.Kill(true);
                Console.WriteLine($"[OK] Stopped server PID {p}.");
            }
            catch { Console.WriteLine($"[INFO] PID {p} not running."); }
        }
        if (File.Exists(Paths.PidPath)) File.Delete(Paths.PidPath);
        return 0;
    }

    private static int CountUsers()
    {
        if (!File.Exists(Paths.DbPath)) return 0;
        try { return DatabaseSetup.CountUsersAsync(Paths.DbPath).GetAwaiter().GetResult(); }
        catch { return 0; }
    }

    private static string? Validate(string name, string email, string phone, string password)
    {
        if (name.Trim().Length < 2) return "Name must be at least 2 characters.";
        if (!Rules.ValidEmail(email)) return "Invalid email.";
        if (!Rules.EgyptianMobile(phone)) return "Invalid Egyptian mobile.";
        if (!Rules.PasswordPolicy(password)) return "Password policy not met.";
        return null;
    }

    private static string? Env(string key) => Environment.GetEnvironmentVariable(key);

    private static string Prompt(string label, Func<string, string?> validate)
    {
        while (true)
        {
            Console.Write($"{label}: ");
            var value = Console.ReadLine() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(value)) { Console.WriteLine("[INFO] Cancelled."); Environment.Exit(1); }
            var err = validate(value);
            if (err is null) return value;
            Console.WriteLine($"[ERR] {err}");
        }
    }

    private static string PromptDefault(string label, string def, Func<string, string?> validate)
    {
        Console.Write($"{label} [{def}]: ");
        var value = Console.ReadLine();
        if (string.IsNullOrWhiteSpace(value)) return def;
        var err = validate(value);
        return err is null ? value : def;
    }

    private static string PromptSecret(string label, Func<string, string?> validate)
    {
        while (true)
        {
            Console.Write($"{label}: ");
            var sb = new System.Text.StringBuilder();
            if (Console.IsInputRedirected)
            {
                var line = Console.ReadLine() ?? string.Empty;
                Console.WriteLine("********");
                var err0 = validate(line);
                if (err0 is null) return line;
                Console.WriteLine($"[ERR] {err0}");
                continue;
            }
            while (true)
            {
                var key = Console.ReadKey(true);
                if (key.Key == ConsoleKey.Enter) break;
                if (key.Key == ConsoleKey.Backspace && sb.Length > 0) { sb.Length--; Console.Write("\b \b"); continue; }
                if (key.Key is ConsoleKey.Escape) { Console.WriteLine(); Console.WriteLine("[INFO] Cancelled."); Environment.Exit(1); }
                if (!char.IsControl(key.KeyChar)) { sb.Append(key.KeyChar); Console.Write('*'); }
            }
            Console.WriteLine();
            var pass = sb.ToString();
            var err = validate(pass);
            if (err is null) return pass;
            Console.WriteLine($"[ERR] {err}");
        }
    }

    private static int Unknown(string cmd)
    {
        Console.Error.WriteLine($"[ERR] Unknown command: {cmd}");
        PrintUsage();
        return 2;
    }

    private static void PrintUsage()
    {
        Console.WriteLine("Usage: FixNGo.Cli <command> [options]");
        Console.WriteLine("  check-setup [--json]     exit 0 = set up, 10 = first run");
        Console.WriteLine("  setup [--non-interactive]");
        Console.WriteLine("  selftest");
        Console.WriteLine("  db-status [--json]");
        Console.WriteLine("  db-reset --yes");
        Console.WriteLine("  stop-server");
    }
}
