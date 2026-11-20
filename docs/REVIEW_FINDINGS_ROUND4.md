# REVIEW FINDINGS — ROUND 4 (final acceptance review of commit `8f377f5`)

Method: `git clone` of the repo into a temp folder (exactly what anyone receiving the project gets), real `setup.bat` + `start.bat` there, the five tools on an isolated data dir, two independent browser testers driving every role end-to-end with real uploads and the Simulator Dock, plus a code grep by the reviewer. Nothing in the owner's real `data\` was touched.

**Verdict: very close.** Big real progress: start.bat serves the app; all five tools pass (201 dummy users, every status present, valid emails, 2nd dummy refused, restore byte-identical, remove-db → first run); full tow flow incl. Paid invoice, earnings, rating; booking lifecycle incl. extras, correct times, In-Progress; admin KYC with real document images, suspend/restore blocks login, pricing versioning, audit log, 2FA QR, session revoke; support ticket round-trip; password change; AR/dark incl. dock. Screens now match the prototype design.
The items below remain. Fix all, then re-verify **from a fresh `git clone`**.

## A. Blockers
1. **The repository does not build from a clean clone.** `.gitignore` line `app/` also ignores `client/src/app/` → `client/src/app/screens.jsx` and `stores.jsx` were **never committed** (`git ls-files client/src` has no `app/` folder). A fresh clone fails: `Could not resolve "./app/screens.jsx" from "src/App.jsx"`. Fix: change the rule to `/app/` (root only), `git add client/src/app`, commit, and add a test to `verify-all.ps1` that clones the repo to a temp dir and runs `tools/build.ps1` there (gate must fail if any source is untracked). Also run `git status --ignored` and confirm no other source file is ignored.
2. **Fake data still injected / pre-filled in forms (violates "no mock data"):**
   - C40 review: `text: text || t('Professional workshop and punctual bay service.')` (OwnerCentersAndProfile.jsx ~868) — submits a fake review when the user leaves it empty.
   - A09: truck `Isuzu NPR`, capacity `3.5`, plate `TOW-4510`; doc tile says "Front & back attached" before any upload.
   - C05: Toyota / Corolla / 2022 / Silver / Petrol pre-filled — and saving shows **2023 / Blue** (state/display mismatch).
   - C07/C25: pickup `90th Street, 5th Settlement, New Cairo`, destination `Al-Rehab Gate 6 Service Zone`, distance `8.5` pre-filled; C02 location pill defaults to New Cairo before any GPS.
   - C33: expiry `12/2028`, nickname `CIB Visa Platinum`.
   - A10: address/pin + 4 services pre-selected; A08 / M14 experience `5`; M15 `Cairo, Egypt` / `5` km; SH20 bank pre-selected `AlexBank` + "Fill valid sample IBAN" button (sim-only helpers belong in the Simulator Dock, not in the product form); SC05 duration `30`; C17 shows fallback description "Trusted full-service automotive workshop in Nasr City." when the center has none.
   - C32 dispute reason, C43/C29 reason defaults, AD12 reason `Policy violation`.
   Rule: product forms start **empty** (or with the user's own saved data / real GPS result); sensible numeric defaults from **platform settings** are OK only if labelled. Extend `mock-scan.ps1` to flag `useState('<literal of 3+ chars>')` and `useState(<number>)` in form components and `|| t('…sentence…')` used as submitted data; allow-list only UI state (tabs, filters, periods).
3. **Pre-ticked confirmation checkboxes on irreversible actions** (must start unticked and be required): AD12 access decision (`AdminScreens.jsx ~1895`), AD15 review checklist, SH15 withdrawal (`SharedScreens.jsx ~2187`), **SH21 account deletion "I understand" (`SharedScreens.jsx ~3215`)**, C33 "set as default", C16 "recommend". Add tests that the confirm button is disabled until ticked.
4. **Owner live tracking (C11) does not update in real time** while the captain changes status (Dock notifications arrive, screen stays "Searching · Step 1/7"; reload shows partial data with request code "—" and no provider). C11/C12/C13/C31 must subscribe to SignalR `request.status`/`provider.location` (with a polling fallback) and re-render; never lose code/provider after reload.
5. **C14 "Confirm & Pay" returns raw 409 after the captain already collected cash.** If the invoice is settled, C14/C34 must show "Paid" and route to C15 (C34 also shows an active "Pay Now" on a Paid invoice).

## B. Major
6. Tow-specific wording: C13 says "On-Site Repair Estimate / Approve & Start Repair" for a tow; C11 shows "Review Repair Quote"/"Proceed to Payment" too early; T07 says "On the way to the center" when destination is not a center; C06 "Wheel Lift Tow" card shows a "Flatbed" badge; T05 shows drop-off distance as pickup distance.
7. C19 shows fallback slots on a closed day (Friday closed) → must show "Closed" with no slots; remove any client-side fallback slot list.
8. Support ticket attachment (SH08) silently not uploaded/attached; SH09 shows ticket code as Reference instead of the booking/request; AD18 labels the customer's message as "You".
9. A10 map pin not interactive (only presets); services chosen at A10 don't create catalog entries (or say clearly they must be added in SC04); center name typed at A10 not used (admin/KYC shows the signup name).
10. AD05 direct reload stuck on skeleton; bottom-tab highlight lags one tab (AD02/AD04/AD05/C17) and wrong tab on C04/T10/C16/C33.
11. C38 completed booking has no Paid/Unpaid badge; C02 "Upcoming appointment" shows completed/cancelled bookings; C17 rating doesn't refresh after a review until reload (invalidate queries).
12. File URLs carry the JWT in the query string (`http.js: ?access_token=`). Use a short-lived signed file token (single file, ~5 min) or fetch as blob with the Authorization header.

## C. Minor (batch)
C42 raw event keys (`offer.sent`…); SH13 shows "Return to active request" with none; raw enums/plurals (`ServiceCenter`, `InProgress`, `JobEarning`, "1 bays/bookings/applications/trips/providers"); lowercase vehicle-type chips; SC02 detail heading "Accepted appointment" while In progress; SC08 "100% completion" with 0 bookings; RTL phone numbers (wrap in `dir="ltr"`); untranslated strings in AR (names are fine; UI labels/notification titles not); Dock: "Charges" → «المدفوعات» not «الشحنات», raw UTC timestamps, OTP list not auto-refreshing, Test-cards box on Bank tab; C19 horizontal scrollbar; plate hyphen silently stripped (show normalised value before save).

## D. Process / honesty
- The previous report said "zero mock or fallback literals" and "visual review complete" — both were false (items A2/A3). The mock-scan and E2E must be strengthened so these classes of defect fail the gate.
- Final gate must include: fresh-clone build+start test, extended mock-scan, Playwright tests for every A item (live tracking without reload, closed-day slots, unticked confirmations, no pre-filled product forms, C14 after cash).
- Update `FINAL_REPORT.md`, `STATE.md`, `SCREEN_MATRIX.md`, `visual-review.md` honestly.
