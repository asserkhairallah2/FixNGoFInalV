# Script tests (S1–S10)

This document describes the automated tests for the five FixNGo `.bat` tools. It is the companion to `docs/agent-brief/04_SCRIPTS_SPEC.md` and `docs/agent-brief/07_TEST_QA_AND_EVIDENCE.md`.

## Entry points

| Command | Purpose |
|---|---|
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests\scripts\run-all.ps1` | Run S1–S10 in order and write `docs/evidence/test-output/script-tests.txt`. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File tools\verify-all.ps1` | Run **all** gates (build, unit tests, npm test/build, mock scan, S1–S10, optional Playwright E2E) and write `docs/evidence/test-output/verify-all.txt`. Add `-SkipE2E` to skip the E2E step deliberately. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests\scripts\S4.ps1` | Run a single scenario while debugging. |

Both runners are Windows PowerShell 5.1 compatible: no `&&`, no pwsh-only syntax, no long `Start-Sleep` (only short health-check polling), and explicit process timeouts.

## Isolation and safety

* Every scenario creates a fresh temporary `FIXNGO_DATA_DIR` and `FIXNGO_LOG_DIR` and picks a free private HTTP port (5200–5950).
* The real project `data\` folder is **never** used as a test target. S10 explicitly snapshots and compares its file list and `data\fixngo.db` hash.
* Batch scripts are invoked non-interactively with `--yes` / `--no-pause` / `--non-interactive`. Typed confirmation is supplied from a temporary stdin file in S7.
* `dummy-db.md` is generated at the project root by design; `run-all.ps1` deletes any test-generated copy at the end.
* Process timeouts: each batch invocation is capped at 180 s; HTTP health waits at 75 s; `verify-all.ps1` gives the whole script suite 2400 s.

## Scenarios

| ID | Tool(s) | Observable behaviour asserted |
|---|---|---|
| S1 | `start.bat` on empty data dir | `check-setup` 10 → first-run setup → `/health` 200 → `check-setup` 0 → exactly 1 admin; `server.port`/`server.pid` and script logs in the temp dirs. |
| S2 | `setup.bat` when already set up | Exit 2, clear refusal message, DB hash and user count unchanged. |
| S3 | API admin login | Correct setup credentials → HTTP 200 with role `Admin` and a token; wrong password → HTTP 401; Serilog server log in temp log dir. |
| S4 | `dummy-db.bat` | Verified `backups\real-*` with manifest (SHA-256, uploads count, user count, `hadRealData`, version); ≥200 users; `dummy-db.md` lists every user + password; **every listed credential logs in**; `/api/v1/system/status` reports `mode=dummy`. |
| S5 | `dummy-db.bat` twice | Second run exit 2 with `Already in dummy mode` guidance; DB, user count and backup count unchanged. |
| S6 | `restore-db.bat` | DB SHA-256 byte-identical to pre-dummy DB; original user count; `dummy-db.md` removed; used backup moved to `backups\archive\restored-*`; original admin logs in; status mode `real`. |
| S7 | `remove-db.bat` (typed) | Wrong word → exit 1 and no changes; `RESET` → exit 0, `pre-reset-*` safety snapshot with DB+manifest, `check-setup` 10, real data folder preserved; `start.bat` re-triggers setup. |
| S8 | `remove-db.bat` in dummy mode | Refused with exit 2 and restore guidance unless `--force-dummy`; real-data backup bytes preserved in both cases. |
| S9 | `dummy-db.bat` with `FIXNGO_DUMMY_FAIL=1` | Injected post-backup failure → exit 3, clear failure + automatic rollback, DB byte-identical to original, mode still `real`, no `dummy-db.md`, backup archived. |
| S10 | All five tools, spaced paths / other cwd | All tools work from a different cwd whose path contains spaces; spaced data dir honoured; real project `data\` file list and DB hash unchanged. |

S4 deliberately uses `Active`, `PendingVerification` and `DeletionRequested` dummy accounts. `Suspended` accounts are not generated because the API correctly refuses them at login; the “every listed credential logs in” assertion therefore stays truthful. This is documented in `docs/KNOWN_ISSUES.md`.

## Exit codes used by the tools

| Code | Meaning |
|---:|---|
| 0 | Success |
| 1 | Aborted by user / refused confirmation |
| 2 | Precondition failed / already in requested state |
| 3 | Runtime failure |

## Evidence layout

```
docs/evidence/
├── script-tests/
│   ├── S1-start-first-run.txt
│   ├── S2-setup-already-set-up.txt
│   ├── S3-admin-login.txt
│   ├── S4-dummy-db.txt
│   ├── S5-dummy-twice.txt
│   ├── S6-restore-db.txt
│   ├── S7-remove-db-typed.txt
│   ├── S8-remove-dummy-mode.txt
│   ├── S9-dummy-failure-rollback.txt
│   └── S10-paths-with-spaces.txt
└── test-output/
    ├── script-tests.txt       # full S1–S10 console output + summary table
    └── verify-all.txt         # full verify-all output + step summary table
```

## Latest results (2026-11-19 20:23 UTC)

`tests\scripts\run-all.ps1`: **10/10 scenarios passed, 152 assertions passed, 0 failed.**

| Scenario | Result | Assertions (pass/fail) |
|---|---|---:|
| S1 | PASS | 13 / 0 |
| S2 | PASS | 9 / 0 |
| S3 | PASS | 7 / 0 |
| S4 | PASS | 22 / 0 |
| S5 | PASS | 10 / 0 |
| S6 | PASS | 15 / 0 |
| S7 | PASS | 20 / 0 |
| S8 | PASS | 19 / 0 |
| S9 | PASS | 14 / 0 |
| S10 | PASS | 23 / 0 |

`tools\verify-all.ps1`: **7/7 steps passed, 0 failed, 0 skipped.** Release build, Release unit tests, client `npm test`, client `npm run build`, `mock-scan.ps1`, S1–S10, and Playwright E2E (25 tests) all passed.

Full transcripts: `docs/evidence/test-output/script-tests.txt`, `docs/evidence/test-output/verify-all.txt`, and the ten per-scenario files under `docs/evidence/script-tests/`.
