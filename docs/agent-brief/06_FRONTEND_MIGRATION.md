# 06 — Front-end migration (prototype → real app)

Goal: keep the **approved visual design 1:1** (layout, colours, spacing, icons, EN/AR RTL, light/dark) but turn the 138 static screens into a real application wired to the API. Original files stay untouched in `legacy-prototype/` and the new code lives in `client/`.

## 1. Project setup
- `client/`: Vite + React 18, **JavaScript/JSX** (keep the existing JSX; add JSDoc where useful — do not convert everything to TypeScript), Tailwind CSS **3.4** + PostCSS (the prototype uses Tailwind CDN classes incl. arbitrary values like `bg-[#E51C23]`; make sure `content` globs cover all files), `lucide-react`, `@tanstack/react-query`, `@microsoft/signalr`, `qrcode`.
- **No CDN, no remote images at runtime.** Everything bundled → the app must work offline (except the fake services which are local). Replace Unsplash hero/stock images with local assets (download once into `client/src/assets/`, or draw SVG illustrations). Avatars = uploaded photo or initials circle; vehicle image = uploaded photo or a generic car illustration; workshop image = center photo or generic.
- Build output goes to `src/FixNGo.Web/wwwroot` (`vite build --outDir ../src/FixNGo.Web/wwwroot --emptyOutDir`); dev mode proxies `/api` and `/hubs` to the backend. Configure SPA fallback in ASP.NET.
- Hash-based URLs (`#/C21?id=…`) so reload keeps position and Playwright can deep-link screens.

## 2. Code structure
```
client/src/
  main.jsx, App.jsx (shell), styles.css
  app/        nav store (go/back/replace + params + history), session/auth store, theme+lang store, role guard, ErrorBoundary, NotFound
  api/        http client (fetch wrapper: base URL, auth header, refresh-on-401 once, idempotency keys, ProblemDetails → typed errors, offline queue for idempotent POSTs), hooks per area (useVehicles, useRequest, …), signalr.js
  ui/         the SHARED UI KIT as STABLE top-level components (move out of App(): AppTopBar, PrimaryButton, SecondaryButton, StatusBadge, MapView, EmergencySOSBar, ShieldLogo, BrandLockup, Field, Toggle, Chip, EmptyState, Skeleton, ErrorState, Toast, ConfirmDialog, OtpBoxes, FilePicker, StarRating…)
  i18n/       format helpers (fmtMoney, fmtDate, fmtTime, fmtDistance, fmtNumber via Intl with locale ar-EG / en-GB, timezone Africa/Cairo), small dictionary for NEW strings only
  modules/    auth/ owner/ mechanic/ captain/ center/ admin/ shared/  (the 7 original modules, ported screen by screen)
  sim/        SimulatorDock + 5 panels (see 05)
```
- Keep the existing **inline bilingual strings** (`isAr ? 'ar' : 'en'`) — do not rewrite translations. Only replace data-bound literals with API values and Intl formatting (no Arabic-Indic digits baked into strings; format numbers through helpers so Arabic mode shows Arabic digits automatically).
- Replace prop-drilling with contexts/hooks: `useNav()`, `useSession()`, `useTheme()`, `useLang()`.
- Screen codes (`C21`, `SC03`, …) stay as route names. A screen registry maps `code → {component, roles, tab, main:boolean, fallbackBack}`; unknown/forbidden code → `NotFound` (never a destructive screen). Navigation API: `go(code, params)`, `back()` (pops real history first, then `fallbackBack`), params carry ids (`go('C21',{id})`).
- Every data screen has **loading (skeleton), empty, error (retry)** states; every form has validation with inline errors, disabled-while-submitting buttons, success toasts, and server-error mapping.
- Weak network (SRS NFR-15): offline banner; idempotent POSTs (request creation, messages, status updates) are queued and replayed in order; no duplicates.
- `StatusBadge`: map **real enum values** to colours/labels (add statuses beyond Online/Pending/Completed/Cancelled: Accepted, EnRoute, Arrived, Working, Disputed, Suspended, Verified, Rejected, Unpaid, Paid …). Stop reusing "Online" for unrelated meanings.
- Fix progress bars (`step/7`), pre-rendered banners (render only after success), `default:` fallbacks, plate display (store normalised, show spaced), "AM" appended to 24-h times, etc. (see `01_PROJECT_ANALYSIS.md` §5 and the inventories).

## 3. The app shell
- **Remove** the left dev sidebar, screen selector, module selector, Prev/Next, "Show controls", `MOCK_PRESETS`, `switchRolePreview`, role pills, "Require OTP on Login" switch, "Live" ping label, "138 screens" labels.
- Desktop (≥ 768 px): a centered phone frame (393×852, rounded, dark bezel as in the prototype) containing the app, plus the Simulator Dock when enabled; the area around is the neutral `#EEF2F6` background. Mobile (< 768 px): full-screen app with no frame, dock as a bottom sheet. Support `prefers-reduced-motion`.
- Theme/language persisted per user (server) + `localStorage` before login; applied before first paint (no flash); `dir="rtl"` for Arabic including the OTP row exception (`dir="ltr"`).
- `GET /api/v1/system/status` on boot: show the **DUMMY DATA MODE** ribbon, handle `setupComplete=false` with a friendly "System not set up — run setup.bat" screen.
- Global listeners: SignalR connection (auto-reconnect, resubscribe), session-revoked → logout, 401 → refresh → retry once → logout.
- Role home after login: CarOwner → C02/C01, Mechanic → M01/M02 (restore online state), TowCaptain → T01/T02, ServiceCenter → SC01, Admin → AD01; providers with `KycStatus != Approved` → A11; active request → resume banner/screen.

## 4. Porting procedure per module (do in this order; record each screen in `docs/SCREEN_MATRIX.md`)
1. Shell + auth (A01–A13) + shared kit + SH06/SH13.
2. Car owner vehicles (C01–C05, C24) → request wizard & tracking → payment/invoice/review → history → centers/bookings → notifications/profile.
3. Provider modules (Mechanic, Captain) against the request state machine.
4. Service center.
5. Admin (+ AD16–AD18).
6. Remaining shared screens (SH01–SH21) as each flow needs them (chat early — owner & providers depend on it).
For every screen: (a) copy markup from the legacy file, (b) bind to real data/hooks, (c) remove mock literals, (d) add states + validation, (e) run it in the browser, take screenshots EN-light, AR-dark (min), (f) tick the matrix row.

## 5. Visual QA rules
Compare against the design images in `reference/design-images/` (dark/light). Acceptance: no layout shift versus the prototype beyond data-driven differences; no text overflow in EN or AR; RTL mirrors icons/chevrons correctly; contrast OK in both themes; touch targets ≥ 44 px; bottom nav never overlaps content; keyboard doesn't hide inputs.

## 6. Forbidden leftovers (the mock-scan must find none in `client/src`, built assets, or rendered DOM on a clean DB)
`Ahmed Mohamed`, `ahmed.mohamed`, `Karim Mostafa`, `Mahmoud Hassan`, `Nile Auto Care`, `Nour El-Sayed`, `Omar Adel`, `Salma Nabil`, `Cairo Motor Clinic`, `Hany Samir`, `@fixngo.eg`, `Password@123`, `Admin@123`, `FG-2606`, `MR-2611`, `BK-2048`, `KYC-1042`, `SR-108`, `WO-3102`, `SUP-2041`, `WD-2606`, `INV-2026-2606`, `12,482`, `248.6k`, `A B C 1234`, `C R T 9087`, `unsplash.com`, `284106`, `NewPass@2026`, `MOCK_PRESETS`, `switchRolePreview`, `Advance Trip Status`, `Simulate Declined Payment`. (Names may legitimately appear in `dummy-db` generated data only if produced by the generator's name lists with different combinations — but the **literal prototype persona** pairs above must not be hard-coded anywhere in source.)

## 7. New UI for the gaps (keep the same visual language; add to the registry)
- Photos on C26/C07/C08 (≤5, thumbnails, remove), P0 accident entry on C06, "Rate this visit" for centers (reuse C16 layout), "Payment methods" in C23 (list/delete cards, reuse C33), customer cash-confirmation in C15, report-user/report-review actions (chat header + trip detail + center reviews) opening a small bottom sheet, SC17 Bays & technicians, AD16 Reports, AD17 Reviews & complaints, AD18 Support inbox, "Invite admin" in AD06, per-document pre-selection in SH18, resume-active-request banner on C02, NotFound screen, offline/SH03 boundary.
Log every such addition in `docs/DEVIATIONS.md` with a screenshot.
