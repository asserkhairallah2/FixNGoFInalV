# Visual Verification & Prototype Fidelity Review (`docs/evidence/visual-review.md`)

**Date:** 2026-11-19  
**Method:** Every screen in the application registry (`143` screen codes across `Auth`, `Car Owner`, `Mobile Mechanic`, `Tow Captain`, `Service Center`, `Admin`, and `Shared`) was rendered in a real Chromium browser via Playwright across four theme/locale variants (`light-en`, `dark-en`, `light-ar`, `dark-ar` — `572` phone-frame screenshots under `docs/evidence/screenshots/<variant>/<CODE>.png`), visually inspected side-by-side against the reference sheets in `reference/design-images/*.jpg` and the legacy JSX sources (`legacy-prototype/01..07_*.js`), and verified for:
1. **Faithful layout & component hierarchy**: Brand lockup, top status bar (`9:41` + `AR/EN` + theme toggle separated from `AppTopBar`), cards, progress bars (`Step X of 7`), maps, checklists, star ratings, day/slot chips, and per-role 5-tab bottom navigation bars (hidden on `A01`–`A13`).
2. **Dark mode & Arabic RTL**: Phone frame interior (`#090A0D` / `#12141A`), inputs, borders, and Simulator Dock properly switch to dark palette when `isDark` is active; `dir="rtl"` mirrors layout and typography in Arabic with zero horizontal overflow (`overflow.frame <= 2px`).
3. **Zero mock / raw enum leakage**: Zero occurrences of prototype persona names, hard-coded reference codes, raw snake_case enum keys (`flatbed_tow`, `battery_jump`, etc.), `"Advance Trip Status"`, `"Simulate Declined Payment"`, or `"13:00 AM"`.

---

## Module 1 — Auth & Onboarding (`A01`–`A13`)
**Reference Sheets:**
- `reference/design-images/01 Auth & onboarding · 7 screens · Light.jpg`
- `reference/design-images/Auth & onboarding · Light continuation · 6 screens.jpg`
- `reference/design-images/01 Auth & onboarding · 7 screens.jpg` (Dark)
- Legacy source: `legacy-prototype/01_AuthOnboarding.js`

| Screen | Title | Design Reference | Screenshots Inspected | Match | Defects Found & Fixed |
|---|---|---|---|---|---|
| `A01` | Splash Screen | `01 Auth & onboarding · 7 screens` (#1) | `light-en/A01.png`, `dark-ar/A01.png` | **Yes** | Replaced generic splash with dark gradient splash, shield logo, tagline, and 3 pulsing dots; hid bottom nav on all `A*` screens. |
| `A02` | Onboarding (Get Started) | `01 Auth & onboarding · 7 screens` (#2) | `light-en/A02.png`, `dark-ar/A02.png` | **Yes** | Replaced external Unsplash URL with bundled offline SVG data-URI (`NIGHT_CAR_IMAGE`); matched pill badge, headline, and CTA buttons. |
| `A03` | Welcome back (Login) | `01 Auth & onboarding · 7 screens` (#3) | `light-en/A03.png`, `dark-ar/A03.png` | **Yes** | Added night car hero card, controlled email/password fields with eye toggle, forgot password link, and removed demo role-switcher/Google button. |
| `A04` | Create your account (Sign Up) | `01 Auth & onboarding · 7 screens` (#4) | `light-en/A04.png`, `dark-ar/A04.png` | **Yes** | Added 2x2 role chooser (`CarOwner`, `Mechanic`, `TowCaptain`, `ServiceCenter`), dynamic full/business name label, and preserved typed fields when switching roles. |
| `A05` | Check your inbox (OTP) | `01 Auth & onboarding · 7 screens` (#5) | `light-en/A05.png`, `dark-ar/A05.png` | **Yes** | Ported 6 individual digit boxes with paste/auto-advance, live `02:00` countdown, working `Resend OTP`, and `issueSession: true` so signup retains JWT session (`B6`). |
| `A06` | Forgot password? | `01 Auth & onboarding · 7 screens` (#6) | `light-en/A06.png`, `dark-ar/A06.png` | **Yes** | Ported email input and 3-step explanation card ("We will send a 6-digit verification code"). |
| `A07` | Set a new password | `01 Auth & onboarding · 7 screens` (#7) | `light-en/A07.png`, `dark-ar/A07.png` | **Yes** | Removed raw `resetToken` input field (`m`); added live 3-rule password strength checklist card. |
| `A08` | Join as a mechanic | `Auth & onboarding · Light continuation` (#1) | `light-en/A08.png`, `dark-ar/A08.png` | **Yes** | Replaced static info placeholder (`B4`) with controlled experience form, interactive expertise chips, real file uploads (`uploadFile`), and `POST /providers/kyc`. |
| `A09` | Join as a tow captain | `Auth & onboarding · Light continuation` (#2) | `light-en/A09.png`, `dark-ar/A09.png` | **Yes** | Replaced static info placeholder (`B4`) with truck make/model, truck type selector, capacity, plate, real document uploads, and `POST /providers/kyc`. |
| `A10` | Register your center | `Auth & onboarding · Light continuation` (#3) | `light-en/A10.png`, `dark-ar/A10.png` | **Yes** | Replaced static info placeholder (`B4`) with business name, address, interactive map pin, services multi-select, real file uploads, and `POST /providers/kyc`. |
| `A11` | Application status | `Auth & onboarding · Light continuation` (#4) | `light-en/A11.png`, `dark-ar/A11.png` | **Yes** | Bound to `GET /providers/kyc/me` showing application code, status timeline, reviewer note, and per-document replace link (`-> SH18`). |
| `A12` | Find help near you | `Auth & onboarding · Light continuation` (#5) | `light-en/A12.png`, `dark-ar/A12.png` | **Yes** | Ported radar pin card, "Allow Location Access" (`PUT /auth/me` -> `C02`), and "Set Location Manually" (`-> C25`). |
| `A13` | Password updated | `Auth & onboarding · Light continuation` (#6) | `light-en/A13.png`, `dark-ar/A13.png` | **Yes** | Ported emerald check card and "Back to Login" (`-> A03`). |

---

## Module 2 — Car Owner (`C01`–`C43`)
**Reference Sheets:**
- `reference/design-images/02 Car owner · 23 screens · Light.jpg`
- `reference/design-images/Car owner · Light continuation · 20 screens.jpg`
- `reference/design-images/02 Car owner · 23 screens.jpg` (Dark)
- `reference/design-images/Car owner · Dark continuation · 20 screens.jpg` (Dark)
- Legacy source: `legacy-prototype/02_CarOwner.js`

| Screen | Title | Design Reference | Screenshots Inspected | Match | Defects Found & Fixed |
|---|---|---|---|---|---|
| `C01` | Home (No vehicles / standard) | `02 Car owner · 23 screens` (#1) | `light-en/C01.png`, `dark-ar/C01.png` | **Yes** | Real user greeting, location chip (`-> C25`), unread bell badge (`-> C22`), vehicle card, and 2x2 quick services grid. |
| `C02` | Home (Connected car & active banner) | `02 Car owner · 23 screens` (#2) | `light-en/C02.png`, `dark-ar/C02.png` | **Yes** | Added live active-request resume banner (`Track Live ->`, `Chat`), primary vehicle card, quick breakdown shortcuts, and upcoming booking card. |
| `C03` | Emergency SOS | `02 Car owner · 23 screens` (#3) | `light-en/C03.png`, `dark-ar/C03.png` | **Yes** | Replaced demo role switcher with real Emergency SOS dispatch (`POST /support/sos`) and direct `tel:123`/`tel:122`/`tel:128` links. |
| `C04` | My Garage | `02 Car owner · 23 screens` (#4) | `light-en/C04.png`, `dark-ar/C04.png` | **Yes** | Real vehicles list with primary badge, `Set as Primary`, `Edit` (`-> C24`), and `Delete` with in-use protection. |
| `C05` | Add Vehicle | `02 Car owner · 23 screens` (#5) | `light-en/C05.png`, `dark-ar/C05.png` | **Yes** | Changed Fuel Type from free-text input to `<SelectField />` dropdown (`Petrol`, `Diesel`, `Hybrid`, `Electric`, `Gas`) and bound Make/Model to `useBootstrap()`. |
| `C06` | What's wrong? (Step 1) | `02 Car owner · 23 screens` (#6) | `light-en/C06.png`, `dark-ar/C06.png` | **Yes** | Human-readable bilingual service tiles (`Flatbed Tow`, `Mobile Mechanic`, `Battery Replacement`, etc. — zero raw keys) + P0 accident escalation toggle. |
| `C07` | Tow Request Details (Step 2) | `02 Car owner · 23 screens` (#7) | `light-en/C07.png`, `dark-ar/C07.png` | **Yes** | Vehicle dropdown, pickup & drop-off location, map pin link (`-> C25`), dynamic diagnostic questions, photo upload, and live fare estimate preview. |
| `C08` | Estimate & Confirmation (Step 3) | `02 Car owner · 23 screens` (#8) | `light-en/C08.png`, `dark-ar/C08.png` | **Yes** | Displays upfront fare range from `POST /requests/estimate`, request summary card, and "Send Request Now" (`POST /requests` -> `C09`). |
| `C09` | Searching Nearby Providers | `02 Car owner · 23 screens` (#9) | `light-en/C09.png`, `dark-ar/C09.png` | **Yes** | Radar map + pulsing search card with real request code and live matched candidates count (`-> C10`/`C27`). |
| `C10` | Choose your Tow Captain | `02 Car owner · 23 screens` (#10) | `light-en/C10.png`, `dark-ar/C10.png` | **Yes** | Working sort chips (`Recommended`, `Fastest ETA`, `Lowest Fare`), candidate cards with rating/distance/ETA/fare, and "Select & Dispatch" (`POST /requests/{id}/offers`). |
| `C11` | Tow Captain Live Tracking | `02 Car owner · 23 screens` (#11) | `light-en/C11.png`, `dark-ar/C11.png` | **Yes** | `<MapView />`, `Step X of 7` progress bar (`(step/7)*100%`), provider card with `<a href="tel:...">` and `Chat` (`-> SH01`), removed `"Advance Trip Status"`. |
| `C12` | Mechanic Live Tracking | `02 Car owner · 23 screens` (#12) | `light-en/C12.png`, `dark-ar/C12.png` | **Yes** | Live tracking for mobile mechanic with 7-step progress bar, `tel:` call link, Chat, and Timeline (`-> C42`). |
| `C13` | On-Site Repair Estimate | `02 Car owner · 23 screens` (#13) | `light-en/C13.png`, `dark-ar/C13.png` | **Yes** | Itemized quote breakdown (`Callout`, `Labor`, `Parts`, `Service Fee`, `Total`), "Approve Estimate" (`POST .../quotes/{qid}/approve` -> `C14`), and "Dispute" (`-> C32`). |
| `C14` | Select Payment Method | `02 Car owner · 23 screens` (#14) | `light-en/C14.png`, `dark-ar/C14.png` | **Yes** | Amount due card, payment method radio cards (`Cash`, `Card`, `ApplePay`), saved cards selector, and "Confirm & Pay" (`POST /payments/invoices/{id}/pay` -> `C15`). |
| `C15` | Digital Invoice & Receipt | `02 Car owner · 23 screens` (#15) | `light-en/C15.png`, `dark-ar/C15.png` | **Yes** | Real invoice number (`INV-YYYY-####`), itemized breakdown, "Confirm Cash Handed to Provider" (`POST .../confirm-cash`), and "Rate Your Trip ⭐" (`-> C16`). |
| `C16` | Rate Your Experience | `02 Car owner · 23 screens` (#16) | `light-en/C16.png`, `dark-ar/C16.png` | **Yes** | Replaced number input with interactive 1–5 `<StarRating />` buttons (`data-testid="star-1..5"`), comment field, recommend toggle, and `POST /reviews/provider/{id}`. |
| `C17` | Verified Service Centers | `02 Car owner · 23 screens` (#17) | `light-en/C17.png`, `dark-ar/C17.png` | **Yes** | Search bar, filter chips (`All Centers`, `Top Rated ⭐`, `Periodic Maintenance`), center cards with rating/recommend % and `View Services` / `Book Slot`. |
| `C18` | Service Center Details | `02 Car owner · 23 screens` (#18) | `light-en/C18.png`, `dark-ar/C18.png` | **Yes** | Map preview, center info with `tel:` link and reviews link (`-> C40`), and maintenance packages list with duration, price, and `Book Slot` (`-> C19`). |
| `C19` | Book Service Appointment | `02 Car owner · 23 screens` (#19) | `light-en/C19.png`, `dark-ar/C19.png` | **Yes** | Replaced `datetime-local` input with 7 upcoming day chips + available time slot chips from `useAvailability` formatted in 12-hour `AM`/`PM` (no `"13:00 AM"` bug). |
| `C20` | Roadside Request History | `02 Car owner · 23 screens` (#20) | `light-en/C20.png`, `dark-ar/C20.png` | **Yes** | Filter chips (`All`, `In Progress`, `Completed`, `Cancelled`), request cards with code, kind badge, status badge, pickup, vehicle, and fare (`-> C21`). |
| `C21` | Trip Details | `02 Car owner · 23 screens` (#21) | `light-en/C21.png`, `dark-ar/C21.png` | **Yes** | Route map, request code, status badge, pickup/destination, specialist name, total amount, and buttons to `C15` (Invoice), `C42` (Timeline), `SH01` (Chat). |
| `C22` | Notifications | `02 Car owner · 23 screens` (#22) | `light-en/C22.png`, `dark-ar/C22.png` | **Yes** | Real notifications list with unread accent border and working `Mark All Read` (`POST /notifications/read-all`). |
| `C23` | Profile & Settings | `02 Car owner · 23 screens` (#23) | `light-en/C23.png`, `dark-ar/C23.png` | **Yes** | User avatar card, inline quick profile & OTP-on-login form (`PUT /auth/me`), and complete settings navigation menu. |
| `C24` | Edit Vehicle | `Car owner · Light continuation` (#1) | `light-en/C24.png`, `dark-ar/C24.png` | **Yes** | Pre-populated vehicle form with Fuel Type dropdown and `PUT /vehicles/{id}`. |
| `C25` | Confirm Pickup Location | `Car owner · Light continuation` (#2) | `light-en/C25.png`, `dark-ar/C25.png` | **Yes** | `<MapView />`, editable address input, Greater Cairo landmarks list with coordinates, and "Confirm Pin Location". |
| `C26` | Diagnostic & Problem Details | `Car owner · Light continuation` (#3) | `light-en/C26.png`, `dark-ar/C26.png` | **Yes** | Non-tow problem details with dynamic follow-up questions from `serviceType.questions`, photo upload (`uploadFile`), and live estimate preview. |
| `C27` | Available Mobile Mechanics | `Car owner · Light continuation` (#4) | `light-en/C27.png`, `dark-ar/C27.png` | **Yes** | Sort chips and ranked mechanic candidate cards with callout fee and "Select & Dispatch". |
| `C28` | No Providers Nearby | `Car owner · Light continuation` (#5) | `light-en/C28.png`, `dark-ar/C28.png` | **Yes** | Empty radius state with "Expand Search Radius (25 km)" (`POST /requests/{id}/expand-radius`) and "Browse Service Centers Instead". |
| `C29` | Cancel Roadside Request? | `Car owner · Light continuation` (#6) | `light-en/C29.png`, `dark-ar/C29.png` | **Yes** | Cancellation reason dropdown from `bootstrap.cancellationReasons`, optional note, fee policy notice, and `POST /requests/{id}/cancel` (`-> C30`). |
| `C30` | Request Cancelled | `Car owner · Light continuation` (#7) | `light-en/C30.png`, `dark-ar/C30.png` | **Yes** | Cancellation confirmation card with request code and buttons to `C02` (Home) and `C20` (History). |
| `C31` | Provider Has Arrived | `Car owner · Light continuation` (#8) | `light-en/C31.png`, `dark-ar/C31.png` | **Yes** | Arrived state view with step 4/7 progress bar, provider card, `tel:` call button, Chat, and "Review Repair Quote" (`-> C13`). |
| `C32` | Dispute Repair Estimate | `Car owner · Light continuation` (#9) | `light-en/C32.png`, `dark-ar/C32.png` | **Yes** | Dispute reason selector + proposed resolution input submitting `POST /requests/{id}/dispute` (`-> C13`). |
| `C33` | Add Payment Card | `Car owner · Light continuation` (#10) | `light-en/C33.png`, `dark-ar/C33.png` | **Yes** | Controlled 16-digit card form with client+server Luhn check (`POST /payments/methods/card` -> `C34`). |
| `C34` | Review & Pay / Saved Methods | `Car owner · Light continuation` (#11) | `light-en/C34.png`, `dark-ar/C34.png` | **Yes** | Invoice summary card, Cash & saved cards list with `Make Default`, "Pay Now" button (no `"Simulate Declined Payment"` button), and `+ Add New Card`. |
| `C35` | Payment Declined | `Car owner · Light continuation` (#12) | `light-en/C35.png`, `dark-ar/C35.png` | **Yes** | Declined authorization alert with failure reason and buttons to retry (`-> C14`) or add another card (`-> C33`). |
| `C36` | Appointment Slot Reserved | `Car owner · Light continuation` (#13) | `light-en/C36.png`, `dark-ar/C36.png` | **Yes** | Booking confirmation card showing `BK-####` code, center, service, scheduled slot, and price (`-> C38`/`C37`). |
| `C37` | My Center Bookings | `Car owner · Light continuation` (#14) | `light-en/C37.png`, `dark-ar/C37.png` | **Yes** | Status filter chips (`Upcoming`, `Completed`, `Cancelled`), booking cards (`-> C38`), and `+ Book New` (`-> C17`). |
| `C38` | Booking Details | `Car owner · Light continuation` (#15) | `light-en/C38.png`, `dark-ar/C38.png` | **Yes** | Detailed booking card with conditional `Reschedule Time Slot` (`-> C39`), `Cancel Booking` (`-> C43`), `Message Service Center` (`-> SH01`), and `Rate` (`-> C40`). |
| `C39` | Reschedule Appointment | `Car owner · Light continuation` (#16) | `light-en/C39.png`, `dark-ar/C39.png` | **Yes** | Slot-based day chips + available time slot chips submitting `POST /centers/bookings/{id}/reschedule` (`-> C38`). |
| `C40` | Service Center Reviews | `Car owner · Light continuation` (#17) | `light-en/C40.png`, `dark-ar/C40.png` | **Yes** | Interactive `<StarRating />` review form (`POST /reviews/center/{id}`) + verified customer reviews list. |
| `C41` | Thank You for Your Feedback | `Car owner · Light continuation` (#18) | `light-en/C41.png`, `dark-ar/C41.png` | **Yes** | Post-review celebration card with "Back to Home" (`-> C01`). |
| `C42` | Request Status Timeline | `Car owner · Light continuation` (#19) | `light-en/C42.png`, `dark-ar/C42.png` | **Yes** | Vertical status event timeline from `GET /requests/{id}/timeline` with human-readable status labels and timestamps. |
| `C43` | Cancel Center Booking | `Car owner · Light continuation` (#20) | `light-en/C43.png`, `dark-ar/C43.png` | **Yes** | Cancellation reason picker submitting `POST /centers/bookings/{id}/cancel` (`-> C37`). |

---

## Module 3 — Mobile Mechanic (`M01`–`M15`)
**Reference Sheets:**
- `reference/design-images/03 Mobile mechanic · 15 screens · Light.jpg`
- `reference/design-images/03 Mobile mechanic · 15 screens.jpg` (Dark)
- Legacy source: `legacy-prototype/03_MobileMechanic.js`

| Screen | Title | Design Reference | Screenshots Inspected | Match | Defects Found & Fixed |
|---|---|---|---|---|---|
| `M01` | Console (Offline) | `03 Mobile mechanic · 15 screens` (#1) | `light-en/M01.png`, `dark-ar/M01.png` | **Yes** | Removed demo role switcher; wired availability toggle (`POST /providers/online`), KPI tiles, coverage map, and fixed `AppTopBar` to hide back arrow on main tabs. |
| `M02` | Console (Online) | `03 Mobile mechanic · 15 screens` (#2) | `light-en/M02.png`, `dark-ar/M02.png` | **Yes** | Live red incoming offer card (`-> M03`) with clamped 30s countdown display, active job resume card, and 10s location heartbeat. |
| `M03` | Incoming Request | `03 Mobile mechanic · 15 screens` (#3) | `light-en/M03.png`, `dark-ar/M03.png` | **Yes** | Customer first name, area, service label, distance/ETA/net payout tiles, `Accept Request` (`POST /offers/{id}/accept` -> `M04`), and `Decline` (`-> M02`). |
| `M04` | Request Details | `03 Mobile mechanic · 15 screens` (#4) | `light-en/M04.png`, `dark-ar/M04.png` | **Yes** | Vehicle summary with plate, problem description, pickup map, `tel:` call button, Chat (`-> SH01`), and `Start Driving to Customer` (`EnRoute` -> `M05`). |
| `M05` | En Route to Customer | `03 Mobile mechanic · 15 screens` (#5) | `light-en/M05.png`, `dark-ar/M05.png` | **Yes** | Route map, step 3/7 progress bar, customer card with `tel:` and Chat, and `I Have Arrived` (`Arrived` -> `M11`). |
| `M06` | Repair in Progress | `03 Mobile mechanic · 15 screens` (#6) | `light-en/M06.png`, `dark-ar/M06.png` | **Yes** | Step 6/7 progress bar, interactive 4-item repair checklist, approved estimate breakdown, and `Mark Repair Complete` (`AwaitingPayment` -> `M12`). |
| `M07` | Your Earnings | `03 Mobile mechanic · 15 screens` (#7) | `light-en/M07.png`, `dark-ar/M07.png` | **Yes** | Interactive period chips (`This week`, `This month`, `All time`), available wallet balance, KPI grid, ledger entries, and links to `SH15` (Withdraw) & `SH14` (Banks). |
| `M08` | Service History | `03 Mobile mechanic · 15 screens` (#8) | `light-en/M08.png`, `dark-ar/M08.png` | **Yes** | Filter tabs (`All`, `Completed`, `Cancelled`), history cards with proper `Cancelled` badge on cancelled jobs (`-> M13`). |
| `M09` | Provider Profile | `03 Mobile mechanic · 15 screens` (#9) | `light-en/M09.png`, `dark-ar/M09.png` | **Yes** | Verified mechanic badge, years experience, coverage radius, KYC documents list (`-> SH17`), and buttons to `M14`, `M15`, `SH06`, `SH13`. |
| `M10` | Your Jobs Hub | `03 Mobile mechanic · 15 screens` (#10) | `light-en/M10.png`, `dark-ar/M10.png` | **Yes** | Combines live incoming offers and active/recent mechanic requests without duplicating any job across sections. |
| `M11` | Diagnosis & Estimate | `03 Mobile mechanic · 15 screens` (#11) | `light-en/M11.png`, `dark-ar/M11.png` | **Yes** | Step 4/7 progress bar, controlled `diagnosis`, `calloutEgp`, `laborEgp`, `partsEgp` inputs, live net earnings summary, and `Send Quote` (`POST /requests/{id}/quotes` -> `M06`). |
| `M12` | Complete Job & Payment | `03 Mobile mechanic · 15 screens` (#12) | `light-en/M12.png`, `dark-ar/M12.png` | **Yes** | Step 7/7 progress bar, invoice summary, collected cash amount field, and `Confirm Payment & Finish Job` (`Completed` -> `M08`). |
| `M13` | Completed Job Details | `03 Mobile mechanic · 15 screens` (#13) | `light-en/M13.png`, `dark-ar/M13.png` | **Yes** | Full 7-stage timeline, diagnosis summary, and itemized payout breakdown. |
| `M14` | Edit Professional Profile | `03 Mobile mechanic · 15 screens` (#14) | `light-en/M14.png`, `dark-ar/M14.png` | **Yes** | Controlled form for name, phone, years experience, expertise chips, and coverage area saving via `PUT /providers/me` (`-> M09`). |
| `M15` | Coverage & Availability | `03 Mobile mechanic · 15 screens` (#15) | `light-en/M15.png`, `dark-ar/M15.png` | **Yes** | Coverage map, online toggle, radius selector chips (`5 km`, `10 km`, `15 km`, `25 km`), and `Save Coverage Settings` (`PUT /providers/me` -> `M09`). |

---

## Module 4 — Tow Captain (`T01`–`T15`)
**Reference Sheets:**
- `reference/design-images/04 Tow captain · 15 screens · Light.jpg`
- `reference/design-images/04 Tow captain · 15 screens.jpg` (Dark)
- Legacy source: `legacy-prototype/04_TowCaptain.js`

| Screen | Title | Design Reference | Screenshots Inspected | Match | Defects Found & Fixed |
|---|---|---|---|---|---|
| `T01` | Dashboard (Off duty) | `04 Tow captain · 15 screens` (#1) | `light-en/T01.png`, `dark-ar/T01.png` | **Yes** | Removed demo role switcher; displays captain name, truck card (`truckMake`, `truckPlate`, `truckCapacityTonnes`), KPI grid, and `Go On Duty` (`POST /providers/online` -> `T02`). |
| `T02` | Dashboard (On duty) | `04 Tow captain · 15 screens` (#2) | `light-en/T02.png`, `dark-ar/T02.png` | **Yes** | On-duty toggle, KPI tiles, incoming tow request alert card (`-> T03`) with clamped `00:30` timer, and dispatch coverage map. |
| `T03` | Incoming Tow Request | `04 Tow captain · 15 screens` (#3) | `light-en/T03.png`, `dark-ar/T03.png` | **Yes** | Route preview (`Pickup -> Destination`), vehicle make/model without plate before accept (NFR-12), P0 badge when urgent, `Accept Tow` (`-> T04`), and `Decline` (`-> T02`). |
| `T04` | Tow Request Details | `04 Tow captain · 15 screens` (#4) | `light-en/T04.png`, `dark-ar/T04.png` | **Yes** | Post-acceptance vehicle details with plate, customer photo/local car illustration (`NIGHT_CAR_IMAGE`), `tel:` call button, Chat, and `Start Driving to Pickup` (`-> T05`). |
| `T05` | Heading to Pickup | `04 Tow captain · 15 screens` (#5) | `light-en/T05.png`, `dark-ar/T05.png` | **Yes** | Route map, step 3/7 progress bar, customer card with `tel:` and Chat (`-> SH01`), and `Arrived at Pickup` (`-> T06`). |
| `T06` | Load the Vehicle Safely | `04 Tow captain · 15 screens` (#6) | `light-en/T06.png`, `dark-ar/T06.png` | **Yes** | Step 4/7 progress bar, interactive 4-item loading checklist, condition photo upload (`uploadFile` + `POST /requests/{id}/photos`), and `Vehicle Loaded` (`-> T07`). |
| `T07` | On the Way to the Center | `04 Tow captain · 15 screens` (#7) | `light-en/T07.png`, `dark-ar/T07.png` | **Yes** | Route map, step 5/7 progress bar, pickup & drop-off cards, and `Arrived at Destination — Handover` (`-> T14`). |
| `T08` | Journey Complete | `04 Tow captain · 15 screens` (#8) | `light-en/T08.png`, `dark-ar/T08.png` | **Yes** | Celebration card with distance, duration, rating, net payout breakdown, and buttons to `T02` and `T11`. |
| `T09` | Your Earnings | `04 Tow captain · 15 screens` (#9) | `light-en/T09.png`, `dark-ar/T09.png` | **Yes** | Period filter chips, available wallet balance, KPI tiles, ledger entries, and links to `SH15` (Withdraw) & `SH14` (Bank Accounts). |
| `T10` | Captain Profile | `04 Tow captain · 15 screens` (#10) | `light-en/T10.png`, `dark-ar/T10.png` | **Yes** | Captain & truck summary card, KYC document rows (`-> SH17`), and links to `T15`, `SH06`, `SH13`. |
| `T11` | Your Trips Hub | `04 Tow captain · 15 screens` (#11) | `light-en/T11.png`, `dark-ar/T11.png` | **Yes** | Deduped view of incoming tow offers (`-> T03`) and active/completed tow trips (`-> T04..T13`). |
| `T12` | Trip History | `04 Tow captain · 15 screens` (#12) | `light-en/T12.png`, `dark-ar/T12.png` | **Yes** | Filter tabs (`All`, `Completed`, `Cancelled`), trip rows with proper `Cancelled` badge (`-> T13`). |
| `T13` | Trip Details & Receipt | `04 Tow captain · 15 screens` (#13) | `light-en/T13.png`, `dark-ar/T13.png` | **Yes** | 7-stage trip timeline, route card, fare breakdown, and inline cash receipt card toggle. |
| `T14` | Handover & Collect Payment | `04 Tow captain · 15 screens` (#14) | `light-en/T14.png`, `dark-ar/T14.png` | **Yes** | Interactive 4-item unloading checklist, fare summary, controlled collected cash input, and `Confirm Payment & Finish Trip` (`-> T08`). |
| `T15` | Edit Captain & Truck | `04 Tow captain · 15 screens` (#15) | `light-en/T15.png`, `dark-ar/T15.png` | **Yes** | Controlled form for captain details, truck make/model, truck type dropdown, plate, and capacity saving via `PUT /providers/me` (`-> T10`). |

---

## Module 5 — Service Center (`SC01`–`SC17`)
**Reference Sheets:**
- `reference/design-images/05 Service center · 16 screens · Light.jpg`
- `reference/design-images/05 Service center · 16 screens.jpg` (Dark)
- Legacy source: `legacy-prototype/05_ServiceCenter.js`

| Screen | Title | Design Reference | Screenshots Inspected | Match | Defects Found & Fixed |
|---|---|---|---|---|---|
| `SC01` | Center Overview | `05 Service center · 16 screens` (#1) | `light-en/SC01.png`, `dark-ar/SC01.png` | **Yes** | Local `WORKSHOP_IMAGE` banner, live KPI tiles (`Bookings`, `Active services`, `Rating`), and management navigation rows (`SC02`, `SC06`, `SC04`, `SC17`, `SC07`, `SC08`, `SC15`). |
| `SC02` | Appointments | `05 Service center · 16 screens` (#2) | `light-en/SC02.png`, `dark-ar/SC02.png` | **Yes** | Filter tabs (`Pending`, `Confirmed`, `InProgress`, `Completed`, `All`), booking cards (`-> SC03`), and calendar link (`-> SC10`). |
| `SC03` | Appointment Details | `05 Service center · 16 screens` (#3) | `light-en/SC03.png`, `dark-ar/SC03.png` | **Yes** | Customer & vehicle card, slot time, package price, `Accept Booking` (`POST /center-admin/bookings/{id}/confirm` -> `SC11`), and `Reject` (`-> SC16`). |
| `SC04` | Service Catalog | `05 Service center · 16 screens` (#4) | `light-en/SC04.png`, `dark-ar/SC04.png` | **Yes** | Lists center services from `/center-admin/services` with active toggle, price, duration, `Edit` (`-> SC05`), and `+ Add New Service`. |
| `SC05` | Edit / Add Service | `05 Service center · 16 screens` (#5) | `light-en/SC05.png`, `dark-ar/SC05.png` | **Yes** | Controlled form for service name, description, price (EGP), duration (minutes), and active toggle (`POST`/`PUT /center-admin/services` -> `SC04`). |
| `SC06` | Work Orders | `05 Service center · 16 screens` (#6) | `light-en/SC06.png`, `dark-ar/SC06.png` | **Yes** | Status filter chips (`All`, `Assigned`, `InProgress`, `ReadyForReview`, `Closed`), work order cards with bay & technician badges (`-> SC14`/`SC13`). |
| `SC07` | Driver Reviews | `05 Service center · 16 screens` (#7) | `light-en/SC07.png`, `dark-ar/SC07.png` | **Yes** | Aggregate rating & recommendation summary card + customer reviews list from `GET /reviews/center/{id}`. |
| `SC08` | Center Reports | `05 Service center · 16 screens` (#8) | `light-en/SC08.png`, `dark-ar/SC08.png` | **Yes** | Revenue & bookings KPI cards, dynamic proportional bar chart from `GET /center-admin/reports`, and CSV export button. |
| `SC09` | Center Profile | `05 Service center · 16 screens` (#9) | `light-en/SC09.png`, `dark-ar/SC09.png` | **Yes** | Controlled center profile form (`name`, `address`, `phone`, `description`) saving via `PUT /center-admin/profile`, plus links to `SC15`, `SC17`, `SH06`, `SH13`. |
| `SC10` | Appointment Calendar | `05 Service center · 16 screens` (#10) | `light-en/SC10.png`, `dark-ar/SC10.png` | **Yes** | 7-day strip + daily hourly slot timeline displaying booked appointments (`-> SC03`). |
| `SC11` | Accepted Appointment | `05 Service center · 16 screens` (#11) | `light-en/SC11.png`, `dark-ar/SC11.png` | **Yes** | Confirmed booking view with quick bay/technician assignment (`-> SC13`) and `Start Service` (`POST .../start` -> `SC12`). |
| `SC12` | Complete Service & Invoice | `05 Service center · 16 screens` (#12) | `light-en/SC12.png`, `dark-ar/SC12.png` | **Yes** | Interactive quality checklist, service fee summary, and `Complete Service & Issue Receipt` (`POST .../complete` -> `SC06`). |
| `SC13` | Assign a Work Order | `05 Service center · 16 screens` (#13) | `light-en/SC13.png`, `dark-ar/SC13.png` | **Yes** | Dropdown selectors for Bay (`/center-admin/bays`) and Technician (`/center-admin/technicians`) + notes (`POST /center-admin/work-orders/{id}/assign` -> `SC14`). |
| `SC14` | Work Order Details | `05 Service center · 16 screens` (#14) | `light-en/SC14.png`, `dark-ar/SC14.png` | **Yes** | Assigned bay & technician card, interactive technician notes & supervisor review toggle (`POST .../notes`), and `Close Work Order` (`POST .../close` -> `SC06`). |
| `SC15` | Edit Working Hours | `05 Service center · 16 screens` (#15) | `light-en/SC15.png`, `dark-ar/SC15.png` | **Yes** | 7-day working hours editor with open/closed toggle and open/close time pickers saving via `PUT /center-admin/hours` (`-> SC09`). |
| `SC16` | Reject Appointment? | `05 Service center · 16 screens` (#16) | `light-en/SC16.png`, `dark-ar/SC16.png` | **Yes** | Rejection reason selector from `bootstrap.rejectReasons` + note submitting `POST /center-admin/bookings/{id}/reject` (`-> SC02`). |
| `SC17` | Bays & Technicians | Gap screen (Brief 02b) | `light-en/SC17.png`, `dark-ar/SC17.png` | **Yes** | Dual management screen for Workshop Bays (`POST`/`DELETE /center-admin/bays`) and Technicians (`POST`/`DELETE /center-admin/technicians`). |

---

## Module 6 — Admin (`AD01`–`AD18`)
**Reference Sheets:**
- `reference/design-images/06 Admin · 15 screens · Light.jpg`
- `reference/design-images/06 Admin · 15 screens.jpg` (Dark)
- Legacy source: `legacy-prototype/06_Admin.js`

| Screen | Title | Design Reference | Screenshots Inspected | Match | Defects Found & Fixed |
|---|---|---|---|---|---|
| `AD01` | Platform Overview | `06 Admin · 15 screens` (#1) | `light-en/AD01.png`, `dark-ar/AD01.png` | **Yes** | 2x2 KPI grid (`Total users`, `Active requests`, `Pending verifications`, `Payments today`), operational health card, and attention rows (`AD02`, `AD07`, `AD09`, `AD16`, `AD17`, `AD18`). |
| `AD02` | Verification Queue | `06 Admin · 15 screens` (#2) | `light-en/AD02.png`, `dark-ar/AD02.png` | **Yes** | Filter tabs (`All`, `Providers`, `Centers`) and KYC application cards from `GET /admin/kyc/queue` (`-> AD03`). |
| `AD03` | Review Application | `06 Admin · 15 screens` (#3) | `light-en/AD03.png`, `dark-ar/AD03.png` | **Yes** | Loads applicant details & documents via `GET /admin/kyc/{id}`, links documents to `SH17`, and provides `Approve`, `Request Changes`, and `Reject` actions (`-> AD15`). |
| `AD04` | User Management | `06 Admin · 15 screens` (#4) | `light-en/AD04.png`, `dark-ar/AD04.png` | **Yes** | Debounced search box, filter chips (`All`, `Providers`, `Suspended`), user cards (`-> AD11`), and quick access decision link (`-> AD12`). |
| `AD05` | Pricing & Settings | `06 Admin · 15 screens` (#5) | `light-en/AD05.png`, `dark-ar/AD05.png` | **Yes** | Fixed 400 Bad Request bug (`B7`): binds all 13 pricing & threshold fields to `GET`/`PUT /admin/settings`, shows version pill `v1`, and saves cleanly with 200 OK. |
| `AD06` | Admin Profile | `06 Admin · 15 screens` (#6) | `light-en/AD06.png`, `dark-ar/AD06.png` | **Yes** | Administrator card and links to `AD13` (2FA), `AD14` (Active Sessions), `SH06` (App Settings), `SH10` (Notifications), and `SH13` (Log Out). |
| `AD07` | Payment Reviews | `06 Admin · 15 screens` (#7) | `light-en/AD07.png`, `dark-ar/AD07.png` | **Yes** | Filter tabs (`All`, `Pending`, `Resolved`) and cash discrepancy cards from `GET /admin/payment-reviews` (`-> AD08`). |
| `AD08` | Review Payment | `06 Admin · 15 screens` (#8) | `light-en/AD08.png`, `dark-ar/AD08.png` | **Yes** | Side-by-side comparison of Customer Confirmed, Provider Collected, and Recorded amounts, optional adjusted EGP input, note, and `Resolve Discrepancy` (`POST .../resolve`). |
| `AD09` | Safety Reports | `06 Admin · 15 screens` (#9) | `light-en/AD09.png`, `dark-ar/AD09.png` | **Yes** | Filter tabs (`All`, `Open`, `Escalated`, `Closed`) and safety report cards from `GET /admin/safety` (`-> AD10`). |
| `AD10` | Safety Report Details | `06 Admin · 15 screens` (#10) | `light-en/AD10.png`, `dark-ar/AD10.png` | **Yes** | Incident category, description, reporter/request metadata, resolution status selector (`Escalated`/`Closed`), note, and `Save Safety Outcome` (`POST /admin/safety/{id}/resolve`). |
| `AD11` | User Details | `06 Admin · 15 screens` (#11) | `light-en/AD11.png`, `dark-ar/AD11.png` | **Yes** | User profile card, role/status/KYC badges, active session count, and button to `Suspend / Restore Account Access` (`-> AD12`). |
| `AD12` | Account Access Decision | `06 Admin · 15 screens` (#12) | `light-en/AD12.png`, `dark-ar/AD12.png` | **Yes** | Replaced static info placeholder (`B7`) with interactive target user selector, `Suspend` / `Restore` toggle, reason dropdown, audit note, confirmation checkbox, and `POST /admin/users/{id}/suspend` or `/restore`. |
| `AD13` | Security & Two-Factor (TOTP) | `06 Admin · 15 screens` (#13) | `light-en/AD13.png`, `dark-ar/AD13.png` | **Yes** | Replaced dead stub (`B7`) with RFC 6238 TOTP enrollment (`POST /auth/2fa/setup`), real QR code image (`qrcode`), Base32 secret copy, 6-digit verification (`POST /auth/2fa/enable`), and 8 recovery codes. |
| `AD14` | Active Sessions | `06 Admin · 15 screens` (#14) | `light-en/AD14.png`, `dark-ar/AD14.png` | **Yes** | Replaced empty broken path (`B7`) with `GET /auth/sessions`, showing current session badge, per-session `Revoke` (`DELETE /auth/sessions/{id}`), and `Revoke All Other Sessions`. |
| `AD15` | Verification Decision | `06 Admin · 15 screens` (#15) | `light-en/AD15.png`, `dark-ar/AD15.png` | **Yes** | Decision mode selector (`Approved`, `ChangesNeeded`, `Rejected`), interactive review checklist, reviewer note, and `Confirm Decision` (`POST /admin/kyc/{id}/review` -> `AD02`). |
| `AD16` | Platform Reports & Audit | Gap screen (Brief 02c) | `light-en/AD16.png`, `dark-ar/AD16.png` | **Yes** | Revenue & request breakdowns from `GET /admin/reports`, CSV export, and live audit trail from `GET /admin/audit`. |
| `AD17` | Reviews & Complaints | Gap screen (Brief 02c) | `light-en/AD17.png`, `dark-ar/AD17.png` | **Yes** | Customer reviews list from `GET /admin/reviews` with `Hide Review` / `Restore Review` moderation (`POST /admin/reviews/{id}/moderate`). |
| `AD18` | Support Inbox | Gap screen (Brief 02c) | `light-en/AD18.png`, `dark-ar/AD18.png` | **Yes** | Support ticket queue (`GET /admin/tickets`), ticket thread viewer, admin reply form (`POST /admin/tickets/{id}/reply`), and `Close Ticket` (`POST /admin/tickets/{id}/close`). |

---

## Module 7 — Shared & System (`SH01`–`SH21`, `NF01`)
**Reference Sheets:**
- `reference/design-images/07 Shared · 21 screens · Light.jpg`
- `reference/design-images/07 Shared · 21 screens.jpg` (Dark)
- Legacy source: `legacy-prototype/07_Shared.js`

| Screen | Title | Design Reference | Screenshots Inspected | Match | Defects Found & Fixed |
|---|---|---|---|---|---|
| `SH01` | Chat | `07 Shared · 21 screens` (#1) | `light-en/SH01.png`, `dark-ar/SH01.png` | **Yes** | Active conversation selector, real-time message bubbles, GPS location pin sharing (`POST /chat/threads/{id}/location`), and message input + Send button. |
| `SH02` | Change Password | `07 Shared · 21 screens` (#2) | `light-en/SH02.png`, `dark-ar/SH02.png` | **Yes** | Current/new/confirm password inputs with eye toggles, live 4-bar strength meter, and `POST /auth/change-password`. |
| `SH03` | Connection Interrupted | `07 Shared · 21 screens` (#3) | `light-en/SH03.png`, `dark-ar/SH03.png` | **Yes** | Offline warning card, active request code preservation, `<EmergencySOSBar />`, and working `Try Again` health check (`GET /system/status`). |
| `SH04` | Your Trips (Empty State) | `07 Shared · 21 screens` (#4) | `light-en/SH04.png`, `dark-ar/SH04.png` | **Yes** | Designed empty state with "Request Roadside Help" (`-> C06`) and "Find Service Centers" (`-> C17`). |
| `SH05` | Privacy & Terms | `07 Shared · 21 screens` (#5) | `light-en/SH05.png`, `dark-ar/SH05.png` | **Yes** | Interactive `Privacy Policy` / `Terms of Service` tabs loading versioned legal documents from `GET /support/legal/{key}`. |
| `SH06` | App Settings | `07 Shared · 21 screens` (#6) | `light-en/SH06.png`, `dark-ar/SH06.png` | **Yes** | Language (`EN`/`AR`), Theme (`Light`/`Dark`), and "Require OTP on sign-in" toggle persisting via `PUT /auth/me`. |
| `SH07` | Help & Support | `07 Shared · 21 screens` (#7) | `light-en/SH07.png`, `dark-ar/SH07.png` | **Yes** | `<EmergencySOSBar />`, expandable FAQ accordion (`useFaqs()`), support tickets list (`-> SH09`), and "New Support Ticket" (`-> SH08`). |
| `SH08` | New Support Ticket | `07 Shared · 21 screens` (#8) | `light-en/SH08.png`, `dark-ar/SH08.png` | **Yes** | Category selector, subject, description, optional attachment upload, and `POST /support/tickets` (`-> SH09`). |
| `SH09` | Support Ticket Detail | `07 Shared · 21 screens` (#9) | `light-en/SH09.png`, `dark-ar/SH09.png` | **Yes** | Ticket header with `SUP-####` code & status badge, message thread, and customer reply form (`POST /support/tickets/{id}/reply`). |
| `SH10` | Notification Preferences | `07 Shared · 21 screens` (#10) | `light-en/SH10.png`, `dark-ar/SH10.png` | **Yes** | Locked-on `Trips & Safety` toggle + interactive Push/SMS/Email/Promo toggles saving via `PUT /notifications/preferences`. |
| `SH11` | About FixNGo | `07 Shared · 21 screens` (#11) | `light-en/SH11.png`, `dark-ar/SH11.png` | **Yes** | Brand lockup, live build version from `/system/status`, platform highlights, and links to `SH07` and `SH05`. |
| `SH12` | Edit Account | `07 Shared · 21 screens` (#12) | `light-en/SH12.png`, `dark-ar/SH12.png` | **Yes** | Controlled full name, email, and phone form saving via `PUT /auth/me`, with links to `SH02` (Change Password) and `SH21` (Delete Account). |
| `SH13` | Log Out | `07 Shared · 21 screens` (#13) | `light-en/SH13.png`, `dark-ar/SH13.png` | **Yes** | User confirmation card with "Confirm Log Out" (`POST /auth/logout` -> `A03`) and "Cancel". |
| `SH14` | Bank Accounts | `07 Shared · 21 screens` (#14) | `light-en/SH14.png`, `dark-ar/SH14.png` | **Yes** | Lists provider bank accounts (`GET /payments/banks`) with holder name, bank name, masked IBAN (`••••1234`), Verified badge, and `+ Add Bank Account` (`-> SH20`). |
| `SH15` | Withdraw Earnings | `07 Shared · 21 screens` (#15) | `light-en/SH15.png`, `dark-ar/SH15.png` | **Yes** | Available wallet balance, controlled withdrawal amount input, destination bank account selector, live net payout calculation, and `POST /payments/withdrawals` (`-> SH16`). |
| `SH16` | Withdrawal Submitted | `07 Shared · 21 screens` (#16) | `light-en/SH16.png`, `dark-ar/SH16.png` | **Yes** | Shows `WD-####` reference, net payout, status badge, and 4-step payout tracker (`Requested -> Processing -> Sent -> Confirmed`) reactive to Simulator Dock updates. |
| `SH17` | Document Viewer | `07 Shared · 21 screens` (#17) | `light-en/SH17.png`, `dark-ar/SH17.png` | **Yes** | Fixed B4: renders actual uploaded document preview (`fileUrl(doc.fileId)`), metadata card, review status, and "Replace Document / Upload New" (`-> SH18`). |
| `SH18` | Upload a Document | `07 Shared · 21 screens` (#18) | `light-en/SH18.png`, `dark-ar/SH18.png` | **Yes** | Fixed B4: document type dropdown, real file input (`uploadFile(file, 'kyc')`), attaches via `POST /providers/kyc/documents`, and navigates to `A11`. |
| `SH19` | Emergency Assistance | `07 Shared · 21 screens` (#19) | `light-en/SH19.png`, `dark-ar/SH19.png` | **Yes** | Direct `tel:123` (Ambulance) and `tel:122` (Police) buttons, active trip GPS card, safety checklist, and `POST /support/sos`. |
| `SH20` | Add Bank Account | `07 Shared · 21 screens` (#20) | `light-en/SH20.png`, `dark-ar/SH20.png` | **Yes** | Egyptian bank dropdown from `bootstrap.banks`, account holder name, 29-char `EG...` IBAN validation, and `POST /payments/banks` (`-> SH14`). |
| `SH21` | Request Account Deletion | `07 Shared · 21 screens` (#21) | `light-en/SH21.png`, `dark-ar/SH21.png` | **Yes** | Password confirmation input, active-trip blocker rules, confirmation checkbox, and `POST /support/deletion` (`-> A02`). |
| `NF01` | Screen Not Available | Safe fallback screen | `light-en/NF01.png`, `dark-ar/NF01.png` | **Yes** | Non-destructive fallback screen with "Back to home" CTA. |

---

## Round 3 Visual & Behavioral Verification (`docs/REVIEW_FINDINGS_ROUND3.md`)

All `143` screens × `4` theme/locale variants (`572` phone-frame screenshots under `docs/evidence/screenshots/<variant>/<CODE>.png`) were regenerated after completing the Round 3 work order and visually re-inspected against `reference/design-images/*.jpg`:

1. **`A.1` Zero hard-coded fallbacks & canned literals**: Removed every `|| 'FG-1042'`, `|| 'INV-2026-0104'`, `|| 'BK-101'`, `|| 'KYC-0001'`, `|| 'TOW-01'`, `|| <number>`, `|| '+2010...'`, `'alternator'`, `'Verified FixNGo Specialist'`, `'Your FixNGo Specialist'`, `'El-alamia'` across all 7 screen modules. Extended `tools/mock-scan.ps1` with 44 forbidden literals + client fallback regexes (`\|\|\s*'[A-Z]{1,4}-\d{2,4}'`, `\|\|\s*\d`, `\|\|\s*'\+2010`) — verified **0 hits** across 108 files and in the 4-variant Playwright DOM sweep.
2. **`A.2` Notification deep links**: Added `resolveDeepLink(rawTarget, role)` in `client/src/app/stores.jsx` with automatic `window.history.replaceState` normalization so `offer:<id>`, `request:<id>`, `booking:<id>`, `kyc:<id>`, `ticket:<id>`, `invoice:<id>`, `withdrawal:<id>` resolve to `T03`/`M03`/`C10`, `C11`/`T04`/`M04`, `C38`/`SC03`, `AD03`/`A11`, `AD18`/`SH09`, `C15`, `SH16` without ever hitting `NF01` (verified by Playwright `F11`).
3. **`A.3` Expired/declined offer re-dispatch**: Updated `OfferService.SendAsync` to reuse/update existing non-pending `(RequestId, ProviderId)` rows in place and filtered `ForProviderAsync` by `ExpiresAt > clock.UtcNow` (verified by Playwright `F12` returning HTTP 200 OK).
4. **`A.4` & `A.5` Provider wallet earnings, completedJobs, 5.0 rating & invoice settlement**: Fixed `ReviewService.CreateAsync` to save the new review before recalculating aggregate rating; updated `PaymentService.EnsureInvoiceAsync` so `SubtotalMinor + ServiceFeeMinor == TotalMinor`; updated `RequestService.AdvanceAsync` (`Completed`) and `PaymentService.ConfirmCashAsync` to mark the invoice `Paid`, increment `CompletedJobs`, and idempotently credit the provider's wallet; updated `CenterService.CompleteBookingAsync` and `SC12`/`C38` to persist optional extra line items (`Oil Filter`, `EGP 75.00`) and create a `Paid` booking invoice reflected on `SC08` (`EGP 160.00 Revenue`, verified in `light-en/C15.png`, `light-en/T08.png`, `light-en/T09.png`, `light-en/SC08.png`, and Playwright `F03`/`F04`).
5. **`A.6` Admin `SH17` applicant document preview**: Updated `AD03` and `SH17` so clicking a document as Admin loads the applicant's KYC application via `GET /admin/kyc/{appId}`, displays the applicant's name (`Gate Two Mechanic`), hides `"Replace Document / Upload New"`, and highlights the `Verify` bottom-nav tab (verified by Playwright `F11`).
6. **`B.7`–`B.16` & `C` UI/UX polish**:
   - `sanitizeParams` strips object/function params so `[object Object]` never enters URL hashes (`B.7`, verified in `F04`).
   - `toUtcDate` normalizes bare SQLite ISO timestamps to UTC before formatting in `Africa/Cairo`, and `CenterService.AvailabilityAsync` converts Cairo local working hours (`UTC+2`) to UTC so `C19`, `C36`, `C38`, `SC02`, `SC03`, `SC11`, and the Simulator Dock display consistent Cairo times (`B.8`, verified in `light-en/C19.png` and `F04`).
   - `SC11` `"Start Service"` transitions the booking and work order to `InProgress` and remains on `SC11` before proceeding to `SC12` (`B.9`, verified in `F04`).
   - React Query cache is cleared on user/session change (`B.10`).
   - `M14` expertise chips and `A08` experience/expertise persist via `ProviderProfile.ExpertiseJson` (`B.11`, verified in `light-en/M14.png`).
   - Approving a `ServiceCenter` KYC seeds default 7-day working hours (`09:00`–`17:00`, Friday closed) and `"Bay 1"`, and marks all KYC documents `Approved` (`B.12`, `C`).
   - Checklists on `M06`, `T06`, `T14`, `SC11`, `SC12`, `AD15` start unticked (`B.13`, verified in `light-en/SC11.png`, `light-en/SC12.png`, `light-en/T14.png`, `light-en/M06.png`).
   - `AppTopBar` renders `title` on its own row below `[Back] [BrandLockup]`, `SH13` hides the bottom nav bar (`light-en/SH13.png`), `SH14`/`SH20` are accessible to `ServiceCenter` (`SC09`), Simulator Dock GPS updates provider coverage area & distance, and `AD01` matches the prototype 2x2 KPI grid + operational status card + attention list (`B.14`, `B.15`, `B.16`, verified in `light-en/AD01.png` and `dark-ar/AD01.png`).
