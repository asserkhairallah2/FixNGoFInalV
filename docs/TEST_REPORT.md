# Test report

Run: 2026-11-19 · Final Phase 7 tree · Machine: Windows, dotnet 8.0.428, node 26.13.1, npm 11.20.0, git 2.47.1

Status: **PASS** — authoritative gate `tools/verify-all.ps1` (7/7 steps, `OVERALL: PASS`). Full transcript: `docs/evidence/test-output/verify-all.txt`.

| # | Suite | Command | Total | Passed | Failed | Skipped |
|---:|---|---|---:|---:|---:|---:|
| 1 | Release build | `dotnet build FixNGo.sln -c Release` | 0 warnings / 0 errors | — | 0 | — |
| 2 | Domain unit | `dotnet test FixNGo.sln -c Release` | 1 | 1 | 0 | 0 |
| 2 | Application unit (auth/OTP + **providers**) | same | 9 + 11 = 20 | 20 | 0 | 0 |
| 2 | API integration (WebApplicationFactory + temp SQLite) | same | 24 | 24 | 0 | 0 |
| 3 | Client unit (Vitest) | `npm test` | 9 | 9 | 0 | 0 |
| 4 | Client production build | `npm run build` | 0 errors | — | 0 | — |
| 5 | Mock/forbidden-literal scan | `tools/mock-scan.ps1` | 98 files / 33 literals | 0 hits | 0 | — |
| 6 | Script tests S1–S10 | `tests/scripts/run-all.ps1` | 152 assertions | 152 | 0 | 0 |
| 7 | Playwright E2E (flows + 4-variant sweep) | `npx playwright test` | 35 | 35 | 0 | 0 |

**Total .NET tests: 45/45 passed (1 domain + 20 application + 24 API).**
**Total Playwright tests: 35/35 passed; 572 screenshots (143 × 4 variants).**
**Console errors/warnings in E2E: 0/0.**

Evidence:
- `docs/evidence/test-output/verify-all.txt` — authoritative full-gate transcript, summary table and `OVERALL: PASS`
- `docs/evidence/test-output/dotnet-test-gate1.txt`, `dotnet-test-gate2.txt` — earlier phase snapshots
- `docs/evidence/test-output/authz-matrix.md` — generated role × route allow/deny table (17 routes × 6 callers)
- `docs/API.md` — generated from the live `/swagger/v1/swagger.json` document (161 lines)
- `docs/evidence/test-output/mock-scan.txt` — 0 forbidden-literal hits
- `docs/evidence/test-output/e2e-tests.txt`, `docs/evidence/e2e/results.json` — 35/35 E2E
- `docs/evidence/e2e/sweep-{light-en,dark-en,light-ar,dark-ar}-summary.json` — 4-variant sweep diagnostics
- `docs/evidence/scripts/S1-S10*` — script test transcripts
- `docs/AGENT_LOG.md`, `docs/DEVIATIONS.md` (rows 1–13), `docs/E2E_REPORT.md`

### API integration coverage (24 tests)

| Area | Tests | Notes |
|---|---:|---|
| Auth (health/status/login/me/401/validation) | 7 | JWT inbound claim mapping fixed in Gate 1 |
| Authorization matrix | 2 | anonymous + 5 roles across 17 protected routes |
| Business flows | 4 | tow+P0 pricing, mechanic quote/dispute, booking lifecycle, card/cash payments incl. declined/retry/idempotent, KYC review/resubmit |
| Offer race | 1 | two captains accept concurrently → exactly one winner (409 for loser) |
| Privacy | 1 | pre-accept candidate/offer payloads hide phone/plate/exact coords |
| OpenAPI export | 1 | swagger.json served + docs/API.md generated |
| Additional API/behaviour coverage | 8 | simulator endpoints (incl. 404 when disabled), providers, payments, centers, admin and support routes |

### Root causes fixed (never skipped/weakened a test)

1. Gate 1: JWT inbound claim mapping produced empty `sub`/`email`/`role` → disabled `MapInboundClaims` in Web + `TokenService`.
2. Gate 1: .bat scripts polluted the real `data\`/`logs\` → honour `FIXNGO_DATA_DIR`/`FIXNGO_LOG_DIR`.
3. Gate 2: SQLite cannot `ORDER BY` a `decimal` column → cast `Rating` to `double` in `CenterService.CatalogAsync`.
4. Gate 2: Dispute endpoint returned a raw entity with EF-fixup'd `Request.Offers` graph → JSON cycle 500; added `DisputeDto` + `Mappings.Dispute`.
5. Gate 2: declined-card test used the account default good card → pass explicit `paymentMethodId`.
6. Gate 2: OpenAPI export read only per-operation `security`; Swashbuckle emits the global requirement at the document root → export reads both.
7. Backup/restore: `VACUUM INTO` is not byte-identical → verify a vacuum copy but retain raw checkpointed bytes.
8. Dummy generator: email collisions and temp-file cleanup race → global index for email suffix, best-effort cleanup.
9. Phase 7: `BottomNav` `undefined.tab` dereference (P0) → store a real screen per tab, filter `Boolean`.
10. Phase 7: post-create navigation to `#/C08?id=undefined` (P2) → `FormView` uses the created id from the POST/PUT result.
11. Phase 7: `Providers:* = Real` was silently ignored → fail-fast with `ProviderNotConfiguredException` + 11 tests + `docs/PROVIDERS.md`.
12. Phase 7 hostile review: a client-cancelled request (`TaskCanceledException`) was logged `ERROR` and returned a 500 → `ExceptionMiddleware` now handles `OperationCanceledException` explicitly (Debug log, no response).

Three earlier E2E "defects" (APP-02/03/04) were harness field-name mistakes, not product defects; the harness was corrected and `docs/evidence/e2e/ui-defects.json` is `[]`.

This file is regenerated after every full test run; the authoritative, most recent result is always `docs/evidence/test-output/verify-all.txt`.
