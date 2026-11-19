# 05 — Fake external services + the "Simulator Dock" (side panels next to the phone)

## Why
No real keys exist yet (Google Maps, SMS/OTP, payment gateway, push). The owner wants **fake providers that behave like the real thing**, plus visible **side windows next to the phone** to watch/drive them, and the ability to switch to real providers later *by configuration only* when real keys are supplied. These fakes are **services, not mock data**: they must work end-to-end against the real database (real OTP codes, real payment records, real notifications, real coordinates).

## 1. Provider abstraction (Application layer interfaces + Infrastructure implementations)

| Interface | Fake implementation (default, `Providers:*:"Fake"`) | Real (later; leave a stub class that throws `NotConfigured` with a clear message and README steps) |
|---|---|---|
| `IOtpSender` / `ISmsSender` / `IEmailSender` | Writes a `SimMessage{channel: sms|email, to, body, otpCode?, createdAt}` row + log line. Never talks to the internet. | Twilio / SMTP |
| `IPaymentGateway` | Fake PSP: tokenises cards (token `tok_fake_…`), charges, refunds, records `SimPaymentTransaction{id, requestRef, amount, method, status, failureReason}`; deterministic test cards (see 03 §6.4); bank-transfer simulation for withdrawals | Paymob / Stripe |
| `IGeocoder` | Small built-in gazetteer of Egyptian areas/landmarks (New Cairo, Fifth Settlement, 90th Street, Nasr City, Maadi, Zamalek, Giza, 6th of October, Sheikh Zayed, Alexandria…) with coordinates; free-text search = fuzzy match; reverse geocode = nearest gazetteer area label | Google Geocoding |
| `IRoutingService` | Haversine × 1.3, 30 km/h, returns polyline of 2–6 interpolated points (for drawing a route) | Google Directions/Distance Matrix |
| `IPushNotifier` | Records `SimPush{userId, title, body, deepLink}`; SignalR delivers it live | FCM |
| `IClock` | System clock (injectable for tests) | — |

`appsettings.json`: `Simulators:Enabled=true` (set at setup). When `false`: `/api/v1/sim/*` endpoints return 404, the dock is not rendered, and the Fake providers still work internally (or are replaced by Real ones if configured). Real providers are selected by `Providers:Otp|Payments|Maps|Push = Real` + their keys in `data\secrets.json`/env — document in `docs/PROVIDERS.md`.

## 2. Maps (the "fake Google Maps")
- Client `MapView` component with a provider switch `maps.provider = 'fake' | 'google'`. **Fake** = the existing `RadarMapCanvas` look (grid + pulse + markers) but **driven by real lat/lng**: project coordinates into the card's pixel box around the midpoint, scale to fit all markers, draw the real route polyline (from the routing service) and the provider marker moving as `provider.location` events arrive. Labels (ETA/distance/area) come from API data.
- Where used: C07/C25 (pick location: click/drag pin on the fake map + search box via geocoder), C09–C12/C42 (tracking), M04/M05, T03–T07, A10/SC09/M15 (pins/coverage radius), SC10 not needed.
- Browser GPS: wrapper `getPosition()` → real `navigator.geolocation` unless the GPS panel (below) has an override; permission denied → manual flow (FR-12).

## 3. Simulator Dock (UI)
Layout (desktop ≥ 1100 px): phone frame centered; **dock on the right of the phone** (collapsible, remembers state); on narrow screens the dock becomes a bottom sheet toggled by a small floating button; **hidden on real phones when `simulatorsEnabled=false`**.
The dock has **5 tabs/panels**, each with an unread/new badge (small red dot + count) that pulses when something new arrives (SignalR `sim.*` events):

1. **Notifications** — looks like a phone notification shade: list of push/in-app notifications for the **currently logged-in user** (title, body, time, deep-link, read state); red dot on the tab when unread; click = simulates tapping the notification (navigates the phone to the deep link). Toggle "All users" (shows everyone's pushes with the recipient name).
2. **Payments** — table of fake gateway transactions (time, request/booking/invoice ref, payer, method, amount, status). Actions: for `Pending` 3-D-secure style charges → **Approve / Decline**; **Refund**; a "Bank" sub-tab listing withdrawals with buttons to advance state (Processing → Sent → Confirmed / Fail) which pushes `withdrawal.status` live to the provider's phone; test-card cheat-sheet.
3. **SMS** — inbox of every SMS (and a tab for emails) the system "sent": time, recipient (name + phone/email), body; copy button; unread dot.
4. **OTP** — the **active OTP codes** (recipient, purpose signup/login/forgot/contact-change, the code, expiry countdown, attempts left, resend count) with **Copy** and **Autofill** (writes the code into the OTP boxes of the open phone screen A05); expired codes greyed out.
5. **GPS / Maps** — fake device location controls for the current user: lat/lng inputs + click-on-mini-map + preset buttons (New Cairo, Maadi, Nasr City…); for providers: **"Drive to customer" auto-simulation** (moves the provider along the route, sending location pings every 5 s, speed slider) and "Go stale" (stop pings to test the "last seen" state); "Simulate weak network" toggle (adds latency/failed calls on the client to test queue/replay and SH03).

Dock endpoints (all `[Authorize]`, only when simulators enabled): `GET /api/v1/sim/messages?channel=`, `GET /api/v1/sim/otps`, `GET /api/v1/sim/push?all=`, `GET /api/v1/sim/payments`, `POST /api/v1/sim/payments/{id}/approve|decline|refund`, `GET /api/v1/sim/withdrawals`, `POST /api/v1/sim/withdrawals/{id}/advance|fail`, `PUT /api/v1/sim/gps`, `POST /api/v1/sim/gps/drive`. Because the dock is a dev tool it may show cross-user data; it must **never** be reachable when simulators are disabled (test this).

## 4. Multi-user testing without extra tooling
Tokens are kept in `sessionStorage` when simulators are enabled (so each browser tab/incognito window is an independent logged-in user: e.g. tab 1 = customer, tab 2 = captain, tab 3 = admin) and in `localStorage` otherwise. Mention this in the README. The OTP/SMS/Notification panels work in every tab.

## 5. Acceptance for this module
- Sign-up in the phone → OTP appears in panels 3 and 4 within 1 s → Autofill → verified.
- Customer card payment → appears in Payments panel → approve/decline changes the phone's screen live.
- Captain "Drive to customer" → customer's map marker moves, ETA decreases, status step updates; stop pings → "last seen" appears.
- Disabling simulators in config hides the dock and 404s the sim endpoints.
- Switching a provider to `Real` without keys fails fast at startup/first use with a clear message (does not silently fall back).
