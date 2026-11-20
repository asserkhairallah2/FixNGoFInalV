# Test Report

Run: 2026-11-20 · Final Round-5 tree · Machine: Windows, PowerShell 5.1, .NET 8.0.428, Node.js, Git

Status: **PASS** — authoritative gate `tools/verify-all.ps1` (**8/8 steps, `OVERALL: PASS`**). Full transcript: `docs/evidence/test-output/verify-all.txt`.

| # | Gate Step | Command | Total | Passed | Failed | Skipped |
|---:|---|---|---:|---:|---:|---:|
| 1 | `01 dotnet build (Release)` | `dotnet build FixNGo.sln -c Release --nologo` | 0 warnings / 0 errors | — | 0 | — |
| 2 | `02 dotnet test (Release)` — Domain | `dotnet test FixNGo.sln -c Release --no-build` | 1 | 1 | 0 | 0 |
| 2 | `02 dotnet test (Release)` — Application | same | 20 | 20 | 0 | 0 |
| 2 | `02 dotnet test (Release)` — API Integration | same | 26 | 26 | 0 | 0 |
| 3 | `03 npm test (client)` | `npm test` (Vitest) | 9 | 9 | 0 | 0 |
| 4 | `04 npm run build + publish app/` | `tools/build.ps1` | 0 errors | — | 0 | — |
| 5 | `05 mock-scan.ps1` | `tools/mock-scan.ps1` | 117 files / 44 literals + prefill/confirm rules | 0 hits | 0 | — |
| 6 | `06 script tests S1-S10` | `tests/scripts/run-all.ps1` | 10 scenarios (`S1`–`S10`, 155 assertions) | 10 | 0 | 0 |
| 7 | `07 Playwright E2E` | `npm run test:e2e` | 41 | 41 | 0 | 0 |
| 8 | `08 fresh-clone build & start.bat gate` | `tools/clone-gate.ps1` | 1 | 1 | 0 | 0 |

**Total .NET tests: `47/47` passed (`1` Domain + `20` Application + `26` API).**
**Total Playwright tests: `41/41` passed (`5` auth + `15` flows `F01`–`F15` + `20` sweeps + `1` registry); `572` screenshots (`143 × 4` variants).**
**Console errors / warnings / failed requests in E2E: `0 / 0 / 0`.**

### API integration coverage (`26` tests)

| Area | Tests | Notes |
|---|---:|---|
| Auth (`health`/`status`/`login`/`me`/`401`/validation) | 7 | JWT claim mapping + validation |
| Authorization matrix | 2 | anonymous + 5 roles across 17 protected routes (`docs/evidence/test-output/authz-matrix.md`) |
| Business flows | 4 | tow+P0 pricing, mechanic quote/dispute, center booking lifecycle, card/cash payments incl. declined/retry/idempotent, KYC review/resubmit |
| Offer race | 1 | two captains accept concurrently → exactly one winner (`409` for loser) |
| Privacy | 1 | pre-accept candidate/offer payloads hide phone, plate, and exact coordinates |
| File security (`FileSecurityTests`) | 2 | rejects disguised HTML/script uploads via magic-byte check; enforces per-file ownership on `?ft=` tokens, allows Admin KYC inspection, and rejects raw `?access_token=` JWTs on `/api/v1/files` |
| OpenAPI export | 1 | `swagger.json` served + `docs/API.md` generated |
| Simulator & platform endpoints | 8 | simulator endpoints (incl. `404` when disabled), providers, payments, centers, admin, and support routes |

### Evidence files

- `docs/evidence/test-output/verify-all.txt` — authoritative 8-gate transcript and summary table (`OVERALL: PASS`)
- `docs/evidence/test-output/mock-scan.txt` — `0` hits across `117` scanned files
- `docs/evidence/test-output/script-tests.txt` & `docs/evidence/script-tests/S1..S10*.txt` — `.bat` script scenario transcripts
- `docs/evidence/e2e/results.json`, `flows.ndjson`, `auth-results.json`, `sweep-*-summary.json` — Playwright machine-readable outputs
- `docs/evidence/screenshots/{light-en,dark-en,light-ar,dark-ar}/*.png` — `572` phone-frame screenshots
- `docs/evidence/visual-review.md` — multimodal visual inspection review across all 7 modules
