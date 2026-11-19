# 03 — Architecture, data model, rules and API conventions

## 1. Stack (decided — do not re-debate)

| Concern | Decision |
|---|---|
| Runtime | .NET 8 (SDK 8.0.428 is installed at `%LOCALAPPDATA%\dotnet`), C# 12 |
| Web | ASP.NET Core 8 — controllers under `/api/v1`, SignalR hub, serves the built React SPA from `wwwroot` (same origin, no CORS needed) |
| Data | EF Core 8 **Code-First**, **SQLite** file DB (`data/fixngo.db`). Provider is configurable so SQL Server can be added later (SRS names SQL Server for production) but SQLite is the default because the `.bat` DB swapping tools operate on a file. |
| Real-time | SignalR (chat, tracking, offers, status, notifications) |
| Validation / mapping | FluentValidation 11.x, AutoMapper **12.0.1** (+ `AutoMapper.Extensions.Microsoft.DependencyInjection` 12.0.1 — newer AutoMapper versions are commercially licensed) |
| Auth | JWT access token (15 min) + rotating refresh token (30 days, stored hashed in DB, per session/device); ASP.NET `PasswordHasher<T>` (PBKDF2) used standalone (no full Identity UI); TOTP via `Otp.NET` for admins |
| Logging | Serilog → console + rolling files in `logs/` (`server-.log`), request logging, **no passwords/OTPs/tokens/card data in logs**; audit log in DB |
| API docs | Swashbuckle/OpenAPI at `/swagger` (enabled when `Simulators:Enabled` or Development) |
| Tests | xUnit, FluentAssertions **6.12.2** (v7+ is commercial), `Microsoft.AspNetCore.Mvc.Testing`, Playwright (Node) for E2E |
| Client | React 18 + Vite + Tailwind CSS 3.4 + `lucide-react` + `@microsoft/signalr` + `@tanstack/react-query` + `qrcode` (see `06_FRONTEND_MIGRATION.md`) |

## 2. Solution layout (create exactly this)

```
FixNGoFinal/                         (project root = C:\Users\xprenspel\Desktop\FixNGoFinal)
  FixNGo.sln
  Directory.Build.props              (nullable enable, warnings as errors for src, LangVersion 12)
  src/
    FixNGo.Domain/                   entities, enums, value objects, domain exceptions, state machines (NO package refs)
    FixNGo.Application/              use cases/services, DTOs, interfaces (IAppDbContext, IClock, IOtpSender, IPaymentGateway, IGeocoder, IRouting, INotifier, IFileStore…), validators, mapping profiles
    FixNGo.Infrastructure/           AppDbContext, IEntityTypeConfiguration<T> per entity, migrations, repositories/services impl, fake providers, file store, background workers, dummy-data generator
    FixNGo.Web/                      controllers, SignalR hub, middlewares, auth setup, Program.cs, wwwroot (built client), appsettings
    FixNGo.Cli/                      console tool used by the .bat files: setup, check-setup, db-status, db-reset, db-dummy, db-restore, selftest
  tests/
    FixNGo.Domain.Tests/  FixNGo.Application.Tests/  FixNGo.Api.Tests/ (integration)
  client/                            Vite React app (migrated prototype)
  e2e/                               Playwright project (screenshots + flows)
  legacy-prototype/                  (ALREADY PRESENT) ORIGINAL prototype files, untouched (01..07*.js, fixngo_complete_interactive_app.js, run_localhost.bat) — reference only, never edited
  reference/                         (ALREADY PRESENT) SRS + SDD markdown, design-images/, extra-images/ — read-only
  AGENT.md  STATE.md                 (ALREADY PRESENT; STATE.md to be rewritten at the end)
  tools/                             PowerShell helpers used by the bats and tests (build.ps1, e2e-run.ps1, mock-scan.ps1, script-tests.ps1…)
  data/        (runtime, git-ignored)   fixngo.db, uploads/, backups/, state.json, secrets.json, server.pid
  logs/        (runtime, git-ignored)   server-*.log, scripts/*.log, setup-*.log
  docs/                              agent-brief/ (ALREADY PRESENT: this brief), AGENT_LOG.md, PROGRESS.md, SCREEN_MATRIX.md, DEVIATIONS.md, KNOWN_ISSUES.md, TEST_REPORT.md, FINAL_REPORT.md, API.md, evidence/ (screenshots, test outputs)
  setup.bat  start.bat  remove-db.bat  dummy-db.bat  restore-db.bat      (+ dummy-db.md generated)
```

Dependency rules (from `AGENT.md`, keep): Domain references nothing; Application references Domain only (it may use `Microsoft.EntityFrameworkCore` abstractions solely for `IAppDbContext`/`DbSet<T>` — STATE.md ADR #2); Infrastructure references Application+Domain; Web/Cli reference Application+Infrastructure. Controllers never touch `DbContext` directly — they call application services. **Never return entities from controllers; always DTOs.** One `IEntityTypeConfiguration<T>` class per entity (no data-annotation relationships). `DeleteBehavior.Restrict` on important relations. Scoped lifetimes for DbContext/services.

## 3. SQLite rules (avoid known EF Core + SQLite traps)
- Money: store as **integer minor units** (`long` piasters, `AmountMinor`) — SQLite cannot `SUM`/`ORDER BY` `decimal`. DTOs expose decimal EGP.
- Dates: store UTC `DateTime` (Kind=UTC via value converter), not `DateTimeOffset`. Display timezone `Africa/Cairo` on the client.
- Enums stored as **strings**. Ids: `Guid` internal PK + human `Code` (e.g. `FG-2606`) unique index. Use a `Sequence` table with atomic increment (transaction) for codes (`FG-`, `MR-`, `BK-`, `WO-`, `KYC-`, `SR-`, `SUP-`, `WD-yyMM-`, `INV-yyyy-`, `INV-SC-`).
- On every connection: `PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;`. No spatial index: nearby-provider search = bounding-box filter in SQL then Haversine in memory.
- Concurrency: row version/`ConcurrencyToken` on `ServiceRequest`, `Offer`, `Booking`, `Wallet`; "first accept wins" must be enforced by a conditional update inside a transaction.
- Backup/restore must use `VACUUM INTO` or the SQLite backup API after `PRAGMA wal_checkpoint(TRUNCATE)`, never a raw copy while the server runs; always `SqliteConnection.ClearAllPools()` before touching the file.

## 4. Runtime paths & configuration
- Data root: `FIXNGO_DATA_DIR` env var, default `<root>\data`. Logs root `FIXNGO_LOG_DIR`, default `<root>\logs`. Port: `FIXNGO_PORT`, default **5080** (start.bat picks the next free port if busy and writes it to `data/server.port`).
- `data/state.json` (written by the CLI only): `{ "schemaVersion":1, "mode":"real"|"dummy", "setupCompletedAt":"…", "dummy": { "since":"…", "backupDir":"…", "generatedUsers":N } }`.
- `data/secrets.json` (generated at setup, never in git): `{ "jwtSigningKey":"<64 random bytes b64>" }`. Created with restricted ACL where possible.
- `appsettings.json` holds non-secret defaults: `Simulators:Enabled` (true), `Providers:Otp|Payments|Maps|Push` = `"Fake"` (switchable to `"Real"` later), `Features:GoogleLogin` false, `Auth:*` TTLs.
- "System is set up" ⇔ at least one `User` with role `Admin` exists. "First run" ⇔ zero users (or no DB file).

## 5. Roles, statuses, authorisation
- Roles: `CarOwner`, `Mechanic`, `TowCaptain`, `ServiceCenter`, `Admin`.
- `UserStatus`: `PendingVerification` (email OTP not yet verified) · `Active` · `Suspended` · `DeletionRequested` · `Deleted`.
- Provider approval (separate): `KycStatus` = `None | Submitted | UnderReview | ChangesNeeded | Approved | Rejected`. Only `Approved` providers can go online / receive requests / be booked (FR-05, NFR-10).
- Policy-based RBAC + **resource-based checks** (owner sees only own vehicles/requests/bookings/invoices; provider only requests offered to / assigned to them; center only its own bookings/work orders/catalog; admin all). Provide an **authorisation matrix test** (every endpoint × every role → expected 200/401/403/404).
- Security: lockout after 5 failed logins/15 min; rate limits on `/auth/*` and OTP (e.g. 5/min/IP+identity); refresh token rotation with reuse detection; security headers; upload validation (extension + MIME + magic bytes, ≤10 MB, random file names, files stored under `data/uploads`, **served only via authorised endpoints**); `Idempotency-Key` header supported on `POST /requests`, payments, withdrawals, bookings; input length limits; ProblemDetails errors.

## 6. Core domain rules

### 6.1 ServiceRequest (tow + mechanic roadside)
`Kind`: `Tow` (code `FG-####`) | `Mechanic` (code `MR-####`, includes battery/tire/fuel/other). `Priority`: `Normal | P0` (accident with injury).
Status flow (unified; every change writes a `RequestEvent{status, at, actorId}` and notifies):
```
Searching → Offered → Accepted → EnRoute → Arrived → QuotePending → QuoteApproved → Working → AwaitingPayment → Completed
Searching|Offered → NoProviders        any non-terminal → Cancelled        QuotePending → Disputed → QuotePending
```
Customer-facing "7 steps": Requested(1) Matched(2) En route(3) Arrived(4) Working(5) Payment(6) Completed(7). Progress = step/7.
Illegal transitions → 409 with the allowed next steps (UC-23 *b). Provider can only move their own assigned request.
Tow (captain) detail: Accepted → EnRoute → Arrived (at customer) → [customer approves estimate] → loaded → Working (in transit) → arrived at destination → AwaitingPayment (handover + cash) → Completed.
Mechanic detail: … Arrived → diagnosis → `QuotePending` → customer approves → `Working` → complete → `AwaitingPayment` → `Completed`.

### 6.2 Matching & dispatch
- Candidates: providers with `KycStatus=Approved`, `Status=Active`, `IsOnline=true`, no active job, matching kind/type, last heartbeat < 2 min, within radius (default 5 km; "expand" → 10 km, then 20 km).
- Distance via `IRoutingService` (fake: Haversine × 1.3 circuity; ETA = distance / 30 km/h + 2 min; **timeout fallback**: external call capped at 2 s then straight-line estimate marked approximate).
- Ranking: score = 0.4·distance + 0.3·ETA + 0.2·(5−rating) + 0.1·price (normalised). Sort modes: Recommended / Fastest / Lowest price.
- Normal: customer selects a candidate → `Offer{expiresAt = now + OfferTimeout (30 s)}`; accept → `Accepted`; decline/timeout → customer notified + next suggestion (FR-22).
- **P0**: skip list; offers to the **top 3 in parallel**, timeout 15 s; first accept wins, others `Withdrawn`; nobody accepts → widen radius and repeat.
- `OfferExpiryWorker` (hosted service, 1 s tick) expires offers and re-dispatches; also expires stale provider heartbeats (→ offline) and expires Pending bookings after `BookingExpiryHours`.
- Data minimisation (NFR-12): before acceptance the provider sees customer **first name**, **area label**, distance/ETA, vehicle make/model/year/color, service/problem, price; **after acceptance** full name, phone, exact pickup, plate, photos.

### 6.3 Pricing (platform settings, versioned)
```
tow:       subtotal = (towBase + distanceKm × towRatePerKm) × surge ; total = subtotal + serviceFee
mechanic:  total = calloutFee + laborFee + Σparts ; (surge applies to callout) ; + serviceFee
providerNet = total − serviceFee            (platform keeps serviceFee)
```
Sample defaults seeded as **settings (not mock data)**: towBase 450, mechanicBase 150, serviceFee 50, towRatePerKm 18.30, surge 1.0, ambulance 123, police 122, searchRadius 5, offerTimeout 30, p0Timeout 15, bookingExpiryHours 24, minWithdrawal 100, withdrawalFee 0. Each request stores a **price snapshot** (settings version id + computed lines).

### 6.4 Payments, invoices, wallet
- Methods: `Cash`, `Card`, `ApplePay`. Card data never stored: only `{brand,last4,expMonth,expYear,token}`; Luhn check; CVV never persisted or logged.
- Cash: customer chooses cash (C14) → request continues → provider confirms collected amount (T14/M12) → request `Completed`, invoice issued with status `Paid(cash)`, customer shown "Confirm cash paid" (records `CustomerConfirmedAmount`); every cash payment creates a `PaymentReview(Pending)` for admin reconciliation (AD07/AD08) — mismatch between amounts flags it.
- Card/Apple Pay: charged through `IPaymentGateway` (fake: test cards `4242 4242 4242 4242` success, `4000 0000 0000 0002` declined, `4000 0000 0000 9995` insufficient funds, anything else → success if Luhn ok). Success → `Payment(Succeeded)`, invoice issued; failure → `Payment(Failed)` with reason, retry allowed, **idempotent** (never double charge).
- Invoice number `INV-YYYY-####`; center invoice `INV-SC-####`; immutable payment audit log (NFR-11: every payment transaction row is append-only).
- Wallet: on `Completed`, credit `providerNet` to the provider's `Wallet` via an append-only `WalletEntry` (type `JobEarning`); withdrawals debit (`Withdrawal`), balance = Σ entries (never a free-floating number). Withdrawal states: `Requested → Processing → Sent → Confirmed` (or `Failed` → refunded entry). Only to the default **verified** bank account in the user's name; pending payouts keep their original destination snapshot.
- Ratings: one review per request/booking; provider average & count recomputed transactionally; hidden reviews (admin) excluded.

### 6.5 Booking rules (service center)
Slots generated from working hours × service duration × bay capacity; booking holds the slot immediately (`Pending`), released on reject/cancel/expiry; unique constraint prevents double-booking; reschedule re-checks availability; completion creates `INV-SC-####` (unpaid until center confirms payment). Prices are snapshotted.

### 6.6 Notifications (catalog — implement all, bilingual EN/AR templates, deep link = screen id + entity id)
New offer (provider) · Offer withdrawn/expired · Request accepted/declined (customer) · Status changes EnRoute/Arrived/Working/Completed (customer) · Estimate ready (customer) / approved/disputed (provider) · Payment verified/failed/cash-confirmed · Rate your trip · Booking created (center) / confirmed / rejected / expired / rescheduled / cancelled (customer, center) · Work order assigned (technician/center) · KYC decision & changes needed (provider) · Account suspended/restored · Document reviewed · Withdrawal status changes · Support ticket reply · Safety report outcome (reporter) · New KYC application / payment review / safety report (admins) · Chat message (when recipient not in thread).
Delivery: row in `Notification` + SignalR push to user group + `INotifier` (fake push → recorded for the simulator panel). Preferences (SH10) respected except safety-critical.

### 6.7 Security-sensitive flows
OTP: 6 digits, hashed, TTL 2 min, ≤5 attempts, resend cooldown 30 s, ≤5 sends/hour. Password reset: OTP → short-lived single-use reset token → new password (revokes all sessions). Admin 2FA: TOTP + recovery codes. Account deletion: password re-auth, blockers, 14-day grace, anonymisation job. Session revoke kills refresh token and SignalR connections.

### 6.8 Background workers (all idempotent, log every action)
OfferExpiry (1 s) · ProviderHeartbeat reaper (30 s) · BookingExpiry (60 s) · OtpCleanup (hourly) · AccountDeletion anonymiser (hourly) · OutboxDispatcher (notifications/real-time events, 1 s) — **Outbox pattern**: domain events saved in the same transaction, dispatched after commit.

## 7. API conventions
- Base `/api/v1`, JSON camelCase, enums as strings, timestamps ISO-8601 UTC, money as `{ "amount": 650.00, "currency": "EGP" }` (or `amount` decimal), pagination `?page=1&pageSize=20` → `{ items, page, pageSize, total }`, filters as query params, errors = RFC 7807 ProblemDetails with an extra stable `code` (e.g. `auth.invalid_credentials`, `request.illegal_transition`) and `errors{field:[msg]}` for validation (400).
- Never return Arabic-Indic digits or formatted money/dates — raw values only; the client formats via `Intl` using the active language.
- Static bilingual lookups return `{ id, nameEn, nameAr }`.
- Endpoint surface = the union of endpoints implied by `02a/02b/02c` (each inventory lists them). Consolidate duplicates (e.g. one `POST /offers/{id}/accept` for both provider types) and document everything in OpenAPI → export `docs/API.md`.
- SignalR hub `/hubs/app` (auth by access token): server→client events `notification`, `offer.created|expired|withdrawn`, `request.status`, `provider.location`, `chat.message|read|presence`, `payment.status`, `withdrawal.status`, `document.reviewed`, `ticket.reply`, `session.revoked`; client→server `JoinThread`, `SendMessage`, `SendLocation`, `MarkRead`, `Typing`.
- Health: `GET /health` (200 when DB reachable), `GET /api/v1/system/status` → `{ setupComplete, mode:"real|dummy", version, simulatorsEnabled }` (used by the UI to show a **DUMMY DATA MODE** ribbon).

## 8. Seed data policy (what is allowed in the database at first run)
Allowed (system reference data, bilingual): service types, problem types, follow-up questions, cancellation/reject reasons, banks, vehicle makes/models, checklist templates, FAQ items, legal documents (template text), default platform settings, emergency numbers. **Not allowed on a first run:** any user, vehicle, request, booking, review, payment, notification, ticket, bank account, etc. The only account after `setup.bat` is the admin the user typed.
