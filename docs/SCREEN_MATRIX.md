# Screen matrix

One row per prototype screen (138) plus added gap screens. Status starts as `pending`; each ported screen is updated with real API endpoints, states, screenshots and test evidence.

Legend: ✓ implemented · n/a not applicable · — pending evidence.

| Screen | Name | API used | Loading | Empty | Error | EN-light | AR-dark | Automated test | Status |
|---|---|---|---|---|---|---|---|---|---|
| A01 | Splash | GET /me | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| A02 | Onboarding / Get Started | — | n/a | n/a | n/a | — | — | e2e/screens.spec.js | pending |
| A03 | Login | POST /auth/login | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| A04 | Sign up | POST /auth/signup | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| A05 | OTP | POST /auth/verify-otp | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| A06 | Forgot password | POST /auth/forgot-password | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| A07 | New password | POST /auth/reset-password | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| A08 | Mechanic registration | POST /providers/mechanic/application | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| A09 | Captain registration | POST /providers/captain/application | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| A10 | Center registration | POST /providers/center/application | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| A11 | Application status | GET /kyc/applications/me | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| A12 | Location permission | PUT /me/location | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| A13 | Password updated | — | n/a | n/a | n/a | — | — | e2e/screens.spec.js | pending |
| C01 | Home — no vehicle | GET /vehicles | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| C02 | Home — connected car | GET /vehicles, /requests/active, /bookings | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| C03 | Role chooser | DELETED (demo control) | n/a | n/a | n/a | — | — | mock-scan | removed |
| C04 | My Garage | GET /vehicles | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| C05 | Add vehicle | POST /vehicles, GET /lookups | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| C06 | What's wrong? | GET /lookups/service-types | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| C07 | Vehicle & location (tow) | GET /vehicles, POST /requests/estimate, GET /places/search | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| C08 | Ready to send? | POST /requests/estimate | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| C09 | Finding your backup | GET /requests/{id}, SignalR | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| C10 | Choose your captain | GET /requests/{id}/candidates, POST /requests/{id}/select-provider | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| C11 | Captain on the way | GET /requests/{id}, SignalR provider.location | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| C12 | Captain arrived | GET /requests/{id} | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| C13 | Approve estimate | GET /requests/{id}/quote, POST /requests/{id}/estimate/approve | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| C14 | Choose payment | GET /me/payment-methods, POST /requests/{id}/payment-method | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| C15 | Invoice | GET /requests/{id}/invoice | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| C16 | Rate trip | POST /requests/{id}/review | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| C17 | Service centers | GET /centers | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| C18 | Center detail | GET /centers/{id} | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| C19 | Book appointment | GET /centers/{id}/availability, POST /bookings | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| C20 | Request history | GET /requests | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| C21 | Trip detail | GET /requests/{id} | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| C22 | Notifications | GET /notifications | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| C23 | Profile & settings | GET /me | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| C24 | Vehicle detail/edit | GET/PUT/DELETE /vehicles/{id} | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| C25 | Confirm location | GET /places/search, PUT /me/location | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| C26 | Describe issue | GET /lookups/service-types/{id}/questions, POST /requests | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| C27 | Choose mechanic | GET /requests/{id}/candidates | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| C28 | No providers nearby | POST /requests/{id}/expand-radius | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| C29 | Cancel request | POST /requests/{id}/cancel | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| C30 | Request cancelled | GET /requests/{id} | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| C31 | Repair underway | GET /requests/{id}, /events | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| C32 | Dispute estimate | POST /requests/{id}/estimate/dispute | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| C33 | Add card | POST /me/payment-methods | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| C34 | Review & pay | POST /requests/{id}/pay | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| C35 | Payment failed | GET /requests/{id} | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| C36 | Booking confirmed | GET /bookings/{id} | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| C37 | My appointments | GET /bookings | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| C38 | Appointment detail | GET /bookings/{id} | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| C39 | Reschedule | POST /bookings/{id}/reschedule | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| C40 | Center reviews | GET /centers/{id}/reviews | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| C41 | Thanks for review | GET /requests/{id}/review | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| C42 | Request timeline | GET /requests/{id}/events | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| C43 | Cancel appointment | POST /bookings/{id}/cancel | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| M01 | Console — Offline | GET /provider/dashboard, POST /provider/availability | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| M02 | Console — Online | GET /provider/dashboard, SignalR offer.created | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| M03 | Incoming request | GET /offers/{id}, POST /offers/{id}/accept | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| M04 | Request details | GET /requests/{id} (post-accept) | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| M05 | En route | POST /requests/{id}/en-route, GET /requests/{id} | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| M06 | Repair in progress | POST /requests/{id}/quote, /complete | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| M07 | Earnings | GET /provider/earnings | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| M08 | History | GET /provider/jobs?status= | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| M09 | Provider profile | GET /provider/profile | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| M10 | Jobs hub | GET /provider/jobs | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| M11 | Diagnosis & estimate | POST /requests/{id}/quote | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| M12 | Complete job & payment | POST /requests/{id}/payment/cash-confirm, /complete | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| M13 | Completed job details | GET /requests/{id} | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| M14 | Edit professional profile | PATCH /provider/profile | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| M15 | Coverage & availability | PUT /provider/coverage | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| T01 | Dashboard — OFF duty | GET /provider/dashboard | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| T02 | Dashboard — ON duty | GET /provider/dashboard, SignalR | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| T03 | Incoming tow request | GET /offers/{id} | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| T04 | Request details | GET /requests/{id} (post-accept) | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| T05 | Heading to pickup | POST /requests/{id}/en-route | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| T06 | Load the vehicle | POST /requests/{id}/loaded | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| T07 | On the way to center | POST /requests/{id}/arrive-destination | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| T08 | Trip completed | GET /requests/{id} | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| T09 | Earnings | GET /provider/earnings | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| T10 | Captain profile | GET /provider/profile | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| T11 | Trips hub | GET /provider/jobs | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| T12 | Trip history | GET /provider/jobs | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| T13 | Trip details & receipt | GET /requests/{id}, /invoice | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| T14 | Handover & collect payment | POST /requests/{id}/complete | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| T15 | Edit captain & truck | PATCH /provider/profile | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| SC01 | Overview | GET /center/dashboard | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| SC02 | Appointments | GET /center/bookings | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| SC03 | Appointment detail | GET /center/bookings/{id} | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| SC04 | Service catalog | GET /center/services | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| SC05 | Edit/Create service | POST/PUT /center/services | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| SC06 | Work orders | GET /center/work-orders | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| SC07 | Driver reviews | GET /center/reviews | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| SC08 | Reports | GET /center/reports | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| SC09 | Center profile | GET/PUT /center/profile | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| SC10 | Appointment calendar | GET /center/calendar | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| SC11 | Accepted appointment | POST /center/bookings/{id}/start | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| SC12 | Complete service & invoice | POST /center/bookings/{id}/complete | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| SC13 | Assign work order | POST /center/work-orders | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| SC14 | Work order details | POST /center/work-orders/{id}/ready | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| SC15 | Edit working hours | PUT /center/working-hours | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| SC16 | Reject appointment | POST /center/bookings/{id}/reject | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| SC17 | Bays & technicians (added) | GET/POST /center/bays, /technicians | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| AD01 | Platform overview | GET /admin/dashboard | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| AD02 | Verification queue | GET /admin/verifications | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| AD03 | Review application | GET /admin/verifications/{id} | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| AD04 | User management | GET /admin/users | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| AD05 | Pricing & settings | GET/PUT /admin/settings | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| AD06 | Admin profile | GET /me | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| AD07 | Payment reviews | GET /admin/payment-reviews | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| AD08 | Review payment | POST /admin/payment-reviews/{id}/reconcile | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| AD09 | Safety reports | GET /admin/safety-reports | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| AD10 | Safety report details | POST /admin/safety-reports/{id}/escalate | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| AD11 | User details | GET /admin/users/{id} | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| AD12 | Account access decision | POST /admin/users/{id}/access | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| AD13 | Security & 2FA | POST /me/2fa/setup, /verify | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| AD14 | Active sessions | GET /me/sessions, POST /me/sessions/{id}/revoke | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| AD15 | Verification decision | POST /admin/verifications/{id}/decision | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| AD16 | Reports (added) | GET /admin/reports | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| AD17 | Reviews & complaints (added) | GET /admin/reviews, /reports | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| AD18 | Support inbox (added) | GET /admin/support/tickets, POST /messages | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| SH01 | Chat | GET /threads/{id}/messages, SignalR | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| SH02 | Change password | POST /auth/change-password | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| SH03 | Connection interrupted | GET /system/status | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| SH04 | Your trips — empty | GET /requests | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| SH05 | Privacy & terms | GET /legal/{doc}?lang= | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| SH06 | App settings | GET/PUT /me/preferences | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| SH07 | Help & support | GET /support/faqs, /support/tickets | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| SH08 | New support ticket | POST /support/tickets | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| SH09 | Ticket detail | GET /support/tickets/{id}, POST /messages | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| SH10 | Notification preferences | PUT /me/notification-preferences | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| SH11 | About FixNGo | GET /system/status | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| SH12 | Edit account | GET/PUT /me | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| SH13 | Log out | POST /auth/logout | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| SH14 | Bank accounts | GET/POST /me/bank-accounts | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
| SH15 | Withdraw earnings | POST /me/withdrawals | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| SH16 | Withdrawal submitted | GET /me/withdrawals/{id} | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| SH17 | Document viewer | GET /files/{id} (authorised) | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| SH18 | Upload document | POST /files | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| SH19 | Emergency assistance | POST /emergency/sos | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| SH20 | Add bank account | POST /me/bank-accounts | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| SH21 | Request account deletion | POST /me/deletion | ✓ | n/a | ✓ | — | — | e2e/screens.spec.js | pending |
| NotFound | Unknown screen (added) | — | n/a | n/a | n/a | — | — | e2e/screens.spec.js | pending |
| SimDock | Simulator Dock (added) | GET /api/v1/sim/* | ✓ | ✓ | ✓ | — | — | e2e/screens.spec.js | pending |
