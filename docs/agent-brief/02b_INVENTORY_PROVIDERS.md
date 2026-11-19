# 02b — Inventory: Mechanic (M01–M15), Tow Captain (T01–T15), Service Center (SC01–SC16)

> Same conventions as 02a. All names/numbers quoted are prototype MOCK values to be replaced by API data.

---
## A. Mobile mechanic (`03_Mechanic.js`)

Tabs: Console (M01/M02), Jobs (M10), Earnings (M07), History (M08), Profile (M09). Main screens: M01, M02, M07, M08, M09, M10.
Fallback-back: M03→M02, M04→M03, M05→M04, M06→M11, M11→M05, M12→M06, M13→M08, M14→M09, M15→M09.

| Id | Screen | Real behaviour |
|---|---|---|
| M01 | Console — Offline | Greeting with real first name; **Go Online is a real action** `POST /provider/availability {isOnline:true,lat,lng}`; blocked with explanation if account not Verified (UC-21 2a). Stats today (jobs, rating, earnings) from `GET /provider/dashboard`. Map shows coverage zone (fake map driven by real lat/lng + radius). |
| M02 | Console — Online | Real stats; toggle goes offline (blocked while active job). Offer card shown **only when a live offer exists** (SignalR `offer.created`), with real countdown to `expiresAt`, service, customer first name + area, distance/ETA (computed), estimated earnings (net). Location heartbeat `POST /provider/location` every 5–10 s while online/en-route. Auto-offline after 2 min without heartbeat. |
| M03 | Incoming request | Real offer: service + description, distance, ETA, net earnings, customer estimate + platform fee, pickup **area label only** before accept. Accept → `POST /offers/{id}/accept` (race-safe: first accept wins; others get "already taken") → M04. Decline (optional reason) → M02. Offer expiry while on screen → toast + M02. |
| M04 | Request details | After accept: full customer name, vehicle (make/model/year/color/plate), customer note, photos (real uploaded), exact pickup on map, estimate. "Navigate to customer" → M05 (+ `POST …/en-route`). |
| M05 | En route | Real map/ETA, status step "X of 7" with **X/7 bar**, customer card, phone (`tel:`), Chat → SH01 (thread of the request). "Arrived" → `POST …/arrive` → M11. |
| M11 | Diagnosis & estimate | **Controlled inputs**: diagnosis (required textarea), call-out fee (number ≥0, default = platform mechanic base), labor (number ≥0), optional parts lines (name, qty, price). Totals recalc live: `customerTotal = callout + labor + parts + serviceFee(50 default from settings)`, `net = customerTotal − serviceFee`. Button label shows real total. "Send Quote" → `POST …/quote` → **waits for customer approval** (waiting state; quote can be revised) → when approved → M06. |
| M06 | Repair in progress | Real on-site start time, breakdown from the approved quote, working checklist (interactive; items from lookup), optional extra-parts re-quote (creates new quote version needing customer approval), "Complete Job" disabled until checklist done → `POST …/complete` → M12. |
| M12 | Complete job & payment | Interactive completion checklist; payment method shown from customer's choice; **cash:** amount-to-collect = real total; "Confirm Cash Received" → `POST …/payment/cash-confirm {amount}`; card: shows "Paid online — verified" and a "Finish" button. → M13. |
| M13 | Completed job details | Real by id: totals, fee, net, real timeline events, payment status. "View receipt" shows the real receipt (not earnings). |
| M07 | Earnings | Period chips work (week/month/all) → `GET /provider/earnings?period=`; balance = real wallet balance; growth % vs previous period; completed jobs count; today; daily list (real dates, weekday names derived from locale, count of jobs per day); Withdraw → SH15. |
| M08 | History | Real paginated completed/cancelled jobs, filter works; row → M13 with id; shows vehicle make (not "Hyundai / Kia" placeholder). |
| M09 | Provider profile | Real name/avatar, rating, completed jobs, verified badge (from KYC status), experience years, coverage area+radius, real documents list with status + expiry (each → SH17 **with document id**), Edit → M14, Coverage → M15, Settings → SH06. |
| M10 | Jobs hub | Tabs Incoming / Active / Scheduled are real (`GET /provider/jobs?status=`), counts real. "Continue active job" opens the screen matching the **real status** (M05/M11/M06/M12). |
| M14 | Edit professional profile | Controlled: name, email, phone (changing contact → re-verification OTP), years of experience (number), expertise (editable multi-select), avatar upload. Save → `PATCH /provider/profile`. |
| M15 | Coverage & availability | Coverage area name + center (map pin), radius km (1–50), "available for new requests" toggle **synced with M01/M02 state**. Save → `PUT /provider/coverage`. |

Mechanic job state machine (stored as `ServiceRequest.Status` + `RequestEvent`s):
`Searching → Offered → Accepted → EnRoute → Arrived → QuotePending → QuoteApproved → Working → AwaitingPayment → Completed` ; side exits `Cancelled`, `NoProviders`, `Disputed`; offer sub-state `Pending/Accepted/Declined/Expired/Withdrawn`.

---
## B. Tow captain (`04_TowCaptain.js`)

Tabs: Dashboard (T01/T02), Trips (T11), Earnings (T09), History (T12), Profile (T10). Main screens: T01, T02, T09, T10, T11, T12.
Fallback-back: T03→T02, T04→T03, T05→T04, T06→T05, T07→T06, T08→T14, T13→T12, T14→T07, T15→T10.

| Id | Screen | Real behaviour |
|---|---|---|
| T01 | Dashboard — OFF duty | Real greeting, truck card from the captain's truck (unit code, make/type, plate, capacity), real stats; **Go online** is real (blocked if unverified). **Remove role switcher pills.** |
| T02 | Dashboard — ON duty | Real header, stats (today's jobs, rating, earnings), current offer card only if a live offer exists (countdown to `expiresAt`, car + service, route pickup→destination + km, offer amount), map. Toggle → off (blocked during a trip). |
| T03 | Incoming tow request | Real offer: request code, customer first name, pickup area, destination (service center or address) + km, vehicle make/model/year/color (plate only after accept), pickup ETA, price. Accept → `POST /offers/{id}/accept` → T04; Decline (+reason) → T02; expiry handled. P0 offers show a red "Emergency" tag and 15 s timer. |
| T04 | Request details | After accept: customer, vehicle with plate, **the customer's real vehicle/problem photo (not the flatbed stock image)**, customer note, estimate. "Start navigation to pickup" → `POST …/en-route` → T05. |
| T05 | Heading to pickup (step 3/7) | Real map/ETA/distance, X/7 bar, customer phone `tel:` + Chat → SH01; "Arrived at customer" → `POST …/arrive` → T06. Location pings every 5–10 s. |
| T06 | Load the vehicle (step 4/7) | **Interactive checklist** (customer & vehicle confirmed, parking brake released, wheels strapped, safety lights/ramps) persisted; condition photos list (real uploads via SH18 with `requestId`); "Vehicle Loaded" disabled until checklist ticked and ≥1 photo → `POST …/loaded` → T07. |
| T07 | On the way to center (step 5/7) | Real map to destination, pickup/destination cards, "Arrived at destination" → `POST …/arrive-destination` → T14. |
| T14 | Handover & collect payment | Interactive unloading checklist; fare breakdown (base + distance + service fee = total, from the approved quote); **cash:** captain types/confirms collected amount; card: "Paid online — verified". "Finish Trip" → `POST …/complete {collectedAmount}` → T08 (button label identical in EN/AR logic). |
| T08 | Trip completed | Real totals, distance, duration, the **customer's rating of the captain once available** (else "Not rated yet"), breakdown. → T02. |
| T09 | Earnings | Real wallet balance, week-over-week %, completed jobs, today, rating; daily list (real dates, trips per day); period selector works; Withdraw → SH15. |
| T10 | Captain profile | Real name/rating/trip count; verified badge from KYC; truck card; documents (driving license, vehicle registration & insurance) with real status + expiry → SH17 with id; Edit → T15; Settings → SH06. |
| T11 | Trips hub | Real: incoming offer card (if any) **and/or** the active trip card (never the same request in both states); counts real. |
| T12 | Trip history | Real paginated list incl. cancelled trips with their own customer/vehicle info (fix the "Collected" bug); filter works; row → T13 with id. |
| T13 | Trip details & receipt | Real by id: route, distance/duration, 7-stage timeline with real times, **real cash receipt** (the old "View Cash Receipt" jumped to earnings: fix); cancelled trips have a distinct view. |
| T15 | Edit captain & truck | Controlled: full name, phone (E.164), email, truck make, truck type (enum), plate, capacity tonnes (number 0.5–50), truck photo upload. Unique phone/email/plate; plate/capacity change → document re-verification flag. |

Tow trip stages (7): Requested → Matched → En route → Arrived → Working (loaded & in transit) → Payment (at destination) → Completed. Progress bar = stage/7.

---
## C. Service center (`05_ServiceCenter.js`)

Tabs: Overview (SC01), Bookings (SC02), Catalog (SC04), Reports (SC08), Profile (SC09). Main screens: SC01, SC02, SC04, SC08, SC09.
Fallback-back: SC03→SC02, SC05→SC04, SC06→SC01, SC07→SC01, SC10→SC02, SC11→SC03, SC12→SC11, SC13→SC06, SC14→SC06, SC15→SC09, SC16→SC03.

| Id | Screen | Real behaviour |
|---|---|---|
| SC01 | Overview | Real center name/image, today's date, KPI tiles (bookings today, active services (= active catalog items), rating), menu counts (pending bookings, active work orders, bays in progress, reviews), **today's hours from working-hours** (or "Closed today"). |
| SC02 | Appointments | Filter tabs Pending / Confirmed / In-Progress / Completed (+Rejected/Cancelled under "All") are real (server-side); cards show real booking code, status chip matching the filter, service, customer · vehicle, datetime, price; card → SC03 with id; "Calendar" → SC10. |
| SC03 | Appointment detail | Real by id: created time, status chip, customer (name, phone), vehicle (make/model/year/plate), service, slot, price, customer note. Workflow buttons are state-driven: Pending → Accept (`POST /center/bookings/{id}/accept`) / Reject (→ SC16); Confirmed → Start Service; In-progress → Complete (→ SC12). |
| SC04 | Service catalog | Real services (name, duration, price) with Active/Inactive toggle persisted (`PATCH …/active`); row → SC05 with id; "Add Service" → SC05 in **create mode (empty form)**. |
| SC05 | Edit/Create service | Controlled: name (required), description, price EGP (>0), duration min (>0, multiple of 5), active toggle; Save → POST/PUT, **toast on success**, back to SC04; Delete (blocked with warning listing pending/confirmed bookings for that service — UC-26 2a). |
| SC06 | Work orders | Real list; tabs In progress / Ready / All work; subtitle counts real (active repairs, bays available); elapsed time = now − startedAt (live); card → SC14 with id; "Assign new work order" → SC13. |
| SC07 | Driver reviews | Real summary (avg, ★ derived, count, % recommend) and paginated list; filter All / 5 stars / With comments works. |
| SC08 | Reports | Period tabs This week / This month / Custom (real date pickers) → `GET /center/reports`; KPIs total bookings, revenue, avg rating; revenue vs previous period % (label matches the period); top services chart with **bar heights computed from data**; % of bookings per top service, on-time completion %, repeat customers %; period label real. |
| SC09 | Center profile | Controlled: name, phone, description, address + map pin (lat/lng), logo/photo upload; working-hours widget real (7 days, special days highlighted) → SC15; Settings → SH06; Save persists (toast). |
| SC10 | Appointment calendar | Real day selector (next days), slots computed from working hours + service duration + bay capacity: Available / booked (with booking code, status) ; booked → SC11 (Confirmed) or SC03 (Pending); footer counts real. |
| SC11 | Accepted appointment | Real by id; pre-start checklist (check-in recorded `checkedInAt`); **Start Service** → `POST …/start` (status In-Progress) then to SC06/SC14 (create/assign work order) — not straight to "Complete". "Complete service" row enabled only after start. |
| SC12 | Complete service & invoice | Interactive completion checklist; invoice lines (service + optional extra lines: description, amount), total; completion notes (editable); `POST …/complete` creates invoice `INV-SC-####`, notifies customer, payment status **Unpaid (due at center)**; "Confirm payment received (cash/card at center)" action sets Paid. Banner appears **after** success only. |
| SC13 | Assign work order | Booking picker (Accepted/Confirmed bookings only), bay picker (available bays only), technician picker (center technicians), notes; `POST /center/work-orders` → reserves bay, notifies technician → SC14. |
| SC14 | Work order details | Real by id; status chip colour consistent with SC06; diagnostics checklist interactive and persisted; mechanic notes editable; supervisor review toggle gates "Mark Ready for Review" → `POST …/ready` (status Ready) → SC06. |
| SC15 | Edit working hours | Per-day open/close time pickers (validated close>open), per-day closed toggle (Friday default per saved data), save → future slots updated, existing confirmed bookings untouched (warn about conflicts and list them — UC-26 3a). |
| SC16 | Reject appointment | Reason **picker** (lookup list: no bay available, fully booked, service unavailable, outside hours, other) + editable message to customer + notify toggle; only for Pending; `POST …/reject` → SC02. |

Missing → add **SC17 Bays & technicians** (SHOULD): list/add/edit/disable bays (name, active) and technicians (name, phone, active); entry point from SC09/SC13.

Service center business rules: booking states `Pending → Confirmed → InProgress → Completed`, `Pending → Rejected`, `Pending/Confirmed → Cancelled`, `Pending → Expired` (after 24 h default; slot released). Prices are **snapshotted** on the booking at creation. Work order states `Assigned → InProgress → ReadyForReview → Closed`. Invoice `Issued(unpaid) → Paid`.
