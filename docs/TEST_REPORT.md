# Test report

Run: 2026-11-19 · Phase 2 Gate 2 · Machine: Windows, dotnet 8.0.428, node 26.13.1, npm 11.20.0, git 2.47.1

Status: **Phase 2 Gate 2 — PASS** (all domain modules + REST API + SignalR hub + workers; full business flows through the real host).

| Suite | Command | Total | Passed | Failed | Skipped | Duration |
|---|---|---|---|---|---|---|
| Domain unit | `dotnet test tests/FixNGo.Domain.Tests -c Release` | 1 | 1 | 0 | 0 | < 1 s |
| Application unit (auth/OTP) | `dotnet test tests/FixNGo.Application.Tests -c Release` | 9 | 9 | 0 | 0 | 5 s |
| API integration (WebApplicationFactory + temp SQLite) | `dotnet test tests/FixNGo.Api.Tests -c Release` | 16 | 16 | 0 | 0 | 9 s |
| ├ auth (7) | login/me/401/validation | 7 | 7 | 0 | 0 | — |
| ├ authorisation matrix (2) | anonymous + 5 roles across 17 protected routes | 2 | 2 | 0 | 0 | — |
| ├ business flows (4) | tow+P0 pricing, mechanic quote/dispute, booking lifecycle, card/cash payments incl. declined/retry/idempotent replay, KYC review/resubmit | 4 | 4 | 0 | 0 | — |
| ├ offer race (1) | two captains accept concurrently → exactly one winner | 1 | 1 | 0 | 0 | — |
| ├ privacy (1) | pre-accept candidate/offer payloads hide phone/plate/exact coordinates | 1 | 1 | 0 | 0 | — |
| └ OpenAPI export (1) | swagger.json served + docs/API.md generated | 1 | 1 | 0 | 0 | — |
| Script tests S1–S3 | `powershell -File tools/script-tests.ps1 -Scenarios S1,S2,S3` | 11 assertions | 11 | 0 | 0 | ~30 s |
| Mock/forbidden-literal scan | `powershell -File tools/mock-scan.ps1` | 0 hits | 0 | 0 | — | < 1 s |
| Release build | `dotnet build FixNGo.sln -c Release` | 0 warnings, 0 errors | — | 0 | — | 4 s |

**Total .NET tests: 26/26 passed (1 + 9 + 16).**

Evidence:
- `docs/evidence/test-output/dotnet-test-gate2.txt` — raw full-suite output, 26/26
- `docs/evidence/test-output/authz-matrix.md` — generated role × route allow/deny table (17 routes)
- `docs/API.md` — generated from the live `/swagger/v1/swagger.json` document (161 lines)
- `docs/evidence/test-output/mock-scan.txt` — 0 forbidden-literal hits
- `docs/evidence/scripts/S1-start-first-run.txt`, `S2-setup-already-set-up.txt`, `S3-admin-login.txt`
- `docs/AGENT_LOG.md` (append-only chronological log), `docs/DEVIATIONS.md` (rows 1–12)

Root causes fixed during Gate 2 (never skipped/weakened a test):
1. SQLite cannot `ORDER BY` a `decimal` column → cast `Rating` to `double` in `CenterService.CatalogAsync` (the `/api/v1/centers` 500).
2. Dispute endpoint returned a raw `Dispute` entity whose EF-fixup'd `Request.Offers` graph caused a JSON cycle (500) → added `DisputeDto` + `Mappings.Dispute` and returned the DTO.
3. Declined-card test used the account default (a good "4242" card from the shared host) → pass explicit `paymentMethodId` for the declined and retry cards.
4. OpenAPI export read only per-operation `security`; Swashbuckle emits the global requirement at the document root → export now reads both.

This file is regenerated after every full test run in Phases 1–6 by `tools/verify-all.ps1`.
