# 08 — Templates for the tracking files (create these in `docs/` during Phase 0)

## docs/PROGRESS.md
```markdown
# Progress
## RESUME HERE
Phase: 0 · Task: … · Last command: … · Next command: …

## Gate summaries (newest first)
(5 lines per gate: what passed, test counts, evidence links)

## Plan & risks
- Plan: …
- Risks: (SQLite concurrency for offer race, OTP/time handling, dummy data consistency, BAT quoting, Playwright flakiness, …) → mitigation

## Checklist
### Phase 0 Bootstrap
- [ ] layout verified (legacy-prototype, reference, docs/agent-brief)  - [ ] git init + baseline commit
### Phase 1 Foundation
- [ ] solution + projects  - [ ] DB + migrations + seed  - [ ] auth + RBAC  - [ ] CLI check-setup/setup  - [ ] setup.bat/start.bat  - [ ] Gate 1
### Phase 2 Domain & API
- [ ] vehicles  - [ ] lookups  - [ ] requests/matching/offers/P0  - [ ] quotes/disputes  - [ ] payments/invoices/wallet/withdrawals  - [ ] reviews  - [ ] chat  - [ ] notifications/outbox  - [ ] centers/bookings/work orders  - [ ] providers/KYC  - [ ] admin  - [ ] support/legal/SOS/deletion  - [ ] workers  - [ ] Gate 2
### Phase 3 Client
- [ ] shell+kit  - [ ] auth  - [ ] owner  - [ ] mechanic  - [ ] captain  - [ ] center  - [ ] admin  - [ ] shared  - [ ] gap screens  - [ ] Gate 3
### Phase 4 Simulators
- [ ] fake providers  - [ ] dock panels 1-5  - [ ] GPS drive  - [ ] Gate 4
### Phase 5 Tools
- [ ] remove-db  - [ ] dummy-db + generator + md  - [ ] restore-db  - [ ] S1–S10  - [ ] Gate 5
### Phase 6 QA
- [ ] E2E flows  - [ ] screen sweep  - [ ] a11y/security/perf  - [ ] verify-all green  - [ ] Gate 6
### Phase 7 Hand-off
- [ ] FR/NFR/UC audit  - [ ] README/STATE/AGENT  - [ ] FINAL_REPORT  - [ ] Gate 7
```

## docs/AGENT_LOG.md
```markdown
# Agent log (append only)
| Time | Phase | Action | Command / file | Result | Notes |
|---|---|---|---|---|---|
```

## docs/SCREEN_MATRIX.md
```markdown
| Screen | Name | API used | Loading | Empty | Error | EN-light | AR-dark | Automated test | Status |
|---|---|---|---|---|---|---|---|---|---|
| A01 | Splash | GET /me | ✓ | n/a | ✓ | evidence/screens/A01_light_en.png | …_dark_ar.png | e2e/screens.spec.js | done |
(… one row for each of the 138 screens plus SC17, AD16, AD17, AD18, NotFound, etc.)
```

## docs/DEVIATIONS.md
```markdown
| # | Screen/Area | Prototype/spec said | What was implemented | Why | Evidence |
|---|---|---|---|---|---|
```

## docs/KNOWN_ISSUES.md
```markdown
| # | Severity (P0–P3) | Area | Symptom | Root cause (known/suspected) | Attempts | Workaround |
|---|---|---|---|---|---|---|
```

## docs/TEST_REPORT.md (regenerate on every full run)
```markdown
Run: <timestamp> · Commit: <sha> · Machine: <os/dotnet/node versions>
| Suite | Command | Total | Passed | Failed | Skipped | Duration |
|---|---|---|---|---|---|---|
Failures (if any): …   Evidence: docs/evidence/test-output/…
```
