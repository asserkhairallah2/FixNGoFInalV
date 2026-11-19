# FixNGo

FixNGo is a working roadside-assistance and car-care platform for Egypt, with an English/Arabic (RTL), light/dark responsive client. It was built from the front-end-only prototype in `legacy-prototype/` into a real system backed by a SQLite database, a REST API, background workers and fake-but-functional external providers.

The prototype is kept read-only as a visual reference. The production client lives in `client/`; no mock personas, hard-coded numbers/dates/image URLs or role switchers remain in it.

## Architecture

| Layer | Project | Responsibility |
|---|---|---|
| Domain | `src/FixNGo.Domain` | Entities, enums, value objects, domain exceptions. No external dependencies. |
| Application | `src/FixNGo.Application` | Use-case services, DTOs, validators, mapping profiles, infrastructure port interfaces. Depends only on Domain. |
| Infrastructure | `src/FixNGo.Infrastructure` | EF Core `AppDbContext`, entity configurations, migrations, SQLite persistence, fake providers, workers, file store, Serilog. |
| Web | `src/FixNGo.Web` | ASP.NET Core 8 API controllers (`/api/v1/...`), JWT auth, RBAC, SignalR hub, exception middleware, static SPA hosting. |
| CLI | `src/FixNGo.Cli` | Business logic behind the five root `.bat` tools. |

- **Backend:** C# 12 / .NET 8 LTS, EF Core 8 (Code-First, separate `IEntityTypeConfiguration<T>` classes), FluentValidation, AutoMapper, JWT access + rotating refresh tokens, role-based authorisation, SignalR real-time notifications, hosted workers.
- **Database:** SQLite. A single database file under `data/` (or `FIXNGO_DATA_DIR`). Schema is created by EF Core migrations; the first admin is created by `setup.bat`.
- **Client:** Vite 6 + React 18 + JavaScript/JSX, Tailwind CSS 3.4, `@tanstack/react-query`, `@microsoft/signalr`, `lucide-react`, `qrcode`. Built into `src/FixNGo.Web/wwwroot` and served by the API, so the app works offline apart from the local fake providers. No CDN or remote images at runtime.
- **Providers:** fake OTP/SMS/email, payments, maps/geocoding/routing and push providers write real records to the database and expose them through the Simulator Dock. Switching to real providers later is configuration-only; see `docs/PROVIDERS.md`.

## Requirements

- Windows with **.NET 8 SDK** and **PowerShell 5.1+**
- **Node.js 18+** and npm
- Playwright Chromium only if you intend to run E2E: `cd client && npm run e2e:install`

The .NET SDK on the build machine is user-local, so the wrappers call `dotnet <dll>` instead of the generated apphost executables. All business logic remains in C#, not in batch files.

## Quick start

```bat
setup.bat
start.bat
```

`setup.bat` is a console wizard that creates the first admin account (email and password are entered interactively; no secret is stored in code), then closes and launches `start.bat`. `start.bat` builds the app if `app\` is missing, runs setup automatically if there are no accounts, and starts the server at **http://localhost:5080**. Press `Ctrl+C` to stop it. Set `FIXNGO_PORT` to use a different port.

## The five tools

All five live in the project root, work by double-click or terminal, log to `logs\scripts\` (or `FIXNGO_LOG_DIR`) without passwords, and support `--non-interactive`/`--yes` for automation.

| Tool | What it does |
|---|---|
| `setup.bat` | First-time wizard: creates the first admin, then hands over to `start.bat`. |
| `start.bat` | Builds if needed, runs setup if there are no accounts, starts the API + SPA. |
| `remove-db.bat` | Backs up and resets the database to first-run state so `setup.bat` can run again. |
| `dummy-db.bat` | Verifies a backup first, then loads one month of realistic dummy data and writes `dummy-db.md` listing every generated user with role, status and password. |
| `restore-db.bat` | Restores the most recent verified backup byte-for-byte. |

## Build and verification

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\build.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\verify-all.ps1
```

`verify-all.ps1` is the single authoritative gate. It runs, in order: Release build, all .NET tests, client unit tests, client build, forbidden-literal/mock scan, script scenarios S1–S10 and the Playwright E2E suite. It writes the full transcript to `docs/evidence/test-output/verify-all.txt` and exits 0 only when every executed step passes. Use `-SkipE2E` for a faster local pass.

Individual suites:

```powershell
dotnet test FixNGo.sln -c Release
cd client; npm test; npm run test:e2e
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\scripts\run-all.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\mock-scan.ps1
```

Automated runs must isolate state with `FIXNGO_DATA_DIR`, `FIXNGO_LOG_DIR` and a private port (`FIXNGO_PORT` / `FIXNGO_E2E_PORT`); the real `data\` folder is never a test target.

## Documentation

- `docs/agent-brief/` — the original construction brief and acceptance criteria.
- `docs/API.md` — generated from the live OpenAPI document.
- `docs/PROVIDERS.md` — fake provider behaviour and configuration switches.
- `docs/SCREEN_MATRIX.md` — one row per screen with API usage, states and screenshots.
- `docs/TRACEABILITY.md` — FR/NFR ID-level mapping to code and evidence, with honest gaps.
- `docs/TEST_REPORT.md`, `docs/E2E_REPORT.md`, `docs/SCRIPT_TESTS.md` — test results.
- `docs/DEVIATIONS.md`, `docs/KNOWN_ISSUES.md` — honest differences and remaining issues.
- `docs/PROGRESS.md`, `docs/AGENT_LOG.md` — build chronology and resume point.
- `docs/FINAL_REPORT.md` — hand-off report, including verification limits.
- `AGENT.md`, `STATE.md` — conventions and current status.
- `reference/` — SRS and system design; `legacy-prototype/` — read-only visual reference.

The reference SRS is the requirements source of truth; `docs/DEVIATIONS.md` records the deliberate, reviewed differences from it.
