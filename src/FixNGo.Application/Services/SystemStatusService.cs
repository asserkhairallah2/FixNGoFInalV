using FixNGo.Application.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Application.Services;

/// <summary>Application use-case reporting platform setup state, data mode, and active provider metadata.</summary>
public sealed class SystemStatusService(IAppDbContext db) : ISystemStatusService
{
    public async Task<SystemStatusDto> GetStatusAsync(bool simulatorsEnabled, CancellationToken ct = default)
    {
        var totalUsers = await db.Users.CountAsync(ct);
        var isDummy = await db.Users.AnyAsync(u => u.Email.EndsWith("@dummy.fixngo.test"), ct);
        var mode = isDummy ? "dummy" : "real";
        return new SystemStatusDto(
            SetupComplete: totalUsers > 0,
            Mode: mode,
            Version: "1.0.0",
            SimulatorsEnabled: simulatorsEnabled,
            TotalUsers: totalUsers,
            DatabaseProvider: "Relational-EFCore8");
    }
}
