# Progress

## RESUME HERE
Phase: 3 (Client migration & wiring) — task: finish the declarative registry-driven client, fix audit findings, add render smoke tests, produce EN-light/AR-dark screenshots for every screen, then Gate 3.
Last verified: Phase 3 checkpoint — client 9/9 Vitest PASS; client build PASS; backend Release build 0 warnings/errors; mock-scan 0 hits (86 files); 141 screens registered (138 legacy + AD16–AD18). Evidence: docs/evidence/test-output/vitest-gate3-prep.txt, client-build-gate3-prep.txt, dotnet-build-gate3-prep.txt, mock-scan.txt. Prior Gate 2 PASS — Release build 0 Warning(s) 0 Error(s); full suite 26/26 (1 domain + 9 app + 16 API); authz matrix, tow/mechanic/booking/payment/KYC flows, offer race, privacy and OpenAPI export all green; docs/API.md generated (161 lines); TEST_REPORT.md regenerated.
Next command: `git add -A; git commit` Gate 2, then inspect `client/` current shell + a legacy module source and begin Phase 3 porting per `06_FRONTEND_MIGRATION.md`.

## Gate summaries (newest first)
Gate 2 — PASS (2026-11-19): Release build 0 warnings/errors; 26/26 tests (1 domain + 9 app + 16 API via WebApplicationFactory + temp SQLite); authz matrix 17 routes × 6 callers; flow tests tow/P0, mechanic quote/dispute, booking lifecycle, payments (card/cash/declined/retry/idempotent), KYC; offer race (2 captains → exactly 1 winner); privacy (pre-accept payloads hide phone/plate/exact coords); OpenAPI exported to docs/API.md. Evidence: docs/evidence/test-output/dotnet-test-gate2.txt, authz-matrix.md, docs/API.md, docs/TEST_REPORT.md. Root causes fixed: SQLite decimal ORDER BY, dispute JSON cycle, default-card test bug, Swagger global security export.

Gate 1 — PASS (2026-11-19): Release build 0 warnings/errors; 17/17 tests (1 domain + 9 app auth + 7 API); S1–S3 script tests 11/11 with transcripts; browser login E2E (POST /auth/login 200, authenticated shell, 0 console errors) with screenshots; mock-scan 0 hits. Evidence: docs/evidence/test-output/dotnet-test-gate1.txt, docs/evidence/test-output/mock-scan.txt, docs/evidence/scripts/S1-S3, docs/evidence/screens/. Deviations 1–12 logged.

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
- [x] solution + 5 projects + 3 test projects
- [x] Directory.Build.props (nullable, warnings as errors for src)
- [x] EF Core context, base entity, per-entity configurations, reference seeding (EnsureCreated)
- [x] Serilog, settings/secrets loader, health/status
- [x] auth (login/JWT/refresh/me/claim mapping), RBAC, ProblemDetails; full signup/OTP/reset in Phase 2
- [x] fake OTP sender + simulator message store (foundation; panels in Phase 4)
- [x] FixNGo.Cli check-setup / setup / selftest
- [x] build.ps1 + setup.bat + start.bat with React shell (real login)
- [x] Gate 1: Release build 0 warnings, 17 tests green, S1–S3 (11/11), browser login E2E, mock-scan 0 hits

### Phase 2 Domain & API
- [x] vehicles, lookups, requests/matching/offers/P0, quotes/disputes, payments/invoices/wallet/withdrawals
- [x] reviews, chat (REST+SignalR), notifications/outbox/preferences
- [x] service centers (catalog/hours/bays/technicians/availability/bookings/work orders/reports)
- [x] providers (profile/documents/KYC/availability/location/earnings/history)
- [x] admin (dashboard/verification/users/settings/payment reviews/safety/reviews/support/reports/audit/2FA/sessions)
- [x] support/legal/SOS/deletion, background workers, file store
- [x] Gate 2: all tests green, API.md, authz matrix, flow tests, offer race, privacy test

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
