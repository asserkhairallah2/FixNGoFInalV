namespace FixNGo.Infrastructure;

/// <summary>Resolves runtime data/log/root paths from environment variables with project-root defaults.</summary>
public sealed class RuntimePaths
{
    public RuntimePaths()
    {
        Root = FindRoot();
        DataDir = Resolve("FIXNGO_DATA_DIR", Path.Combine(Root, "data"));
        LogDir = Resolve("FIXNGO_LOG_DIR", Path.Combine(Root, "logs"));
        DbPath = Path.Combine(DataDir, "fixngo.db");
        UploadsDir = Path.Combine(DataDir, "uploads");
        BackupsDir = Path.Combine(DataDir, "backups");
        SecretsPath = Path.Combine(DataDir, "secrets.json");
        StatePath = Path.Combine(DataDir, "state.json");
        PortPath = Path.Combine(DataDir, "server.port");
        PidPath = Path.Combine(DataDir, "server.pid");
        AppDir = Path.Combine(Root, "app");
    }

    public string Root { get; }
    public string DataDir { get; }
    public string LogDir { get; }
    public string DbPath { get; }
    public string UploadsDir { get; }
    public string BackupsDir { get; }
    public string SecretsPath { get; }
    public string StatePath { get; }
    public string PortPath { get; }
    public string PidPath { get; }
    public string AppDir { get; }

    public void EnsureDirectories()
    {
        Directory.CreateDirectory(DataDir);
        Directory.CreateDirectory(LogDir);
        Directory.CreateDirectory(UploadsDir);
        Directory.CreateDirectory(BackupsDir);
    }

    private static string Resolve(string env, string fallback)
    {
        var value = Environment.GetEnvironmentVariable(env);
        return string.IsNullOrWhiteSpace(value) ? fallback : Path.GetFullPath(value);
    }

    private static string FindRoot()
    {
        // When published to app/, the project root is the parent. Otherwise walk up for FixNGo.sln.
        var dir = AppContext.BaseDirectory;
        while (!string.IsNullOrEmpty(dir))
        {
            if (File.Exists(Path.Combine(dir, "FixNGo.sln"))) return dir;
            var parent = Directory.GetParent(dir);
            if (parent is null) break;
            dir = parent.FullName;
        }
        return Environment.CurrentDirectory;
    }
}
