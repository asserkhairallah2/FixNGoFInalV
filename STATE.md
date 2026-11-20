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
  * **.NET:** `47/47` (`1` Domain + `20` Application + `26` API integration, including `FileSecurityTests` for magic-byte upload validation, ownership checks, and short-lived `?ft=` file tokens).
  * **Client unit (Vitest):** `9/9`.
  * **Strict mock/prefill scan (`tools/mock-scan.ps1`):** `0` hits across `112` files (44 forbidden literals + form-prefill `useState` checks + fallback-sentence regexes + pre-ticked confirmation checks).
  * **Script scenarios (`tests/scripts/run-all.ps1`):** `10/10` (`S1`–`S10`).
  * **Playwright E2E:** `41/41` (`5` role logins + `15` UI/API business flows `F01`–`F15` + `20` four-variant screen sweeps + `1` registry check = `572` phone-frame screenshots with `0` console errors, `0` warnings, `0` failed requests, `0` forbidden/raw-enum text, `0` horizontal overflow).
  * **Fresh-clone gate (`tools/clone-gate.ps1`):** `PASS` (`git clone` to temp folder → `setup.bat` → `start.bat` → HTTP 200 SPA + JS bundle).
* **Git:** branch `main`; `client/src/app/` tracked (`.gitignore` anchored to `/app/`); post-commit working tree clean; `data/` untouched.

---

## 2. What was delivered

* **Backend:** ASP.NET Core 8, Clean Architecture (`Domain`, `Application`, `Infrastructure`, `Web`, `Cli`), EF Core 8 + SQLite, JWT + rotating refresh tokens, RBAC policies, SignalR hub (`/hubs/app` emitting live `notification`, `push`, `location.updated`, `chat.message`, `chat.typing`), scoped time-limited DataProtection download tokens (`POST /api/v1/files/token` → `?ft=`) with per-file ownership (`FileAccessService`) and magic-byte verification, hosted workers, FluentValidation, AutoMapper, Serilog. Full REST API under `/api/v1/` (`docs/API.md`).
* **Client:** `client/` — Vite 6 + React 18 + JSX + Tailwind. All 143 registered screens ported into dedicated React components under `client/src/modules/` and wired to the real API + live `useLiveSync()` SignalR invalidation, EN/AR (`dir="rtl"`), light/dark. Product forms start empty (never pre-filled with sample vehicles/trucks/cards/addresses), irreversible confirmation checkboxes start unticked, closed days on `C19`/`C39` show Closed with 0 slots, and already-Paid invoices on `C14`/`C34` route cleanly to `C15`.
* **Providers + Simulator Dock:** fake-but-functional OTP/SMS/email, payments, maps/geocoding/routing, and push providers writing real SQLite rows; five-panel dock (`Notifications`, `Payments` / `المدفوعات`, `SMS`, `OTP`, `GPS`) with auto-refreshing OTPs, formatted `Africa/Cairo` timestamps, `Test cards` on Charges sub-tab, and `Sample IBAN` on Bank sub-tab. Configuration-switchable with fail-fast on `Real` without keys (`docs/PROVIDERS.md`).
* **Five root tools:** `setup.bat`, `start.bat`, `remove-db.bat`, `dummy-db.bat`, `restore-db.bat` — all business logic in `FixNGo.Cli`, wrappers invoke `tools\build.ps1 -IfNeeded` and `dotnet app\FixNGo.Cli.dll`.

---

## 3. Key decisions / deviations

Recorded in `docs/DEVIATIONS.md` (rows 1–14). Most significant: REST + React SPA instead of Razor/MVC (#7); SQLite instead of SQL Server (#8); multimodal visual inspection of regenerated screenshots against `reference/design-images/` (#10); NU1903 suppressed for mandated AutoMapper 12.0.1 (#11); `dotnet <dll>` wrappers with `-IfNeeded` rebuild (#12); provider fail-fast implementation (#13); JWT session issued upon signup OTP verification (#14).

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
