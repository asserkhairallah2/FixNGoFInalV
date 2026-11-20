# End-to-End Test Report (Playwright)

**Date:** 2026-11-20
**Workspace:** `C:\Users\xprenspel\Desktop\FixNGoFinal`
**Authoritative output:** `docs/evidence/test-output/verify-all.txt` (Step `07 Playwright E2E`)
**Machine-readable result:** `docs/evidence/e2e/results.json`

## 1. Final result

Executed against a clean built `wwwroot` and isolated temporary SQLite database (`e2e/server.mjs` on loopback port `54173`; the real `data\` directory is never touched):

| Metric | Result |
|---|---:|
| Tests run | 41 |
| Passed | 41 |
| Failed | 0 |
| Skipped | 0 |
| Flaky | 0 |
| Console errors | 0 |
| Console warnings | 0 |
| Failed HTTP/network requests in sweep | 0 |
| Screenshots captured | 572 (`143 × 4` variants) |

## 2. Suite breakdown

| Spec | Tests | Coverage |
|---|---:|---|
| `e2e/auth.spec.js` | 5 | Real UI login (`#/A03`) for `CarOwner`, `Mechanic`, `TowCaptain`, `ServiceCenter`, and `Admin` with clean console and `/auth/me` verification |
| `e2e/flows.spec.js` | 15 | End-to-end UI + API business & regression flows `F01`–`F15` (`docs/evidence/e2e/flows.ndjson`) |
| `e2e/screens.spec.js` | 21 | 4 variants (`light-en`, `dark-en`, `light-ar`, `dark-ar`) × 5 role groups + 1 registry completeness check (`143` codes) |
| **Total** | **41** | **41/41 PASS** |

### Business & Round-4/5 Regression Flows (`F01`–`F15`)

| Flow | Result | Verified Behaviour |
|---|---|---|
| `F01` | `PASS` | Owner UI login → `C02`, Simulator Dock visible, dark mode toggle (`class="dark"`), Arabic toggle (`dir="rtl"`) |
| `F02` | `PASS` | `C05` starts completely empty + `toggle-isPrimary` off; saving `2022` / `Silver` persists `2022` / `Silver` on `C04`; `C06` starts unselected with no `"Flatbed"` badge on Wheel Lift Tow; `C07` starts empty → `C08` → `C09` |
| `F03` | `PASS` | Multi-role tow dispatch (`C10` → `T03` accept → `EnRoute` → `Arrived` → `Working` → `Completed` → `Paid` invoice on `C15` → 5-star review on `C16` → Captain wallet balance & rating updated on `T09`) |
| `F04` | `PASS` | Slot-based booking on `C19` (Cairo 12h slots, no `[object Object]` on `C36`) → `SC11` `"Start Service"` stays `InProgress` → `SC12` extra line item (`Oil Filter`, `75 EGP`) → `C38` updated total (`160 EGP`) |
| `F05` | `PASS` | `C33` card form with Luhn check → `C34` → card payment `Succeeded` |
| `F06` | `PASS` | Real-time chat message send via `SH01` UI |
| `F07` | `PASS` | Mechanic signup (`A04`) → OTP (`A05`, JWT session retained) → `A08` (`yearsExperience` starts empty) → `A11` + Admin KYC approval |
| `F08` | `PASS` | Admin `AD05` pricing save (`200 OK`, version increment) + `AD13` TOTP 2FA QR setup |
| `F09` | `PASS` | `SH08` category starts empty; PNG attachment uploaded & linked with `requestId`; `SH09` displays `FG-0001` reference and renders image via `?ft=` (never `?access_token=`); `AD18` displays real customer name (never `"You"`) + attachment |
| `F10` | `PASS` | `SH19` emergency `tel:` links + `POST /support/sos` |
| `F11` | `PASS` | Notification deep links (`offer:<id>` → `T03`, `request:<id>` → `C11`, `booking:<id>` → `C38`, `kyc:<id>` → `AD03` → `SH17` applicant document preview without `"Replace Document"`) |
| `F12` | `PASS` | Declined/expired offer re-dispatch to same provider returns `200 OK` |
| `F13` | `PASS` | Live SignalR tracking on `C11` updates provider assignment, `En route`, and `Arrived` **without page reload**, hides `"Review Repair Quote"` for Tow, and retains `FG-xxxx` + `providerName` across `page.reload()` |
| `F14` | `PASS` | `C14` & `C34` on a cash-settled `Paid` invoice show `Paid` and route to `C15` with `0` HTTP 409 errors; `C19` on closed Friday renders `Closed` with `0` slot buttons and disabled confirm; `C38` shows `Paid` badge; `C40` empty-comment review stores `null` text (never fake workshop text) |
| `F15` | `PASS` | Irreversible confirmations (`AD12`, `AD15`, `SH15`, `SH21`) start unticked with disabled submit; `A09`, `A10`, `SH20` start empty with interactive `A10` map pin drop; direct `page.reload()` on `AD05` renders inputs cleanly without hanging on skeleton |

### 4-Variant Screen Sweep Quality Gates (`572` Screenshots)

All four `sweep-{light-en,dark-en,light-ar,dark-ar}-summary.json` files report:
- `screens: 143`, `screenshots: 143`, `withScreenState: 143`
- `consoleErrors: 0`, `consoleWarnings: 0`, `failedRequests: 0`
- `forbiddenText: []` (checks `undefined`, `NaN`, `[object Object]`, prototype literals, raw enum keys such as `TruckRegistration`, `InProgress`, `JobEarning`, `offer.sent`, `settings.update`, and `LEAKED_ACCESS_TOKEN_IN_URL`)
- `horizontalOverflow: []` (`frame <= 2px`, `document <= 2px`)
- `noVisibleState: []`

## 3. Visual Inspection

Unlike earlier text-only runs, the regenerated screenshots across `light-en` and `dark-ar` were directly inspected with multimodal vision alongside a live interactive browser session (`docs/evidence/visual-review.md`).
