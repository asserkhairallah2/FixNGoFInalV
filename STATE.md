# FixNGo — Project State (`STATE.md`)

> **Purpose:** live, honest snapshot of where the project stands. This file was rewritten in Phase 7 in English to reflect the system that was actually delivered. The previous Arabic Phase-1 content was stale and is intentionally replaced. Stable architecture/conventions live in `AGENT.md`; the full hand-off report is `docs/FINAL_REPORT.md`.
>
> **Last updated:** 2026-11-19 · **Overall status:** Complete — Phase 7 hand-off done; all gates green and final commit created.

---

## 1. Current milestone and health

* **Phase:** 0-7 + Round 2 + Round 3 complete with gate evidence; hostile self-review, visual inspection (`docs/evidence/visual-review.md`), final report and final commit done.
* **Build:** `dotnet build FixNGo.sln -c Release` → 0 warnings, 0 errors; client production build → 0 errors.
* **Authoritative gate:** `tools/verify-all.ps1` - 7/7 steps PASS (`OVERALL: PASS`) at 2026-11-20T00:28:22Z on the final Round 3 post-fix source (includes all `A.1`–`A.6`, `B.7`–`B.16`, `C`, and `D.17`–`D.19` items). Transcript: `docs/evidence/test-output/verify-all.txt`.
* **Tests:** .NET (`45/45` — 1 Domain + 20 Application + 24 API), client Vitest (`9/9`), script scenarios S1–S10 (`10/10`), extended `tools/mock-scan.ps1` (`0` hits across 108 files, 44 literals + fallback regexes), and Playwright E2E (`38/38` tests including `F01`–`F12` and 4 screen-sweep variants = `572` screenshots). Exact final counts are in `docs/TEST_REPORT.md` and `docs/E2E_REPORT.md`.
* **Git:** branch `main`; phase commits `e90d3a4` → `a882b9a` plus the final Phase 7 commit (see `git log`); post-commit tree clean.

---

## 2. What was delivered

* **Backend:** ASP.NET Core 8, Clean Architecture (`Domain`, `Application`, `Infrastructure`, `Web`, `Cli`), EF Core 8 + SQLite, migrations, JWT + refresh tokens, RBAC policies, SignalR hub, hosted workers, FluentValidation, AutoMapper, Serilog. Full REST API under `/api/v1/` (generated reference in `docs/API.md`).
* **Client:** `client/` — Vite 6 + React 18 + JSX + Tailwind. All 143 registered screens (138 prototype + added gap screens) ported from `legacy-prototype/01..07_*.js` into dedicated per-screen React components under `client/src/modules/` and wired to the real API, EN/AR RTL, light/dark. Visually inspected against `reference/design-images/*.jpg` (`docs/evidence/visual-review.md`). No mocks, dev sidebar, role switchers, hard-coded personas/numbers/dates or remote image URLs (`tools/mock-scan.ps1` = 0 hits).
* **Providers + Simulator Dock:** fake-but-functional OTP/SMS/email, payments, maps/geocoding/routing and push providers writing real SQLite rows; five-panel dock (Notifications/Payments/SMS/OTP/GPS) visible whenever `simulatorsEnabled = true` (including pre-login). Configuration-switchable with fail-fast on `Real` without keys (`docs/PROVIDERS.md`, DEVIATIONS #13).
* **Five root tools:** `setup.bat`, `start.bat`, `remove-db.bat`, `dummy-db.bat`, `restore-db.bat` — all logic in the C# CLI, wrappers call `tools\build.ps1 -IfNeeded` and `dotnet <dll>`, and `start.bat` serves the built SPA at `/` with HTTP 200.
* **Evidence:** unit/API/authz-matrix/offer-race/privacy tests (45 .NET tests), S1–S10 transcripts (including SPA root HTTP 200 and 201 dummy credentials with Arabic-to-ASCII transliteration and `Suspended` users), client tests (9 Vitest), Playwright E2E flows + 572 screenshots (143 × 4 variants), visual review (`docs/evidence/visual-review.md`), and reports under `docs/`.

---

## 3. Key decisions / deviations

Recorded in `docs/DEVIATIONS.md` (rows 1–14). Most significant: REST + React SPA instead of Razor/MVC (#7); SQLite instead of SQL Server (#8); Round 2 visual inspection of screenshots side-by-side against `reference/design-images/` (#10); NU1903 suppressed for the mandated AutoMapper 12.0.1 (#11); `dotnet <dll>` wrappers with `-IfNeeded` rebuild (#12); provider fail-fast implementation (#13); JWT session issued upon signup OTP verification (#14).

---

## 4. Known issues and unverified items

See `docs/KNOWN_ISSUES.md` (all historical P0/P1 issues and all Round 2 review findings `B1`–`B7`, `M`, `m` fixed and verified). Unverified: real external provider adapters are not bundled by design (fail-fast is the intended behaviour); no formal load/throughput benchmark or SQL Server deployment test. See `docs/FINAL_REPORT.md`.

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
