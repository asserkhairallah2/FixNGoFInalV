# 04 — The five `.bat` tools (exact behaviour)

All five live in the **project root**. Each `.bat` is a thin wrapper (`@echo off`, `chcp 65001`, `cd /d "%~dp0"`, `setlocal`) that calls the built CLI (`app\FixNGo.Cli.exe` / `dotnet app\FixNGo.Cli.dll`) or PowerShell helpers in `tools\`. Business logic lives in **C# (`FixNGo.Cli` + Infrastructure services)**, not in batch syntax, so it can be unit/integration tested.

Common requirements for every script:
- Works when the path contains spaces; works when double-clicked **and** from a terminal; returns meaningful exit codes (0 ok, 1 user abort, 2 precondition failed, 3 failure); never leaves the system half-changed (do the risky step last, verify, roll back on error).
- Writes a timestamped log to `logs\scripts\<script>-<yyyyMMdd-HHmmss>.log` (no passwords). Prints clear English messages with `[OK]`, `[WARN]`, `[ERR]` prefixes. Ends with `pause` **only when launched by double-click** (detect via `%cmdcmdline%` containing `/c`) and when not given `--no-pause`.
- Every script supports `--non-interactive` (+ `--yes`) for automated tests; secrets for non-interactive runs come from **environment variables** (never command-line args).
- If the build output (`app\`) is missing or older than the sources, run `tools\build.ps1` first (publishes Web + Cli to `app\`, builds the client into `wwwroot`). Build failures stop the script with a readable error.
- Respect `FIXNGO_DATA_DIR`, `FIXNGO_LOG_DIR`, `FIXNGO_PORT` (tests use temp dirs and random ports so they never touch the user's real data).
- Stop-server helper (shared, in CLI): read `data\server.pid`, ask the server to stop (`taskkill /PID <pid> /T`), wait ≤10 s, then force (`/F`); also verify the DB file is no longer locked (retry open exclusive for ≤10 s) before any file swap.

---
## 1. `start.bat` — run the system
1. Build if needed (see above).
2. If a server is already running (valid `data\server.pid` + `/health` answers) → just open the browser to it and exit.
3. Run `FixNGo.Cli check-setup`. If it reports **no accounts / no DB (first run)** → print "No accounts found. Starting first-time setup…" and `call setup.bat` (which launches `start.bat` again after success) then `exit /b`. Guard against loops: pass `--from-start` to setup; if setup is cancelled/fails, stop with a message.
4. Choose the port: `FIXNGO_PORT` or 5080, else the next free one up to 5099; write `data\server.port`.
5. Start `FixNGo.Web` (Kestrel, `ASPNETCORE_URLS=http://localhost:<port>`, `ASPNETCORE_ENVIRONMENT=Production`) in this console window, with Serilog output; write `data\server.pid`.
6. Poll `/health` (≤60 s). On success open the default browser at `http://localhost:<port>/` (skip with `--no-browser`). Print the URL, mode (real/dummy), simulators on/off, log file path, "Press Ctrl+C to stop".
7. On exit/Ctrl+C remove `server.pid` (use a `try/finally` in the CLI launcher or a small PowerShell wrapper).
The browser UI must show a visible **"DUMMY DATA MODE"** ribbon when `mode=dummy`.

## 2. `setup.bat` — create the first admin
1. Build if needed. Run `FixNGo.Cli check-setup`; if the system is **already set up** → `[WARN] System already has accounts. Use remove-db.bat to reset.` exit code 2.
2. Create the data folders, generate `secrets.json`, create/migrate the SQLite DB (apply EF migrations + seed reference data only).
3. **Interactive console wizard** (English, one question at a time, re-ask on invalid input, `Ctrl+C`/empty cancel = abort with nothing written):
   - Admin full name (≥ 2 chars)
   - Admin email (valid format, normalised lower-case)
   - Admin phone (Egyptian mobile: `01[0125]xxxxxxxx` or `+201…`; normalise to `+20…`)
   - Password (hidden input, shows `*`; policy ≥8, upper, lower, digit, symbol) + confirm (must match)
   - Optional platform basics with sensible defaults shown in brackets (press Enter to accept): platform support email, emergency numbers (ambulance [123], police [122]), enable simulators [Y/n].
   - Review screen (password masked) → "Create this administrator? [Y/n]".
4. Create the Admin user (`Role=Admin`, `Status=Active`, `EmailVerified=true`, 2FA off, `Super Admin`), write `state.json` (`mode=real`, `setupCompletedAt`), write the settings chosen. Verify by reading the account back; print `[OK] Administrator created: <email>`.
5. Close the visible setup window and start the system: launch `start.bat` in a **new window** (`start "FixNGo" "%~dp0start.bat" --after-setup`) then `exit` (so the setup console closes and the server console opens). In non-interactive mode do not launch; just exit 0.
6. Non-interactive variables: `FIXNGO_SETUP_NAME`, `FIXNGO_SETUP_EMAIL`, `FIXNGO_SETUP_PHONE`, `FIXNGO_SETUP_PASSWORD`, optional `FIXNGO_SETUP_SIMULATORS`.
Interactive input can also be piped from a file for tests (when `Console.IsInputRedirected`, read lines instead of `ReadKey`).

## 3. `remove-db.bat` — reset to "first run"
Purpose: wipe everything so the system behaves as if it had never run.
1. Show exactly what will be deleted (DB, uploads, secrets, state, dummy-db.md, current logs optional) and require the user to **type `RESET`** (skip only with `--yes`).
2. If `state.mode = dummy` → refuse with guidance ("restore-db.bat first, your real data backup is stored in <dir>") unless `--force-dummy`; a forced reset from dummy mode also deletes the orphaned dummy state but **keeps** `data\backups\real-*`.
3. Stop the server (shared helper). Before deleting, make an **automatic safety snapshot** `data\backups\pre-reset-<timestamp>\` (consistent DB copy via `VACUUM INTO` + uploads zip; keep only the newest 3 snapshots) — this is not part of the live system, so the live system is truly empty.
4. Delete `data\fixngo.db`, `-wal`, `-shm`, `data\uploads\*`, `data\secrets.json`, `data\state.json`, `data\server.pid`, `data\server.port`, `dummy-db.md`. Keep `data\backups\`.
5. Verify `check-setup` now reports **first run** and print `[OK] System reset. Run start.bat to begin first-time setup.`

## 4. `dummy-db.bat` — switch to a realistic dummy database
Purpose: a safe sandbox that looks like the system has been used for a month.
1. Preconditions: not already in dummy mode (else: "Already in dummy mode — run restore-db.bat to go back" exit 2). Confirm with the user (`y/N`) that the current data will be set aside and can be restored.
2. Remember whether the server was running; stop it (shared helper).
3. **Backup real data first:** create `data\backups\real-<timestamp>\` containing a consistent copy of the DB (`VACUUM INTO`), the `uploads\` folder, and `manifest.json` `{createdAt, dbSha256, uploadsFileCount, userCount, hadRealData, appVersion}`. Re-open the copy and verify it (integrity_check + user count equals manifest). **If verification fails → abort and change nothing.**
4. Replace the live DB with a **fresh DB** (migrated + reference seed) and generate dummy data (see §4a). Replace `uploads\` with generated placeholder files. Keep `secrets.json` unchanged. Set `state.json` → `mode=dummy`, `dummy.backupDir`, `dummy.since`.
5. Generate **`dummy-db.md`** in the project root (see §4b).
6. If the server had been running, start it again (new window) and open the browser; otherwise print how to start. Print the admin dummy login and the path to `dummy-db.md`.
7. Whole operation is transactional: if dummy generation fails at any point → restore the real DB/uploads/state from the backup automatically and exit 3.

### 4a. What the dummy generator must produce (deterministic seed, relative to "now", covering the last 30 days)
Volumes (configurable constants, defaults): 2 admins · 120 car owners · 40 mechanics · 25 tow captains · 14 service centers · 1–3 vehicles per owner · ~650 service requests (≈70 % completed, 10 % cancelled, 5 % NoProviders, a handful active right now in different statuses incl. one `Disputed`) · ~350 bookings across all booking states · work orders · invoices · payments (cash/card/Apple Pay, a few failed) · payment reviews (some pending/resolved) · reviews/ratings (consistent averages) · chat threads/messages for recent requests · notifications (read/unread) · support tickets (open/answered/closed) with messages · safety reports (open/escalated/closed) · provider wallets with ledger entries, bank accounts, withdrawals in every state · **KYC queue with ≈14 pending/changes-needed/rejected applications** · account states (some Suspended, some PendingVerification, one DeletionRequested) · audit log entries for admin actions · sessions for a few users.
Quality rules: realistic Egyptian names (Arabic + transliterated English mix), emails `firstname.lastname<NN>@dummy.fixngo.test`, phones `+2010/11/12/15xxxxxxxx`, real Cairo/Giza/Alexandria areas with plausible coordinates, plates in valid format, timestamps spread over 30 days with business-hours weighting; **internally consistent** (wallet balance = Σ ledger; rating averages = Σ reviews; invoice totals = request totals; status timelines monotonic; no provider with two active jobs; counts shown on dashboards equal DB counts). Use fixed RNG seed so reruns are reproducible. Hash passwords with the real hasher. Insert in bulk transactions (the whole run should take < 60 s).
Passwords: unique, policy-compliant, human-readable per user, e.g. `Owner@0001`, `Mech@0001`, `Tow@0001`, `Center@0001`, `Admin@0001`.

### 4b. `dummy-db.md` (root, regenerated on each dummy run, deleted by restore-db)
Header: generated time, seed, mode warning ("DUMMY DATA — NOT REAL — run restore-db.bat to return to your real data"), counts summary table (users by role/status, requests by status, bookings by status, payments, reviews…).
Then **one Markdown table per role** (Admins, Car owners, Mechanics, Tow captains, Service centers) with columns: `#`, `Name`, `Email`, `Phone`, `Role`, `Account status`, `KYC status` (providers), `Password`, `Notes` (e.g. "has an active request", "suspended", "pending verification", "wallet 2,350 EGP"). Include **every** dummy user (no truncation), plus a "Suggested test scenarios" list (which user to log in as to see an active tow, a pending KYC application, a disputed estimate, a suspended account, etc.).

## 5. `restore-db.bat` — undo `dummy-db.bat`
1. Precondition: `state.mode = dummy` and the backup dir exists and passes verification (`manifest.json` hash + integrity check). Otherwise: explain and exit 2 (never delete anything in that case).
2. Warn that anything created while in dummy mode will be discarded; confirm (`y/N`).
3. Stop the server (remember if it was running).
4. Verify the backup again; swap: delete the dummy DB + dummy `uploads\`, restore the real DB + uploads from the backup, set `state.json` back to `mode=real` (or, if `hadRealData=false`, to the first-run state).
5. Delete `dummy-db.md`. Move the used backup to `data\backups\archive\restored-<timestamp>\` (never delete it).
6. Verify: DB hash equals `manifest.dbSha256` (after restore the file must be byte-identical to the original backup copy), user count equals manifest. Print `[OK] Real data restored (N users).` Restart the server if it had been running.
7. If restore fails mid-way: keep both the backup and whatever dummy state exists, print exact manual-recovery steps, exit 3.

---
## 6. CLI command contract (used by the bats and by tests)
```
FixNGo.Cli check-setup [--json]                 exit 0 = set up, 10 = first run
FixNGo.Cli setup [--non-interactive]
FixNGo.Cli db-status [--json]                   mode, db path, sizes, user/request counts, backup info
FixNGo.Cli db-reset [--yes] [--force-dummy]
FixNGo.Cli db-dummy [--yes] [--seed N]
FixNGo.Cli db-restore [--yes]
FixNGo.Cli stop-server
FixNGo.Cli selftest                             prints versions, paths, DB connectivity (used by tools/script-tests.ps1)
```
All commands print machine-readable `--json` when asked. Add unit/integration tests for each command against a temp `FIXNGO_DATA_DIR`.

## 7. Scenario table the script tests must pass (automate in `tools/script-tests.ps1`)
| # | Scenario | Expected |
|---|---|---|
| S1 | `start.bat` on an empty data dir | detects first run → launches setup (non-interactive in test) → server healthy → exactly 1 user (the admin) |
| S2 | `setup.bat` when already set up | refuses, exit 2, no changes |
| S3 | Admin login via API with the setup credentials | 200, role Admin; wrong password 401 |
| S4 | `dummy-db.bat` | backup folder + manifest verified; DB has ≥ 200 users; `dummy-db.md` lists **every** user with a password; **every listed credential logs in successfully** (sample ≥ 25 incl. each role) ; mode=dummy ribbon in `/system/status` |
| S5 | `dummy-db.bat` twice | second run refused |
| S6 | `restore-db.bat` | DB byte-identical (sha256) to pre-dummy DB; users == original; `dummy-db.md` gone; original admin logs in; backup archived |
| S7 | `remove-db.bat` (typed confirmation) | data folder in first-run state; safety snapshot exists; `check-setup` = 10; `start.bat` triggers setup again |
| S8 | `remove-db.bat` while in dummy mode | refused unless `--force-dummy`; real backup preserved |
| S9 | Dummy generation failure injection (simulate exception) | automatic rollback to the real DB, exit 3 |
| S10 | Paths with spaces / run from another cwd | all scripts still work |
