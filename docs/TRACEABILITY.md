# SRS requirement traceability (Phase 7 hostile review)

Maps every functional (FR-01…FR-45) and non-functional (NFR-01…NFR-18) requirement in
`reference/fixngo_software_requirements_specification.md` to implementation and evidence. This is an
**honest** mapping: where a requirement is only partially verified or not formally benchmarked, that
is stated explicitly rather than ticked green. Screen-level traceability (143 ids) is in
`docs/SCREEN_MATRIX.md`.

Legend: ✓ implemented + evidenced · ◐ implemented, not formally benchmarked · ✗ not verified (stated honestly).

## Functional requirements

| ID | Requirement (short) | Implementation | Evidence | Status |
|---|---|---|---|---|
| FR-01 | Customer register | `AuthController`, `AuthService` | `AuthApiTests`, A04 sweep, `docs/API.md` | ✓ |
| FR-02 | Provider/center register + documents | `AuthController`, `ProviderController` documents/KYC | A08/A09/M05/SC sweep, `KycFlow_*` test | ✓ |
| FR-03 | Secure login/logout | `AuthController` login/logout/refresh | `AuthApiTests` (5 roles), E2E auth-results.json | ✓ |
| FR-04 | Role-based access | JWT + RBAC policies | `AuthorizationMatrixTests` (17 routes × 6 callers), authz-matrix.md | ✓ |
| FR-05 | Admin verifies providers/centers | `AdminService` KYC queue/approve | `KycFlow_ResubmitAfterChangesThenApprove`, F08 flow | ✓ |
| FR-06 | Forgot password reset | `AuthController` forgot/reset | A06/A07 sweep, `AuthServiceTests` | ✓ |
| FR-07/08 | Add/update/delete vehicle | `VehicleController`, `VehicleService` | C15–C18 sweep, `docs/API.md` | ✓ |
| FR-09 | Vehicle service history | `RequestService` history by vehicle | C history screens, E2E flows.ndjson | ✓ |
| FR-10 | Request roadside assistance | `RequestController`, `RequestService.CreateAsync` | `TowFlow_*`, E2E F02 (real C07 form) | ✓ |
| FR-11/12 | GPS detect + manual location | client geolocation + map screens; fake maps provider | C06/C09/AD screens, GPS sim test | ✓ |
| FR-13 | Problem type selection | `LookupService` problems (`ProblemDto.RecommendedServiceKey`) | C07 form, lookups/bootstrap in E2E log | ✓ |
| FR-14 | Follow-up questions | `FollowUpQuestionDto`, `RequestService.EscalatesAsync` | `TowFlow_*`, C08 screens | ✓ |
| FR-15 | Upload problem photos | file store + request photos endpoints | PH gap screens, `docs/API.md` | ✓ |
| FR-16 | Recommend assistance type | `ProblemDto.RecommendedServiceKey`, `OfferService` sort=recommended | C03 service chooser, lookups evidence | ✓ |
| FR-17/18 | Nearby providers + rating/distance/ETA/cost | `OfferService.ListAsync` (DistanceKm, EtaMinutes, PriceMinor, IsP0) | C16–C18 sweep, `TowFlow_*` | ✓ |
| FR-19 | Select provider/confirm | `OfferService.AcceptAsync` | `TowFlow_*`, E2E F03 | ✓ |
| FR-20 | Notify selected provider | `INotifier` + SignalR hub + push sim | SimulatorTests push, 101 negotiation log | ✓ |
| FR-21 | Provider accept/reject | `OfferService` accept + concurrency guard | `OfferRace_*` (exactly one winner) | ✓ |
| FR-22 | Reject → notify + suggest other | offer re-list after reject/expiry | `OfferService` pending list, C16–C18 | ✓ |
| FR-23/24/25 | Live location + status + ETA | SignalR hub, `RequestService` status, GPS sim drive | GPS sim test, tracking screens, 101 log | ◐ (no formal cadence benchmark) |
| FR-26 | Provider manual status update | `RequestService` status transitions | `TowFlow_*`, `MechanicFlow_*`, M-status screens | ✓ |
| FR-27 | Call provider directly | provider phone exposed via DTOs and shown in provider list rows (`ListRow` subtitle = `row.phone`); emergency `tel:` links in shared kit | `client/src/ui/renderers.jsx` (DualListView `row.phone`), `client/src/ui/kit.jsx:160-161` | ◐ (phone is displayed; no dedicated one-tap `tel:` button bound to the accepted provider — disclosed in FINAL_REPORT §6) |
| FR-28 | In-app chat | `SocialController` REST + SignalR | E2E F06, SH01 sweep, `docs/API.md` | ✓ |
| FR-29 | Share exact location in chat | chat location message + privacy after accept | `Privacy_*` test, SH01 | ✓ |
| FR-30/31 | Search/filter centers | `CenterService.CatalogAsync` (rating cast fix) | SC screens, `docs/API.md` | ✓ |
| FR-32 | Book appointment | `CenterService.BookAsync`, C19 form | `BookingFlow_*`, E2E F04 (real C19 form) | ✓ |
| FR-33 | Center accept/reject booking | `CenterService` booking lifecycle | `BookingFlow_*` (confirm/start/cancel) | ✓ |
| FR-34 | Manage hours/services/prices | `CenterController` admin endpoints | SC-admin screens, `docs/API.md` | ✓ |
| FR-35/36/37 | Cost calc + payment method + invoice | `PaymentService`, quote/invoice, fake gateway | `TowFlow_*`, `MechanicFlow_*`, E2E F05 | ✓ |
| FR-38 | Online payment via gateway | fake-but-functional PSP (`FakePaymentGateway`) | `TokeniseAndCharge_*`, F05 (decline/retry cards) | ✓ |
| FR-39/40/41 | Rate, review, average rating | `ReviewService` (avg + recommend %) | `AppSupport.Review`, review screens | ✓ |
| FR-42 | Admin monitors reviews | `AdminService` reviews/reports | AD screens, AD sweep | ✓ |
| FR-43/44 | Save + view service history | `RequestService`, request detail | C history/detail screens, E2E log | ✓ |
| FR-45 | Provider history + earnings | `ProviderController` history, `payments/earnings` | E2E log (`/api/v1/payments/earnings`), M screens | ✓ |

## Non-functional requirements

| ID | Requirement (short) | How addressed | Evidence | Status |
|---|---|---|---|---|
| NFR-01 | Assistance request < 5 s | async services, local SQLite | API logs show request POST in ms | ◐ (no formal latency benchmark) |
| NFR-02 | Nearby providers < 10 s | `OfferService` indexed queries | API logs show offer list in ms | ◐ (no formal latency benchmark) |
| NFR-03 | Live location 5–10 s cadence | GPS sim + SignalR | GPS sim test, 101 negotiation | ◐ (cadence not benchmarked) |
| NFR-04 | 1,000 concurrent users | async all the way, connection pooling | offer-race concurrency test | ✗ (no load test run — disclosed in FINAL_REPORT §6) |
| NFR-05 | P0 accident priority | `RequestService` P0 escalation, `IsP0` offers | `TowFlow_*`, `OfferRace_*` | ✓ |
| NFR-06 | Emergency contact info | `tel:` 123/122 in shared UI kit | `client/src/ui/kit.jsx:160-161`, sweep | ✓ |
| NFR-07 | Cancel confirmation | confirmation step on cancel path | `BookingFlow_*` cancel path, C-cancel screens | ✓ |
| NFR-08 | Encrypt at rest/in transit | hashed passwords; JWT; HTTPS-ready config; no secrets in logs | `KNOWN_ISSUES`, log password scan, privacy test | ◐ (local dev serves HTTP; at-rest DB encryption not configured) |
| NFR-09 | Role restriction | RBAC policies | `AuthorizationMatrixTests`, authz-matrix.md | ✓ |
| NFR-10 | Verify providers before requests | KYC + admin approval gate | `KycFlow_*`, NFR-10 in admin logic | ✓ |
| NFR-11 | Log payment transactions | Serilog + DB transaction rows | E2E payment flow, DB rows in `PaymentService` | ✓ |
| NFR-12 | Minimum necessary personal data | pre-accept payload redaction | `Privacy_*` test | ✓ |
| NFR-13 | Simple emergency UX | declarative registry, minimal steps | 143-screen sweep, no console errors | ✓ |
| NFR-14 | 24/7 availability | local always-on service + workers | `start.bat`, background workers | ◐ (no uptime/HA test) |
| NFR-15 | Reliability on connection drop | DB transactions, conditional offer accept | `OfferRace_*`, request status invariants | ◐ (no network-drop simulation) |
| NFR-16 | Scalable modular design | Clean Architecture 4 layers + Cli | `AGENT.md` §1-2, 0-warning build | ✓ (design-level) |
| NFR-17 | Maintainability | modular projects, 0 warnings, tests | Release build 0/0, test suites | ✓ |
| NFR-18 | Mobile/tablet/desktop compatibility | responsive Tailwind, 4-variant sweep | 572 screenshots, zero overflow | ✓ |

## Use cases (Appendix B, §6.1)

The SRS lists use cases narratively (no `UC-nn` ids): customer request/track/pay/review, provider
accept/status/earnings, center booking management, admin verification/user management/reports. Each
is covered by the FR rows above plus the E2E flows F01–F10 in `docs/evidence/e2e/flows.ndjson` and
the 143-screen sweep. There is no separate UC id list to tick in the SRS.

## Honest gaps

- **NFR-04 (1,000 concurrent users)** and the latency/cadence benchmarks (NFR-01/02/03) were not
  formally load-tested. Functional E2E and the offer-race concurrency test pass, but no throughput
  figure is claimed.
- **NFR-08 at-rest encryption** is not configured; passwords are hashed and secrets are kept out of
  source/logs, but the local SQLite file is not encrypted. This is a deliberate local/evaluation setup.
- These gaps are also listed in `docs/FINAL_REPORT.md` §6 and `docs/KNOWN_ISSUES.md`.
