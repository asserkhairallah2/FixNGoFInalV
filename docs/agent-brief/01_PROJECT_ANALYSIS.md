# 01 — Analysis of the existing FixNGo project (what you are starting from)

> This file describes the project **as it is today**. It was produced by reading every file and by running the prototype in a real browser and taking screenshots. Treat it as ground truth.

## 1. What the project is

FixNGo = "An Integrated Vehicle Roadside Assistance and Car Care Platform" (Egypt, EGP currency, Arabic + English, RTL).
Actors: **Car Owner (customer)**, **Mobile Mechanic**, **Tow Captain**, **Service Center**, **Admin**.

The folder `C:\Users\xprenspel\Desktop\FixNGoFinal` currently contains **only a front-end prototype (mock UI)** (in `legacy-prototype\`) plus specs/design images (`reference\`). There is **no backend, no database, no .NET code, no tests**. `STATE.md` claims a finished ASP.NET solution — that is **outdated/aspirational; none of it exists on disk**. Do not trust STATE.md for status; you will rewrite it.

## 2. Files on disk (paths relative to `FixNGoFinal\`)

| Path | Size | What it is |
|---|---|---|
| `legacy-prototype/fixngo_complete_interactive_app.js` | 50 KB | Host `App` component: phone frame, dev sidebar (module/screen selector), theme + language state, navigation history, `MOCK_PRESETS` (fake users + plaintext passwords), shared UI kit (`AppTopBar`, `PrimaryButton`, `SecondaryButton`, `StatusBadge`, `RadarMapCanvas` fake map, `EmergencySOSBar`, `FixNGoShieldLogo`, `FixNGoBrandLockup`), bottom nav per role. |
| `legacy-prototype/01_AuthOnboarding.js` | 36 KB | Screens A01–A13 |
| `legacy-prototype/02_CarOwner.js` | 152 KB | Screens C01–C43 |
| `legacy-prototype/03_Mechanic.js` | 56 KB | Screens M01–M15 |
| `legacy-prototype/04_TowCaptain.js` | 55 KB | Screens T01–T15 |
| `legacy-prototype/05_ServiceCenter.js` | 83 KB | Screens SC01–SC16 |
| `legacy-prototype/06_Admin.js` | 77 KB | Screens AD01–AD15 |
| `legacy-prototype/07_SharedSettings.js` | 87 KB | Screens SH01–SH21 (chat, settings, bank, withdrawals, documents, SOS, support, legal) |
| `legacy-prototype/run_localhost.bat` | 7 KB | Starts a tiny PowerShell TCP static server on port 3000..3010. The HTML is embedded in the bat; it loads **Tailwind, Babel-standalone, React, lucide-react from CDNs (internet required)** and compiles the `.js` files in the browser. |
| `AGENT.md` | 4 KB | Architecture rules (Arabic): .NET 8, ASP.NET Core, EF Core Code-First, Clean Architecture (Domain / Application / Infrastructure / Web), `IEntityTypeConfiguration<T>` per entity, no entities in views, FluentValidation + AutoMapper, secrets not in code, Scoped lifetimes. **Still valid — follow it** (see precedence rules in `00_MASTER_PROMPT.md`). |
| `STATE.md` | 7 KB | Outdated status file (Arabic). |
| `reference/fixngo_software_requirements_specification.md` | 26 KB | SRS: FR-01..FR-45, NFR-01..NFR-18. |
| `reference/fixngo_system_analysis_design.md` | 59 KB | System analysis & design: UC-01..UC-32, status life-cycle, P0 emergency path, N-tier modular monolith, SignalR, idempotency keys, outbox. |
| `reference/design-images/*.jpg` (34 images) | — | **Design spec images**: Dark + Light variants for each module (Auth 7+6, Car owner 23+20, Mechanic 9+6, Captain 10+5, Center 9+7, Admin 5+9, Shared 5/6+15), "destination index" sheets for the 68 continuation screens, UI kit, reusable components. These are the visual source of truth for layout. Look at them when a screen's layout is unclear. |
| `reference/extra-images/` | — | 3 small reference images (module selector, a profile screen, a screenshot). |

## 3. The 138 screens

| Module | Prefix | Count | Bottom tabs |
|---|---|---|---|
| Auth & onboarding | A01–A13 | 13 | none |
| Car owner | C01–C43 | 43 | Home, Garage, Requests, Centers, Profile |
| Mechanic | M01–M15 | 15 | Console, Jobs, Earnings, History, Profile |
| Tow captain | T01–T15 | 15 | Dashboard, Trips, Earnings, History, Profile |
| Service center | SC01–SC16 | 16 | Overview, Bookings, Catalog, Reports, Profile |
| Admin | AD01–AD15 | 15 | Overview, Verify, Users, Pricing, Profile |
| Shared | SH01–SH21 | 21 | (sub-screens of the role that opened them) |

Each module file exports `XXX_SCREENS` (list of `{id,label,labelAr,tab}`), `XXX_MAIN_SCREENS` (root/tab screens, no back button) and `XXX_FALLBACK_BACK` (logical parent) plus a default component that is one big `switch(screenCode)`.
Full per-screen detail is in `02a/02b/02c_INVENTORY_*.md`.

## 4. How the prototype behaves (verified in a browser)

- Renders correctly in Chromium (no blank screens, no console errors, no broken images). Layout: left dev sidebar + a 393×852 phone frame centered. Light/dark theme and EN/AR (RTL) work and look good — **the visual design is approved and must be preserved.**
- Login screen A03 shows pre-filled `ahmed.mohamed@gmail.com` + masked password; pressing Login jumps straight into the Car Owner home regardless of credentials (role comes from `lastRole`, not from the account).
- The sidebar lets you jump to any of the 138 screens and switch role — a **developer tool that must not exist in the product**.
- Typical home screens: C02 (vehicle card with image, "Request Roadside Help", quick services, upcoming booking), AD01 (KPIs: total users, active requests, pending verifications, payments), C11 (map card with route, step bar "Step 3 of 7", captain card, Chat/Timeline).

## 5. Systemic defects of the prototype (the backend/front-end work must fix ALL of these)

1. **100 % static.** Almost no controlled inputs; most "fields" are `<div>`s showing a value. Primary buttons only navigate. Nothing persists.
2. **Detail screens never receive an id** — every list row opens the same hard-coded record (e.g. BK-2048, FG-2606, MR-2611, KYC-1042, SR-108, WO-3102, Ahmed Mohamed).
3. **Filters/tabs/sorts do nothing** (almost everywhere) and counts are literals ("14 pending", "Open (2)", "12,482 accounts").
4. **Success/result banners are pre-rendered** before the user acts ("Reconciled · Audit saved", "Work order assigned", "Decision saved").
5. **Dangerous `default:` branches** in the screen switches: unknown id → `SH21 Delete account`, `SC16 Reject appointment`, `AD15 Verification decision`, `T02`, `M02`, `A02`.
6. **Hard-coded dates/times** ("6 November 2026", "14:45", "Thu · 5 Nov") and **Arabic-Indic digits baked into strings**; money/distance/time are pre-formatted strings.
7. **Inconsistent numbers/states across screens** (BK-2048 is Pending in one screen and Confirmed in another; "4 active repairs" with 2 rows; "Step 3 of 7" with a 3/6 bar; 4,550 balance vs 1,950 today).
8. **Demo-only controls:** role-switcher pills (C01, C03, M01, M02, T01, T02), "Advance Trip Status" (C11, C12), "Simulate Declined Payment" (C34), `MOCK_PRESETS` auto-fill when picking a role on sign-up (it overwrites what the user typed), the whole dev sidebar, "Require OTP on Login" switch in the sidebar.
9. **Dead buttons:** Resend OTP, Use GPS, phone/call buttons, Mark all as read, delete vehicle, copy setup key, revoke session row, Open Device Settings, Call 123/122 (they call `handleBack`), Continue with Google, upload tiles, etc.
10. **Remote stock images** (Unsplash URLs) for car, workshop, avatars — breaks offline and is fake data.
11. **Structure problems:** shared UI components are defined *inside* `App()` (re-created every render); heavy prop-drilling; screen-id string switches; no URL routing; no role guard; no loading/empty/error states anywhere.
12. **Auth logic:** role chosen from host state not account; passwords unbound; OTP digits never checked; OTP countdown static; reset flow asks for the code twice; A11 always shows "Changes needed — driving license".
13. **Provider data privacy:** offer screens show customer name/phone/exact pickup before acceptance (SDD NFR-12 says reveal only after acceptance).
14. **Flow-order contradictions:** payment screens appear before the "Working" stage; mechanic flow (C26→C27→C31) ignores the chosen service type and skips location/quote approval.

## 6. Gaps: things the SRS/SDD require that the prototype has NO screen for
(Implement them; reuse the existing visual language. See `06_FRONTEND_MIGRATION.md` §7.)

- Photo upload on a request (FR-15), full follow-up questions per problem type (FR-14), accident/injury **P0 emergency path** (parallel offers to top 3, 15 s timeout) (UC-04 5a, UC-10 3a).
- Real call button (`tel:`) and real location-sharing in chat (FR-27..29).
- Customer cash-confirmation, real invoice generation, receipt view.
- Reporting a user / a review (FR-42, UC-30), admin moderation of reviews & complaints, admin reports/statistics (UC-31), admin support inbox.
- Rating a service center after a completed booking.
- Service-center bays & technicians management (needed by SC13 work orders).
- Document upload with real file input for mechanic / captain / center registration (UC-02) and re-submission.
- Real empty / loading / error / offline states (NFR-15 weak-network, SH03).
