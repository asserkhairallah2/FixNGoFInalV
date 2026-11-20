# Round 5 — work split (coordinator: main agent)

Source of truth for WHAT to fix: `docs/REVIEW_FINDINGS_ROUND4.md` (+ earlier rounds for context).
Product rules (from `docs/agent-brief/`): no mock/fake data anywhere in the product; product forms start empty (or with the user's own saved data / real GPS); confirmation checkboxes start unticked; EN/AR + light/dark must look right; never break the visual design (legacy-prototype + reference/design-images are the reference).

## Ownership (do NOT edit files owned by another track)
| Track | Branch | Owns (client) | Owns (backend) |
|---|---|---|---|
| core (main agent) | main | `client/src/App.jsx`, `client/src/api/*`, `client/src/app/*`, `client/src/ui/*`, `client/src/i18n/*`, `client/e2e/*`, `client/src/tests/*` | `src/FixNGo.Web/Program.cs`, `src/FixNGo.Web/Controllers/SupportController.cs` (FileController part), `LocalFileStore.cs`, all entities + migrations, `tools/*`, `tests/*` |
| owner | r5-owner | `client/src/modules/owner/*` | `CenterService.cs` (availability/closed days only), `PaymentService.cs` (paid-state queries only) |
| providers | r5-providers | `client/src/modules/auth/*`, `mechanic/*`, `captain/*`, `center/*` | `ProviderService.cs` |
| admin | r5-admin | `client/src/modules/admin/*`, `client/src/modules/shared/*`, `client/src/sim/*` | `SupportService.cs`, `AdminService.cs`, `SimulatorService.cs`, `SimController.cs` |

If you need a change in a file you don't own (e.g. a shared UI kit component, a DTO field, an entity/migration, a hook in `api/hooks.js`), do NOT edit it: implement locally inside your own files if possible, otherwise describe the exact change in your final report and the coordinator will apply it. No EF schema changes / migrations in tracks.

## Core changes already decided (coordinator does these on main)
- SignalR: client will listen to the server's real event names (`notification`, `push`) and invalidate React Query caches globally; active request queries also poll every 5 s. Track screens just need to read data from the standard hooks (`useRequest`, `useInvoiceForRequest`, `useBookings` …) — do not add ad-hoc polling.
- Files: `fileUrl(id)` keeps its signature; it will use a short-lived file-scoped token instead of the JWT, and the server will enforce ownership.
- mock-scan will flag: literal `useState('…')`/`useState(<number>)` defaults in form components (allow-list: tab/filter/period/mode UI state), `|| t('sentence')` used as submitted data, pre-ticked confirmations (`useState(true)` on names like confirm/understood/agree/acknowledge).

## Verification per track (mandatory)
1. `cd client && npm install` (once), then `npx vite build --outDir <TEMP>\fx_<track>_build --emptyOutDir` must succeed.
2. If you changed backend: `dotnet build FixNGo.sln -c Release` and `dotnet test FixNGo.sln -c Release` in YOUR working copy must pass.
3. Run your copy for real: `tools\build.ps1`, then run the server from `app\web` (cwd = `app\web`) with `FIXNGO_DATA_DIR`/`FIXNGO_LOG_DIR` pointing to a temp folder and `ASPNETCORE_URLS=http://localhost:<your port>` (owner 5101, providers 5102, admin 5103); create an admin with `dotnet app\FixNGo.Cli.dll setup --non-interactive` + `FIXNGO_SETUP_*` env vars. Drive the affected screens in a browser (browser subagent), take screenshots EN-light and AR-dark, LOOK at them.
4. Commit on your branch with clear messages. Final report: items fixed (with screenshot paths), items not fixed and why, any change you need from core.
