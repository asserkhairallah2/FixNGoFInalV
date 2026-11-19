# FixNGo — Project State (`STATE.md`)

> **Purpose:** live, honest snapshot of where the project stands. This file was rewritten in Phase 7 in English to reflect the system that was actually delivered. The previous Arabic Phase-1 content was stale and is intentionally replaced. Stable architecture/conventions live in `AGENT.md`; the full hand-off report is `docs/FINAL_REPORT.md`.
>
> **Last updated:** 2026-11-19 · **Overall status:** Complete — Phase 7 hand-off done; all gates green and final commit created.

---

## 1. Current milestone and health

* **Phase:** 0-7 complete with gate evidence; hostile self-review, final report and final commit done.
* **Build:** `dotnet build FixNGo.sln -c Release` → 0 warnings, 0 errors; client production build → 0 errors.
* **Authoritative gate:** `tools/verify-all.ps1` - 7/7 steps PASS (`OVERALL: PASS`) at 2026-11-19 21:11:13 on the final post-fix source (includes the `ExceptionMiddleware` cancellation fix, client P0/P2 fixes, provider fail-fast and E2E harness corrections). Transcript: `docs/evidence/test-output/verify-all.txt`.
* **Tests:** .NET (Domain + Application + API), client Vitest, script scenarios S1–S10, mock-scan, and Playwright E2E (35 tests, 4 screen-sweep variants). Exact final counts are in `docs/TEST_REPORT.md` and `docs/E2E_REPORT.md`.
* **Git:** branch `main`; phase commits `e90d3a4` → `a882b9a` plus the final Phase 7 commit (see `git log`); post-commit tree clean.

---

## 2. What was delivered

* **Backend:** ASP.NET Core 8, Clean Architecture (`Domain`, `Application`, `Infrastructure`, `Web`, `Cli`), EF Core 8 + SQLite, migrations, JWT + refresh tokens, RBAC policies, SignalR hub, hosted workers, FluentValidation, AutoMapper, Serilog. Full REST API under `/api/v1/` (generated reference in `docs/API.md`).
* **Client:** `client/` — Vite 6 + React 18 + JSX + Tailwind. 143 registered screens (138 prototype + added gap screens) wired to the real API, EN/AR RTL, light/dark. No mocks, dev sidebar, role switchers, hard-coded personas/numbers/dates or remote image URLs (`tools/mock-scan.ps1` = 0 hits).
* **Providers + Simulator Dock:** fake-but-functional OTP/SMS/email, payments, maps/geocoding/routing and push providers writing real SQLite rows; five-panel dock (Notifications/Payments/SMS/OTP/GPS). Configuration-switchable with fail-fast on `Real` without keys (`docs/PROVIDERS.md`, DEVIATIONS #13).
* **Five root tools:** `setup.bat`, `start.bat`, `remove-db.bat`, `dummy-db.bat`, `restore-db.bat` — all logic in the C# CLI, wrappers call `dotnet <dll>`.
* **Evidence:** unit/API/authz-matrix/offer-race/privacy tests, S1–S10 transcripts, client tests, Playwright flow + 572 screenshots (143 × 4 variants), reports under `docs/`.

---

## 3. Key decisions / deviations

Recorded in `docs/DEVIATIONS.md` (rows 1–13). Most significant: REST + React SPA instead of Razor/MVC (#7); SQLite instead of SQL Server (#8); visual image inspection impossible for this model, replaced by automated DOM/screenshot assertions (#10); NU1903 suppressed for the mandated AutoMapper 12.0.1 (#11); `dotnet <dll>` wrappers due to user-local SDK (#12); provider fail-fast implementation (#13).

---

## 4. Known issues and unverified items

See `docs/KNOWN_ISSUES.md` (all historical P0/P1 issues fixed; remaining items are deliberate dataset choices or P3 notes). Unverified: no human-style visual inspection of the 572 screenshots (model cannot view images); real external provider adapters are not bundled by design (fail-fast is the intended behaviour). See `docs/FINAL_REPORT.md`.

---

## 5. How to run / verify

```bat
setup.bat
start.bat
```

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\verify-all.ps1
```

Server: `http://localhost:5080` (`FIXNGO_PORT` overrides). Automated runs isolate state via `FIXNGO_DATA_DIR`, `FIXNGO_LOG_DIR` and a private port; the real `data\` folder is never a test target.

---

## 6. Resume point

For orientation, read: `README.md` → `docs/PROGRESS.md` (`RESUME HERE`) → `docs/AGENT_LOG.md` (latest rows) → `docs/FINAL_REPORT.md`. All work is complete: final `verify-all` green (21:11:13), final commit created, tree clean. Do not trust the old Arabic Phase-1 content that previously occupied this file.
