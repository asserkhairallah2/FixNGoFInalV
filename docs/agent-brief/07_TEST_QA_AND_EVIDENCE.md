# 07 — Testing, screenshots, logging and the review package

The owner will have the work **independently reviewed**. Everything you claim must be reproducible from files in the repo. **"It compiles" is not "it works". You must run it, look at it, and record proof.**

## 1. Evidence layout (all under `docs/`)
```
docs/AGENT_LOG.md          chronological log: timestamp · phase · what you did · command(s) · result (pass/fail) · next
docs/PROGRESS.md           phase checklist with [ ]/[x] and links to evidence (update after every milestone)
docs/SCREEN_MATRIX.md      one row per screen id (138 + added): screen · API endpoints used · states (loading/empty/error) · EN-light shot · AR-dark shot · automated test · status
docs/DEVIATIONS.md         every place where you deliberately differ from the prototype/spec, why, screenshot
docs/KNOWN_ISSUES.md       honest list of unresolved problems (root cause, impact, workaround)
docs/TEST_REPORT.md        generated/updated after every full test run: counts, failures, durations, commands
docs/FINAL_REPORT.md       the hand-off report (see §8)
docs/API.md                generated from OpenAPI
docs/PROVIDERS.md          how to switch fake → real providers
docs/evidence/screens/     <ScreenId>_<light|dark>_<en|ar>.png   (full phone-frame screenshots)
docs/evidence/flows/       <flow-name>/NN-step.png  (E2E flow storyboards)
docs/evidence/scripts/     console transcripts of the five .bat tools (S1–S10)
docs/evidence/test-output/ raw outputs: dotnet test (trx/console), vitest, playwright report, mock-scan, authz-matrix
logs/                      server + script logs produced by real runs (keep samples in evidence too)
```

## 2. Test pyramid (all must exist and pass)
1. **Unit** (`FixNGo.Domain.Tests`, `FixNGo.Application.Tests`): state machines (every legal/illegal transition for ServiceRequest, Offer, Booking, WorkOrder, Withdrawal, KYC), pricing formulas (tow/mechanic/surge/rounding), matching/ranking/radius expansion, P0 parallel-offer logic, wallet ledger invariants, rating aggregation, slot generation + double-booking, IBAN mod-97, Luhn, password policy, OTP rules (TTL/attempts/cooldown), idempotency key handling, plate normalisation, code sequences (concurrency test with parallel tasks).
2. **API integration** (`FixNGo.Api.Tests`, `WebApplicationFactory` + temp SQLite): every endpoint happy path + validation errors + authorisation. Includes:
   - **Authorisation matrix**: iterate all controller actions via reflection/OpenAPI × {anonymous, each role, another user of same role} → assert expected status; output a table to `docs/evidence/test-output/authz-matrix.md`.
   - Full business flows through the API: tow request normal + P0; mechanic request with quote/approval/dispute; cash and card payments (success, declined, retry, idempotent replay); booking lifecycle (accept/reject/start/complete/cancel/reschedule/expiry); KYC approve/reject/changes → resubmit; suspension effects; support ticket round trip; withdrawal lifecycle; account deletion blockers; chat over SignalR (two clients); offer race (two providers accept simultaneously → exactly one wins).
   - Data-privacy test: provider payload before accept contains no phone/plate/exact coordinates.
   - Simulator endpoints return 404 when `Simulators:Enabled=false`.
3. **Script tests** (`tools/script-tests.ps1`, scenarios S1–S10 in `04_SCRIPTS_SPEC.md`) executed against temp data dirs/ports; save transcripts to `docs/evidence/scripts/`.
4. **Client unit/component tests** (Vitest + Testing Library): format helpers (AR/EN digits), nav store (history/back/fallback/NotFound), OtpBoxes, forms validation, StatusBadge mapping, API client (refresh-on-401, offline queue, idempotency).
5. **End-to-end** (`e2e/`, Playwright, Chromium, headless; install with `npx playwright install chromium`): run against a real server started on a temp data dir with an admin created by non-interactive setup. Use **multiple browser contexts** for multi-user flows. Flows (each stores a storyboard screenshot per step):
   1. First-run → admin login → empty dashboards (no mock numbers; zero states look right).
   2. Sign-up per role with OTP read from the OTP panel/API; provider KYC upload → admin approves (also: reject → resubmit → approve).
   3. Owner adds vehicle → tow request (normal): select captain → captain accepts → drive simulation → arrived → estimate approve → loaded/transit/handover → cash confirm → invoice → rating.
   4. P0 accident request → 3 parallel offers → first accept wins.
   5. Mechanic request: diagnosis quote → customer approves → complete → card payment (success) ; second run with declined card then retry with cash.
   6. Estimate dispute → admin payment review → adjusted amount → re-approval.
   7. Service center: catalog CRUD, working hours, customer books, center accepts → start → complete → invoice → customer rates visit; reject path; reschedule; cancel.
   8. Chat both directions + location share; read-only after completion.
   9. Admin: verification queue, user suspend/restore (suspended user is blocked), pricing change (new request uses new price, old unchanged), safety report, reports page, audit log, 2FA enrol + login with TOTP, session revoke.
   10. Settings: language/theme persistence across reload and re-login; notification prefs; change password; logout; delete-account blockers.
   11. Weak network (simulated offline): create request offline → replay on reconnect → exactly one request.
   12. `dummy-db` mode: log in with credentials taken from `dummy-db.md`; dashboards show non-zero consistent numbers; DUMMY ribbon visible.
6. **Screen sweep** (`e2e/screens.spec.js`): programmatically open **every screen id** for a user of the right role with real data (seed via API/dummy mode), in **4 variants** (light-EN, dark-EN, light-AR, dark-AR) → screenshot → assert: no console errors, no failed network calls (≥400 except expected), no `undefined`/`NaN`/`[object Object]`/`null` text, no horizontal overflow (`scrollWidth ≤ clientWidth`), no forbidden mock strings (see 06 §6), page has meaningful content. Save to `docs/evidence/screens/`.
7. **Mock scan** (`tools/mock-scan.ps1`): greps `client/src`, `src/**`, built `wwwroot`, and the rendered DOM text dump on a fresh DB for the forbidden strings; **fails the build if any hit**. Also scans for `TODO`, `FIXME`, `lorem`, `placeholder data`, `fake` in non-simulator production code paths.
8. **Non-functional checks**: p95 latency for key endpoints under a small load script (e.g. 50 concurrent users for 30 s on request creation + provider list) logged to `docs/evidence/test-output/perf.md` (targets from SRS: first offer ≤ 5 s, provider list ≤ 10 s); security checks (security headers, lockout, rate limit, upload rejection of `.exe`/oversized/wrong-magic files, private file access denied to other users); accessibility smoke (axe-core via Playwright on 10 key screens).

## 3. Looking at screenshots (important)
You must **open and inspect** the screenshots you produce (use your image-viewing ability if the model supports it). If your model cannot view images, rely on the automated assertions above **and say so explicitly in `docs/FINAL_REPORT.md`** so the reviewer knows which screenshots were not visually inspected by you. Never claim a visual check you did not do. Compare key screens against the design images in `reference/design-images/`.

## 4. Gates (a phase is "done" only when its gate passes — see 00_MASTER_PROMPT §5)
After each gate: update `docs/PROGRESS.md`, append to `docs/AGENT_LOG.md`, regenerate `docs/TEST_REPORT.md`, `git commit`.

## 5. Failure handling
- Reproduce → find root cause → fix → re-run the **whole** relevant suite (not just the one test). Log the cause in `AGENT_LOG.md`.
- Don't weaken/skip/delete a failing test to get green. If a test is wrong, fix it and say why in the log. Flaky tests must be fixed (no sleeps > 1 s without a condition wait).
- If something is truly blocked after 3 genuinely different approaches, write it to `KNOWN_ISSUES.md` (symptom, attempts, suspected cause), keep going with the rest, and list it prominently in the final report.

## 6. Logging requirements in the product itself
Serilog structured logs with correlation id per request; log levels sane (Information for business events: request created/accepted/completed, payment results, admin decisions; Warning for rejected transitions/auth failures; Error with stack for exceptions); **never log**: passwords, OTP codes (log "OTP sent to u***@…" only), tokens, card data, full IBAN. Rolling daily files, retain 14 days. A `logs/` sample from a real E2E run must be saved into `docs/evidence/`.

## 7. Reproducibility
Provide `tools/verify-all.ps1` that, from a clean checkout, does: restore + build (Release) → unit + API tests → client tests → build client → script tests → start server on temp dir → Playwright (flows + screen sweep) → mock-scan → writes `docs/TEST_REPORT.md` → exit code 0 only if everything passed. The reviewer will run this one command.

## 8. `docs/FINAL_REPORT.md` template
1. Summary (what was built, versions) · 2. How to run (the five bats + prerequisites) · 3. Phase-by-phase results with evidence links · 4. Requirement coverage table (FR-01..FR-45, NFR-01..NFR-18, UC-01..UC-32, 138+ screens → implemented/partial/not, evidence) · 5. Deviations · 6. Known issues · 7. Test results (counts and commands) · 8. Security notes · 9. How to switch fake providers to real · 10. Honest limitations (including anything not visually verified) · 11. Reviewer checklist (the commands to re-verify).
