# Progress

## RESUME HERE
Phase: 1 (Foundation) — backend layers done, CLI + tools + client shell pending.
Last command: Web project built cleanly (0 warnings/errors); logged to AGENT_LOG.md.
Next command: `git add -A && git commit -m "feat(p1): backend foundation - domain, application, infrastructure, web"`, then implement FixNGo.Cli (check-setup/setup/selftest), tools/build.ps1, setup.bat, start.bat, and the React login shell.

## Gate summaries (newest first)
Gate 0 — PASS (2026-11-19): layout verified; 11 brief files + AGENT.md + SRS + SDD read; git baseline commit `e90d3a4` exists; legacy prototype served HTTP 200 and 12 screens rendered in Chromium with 0 console errors. Evidence: `docs/evidence/phase0/legacy-prototype-check.md`.

## Plan & risks
- Plan: Phase 1 foundation (solution, Clean Architecture, EF Core/SQLite, auth, CLI, two bats, empty React shell) → Gate 1; Phase 2 all domain modules + tests → Gate 2; Phase 3 port 138 screens to Vite/React wired to API, remove mocks → Gate 3; Phase 4 fake providers + 5-panel Simulator Dock → Gate 4; Phase 5 finish 5 bats + dummy generator + S1–S10 → Gate 5; Phase 6 full QA, E2E flows, 4-variant screen sweep, verify-all → Gate 6; Phase 7 hostile self-review + reports → Gate 7.
- Work style: small verified steps, append `AGENT_LOG.md`, tick this file, commit after each step. Tests always use `FIXNGO_DATA_DIR` temp folders + random ports; never the real `data\`.
- Risks & mitigations:
  - SQLite concurrent offer race → conditional `UPDATE ... WHERE status='Pending'` in a transaction + rowversion; integration test with two parallel accepts.
  - OTP/time correctness → `IClock` injection, hashed OTPs, TTL/attempts/cooldown/5-per-hour unit tests; fake OTP exposed only via sim panel.
  - Dummy data internal consistency → deterministic RNG, build wallets from ledger sums and ratings from reviews, verify manifest hash before swapping.
  - BAT quoting / paths with spaces → thin `.bat` wrappers, all logic in C# CLI; test S10 from another cwd with a spaced temp path.
  - Playwright flakiness → condition waits (no fixed sleeps), `sessionStorage` tokens per context, deterministic dummy data.
  - Image inspection impossible for this model → record in FINAL_REPORT, rely on automated DOM/screenshot assertions and no-console-error checks.
  - Very large scope → prioritise a real, working vertical slice per phase with evidence; never fake a green test.

## Checklist
### Phase 0 Bootstrap
- [x] layout verified (legacy-prototype, reference, docs/agent-brief)
- [x] git init + baseline commit (`e90d3a4`)
- [x] read all brief files, AGENT.md, SRS, SDD
- [x] run legacy prototype + skim screens
- [x] tracking templates + implementation plan
- [x] Gate 0

### Phase 1 Foundation
- [ ] solution + 5 projects + 3 test projects
- [ ] Directory.Build.props (nullable, warnings as errors for src)
- [ ] EF Core context, base entity, per-entity configurations, first migration, reference seeding
- [ ] Serilog, settings/secrets loader, health/status
- [ ] auth (signup/OTP/login/refresh/logout/forgot/reset/change-password/lockout/rate-limit), RBAC, ProblemDetails
- [ ] fake OTP sender + simulator message store
- [ ] FixNGo.Cli check-setup / setup / selftest
- [ ] build.ps1 + setup.bat + start.bat with empty React shell (real login)
- [ ] Gate 1: Release build 0 warnings, auth tests, S1–S3, browser login screenshot, mock-scan

### Phase 2 Domain & API
- [ ] vehicles, lookups, requests/matching/offers/P0, quotes/disputes, payments/invoices/wallet/withdrawals
- [ ] reviews, chat (REST+SignalR), notifications/outbox/preferences
- [ ] service centers (catalog/hours/bays/technicians/availability/bookings/work orders/reports)
- [ ] providers (profile/documents/KYC/availability/location/earnings/history)
- [ ] admin (dashboard/verification/users/settings/payment reviews/safety/reviews/support/reports/audit/2FA/sessions)
- [ ] support/legal/SOS/deletion, background workers, file store
- [ ] Gate 2: all tests green, API.md, authz matrix, flow tests, offer race, privacy test

### Phase 3 Client
- [ ] shell + shared UI kit (no dev sidebar/mocks)
- [ ] auth A01–A13; car owner C01–C43; mechanic M01–M15; captain T01–T15; center SC01–SC17; admin AD01–AD18; shared SH01–SH21
- [ ] gap screens (P0, photos, cash confirm, payment methods, report user/review, NotFound, offline)
- [ ] Gate 3: all screens data-bound, mock-scan 0, client tests green

### Phase 4 Simulators
- [ ] fake maps/SMS/email/OTP/payments/push providers + config switch to Real stubs
- [ ] Simulator Dock: notifications, payments, SMS, OTP, GPS/Maps + drive simulation
- [ ] Gate 4: acceptance list, sim 404 when disabled

### Phase 5 Tools
- [ ] remove-db, dummy-db + generator + dummy-db.md, restore-db
- [ ] S1–S10 scripts tests with transcripts
- [ ] Gate 5: every generated credential logs in, byte-identical restore

### Phase 6 QA
- [ ] E2E flows (12 storyboards), 4-variant screen sweep, a11y/security/perf, verify-all.ps1
- [ ] Gate 6: verify-all exits 0, TEST_REPORT 0 failures

### Phase 7 Hand-off
- [ ] FR/NFR/UC audit, README/STATE/AGENT updates, FINAL_REPORT, hostile self-review
- [ ] Gate 7 = Definition of Done
