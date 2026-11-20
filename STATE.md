# FixNGo — Project State (`STATE.md`)

> **Purpose:** live, honest snapshot of where the project stands. Stable architecture/conventions live in `AGENT.md`; the full hand-off report is `docs/FINAL_REPORT.md`.
>
> **Last updated:** 2026-11-20 · **Overall status:** Complete — All Phase 0–7 + Round 2–5 QA findings resolved; all 8 automated verification gates green, screenshots visually inspected, live browser walkthrough verified, and final commit clean.

---

## 1. Current milestone and health

* **Phase:** 0–7 + Rounds 2, 3, 4 & 5 complete with gate evidence; hostile self-review, multimodal visual screenshot inspection (`docs/evidence/visual-review.md`), live interactive browser verification, final report, and clean-clone gate done.
* **Build:** `dotnet build FixNGo.sln -c Release` → 0 warnings, 0 errors; client production build → 0 errors; fresh `git clone` build + `setup.bat` + `start.bat` (`tools/clone-gate.ps1`) → PASS.
* **Authoritative gate:** `tools/verify-all.ps1` — **8/8 steps PASS (`OVERALL: PASS`)** on 2026-11-20. Transcript: `docs/evidence/test-output/verify-all.txt`.
* **Tests:**
  * **.NET:** `64/64` (`9` Domain + `23` Application + `32` API & MVC integration, including `ValueObjectsAndSpecsTests`, `CleanArchitectureApplicationTests`, `MvcAndCleanArchitectureTests`, and `FileSecurityTests`).
  * **Client unit (Vitest):** `9/9`.
  * **Strict mock/prefill scan (`tools/mock-scan.ps1`):** `0` hits across `268` files (44 forbidden literals + form-prefill `useState` checks + fallback-sentence regexes + pre-ticked confirmation checks).
  * **Script scenarios (`tests/scripts/run-all.ps1`):** `10/10` (`S1`–`S10`, `155/155` assertions).
  * **Playwright E2E:** `41/41` (`5` role logins + `15` UI/API business flows `F01`–`F15` + `20` four-variant screen sweeps + `1` registry check).
  * **Fresh-clone gate (`tools/clone-gate.ps1`):** `PASS` (`git clone` to temp folder → `setup.bat` → `start.bat` → HTTP 200 ASP.NET Core 8 MVC Razor host + JS bundle).
* **Git:** branch `main`; `client/src/app/` tracked (`.gitignore` anchored to `/app/`); post-commit working tree clean; `data/` untouched.

---

## 2. What was delivered

* **Backend (Primary Foundation — .NET 8 C# Clean Architecture & ASP.NET Core 8 MVC):**
  * **4-Layer Clean Architecture:**
    1. `FixNGo.Domain` (pure C# 12 core, zero external dependencies): 60 dedicated single-entity C# files (`Entities/`), Value Objects (`EgyptianPhoneNumber`, `VehiclePlate`, `GeoCoordinate` with Haversine formula), Domain Events (`IDomainEvent`), and Specification Pattern (`ISpecification<T>`).
    2. `FixNGo.Application` (use cases & ports): 17 Application Service interfaces + implementations, persistence & cross-cutting ports (`IRepository<T>`, `IUnitOfWork`, `ICacheService`, `IIdempotencyStore`, `IOutboxPublisher`, `IRoutingService`, `IGeocoderService`), real AutoMapper `FixNGoMappingProfile`, and FluentValidation validators across all modules.
    3. `FixNGo.Infrastructure` (EF Core 8 + adapters): 60 dedicated 1-file-per-entity `IEntityTypeConfiguration<T>` classes (`Configurations/`), `EfRepository<T>` & `UnitOfWork`, dual **SQLite** (default) & **SQL Server** (`Database:Provider = "SqlServer"`) support, `MemoryCacheService`, `IdempotencyStore`, `InMemoryOutboxPublisher`, `HaversineRoutingService`, `CairoGeocoderService`, hosted background workers, and switchable OTP/Payments/Maps/Push providers.
    4. `FixNGo.Web` (ASP.NET Core 8 MVC + REST API + SignalR — **zero `.html` files**): MVC Controllers (`HomeController`, `ServiceCentersMvcController`, `ArchitectureMvcController`), strongly-typed `ViewModels`, AutoMapper `WebViewModelMappingProfile`, compiled Razor `.cshtml` Views (`_Layout.cshtml`, `Home/Index.cshtml`, `ServiceCentersMvc/Index.cshtml`, `ServiceCentersMvc/Details.cshtml`, `ArchitectureMvc/Index.cshtml`), custom C# `TagHelpers` (`ClientProtectionTagHelper`, `StatusBadgeTagHelper`), `SystemRibbonViewComponent`, `SecurityHeadersMiddleware`, `IdempotencyMiddleware`, `FluentValidationActionFilter`, interface-only API Controllers under `/api/v1/`, JWT + RBAC policies, SignalR `/hubs/app`, and scoped DataProtection file tokens (`?ft=`).
* **Interactive Mobile UI Assets:** `client/` — Vite 6 compiles `/assets/fixngo-app.js` and `/assets/fixngo-app.css` (without any `index.html`) hydrated inside the server-rendered ASP.NET Core 8 MVC Razor view (`Views/Home/Index.cshtml`), preserving the iPhone 17 Pro Max shell, custom touch-dot cursor, drag-to-scroll, F12/selection guard, unified `<` back button, fixed `/` browser URL, and all 143 screens in EN/AR & light/dark.
* **Providers + Simulator Dock:** fake-but-functional OTP/SMS/email, payments, maps/geocoding/routing, and push providers writing real DB rows; Configuration-switchable with fail-fast on `Real` without keys (`docs/PROVIDERS.md`).
* **Five root tools:** `setup.bat`, `start.bat`, `remove-db.bat`, `dummy-db.bat`, `restore-db.bat` — all business logic in `FixNGo.Cli`, wrappers invoke `tools\build.ps1 -IfNeeded` and `dotnet app\FixNGo.Cli.dll`.

---

## 3. Key decisions / deviations

Recorded in `docs/DEVIATIONS.md` (rows 1–14). Most significant: ASP.NET Core 8 MVC Razor Views + strongly-typed ViewModels + TagHelpers hosting both server-rendered MVC views (`/`, `/mvc/centers`, `/mvc/architecture`) and the interactive iPhone workspace with zero static `.html` files (#7); dual SQLite (default for portable `.bat` file-swapping) + SQL Server (`Database:Provider = "SqlServer"`) support (#8); multimodal visual inspection (#10); NU1903 suppressed for mandated AutoMapper 12.0.1 (#11); `dotnet <dll>` wrappers with `-IfNeeded` rebuild (#12); provider fail-fast implementation (#13); JWT session issued upon signup OTP verification (#14).

---

## 4. Known issues and unverified items

All historical P0/P1 issues and all Round 2, Round 3, and Round 4 (`docs/REVIEW_FINDINGS_ROUND4.md` `A.1`–`A.5`, `B.6`–`B.12`, `C`, `D`) findings are fixed at the root cause and covered by automated gates. Unverified by design: real external provider adapters require live third-party credentials (`Providers:* = Real` fails fast intentionally); no SQL Server deployment or formal load-benchmark run.

---

## 5. How to run / verify

```bat
setup.bat
start.bat
```

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\verify-all.ps1
```

Server: `http://localhost:5080` (`FIXNGO_PORT` overrides). Automated runs isolate state via `FIXNGO_DATA_DIR`, `FIXNGO_LOG_DIR`, and a private port; the real `data\` folder is never a test target.
