using System.Text.Json;
using System.Text.Json.Serialization;

namespace FixNGo.Cli;

/// <summary>Reads/writes data/state.json (written by the CLI only).</summary>
public sealed class StateStore(Infrastructure.RuntimePaths paths)
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public StateData? Load()
    {
        if (!File.Exists(paths.StatePath)) return null;
        try { return JsonSerializer.Deserialize<StateData>(File.ReadAllText(paths.StatePath), JsonOpts); }
        catch { return null; }
    }

    public void Save(StateData state)
    {
        paths.EnsureDirectories();
        File.WriteAllText(paths.StatePath, JsonSerializer.Serialize(state, JsonOpts));
    }

    public void FirstRun()
    {
        if (File.Exists(paths.StatePath)) File.Delete(paths.StatePath);
    }
}

public sealed class StateData
{
    public int SchemaVersion { get; set; } = 1;
    public string Mode { get; set; } = "real";
    public DateTime? SetupCompletedAt { get; set; }
    public string? PlatformEmail { get; set; }
    public string? AmbulanceNumber { get; set; }
    public string? PoliceNumber { get; set; }
    public bool SimulatorsEnabled { get; set; } = true;
    public DummyState? Dummy { get; set; }
}

public sealed class DummyState
{
    public DateTime Since { get; set; }
    public string? BackupDir { get; set; }
    public int GeneratedUsers { get; set; }
    public int Seed { get; set; }
}
