# 02a — Inventory: Auth (A01–A13) and Car Owner (C01–C43)

> Source: line-by-line analysis of `01_AuthOnboarding.js` and `02_CarOwner.js`. For each screen: what it shows, what is mock, what must become real. "→" means navigation. Read the actual JS file for the exact markup/design before porting a screen.
> Convention for this whole brief: every hard-coded person/number/date/id below is **MOCK and must disappear**; it is listed only so you recognise it and replace it with API data.

---
## A. Auth & onboarding (module `01_AuthOnboarding.js`)

Main (root) screens: A01, A02. Fallback-back: A03→A02, A04→A02, A05→(by otpContext: signup→A04, forgot→A06, login→A03), A06→A03, A07→A06, A08/A09/A10/A11/A12→A04, A13→A03.

| Id | Screen | Real behaviour required |
|---|---|---|
| A01 | Splash | On load: read token → `GET /me`; route to the role home (or onboarding step for providers with pending KYC) else → A02. Short timer (≤1.2 s). |
| A02 | Onboarding / Get Started | Static marketing (keep). Hero image must be a **local asset**. Get Started → A04, Log In → A03. |
| A03 | Login | Controlled `email` + `password` (eye toggle works). `POST /auth/login`. Role comes **from the account**. If the user has `otpOnLogin` enabled → A05 (context `login`). Wrong credentials → inline error; 5 failures → lockout 15 min message. Suspended → "account suspended" message. Provider not yet approved → login OK, lands on A11/application-status. "Continue with Google" is **hidden** (feature flag off). Remove prefilled values. |
| A04 | Sign up | Fields: full name (business name label when role = service center), email, phone (required for providers, optional for owners, Egyptian format `+20 1xxxxxxxxx` / `01xxxxxxxxx`), password, confirm password, role chooser (Car Owner / Mechanic / Tow Captain / Service Center). **Admin is never selectable.** Choosing a role must NOT overwrite typed values. Validation: name ≥2 chars, valid email, password policy (≥8, upper, lower, digit, symbol), passwords match, email/phone unique (409 → "already registered, log in or reset"). `POST /auth/signup` → sends OTP → A05 (context signup). |
| A05 | OTP (6 digits) | 6 boxes: numeric only, auto-advance, backspace, paste of 6 digits. Real countdown (2:00 TTL) and working **Resend** (cooldown 30 s, max 5/h). Verify → `POST /auth/verify-otp`. Max 5 attempts then code invalidated. Next step by context: signup → owner A12 / mechanic A08 / captain A09 / center A10; forgot → A07 (carries a one-time reset token); login → role home. OTP delivery goes through `IOtpSender` (fake → SMS/OTP simulator panels). |
| A06 | Forgot password | email → `POST /auth/forgot-password` (always responds generically, no user enumeration) → A05 (context forgot). Copy says "code" (not "link"). |
| A07 | New password | Fields: new password + confirm only (**remove the prefilled "verification code" field** — the code was verified in A05; log in DEVIATIONS). Live strength meter driven by input (≥8, upper, lower, digit, symbol). `POST /auth/reset-password {resetToken,newPassword}` → A13. |
| A08 | Mechanic registration step 2/2 | Fields: full name (prefilled from step 1, editable), phone, years of experience (**number**), expertise (multi-select of service types, real), document uploads (national ID, professional certificate, driving license) with real file inputs (JPG/PNG/PDF ≤10 MB). Submit → `POST /providers/mechanic/application` → A11. |
| A09 | Tow captain registration step 2/2 | Fields: name, truck make/model, truck type (enum: flatbed, hook, wheel-lift…), capacity in tonnes (**number**, 0.5–50), plate, documents (national ID, driving license, truck registration & insurance) with real uploads → `POST /providers/captain/application` → A11. |
| A10 | Service center registration step 2/2 | Fields: business name, address + map pin (lat/lng via fake map), phone, services offered (multi-select), documents (commercial license, tax ID, center photos) → `POST /providers/center/application` → A11. |
| A11 | Application status | Real: `GET /kyc/applications/me` → id (`KYC-####`), submitted date, status (`Submitted/UnderReview/ChangesNeeded/Approved/Rejected`), reviewer reason, which document needs replacement. Buttons: Replace document → SH18 with the **specific document type pre-selected**; Back to login → A03; when `Approved` → role home. |
| A12 | Location permission (owner only) | Allow → real `navigator.geolocation` (or GPS simulator) then `PUT /me/location` → C02; Manual → C25. |
| A13 | Password updated | → A03. |

Entities implied: `User`, `OtpCode` (purpose, hash, expiry, attempts, resend count), `PasswordResetToken`, `KycApplication` (+`KycDocument`), `RefreshToken/Session`, `UploadedFile`.

---
## B. Car owner (module `02_CarOwner.js`)

Bottom tabs: Home (C02), Garage (C04), Requests (C20), Centers (C17), Profile (C23). Main screens: C01, C02, C04, C17, C20, C23.
Fallback-back: C03→C02, C05→C04, C06→C02, C07→C06, C08→C07, C09→C08, C10→C09, C11→C10, C12→C11, C13→C12, C14→C13, C15→C14, C16→C15, C18→C17, C19→C18, C21→C20, C22→C02, C24→C04, C25→C07, C26→C06, C27→C26, C28→C09, C29→C09, C30→C29, C31→C27, C32→C13, C33→C14, C34→C14, C35→C34, C36→C19, C37→C17, C38→C37, C39→C38, C40→C18, C41→C16, C42→C21, C43→C38.
(With real params, "back" must return to the real previous screen using the history stack.)

### Home & garage
| Id | Screen | Mock to replace → real |
|---|---|---|
| C01 | Home — no vehicle | Shown when `GET /vehicles` is empty. Greeting uses real first name; location label from last known/reverse-geocoded location; "+ Add Vehicle" → C05. |
| C02 | Home — connected car | Real: user name, location label (tap → C25), unread-notification dot (→ C22), primary vehicle card (image, make/model/year/color/fuel/plate), "Request Roadside Help" → C06, quick services (SOS→SH19, Tow→C06 pre-selecting Tow, Mechanic→C06 pre-selecting Mechanic, Centers→C17), "Upcoming booking" = the nearest real upcoming booking (or hidden), **active-request resume banner** (if an active request exists → jump to its current screen). |
| C03 | Role chooser | **Delete** (demo role switcher). |
| C04 | My Garage | Real vehicle list (count in subtitle), primary badge; tap → C24 **with that vehicle id**; "+ Add Vehicle" → C05. |
| C05 | Add vehicle | Controlled fields: make, model (lookups), year (1990–current+1), plate (Latin/Arabic letters + digits, normalised, unique per owner), color, fuel type (petrol, diesel, hybrid, electric, gas), optional photo, "set as primary". Note: "plate shared only with assigned providers". `POST /vehicles`. |
| C24 | Vehicle detail/edit | Loads by id; edit same fields; primary toggle; **Delete works** with confirm; blocked (message) if vehicle has an active request; if primary deleted, another becomes primary; past requests keep the vehicle snapshot. |

### Roadside request wizard
| Id | Screen | Notes |
|---|---|---|
| C06 | What's wrong? step 1/3 | Tiles come from `GET /lookups/service-types`: Flatbed Tow, Mechanic, Battery Jump, Tire Change, Fuel, Other (+ small "Accident / someone injured" entry → P0). Continue disabled until chosen. Tow → C07; every other type → C26 **for that type**. Emergency numbers from platform settings. |
| C07 | Vehicle & location step 2/3 (tow) | Real vehicle selector (user's vehicles), "Use GPS" works (real geolocation or simulator), pickup address (editable, geocoded), tow destination (free text/geocode or choose a service center), estimated distance/ETA from `POST /requests/estimate`. Review → C08. |
| C25 | Confirm location | Search places (`GET /places/search`), reverse-geocode pin, "use my current location", recent places; Confirm returns to the **caller** (not always C07). |
| C26 | Describe issue (non-tow) | **Dynamic per service type** (follow-up questions from `GET /lookups/service-types/{id}/questions`): e.g. tire → affected tire, spare available; battery → lights on? ; fuel → fuel type/litres; mechanic → symptoms; common: is vehicle movable?, anyone injured? (yes → P0), free-text note, **photo upload (≤5 photos)**. Needs location + vehicle too (reuse C25/vehicle selector inside this flow; prototype skipped them). Header "Step 1 of 3" must be consistent (3 steps for every type). |
| C08 | Ready to send? step 3/3 | Summary of vehicle, pickup, destination, service type, fare **estimate range** from API; "Send Request" → `POST /requests` (with `Idempotency-Key`) → C09. Weak network: queue and replay without duplicates. |
| C09 | Finding your backup | Real request code (`FG-####` tow / `MR-####` mechanic), radius, "Searching" badge, live candidate count via SignalR; auto-advance to C10 (tow) / C27 (mechanic) when candidates exist; no candidates after expansion → C28; Cancel → C29. P0: skips lists, shows "offers sent to 3 providers". |
| C10 | Choose your captain (tow) | Real ranked candidates: name, rating, ETA, distance, price. Sort tabs work (Recommended / Fastest / Lowest price). Select → `POST /requests/{id}/select-provider` (offer sent, 30 s timeout) → waiting state → on accept C11; on reject/timeout toast + back to list with next candidate suggestion (FR-22). |
| C27 | Choose mechanic | Same mechanics for mechanic requests. Select → offer → on accept C11-style tracking for mechanic (re-use C11/C12; C31 is the post-arrival repair view). |
| C28 | No providers nearby | Reached when matching returns none: "Search again", "Expand radius" (5→10 km, stays in the **same** request type), "Change service", emergency numbers. Status `NoProviders`, no charge. |
| C29 | Cancel request | Real code/service/status; 4 reasons from lookup; fee shown from policy (0 if no provider assigned; configurable after assignment); **second confirmation** if urgent or already accepted (NFR-07). → `POST /requests/{id}/cancel` → C30. |
| C30 | Request cancelled | Real summary of the cancelled request. |
| C11 | Captain on the way | Real: request code, "Arriving in N min" from live ETA, **step X of 7 with correct bar math (X/7)**, provider name/rating/trips, truck make+plate, live map (provider position via SignalR every 5–10 s; "last seen" if stale), call (`tel:` provider phone, only after accept), Chat → SH01 (thread of this request), Timeline → C42. **Remove "Advance Trip Status"** (status is driven by the provider). Cancel available with confirmation. |
| C12 | Captain arrived | Real; auto-shown when status = Arrived. Shows provider + vehicle description. Next customer action = review estimate (C13). **Remove "Advance Trip Status".** |
| C13 | Approve estimate | Real breakdown from the quote (tow: base + distance×rate + service fee; mechanic: call-out + labor + fee). Approve → `POST …/estimate/approve` → payment choice C14; Dispute → C32. |
| C32 | Dispute estimate | Real reason + proposed resolution; `POST …/estimate/dispute`; request flagged `Disputed`, admin payment-review item created; Back → C13. |
| C14 | Choose payment | Methods: cash, saved card(s), Apple Pay (visible only if enabled by payment provider config). Summary uses the real request amount. Cash → record choice, continue to live tracking until provider confirms cash. Card/Apple → C34. "+ Add card" → C33. |
| C33 | Add card | Name, card number (Luhn), expiry (MM/YY, not past), CVV (never stored/logged), save toggle. Tokenised via `IPaymentGateway` (stores brand/last4/exp/token only). Returns to its **caller**. |
| C34 | Review & pay | Tabs card/Apple initial value = chosen method. Pay → `POST /requests/{id}/pay` → success → C15 (invoice) | declined → C35. **Remove "Simulate Declined Payment"** (use the declining test card/payment simulator instead). |
| C35 | Payment failed | Real failure reason, retry / choose another method, no duplicate charge. |
| C15 | Invoice "You're good to go" | Real invoice: number `INV-YYYY-####`, date, request code, **actual** payment method and status (cash shows "Awaiting provider confirmation" until confirmed, then "Payment verified"), breakdown, provider, paid time; receipt view/download (printable HTML/PDF). Customer **cash confirmation** button when method = cash. → Rate (C16). |
| C16 | Rate trip | Real provider + service + code; 1–5 stars (label reflects the number of stars), optional review text, once per request. `POST /requests/{id}/review` → C41. Skip allowed (rate later from history). |
| C41 | Thanks for review | Shows the submitted stars/text. |
| C31 | Repair underway (mechanic) | Real mechanic job view: timeline (assigned, arrived, diagnosis & quote sent, customer approved, repair complete…) from events, breakdown (call-out + labor + fee), chat, "Continue to payment" when work finished. Title/badge must match the real status ("underway" vs "complete"). |
| C42 | Request timeline | Real events with times, 7-step progress, pickup/destination, amount/method. → View receipt C15. |

### History, centers, bookings
| Id | Screen | Notes |
|---|---|---|
| C20 | Request history | Real paginated list (All/Completed/Cancelled filter works server-side); row → C21 **with id**. |
| C21 | Trip detail | Real by id: code, date, route map, provider card, invoice ref + method, timeline → C42/C15. |
| C17 | Service centers | Real list from `GET /centers?q&filter=nearby|top&lat&lng`, search box works (debounced), filters All/Nearby/Top rated + service type + distance; row → C18 with id. "My appointments" → C37. |
| C18 | Center detail | Real: name, rating, review count, verified badge, address/distance, **today's hours from working-hours**, services (name, duration, price), latest review; → C40, Book → C19. |
| C19 | Book appointment | Service picker (real), date chips = next 7 real days, time chips = **available slots from the API** (`GET /centers/{id}/availability?date&serviceId`) (no "13:00 AM" bug), vehicle picker, notes. `POST /bookings` (status Pending, slot held) → C36. Double-booking impossible. |
| C36 | Booking confirmed | Shows the **created** booking (`BK-####`, chosen slot, price, status Pending/Confirmed). |
| C37 | My appointments | Real list with status filter tabs (Upcoming/Completed/Cancelled); each → C38 with id. |
| C38 | Appointment detail | Real by id; Reschedule/Cancel visible **only for Pending/Confirmed**; completed → "Rate this visit" (center review) and invoice; "Message the center" → SH01 (booking thread). |
| C39 | Reschedule | Real current slot, slot picker from availability, price difference computed; confirm → `POST /bookings/{id}/reschedule` → C38 shows new slot. |
| C43 | Cancel appointment | Real reasons + fee from policy → `POST /bookings/{id}/cancel` → C37. |
| C40 | Center reviews | Real aggregate (avg, count, % recommend) + paginated reviews. |

### Notifications & profile
| Id | Screen | Notes |
|---|---|---|
| C22 | Notifications | Real list, tabs All/Trips/Bookings work, unread count real, "Mark all as read" works, tapping an item deep-links (screen + id) and marks it read. |
| C23 | Profile & settings | Real name/email/role badge; menu rows (Settings SH06, Notifications SH10, Change password SH02, Help SH07, Privacy SH05, About SH11, Log out SH13); badge → SH12. Add "Payment methods" row (manage saved cards). |

### Owner business rules to implement
- Request codes: `FG-####` (tow) and `MR-####` (mechanic request). Bookings `BK-####`. Invoices `INV-YYYY-####`. Sequence numbers allocated atomically.
- Fare for tow: `total = (towBase + distanceKm × ratePerKm) × surge + serviceFee` (prototype sample: 450 + 8.2 km×18.30≈150 + 50 = 650 EGP). The estimate range shown in C08 = ±8 % of the computed fare, rounded to 10 EGP.
- Cancellation allowed until `Completed`; fee policy configurable (default 0 before assignment; after assignment default 0 but recorded).
- A vehicle cannot be deleted while it has an active request or a pending/confirmed booking.
- Provider contact details (phone, exact location, plate) are shared only after acceptance (NFR-12).
