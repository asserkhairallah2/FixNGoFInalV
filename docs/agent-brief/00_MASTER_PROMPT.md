# 00 — MASTER PROMPT: Build the FixNGo backend + wire the real application

> You are an autonomous senior full-stack engineer working in **GOAL MODE**. Read this file completely first, then the numbered files in order. You work alone and unattended: **do not ask the owner questions** — every decision you need is made in these documents; if something is genuinely ambiguous, choose the safest reasonable option, write it in `docs/DEVIATIONS.md`, and continue. You are done only when the **Definition of Done (§6)** is fully satisfied **and proven by evidence files**.

## 1. Mission (one paragraph)
`C:\Users\xprenspel\Desktop\FixNGoFinal` is your **one and only working folder (the project root)**. It was prepared for you with everything you need: the **front-end prototype with mock data** (138 mobile screens in React, no backend) in `legacy-prototype\`, the specs and design images in `reference\`, this brief in `docs\agent-brief\`, and `AGENT.md`/`STATE.md`. Do **not** read from or write to the older folder `C:\Users\xprenspel\Desktop\FixNGo` (the owner's untouched original) — everything you need is already inside `FixNGoFinal`. Build the **complete real system**: an ASP.NET Core 8 backend (Clean Architecture, EF Core + SQLite, SignalR), turn the prototype into a real working client wired to it, **remove every piece of fake/mock data**, replace external services (maps, SMS/OTP, payments, push) with **fake-but-functional providers shown in side "simulator" panels** next to the phone, and deliver five Windows tools: `setup.bat`, `start.bat`, `remove-db.bat`, `dummy-db.bat`, `restore-db.bat`. Then **test everything for real** (including browser screenshots of every screen), **log everything**, and produce a report so the work can be reviewed.

## 2. Reading order (do this before writing code)
| # | File | Content |
|---|---|---|
| 1 | `00_MASTER_PROMPT.md` | this file |
| 2 | `01_PROJECT_ANALYSIS.md` | what exists, defects of the prototype, gaps |
| 3 | `02a_INVENTORY_AUTH_AND_CAR_OWNER.md` | per-screen real behaviour (A01–A13, C01–C43) |
| 4 | `02b_INVENTORY_PROVIDERS.md` | Mechanic, Tow captain, Service center |
| 5 | `02c_INVENTORY_ADMIN_AND_SHARED.md` | Admin, Shared screens, entity list |
| 6 | `03_ARCHITECTURE_AND_DATA_MODEL.md` | stack, layout, domain rules, API conventions |
| 7 | `04_SCRIPTS_SPEC.md` | the five `.bat` tools — exact behaviour + test scenarios |
| 8 | `05_SIMULATORS_SPEC.md` | fake providers + Simulator Dock |
| 9 | `06_FRONTEND_MIGRATION.md` | how to port the 138 screens |
| 10 | `07_TEST_QA_AND_EVIDENCE.md` | tests, screenshots, logs, report |
| 11 | `08_PROGRESS_TEMPLATES.md` | templates for the log/matrix files |

This brief lives **inside the project** at `docs/agent-brief/` (re-read it any time). Also read the project's `AGENT.md` (architecture rules, still valid) and the SRS/SDD in `reference/` (`fixngo_software_requirements_specification.md`, `fixngo_system_analysis_design.md`) — they define FR/NFR/UC ids you must trace to. Look at the design images in `reference/design-images/` whenever a layout question arises (`reference/extra-images/` has 3 small extras). Open and read the legacy JS file of a module (in `legacy-prototype/`) **before** porting it — the inventories summarise, the source is authoritative for markup.

**Precedence when documents conflict:** (1) this brief (00–08) > (2) SRS/SDD > (3) `AGENT.md` > (4) `STATE.md` (outdated, ignore its status claims) > (5) the prototype's behaviour. Where `AGENT.md` mentions Razor/Bootstrap MVC views, this brief's decision (REST API + SignalR + React SPA served by the same ASP.NET app) wins; all other `AGENT.md` rules (Clean Architecture layers, `IEntityTypeConfiguration<T>` per entity, no entities in views/controllers, FluentValidation, AutoMapper, no secrets in code, Scoped lifetimes) stay.

## 3. Non-negotiable rules
1. **No mock data anywhere in the product.** A fresh install after `setup.bat` contains reference data + exactly one account (the admin the owner typed). Every screen shows real data from the API; empty databases must render designed empty states. The forbidden-literal list in `06_FRONTEND_MIGRATION.md` §6 must produce zero hits.
2. **The fake external providers are allowed and required** (they are services, not mock data) — see `05_SIMULATORS_SPEC.md`.
3. **Preserve the approved visual design** (prototype look, EN/AR RTL, light/dark). Don't redesign; port.
4. **Truth over speed.** Never claim something works unless you ran it and saw the result. Never skip, weaken or delete tests to get green. Never fabricate screenshots/logs. If you can't verify, say so.
5. **Security & safety:** passwords hashed, no secrets/OTPs/tokens/card data in logs or git, uploads validated, private files only via authorised endpoints, destructive scripts need typed confirmation and make verified backups first (`04_SCRIPTS_SPEC.md`). Never run destructive commands outside the project folder. Do not touch the owner's real `data\` while testing — tests use `FIXNGO_DATA_DIR` temp folders and random ports.
6. **Work in small verified steps.** Your context window is limited: after every meaningful step write a line to `docs/AGENT_LOG.md`, tick `docs/PROGRESS.md`, and `git commit`. When context grows, re-read the relevant brief file instead of relying on memory. Keep each source file focused (< ~600 lines).
7. **Autonomy:** install anything you need (NuGet/npm/Playwright browsers) non-interactively; no admin rights needed. If a command prompts, re-run with non-interactive flags. Prefer repo-local tools (`npx`, `dotnet tool` local manifest) over global installs. Handle Windows paths with spaces and PowerShell quoting.
8. **Quality bar:** nullable enabled, warnings as errors in `src/`, async all the way, cancellation tokens, no `.Result`/`.Wait()`, no swallowed exceptions, no magic strings for roles/statuses (use enums/consts), consistent naming, XML summary comments on public application services, small functions.
9. **Traceability:** every FR/NFR/UC and every screen id must map to code + tests in `docs/SCREEN_MATRIX.md` / `docs/FINAL_REPORT.md`.

## 4. Environment facts (verified on the owner's machine)
Windows, PowerShell (pwsh). `dotnet` 8.0.428 (in `%LOCALAPPDATA%\dotnet`), Node.js (`node -v` works) with npm, Python and Git available. `sqlite3` CLI is **not** installed (use EF Core/`Microsoft.Data.Sqlite`, or Python's `sqlite3` module for ad-hoc inspection). `opencode` is the agent runtime you are in. Internet is available for NuGet/npm. `FixNGoFinal` is **not** a git repository yet (run `git init`, add a proper `.gitignore` (`bin/ obj/ node_modules/ data/ logs/ app/ wwwroot build output, *.db`, e2e artifacts except `docs/evidence`), commit baseline of the untouched prototype FIRST).
The legacy prototype can be run to compare behaviour: `legacy-prototype\run_localhost.bat` (needs internet CDNs, port 3000).

## 5. Phases and gates (do them in order; a gate must pass before moving on)

### Phase 0 — Bootstrap & understanding
Verify the prepared layout (`legacy-prototype/`, `reference/`, `docs/agent-brief/`, `AGENT.md`, `STATE.md`); `git init` + baseline commit **of the folder exactly as delivered** (so the untouched prototype is in history); read everything (§2); run the legacy prototype once (`legacy-prototype\run_localhost.bat`, needs internet) and skim a few screens; create `docs/*` templates (`08_PROGRESS_TEMPLATES.md`); write your own **implementation plan + risk list** into `docs/PROGRESS.md`.
**Gate 0:** `docs/PROGRESS.md` has the plan; baseline commit exists; layout verified.

### Phase 1 — Foundation
Solution + 5 projects + 3 test projects; Directory.Build.props; EF Core context, base entity, configurations, first migration, reference-data seeding; Serilog; settings & secrets loader (`data\` paths, env vars); auth (signup/verify-otp/login/refresh/logout/forgot/reset/change-password/lockout/rate-limit), RBAC policies, ProblemDetails, health/status endpoints, Swagger; fake OTP sender + simulator message store; **FixNGo.Cli with `check-setup`, `setup`, `selftest`**; `build.ps1`; `setup.bat` + `start.bat` working end-to-end with the empty React shell (login screen real).
**Gate 1:** `dotnet build -c Release` 0 warnings/errors · unit+API tests for auth pass · scripts S1–S3 pass with transcripts saved · login works in a real browser (screenshot) · mock-scan passes on the (still small) client.

### Phase 2 — Domain & API (all business modules)
Implement, with unit + API tests as you go: vehicles; lookups; service requests + matching + offers + P0 + quotes + disputes + events + photos; payments (cash/card/Apple Pay via fake gateway), invoices, wallet, bank accounts, withdrawals; reviews; chat (REST + SignalR); notifications (+ outbox + preferences + device tokens); service centers (profile, hours, catalog, bays, technicians, availability, bookings, work orders, reviews, reports); providers (profile, documents, KYC, availability, location, earnings, history); admin (dashboard, verification, users/access, settings versioning, payment reviews, safety reports, reviews/complaints, support inbox, reports, audit, 2FA, sessions); support (FAQ, tickets); legal docs; emergency/SOS; account deletion; background workers; file store.
**Gate 2:** all unit + API + authorisation-matrix tests green · OpenAPI exported to `docs/API.md` · flow tests for tow/mechanic/booking/payment/KYC pass · offer-race test passes · privacy test passes · test report generated.

### Phase 3 — Client migration & wiring
Execute `06_FRONTEND_MIGRATION.md` module by module (Auth → Owner → Mechanic/Captain → Center → Admin → Shared). Update `docs/SCREEN_MATRIX.md` per screen with screenshots (light-EN and dark-AR at least) taken from the **running app against the real backend**. Remove the dev sidebar/mocks.
**Gate 3:** every screen id renders with real data or a designed empty state · `mock-scan` = 0 hits · client tests green · no console errors in a manual smoke of all roles.

### Phase 4 — Simulators
Fake providers + Simulator Dock with 5 panels + GPS drive simulation + SignalR sim events (`05_SIMULATORS_SPEC.md`).
**Gate 4:** the acceptance list in `05` §5 passes with screenshots; sim endpoints 404 when disabled (test).

### Phase 5 — The five tools
Finish `remove-db`, `dummy-db` (+ generator + `dummy-db.md`), `restore-db` exactly per `04_SCRIPTS_SPEC.md` with the full CLI and tests.
**Gate 5:** scenarios S1–S10 pass; transcripts in `docs/evidence/scripts/`; every credential listed in a generated `dummy-db.md` logs in (automated check over **all** listed users, not a sample); restore is byte-identical (SHA-256) to the original.

### Phase 6 — Full QA & visual verification
Run the complete suite from `07_TEST_QA_AND_EVIDENCE.md`: E2E flows (storyboards), the **screen sweep over all 138+ screens × 4 variants** with automated checks, accessibility smoke, security checks, light performance run. **Look at the screenshots** (rule in `07` §3). Fix everything you find, re-run everything.
**Gate 6:** `tools/verify-all.ps1` exits 0 · `docs/TEST_REPORT.md` shows 0 failures · screenshots present for every screen · `KNOWN_ISSUES.md` contains only honest, justified items (no P0/P1 functional gaps).

### Phase 7 — Self-review & hand-off
Act as a hostile reviewer: (a) walk the SRS FR/NFR/UC list and tick each with evidence; (b) walk `SCREEN_MATRIX.md` and open 20 random screenshots; (c) re-run mock-scan and `verify-all`; (d) check git is clean and `.gitignore` excludes data/logs/secrets; (e) update `README.md` (how to run, prerequisites, the five tools, simulators, switching to real providers), `STATE.md` (rewrite in English with the true state), `AGENT.md` (append a short "current architecture" section). Write `docs/FINAL_REPORT.md` (template in `07` §8).
**Gate 7 = Definition of Done.**

## 6. Definition of Done (all must be true)
- [ ] `setup.bat` creates the first admin from interactive console input, then closes its window and launches `start.bat`; `start.bat` runs the system and launches `setup.bat` automatically when no accounts exist.
- [ ] `remove-db.bat`, `dummy-db.bat` (+ `dummy-db.md` listing every dummy user with role, status, password), `restore-db.bat` behave exactly as specified and passed S1–S10.
- [ ] 100 % of the 138 prototype screens (+ added gap screens) are real, data-bound, state-complete, in EN/AR and light/dark; navigation passes real ids; no dev sidebar; no mock literals (scan = 0).
- [ ] Backend implements all flows in the inventories and SRS/SDD must-haves with the rules of `03_*`; RBAC matrix verified; privacy rules verified.
- [ ] Fake providers + 5-panel Simulator Dock work and are switchable by configuration.
- [ ] Automated suites (unit, API, script, client, E2E, screen sweep, mock-scan) all green via `tools/verify-all.ps1`; evidence + logs committed under `docs/`.
- [ ] Reports written honestly (`FINAL_REPORT.md`, `KNOWN_ISSUES.md`, `DEVIATIONS.md`), including what you could not verify.

## 7. How to report progress while working
Single short line per step in `docs/AGENT_LOG.md` (`2026-11-20 14:05 · P2 · Offer race test · dotnet test --filter OfferRace · PASS`). After each gate write a 5-line summary at the top of `docs/PROGRESS.md`. Do not stop to chat; continue to the next task until Gate 7 is reached. If you must stop (tool/quota failure), leave `docs/PROGRESS.md` with an exact "RESUME HERE" section (phase, task, last command, next command) so another session can continue seamlessly.
