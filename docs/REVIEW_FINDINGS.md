# REVIEW FINDINGS (independent review, 2026-11-19) — Round 2 work order

Reviewer method: ran the delivered project from a clean temp data dir (`FIXNGO_DATA_DIR`), used the real `setup.bat` / `start.bat` / `dummy-db.bat` / `restore-db.bat`, drove the real UI in a browser (admin + car-owner sessions, EN/AR, light/dark, Simulator Dock), read `client/src/app/screens.jsx`, and opened the agent's own screenshots in `docs/evidence/screenshots/`.

**Verdict: the backend foundation and the .bat/CLI tools are decent; the client and the end-to-end product are NOT done.** The previous hand-off ("143 screens wired", "design 1:1", "verify-all 7/7") is materially overstated. `verify-all` passed because the tests only check that something renders, not that the product works.

## What is genuinely OK (keep, do not rewrite)
- Solution layout, Clean Architecture, EF Core + SQLite, auth/OTP endpoints, setup wizard (non-interactive path works), `dummy-db.bat` (201 users, `dummy-db.md` written, ~9 s), `restore-db.bat` (restores real data), fake provider rows, Simulator Dock exists with 5 tabs (OTP/SMS/Email panels show real data).

## Findings (severity: B = blocker, M = major, m = minor)

### Delivery / run path
- **B1** `start.bat` serves **404 on `/`** and logs `WebRootPath was not found: ...\FixNGoFinal\wwwroot`. It launches `app\web\FixNGo.Web.dll` with the project root as content root, so the SPA in `app\web\wwwroot` is never served. The E2E suite hides this: `client/e2e/server.mjs` starts its own temp copy and explicitly does *not* use `app\web`. The five tools / start path are therefore untested by E2E.
- **B2** `app\` was **stale** (older than `src\`); `start.bat` only builds when `app\` is missing, so users run an old client that crashed after admin login (`Cannot destructure property 'isDark' ... null`). Spec required rebuild when sources are newer.
- **m** No ErrorBoundary fallback: any render error = blank page.

### Client is not a port of the prototype (biggest problem)
- **B3** `client/src/app/screens.jsx` is a ~60 KB **declarative registry** that maps all 143 screens onto ~7 generic views (`info`, `list`, `detail`, `form`, `dashboard`, `mapStatus`, `chat`). Total client ≈ 190 KB vs ≈ 540 KB of legacy screen markup. Result: layouts, cards, maps, chips, steppers, checklists, charts etc. of the approved design are gone. Many screens are literally a title + "0 Records" / "Nothing here yet" (AD06, AD13, AD14, AD16, C02 vehicle card = "1 Records", C23 profile, ...). Raw enum/keys leak to the UI (`QuoteApproved` as "QuotaApproved", `flatbed_tow`, `battery`...).
- **B4** Registration steps A08/A09/A10 are `info` placeholders ("add your experience in the provider profile"): no fields, **no document upload**, no KYC submission. SH18 "Upload document" is an `info` screen with no file picker. Providers can therefore never be approved → whole provider side unusable.
- **B5** The roadside-request wizard does not work: C06 lists problem types with raw keys; C26 "Describe your issue" just repeats the same 6 buttons (no follow-up questions, no photos, no location/GPS picker, no estimate); C27 shows "Nothing here yet"; **no `POST /requests` is ever sent**. The core product flow cannot be performed from the UI.
- **B6** After signup OTP verification (API 200) the app lands on `#/C02` "Screen not available" and the session is lost (user must log in again).
- **B7** Admin Pricing (AD05) inputs are blank and Save fails: `PUT /admin/settings` → 400 "The Pricing field is required." (payload shape mismatch). AD12 (suspend/restore) has no actions; AD13 has no 2FA setup; AD14 sessions list empty although a session is active.
- **M** Rating screen C16 is a number input, booking C19 a `datetime-local`, A07 asks the user to paste a "Reset token", fuel type is a free-text field that 409s on "Gasoline", saving a vehicle doesn't navigate back.
- **M** Dark mode: only `<html class="dark">` is set; phone interior and Simulator Dock stay light.
- **M** Simulator Dock is hidden before login, so OTP/SMS panels are unreachable on the OTP screen (A05) — the very place they are needed. Dock must show whenever `simulatorsEnabled`.
- **m** Top bar title overlaps the language/theme buttons on almost every inner screen; fixed bottom nav covers the primary button on long forms (C05); guest/provider screens show the **car-owner** bottom tabs (A08 screenshot).
- **m** FR-27 `tel:` call button missing (agent admitted it).

### Test/evidence quality
- Screen sweep (572 screenshots) passes on trivial checks (no console error, no "undefined") and the agent never looked at them. Evidence shows the placeholder-quality screens above, so the sweep gives false confidence.
- E2E "35/35" does not cover: real `start.bat` run, A05→home after signup, provider KYC upload + admin approval, creating a request from the UI, accept/track/complete flow in the UI.

### Smaller backend/tool issues
- Dummy generator: Arabic names produce emails like `nour.xxxxx0011@dummy.fixngo.test` (transliteration broken); no `Suspended` users generated (spec asked for some); verify the generated users cover every status named in `04_SCRIPTS_SPEC.md`.
- `STATE.md`/FINAL_REPORT claims must be corrected after Round 2.

## Round 2 acceptance (must ALL be true, proven with real-browser tests, not render checks)
1. `start.bat` (real script, temp data dir, fresh DB) → browser shows the app; `setup.bat` → first admin → app opens. `start.bat` rebuilds when `src\` or `client\` is newer than `app\`. Tests run the real bats.
2. **Faithful port:** rebuild every screen from its legacy JSX (`legacy-prototype/*.js`) as real components (one file per screen or small groups, ≈ the same markup/classes as legacy), bound to API data. Delete the generic registry renderers (a tiny shared `List/Detail` helper is fine only for plain admin tables). Side-by-side screenshots vs `reference/design-images/` for the 30 most important screens must look the same (layout, cards, map card, stepper, chips, checklists, tab bars per role).
3. Working end-to-end flows **through the UI** (Playwright, multiple contexts): provider sign-up with real file uploads → admin approves → provider goes online → owner adds vehicle → creates tow request via the wizard (location pick, estimate, photos) → selects provider → provider accepts → tracking with GPS-sim → estimate approve → cash/card payment → invoice → rating; mechanic flow with quote; booking flow with a service center; chat; admin pricing save; suspend/restore; 2FA enrol; sessions revoke; settings persistence; withdrawals via dock "Bank".
4. Fix every B/M/m item above. No raw enum/keys in UI, no "0 Records"/"Nothing here yet" on screens that should have designed content, no overlapping header/bottom-bar, dark mode applies to the whole phone + dock, dock visible on all screens when simulators are enabled.
5. Sweep upgrade: for each screen assert **semantic content** (expected headings/fields/buttons from a per-screen manifest derived from the legacy file), not just "no errors". Open and visually check screenshots; if you cannot view images, say so, and add pixel-diff/structure checks against baselines.
6. Honest report: rewrite `docs/FINAL_REPORT.md`, `STATE.md`, `SCREEN_MATRIX.md` with true status per screen (done / partial / placeholder). No claim without a test that would fail if it were false.
