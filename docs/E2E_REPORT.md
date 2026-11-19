# End-to-End Test Report (Playwright)

**Date:** 2026-11-19
**Workspace:** `C:\Users\xprenspel\Desktop\FixNGoFinal`
**Final raw output:** `docs/evidence/test-output/e2e-tests.txt` (also embedded in `docs/evidence/test-output/verify-all.txt`)
**Machine-readable result:** `docs/evidence/e2e/results.json`

## 1. Final result

A single clean run of the full suite was executed with the committed Playwright config (list + JSON reporters), as step 07 of `tools/verify-all.ps1`:

```powershell
# from client/
npx playwright test 2>&1 | Tee-Object -FilePath ..\docs\evidence\test-output\e2e-tests.txt
```

| Metric | Result |
|---|---:|
| Tests run | 35 |
| Passed | 35 |
| Failed | 0 |
| Skipped | 0 |
| Flaky | 0 |
| Duration | ~3m 12s (193,237 ms) |
| Console errors | 0 |
| Console warnings | 0 |
| Screenshots | 572 |

`results.json` confirms `expected: 35`, `unexpected: 0`, `skipped: 0`, `flaky: 0`.

The run used one ASP.NET Web instance on the reserved loopback port `54173`, with temporary data/log/web directories, CLI-based seeding and a clean built `wwwroot`. The real `data\` directory was never used. No bundle was patched — the shipped client is the clean source build recorded in `docs/evidence/e2e/source-build.txt` (`exit=0`, `0 Warning(s)`, `0 Error(s)`).

## 2. Coverage

| Area | Tests | Result |
|---|---:|---|
| Real UI login for all 5 seeded roles | 5 | 5/5 PASS, clean console |
| Key business flows driven through the real UI | 9 | 9/9 PASS (10 flow records; F07+F08 in one test) |
| Full screen sweep, 4 variants (light/dark × EN/AR) | 20 | 20/20 PASS |
| Registry completeness | 1 | PASS (143 codes, all 4 variants) |
| **Total** | **35** | **35/35 PASS** |

### Screen registry coverage

| Role | Codes | light-en | dark-en | light-ar | dark-ar |
|---|---:|---:|---:|---:|---:|
| Owner | 71 | 71 | 71 | 71 | 71 |
| Mechanic | 22 | 22 | 22 | 22 | 22 |
| Captain | 15 | 15 | 15 | 15 | 15 |
| Service center | 17 | 17 | 17 | 17 | 17 |
| Admin | 18 | 18 | 18 | 18 | 18 |
| **Total** | **143** | **143** | **143** | **143** | **143** |

Screenshot files: `docs/evidence/screenshots/{light-en,dark-en,light-ar,dark-ar}/*.png`, 143 PNG each, 572 total. All 143 registry codes exist in all four variants; missing files: 0.

### Sweep quality gates

All four `sweep-{light-en,dark-en,light-ar,dark-ar}-summary.json` reports agree:

| Check | light-en | dark-en | light-ar | dark-ar |
|---|---:|---:|---:|---:|
| Screens | 143 | 143 | 143 | 143 |
| Screenshots | 143 | 143 | 143 | 143 |
| Rendered screen / designed state | 143 | 143 | 143 | 143 |
| Console errors | 0 | 0 | 0 | 0 |
| Console warnings | 0 | 0 | 0 | 0 |
| Failed requests | 0 | 0 | 0 | 0 |
| Forbidden text (`undefined`, `NaN`, `[object Object]`) | 0 | 0 | 0 | 0 |
| Horizontal overflow | 0 | 0 | 0 | 0 |
| No visible state | 0 | 0 | 0 | 0 |

All five login tests in `auth-results.json` are `PASS` with empty console arrays. UI-based flow assertions also required zero console errors/warnings.

## 3. Business flow evidence

`docs/evidence/e2e/flows.ndjson` contains one record per flow from the final run. F02, F04, F05 and F09 are driven through the real UI forms (confirmed field names), not direct API calls:

| Flow | Status | Notes |
|---|---|---|
| F01 login → C02 | `PASS` | Owner home reached |
| F02 request creation | `PASS` | Real C07 UI form; navigates to created request id (P2 fixed) |
| F03 offer accept | `PASS` | Provider-selection flow |
| F04 booking | `Confirmed` | Real C19 UI form with `slotStart` |
| F05 card payment | `PASS` | Real C33 UI form (`expMonth`/`expYear`/`label`), `4242…4242`, settled |
| F06 chat send | `PASS` | Real SH01 UI send |
| F07 KYC submission | `Submitted` | Real API |
| F08 admin review | `Approved` | Real API |
| F09 support ticket | `PASS` | Real SH08 UI form (`category`/`subject`/`description`) |
| F10 SOS | `PASS` | Real API + SH19 UI |

Global setup seeded the five Gate 2 roles and the entity IDs used by the flows (`docs/evidence/e2e/global-setup.json`).

## 4. Defect status

Two real product defects were found during hostile review of an earlier E2E run, **fixed in source**, and re-verified green:

| ID | Severity | Screen / area | Defect | Fix | Evidence |
|---|---|---|---|---|---|
| APP-01 | P0 | Shared shell (`BottomNav`) | `undefined.tab` dereference could crash the authenticated shell. | `client/src/App.jsx`: `BottomNav` now stores a real screen (`byTab.set(s.tab, s)`) and filters `Boolean`. | `docs/evidence/e2e/source-build.txt`, 35/35 E2E PASS |
| APP-05 | P2 | Post-request navigation | After UI request creation the app navigated to `#/C08?id=undefined`. | `client/src/ui/renderers.jsx`: `FormView` captures the POST/PUT result and uses `result?.id ?? id`, only passing `{ id }` when a real id exists. | `docs/evidence/e2e/flows.ndjson` F02, 35/35 E2E PASS |

Three earlier "APP-02/03/04" records were **false positives**: the E2E harness used wrong field names, not a product defect. The forms were confirmed correct (`C19` `slotStart`, `C33` `AddCardRequest(Number, ExpMonth, ExpYear, Label)`, `SH08` `CreateTicketRequest(Category, Subject, Description)`), the harness flows were corrected to drive the real controls, and the defects were removed. `docs/evidence/e2e/ui-defects.json` is now `[]`.

No E2E bundle patching occurs; `docs/evidence/e2e/bundle-patch.txt` records `none`.

**Transient server-log finding (P3, fixed):** hostile review of an earlier passing run found a client-cancelled `GET /api/v1/sim/push` during rapid navigation logged as `ERROR "Unhandled exception"` + a 500 response (`TaskCanceledException`, client abort). This was not an assertion failure (all E2E checks passed), but it was a misleading server fault. Fixed at the root in `ExceptionMiddleware` (explicit `OperationCanceledException` handling: Debug log, no 500 for client aborts) and recorded in `docs/KNOWN_ISSUES.md` #7. Full suite re-run after the fix is the authoritative transcript in `docs/evidence/test-output/verify-all.txt`.

## 5. Fixture constraints (not counted as app defects)

- `GET /offers/{id}` only returns pending offers; accepted offers 404, and seeded offers expire after 30 s. The two incoming-offer screens use separate pending offers with a far-future expiry in the temp DB only.
- Quote creation is stage-gated (`Arrived`/`QuotePending`/`Disputed`). The main fixture request was moved to `Arrived` in the temp DB before quote/invoice seeding.
- Provider KYC submission is rejected once `KycStatus` is `Approved`; the KYC flow resets status to `None` first.
- SignalR `101`/long-lived negotiation entries in the raw server log are normal; they are not browser console errors.

## 6. Visual inspection limit

The screenshots were generated by Playwright and checked by automated DOM assertions (visible state, forbidden text, overflow, console cleanliness). This model **cannot visually view images**, so no human-style visual inspection was performed. This limitation is disclosed in `docs/FINAL_REPORT.md` and `docs/DEVIATIONS.md` #10.

## 7. Evidence inventory

| File | Purpose |
|---|---|
| `docs/evidence/test-output/e2e-tests.txt` | Final raw Playwright list output |
| `docs/evidence/e2e/results.json` | Final JSON reporter stats (35/35) |
| `docs/evidence/e2e/screen-registry.json` | 143 codes in 4 variants |
| `docs/evidence/e2e/auth-results.json` | 5 role login results and console evidence |
| `docs/evidence/e2e/flows.ndjson` | Final business-flow records |
| `docs/evidence/e2e/ui-defects.json` | `[]` — no outstanding UI defects |
| `docs/evidence/e2e/global-setup.json` | Seeded users, IDs and prerequisite status |
| `docs/evidence/e2e/sweep-*.json` | Per-role and aggregate sweep diagnostics for all 4 variants |
| `docs/evidence/screenshots/{light-en,dark-en,light-ar,dark-ar}/*.png` | 572 screenshots |
| `docs/evidence/e2e/source-build.txt` | Clean source build: 0 warnings, 0 errors |
| `docs/evidence/e2e/bundle-patch.txt` | `none` — no bundle patch applied |

## 8. Ownership statement

E2E-owned files: `client/playwright.config.js`, `client/e2e/**`, `client/package.json` (Playwright dependency/scripts), `docs/evidence/e2e/**`, `docs/evidence/screenshots/**` and this report. The two product-source fixes (APP-01/APP-05) were applied deliberately in `client/src/**` and are part of the final source commit. The real `data\` directory was not used.
