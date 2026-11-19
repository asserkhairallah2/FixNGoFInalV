# Agent log (append only)

| Time | Phase | Action | Command / file | Result | Notes |
|---|---|---|---|---|---|
| 2026-11-19 09:00 | 0 | Read all brief files, AGENT.md, SRS, SDD | docs/agent-brief/* reference/* | PASS | 11 brief files read in order before code |
| 2026-11-19 09:10 | 0 | Verify toolchain | dotnet --version; node -v; npm -v; git --version | PASS | dotnet 8.0.428, node 26.13.1, npm 11.20.0, git 2.47.1; python not on PATH (use .NET/Node) |
| 2026-11-19 09:15 | 0 | Init git + baseline commit | git init -b main; git add -A; git commit | PASS | e90d3a4; .gitignore excludes data/logs/app/node_modules/wwwroot |
| 2026-11-19 09:25 | 0 | Run legacy prototype + skim 12 screens | legacy-prototype/run_localhost.bat; browser snapshots | PASS | HTTP 200 for HTML + JS; 12 screen headings; 0 console errors. Evidence: docs/evidence/phase0/legacy-prototype-check.md |
| 2026-11-19 09:30 | 0 | Create tracking templates + plan | docs/PROGRESS.md, SCREEN_MATRIX.md, DEVIATIONS.md, KNOWN_ISSUES.md, TEST_REPORT.md | PASS | Gate 0 prepared |
| 2026-11-19 10:00 | 1 | Scaffold solution (5 src + 3 test projects) | dotnet new sln + projects; Directory.Build.props | PASS | 8 projects restored; NU1903 suppressed for mandated AutoMapper 12.0.1 (DEVIATIONS #11) |
| 2026-11-19 10:30 | 1 | Domain layer: enums, entities, state machines, pricing/geo/matching/rules | src/FixNGo.Domain/*.cs | PASS | dotnet build 0 warnings/errors; fixed `**`→Math.Pow, init-only Score, Contains(char,int) |
| 2026-11-19 11:00 | 1 | Application layer: IAppDbContext, ports, auth DTOs/validators/AuthService | src/FixNGo.Application/ | PASS | dotnet build 0 warnings/errors |
| 2026-11-19 11:30 | 1 | Infrastructure: AppDbContext + per-entity configs, services, seeder, DB setup | src/FixNGo.Infrastructure/ | PASS | dotnet build 0 warnings/errors; enums→string, UTC converters, PRAGMAs |
| 2026-11-19 12:00 | 1 | Web: Program.cs, JWT/RBAC, ProblemDetails middleware, SignalR hub, AuthController | src/FixNGo.Web/ | PASS | dotnet build 0 warnings/errors |
| 2026-11-19 18:20 | 1 | Fix auth: JWT inbound claim mapping, DI AuthOptions, domain-code HTTP mapping | src/FixNGo.Web/Program.cs, Middleware/ExceptionMiddleware.cs, Infrastructure/Services/InfrastructureServices.cs | PASS | 0 warnings; real POST login 200 role=Admin, /auth/me populated, wrong password 401 |
| 2026-11-19 18:11 | 1 | Add real auth unit tests (9) - fixed real JWT sub/email mapping bug | tests/FixNGo.Application.Tests/AuthServiceTests.cs | PASS | 9/9; dotnet test Application.Tests -c Release |
| 2026-11-19 18:14 | 1 | Add API integration tests (7) via WebApplicationFactory + temp SQLite | tests/FixNGo.Api.Tests/AuthApiTests.cs | PASS | 7/7; health/status/login/me/401/validation |
| 2026-11-19 18:15 | 1 | Create mock-scan.ps1 (PS5.1-compatible); zero forbidden literals | tools/mock-scan.ps1 | PASS | 49 files scanned, 33 literals, 0 hits; docs/evidence/test-output/mock-scan.txt |
| 2026-11-19 18:20 | 1 | Fix CLI env-driven setup; Cmd parse errors in setup.bat (`(code X).`, `(non-interactive).`) | src/FixNGo.Cli/Program.cs, setup.bat | PASS | first-run start.bat now creates admin and serves /health |
| 2026-11-19 18:22 | 1 | Script tests S1-S3 (11 assertions) against temp dirs/ports | tools/script-tests.ps1 | PASS | 11/11; transcripts in docs/evidence/scripts/S1-S3 |
| 2026-11-19 18:30 | 1 | Browser login E2E: login page renders 0 console errors, POST /auth/login 200, authenticated shell shown | client/ via browser | PASS | screenshots docs/evidence/screens/login-screen.jpeg + login-success-shell.jpeg |
| 2026-11-19 18:31 | 1 | Full solution test run; Release build 0 warnings/errors | dotnet test FixNGo.sln -c Release --nologo | PASS | 17/17 (1 domain+9 app+7 api); docs/evidence/test-output/dotnet-test-gate1.txt |
| 2026-11-19 18:32 | 1 | Gate 1 PASS - backend foundation + CLI + tools + client shell + auth verified | - | PASS | backend/CLI/tools/client committed; next Phase 2 domain modules |
| 2026-11-19 19:05 | 2 | Write Phase 2 application services (13), DTOs, controllers (12), workers (4), file store, notifier | src/FixNGo.Application/Services/*, src/FixNGo.Web/Controllers/*, PlatformWorkers.cs | PASS | all modules wired to DI in Program.cs |
| 2026-11-19 19:20 | 2 | Fix Phase 2 compile errors (notifier signature 4→6 args, CenterService entity collision, EF Relational pkg, tuple order, nullability, unused params) | src/**; added Microsoft.EntityFrameworkCore.Relational 8.0.11 | PASS | Release build 0 Warning(s) 0 Error(s) |
