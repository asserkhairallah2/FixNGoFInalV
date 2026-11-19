# Providers (fake ↔ real)

FixNGo uses external providers for OTP/SMS/email, payments, maps/geocoding/routing and push.
This build bundles **functional fake** implementations that work end-to-end against the real
SQLite database (real OTP rows, real payment records, real notifications, real coordinates) and
never contact the internet.

## Configuration

Selection is **configuration-only** (`appsettings.json`), per brief 05 §5:

```json
"Providers": {
  "Otp": "Fake",
  "Payments": "Fake",
  "Maps": "Fake",
  "Push": "Fake"
}
```

Each value is `Fake` (default) or `Real`. Matching is case-insensitive. Every key defaults to
`Fake` when absent. The same values can be supplied via environment variables, e.g.
`Providers__Otp=Real`.

| Interface | Fake implementation | Real plan | Config key |
|---|---|---|---|
| `IOtpSender` | `FakeOtpSender` — writes a `SimMessage` row (SMS/email) with the code + log line | Twilio / SMTP | `Providers:Otp` |
| `IPaymentGateway` | `FakePaymentGateway` — tokenises `tok_fake_`, charges, records `SimPaymentTransaction`, deterministic test cards | Paymob / Stripe | `Providers:Payments` |
| `IGeocoder` / `IRoutingService` | Built-in Egyptian gazetteer + Haversine routing | Google Geocoding / Directions | `Providers:Maps` |
| Push / `INotifier` | `SignalRNotifier` + `SimPush` rows | Firebase Cloud Messaging / APNs | `Providers:Push` |

## Fail-fast contract

There are **no real adapters or real keys bundled**. Switching any provider to `Real` therefore
fails fast — it never silently falls back to a fake:

- `ProviderOptions.FromValues(...)` throws `ProviderNotConfiguredException` at **startup** while
  `Program.cs` parses `Providers:*`. The exception message names the provider and points here.
  `Program.cs` logs it with Serilog (`Log.Fatal`) before rethrowing, so the process exits non-zero
  with a clear, single-line reason.
- If `ProviderOptions` is constructed directly with `ProviderMode.Real` (tests), the DI container
  registers `RealOtpSender` / `RealPaymentGateway` stubs that throw
  `ProviderNotConfiguredException` on **first use** — again, no silent fake.

`ProviderNotConfiguredException` message form:

```
Provider 'Otp' is configured as 'Real', but this build bundles no real Otp adapter or credentials.
Set Providers:Otp=Fake to use the functional fake, or add the real adapter and keys described in docs/PROVIDERS.md.
```

An unrecognised value (anything other than `Fake`/`Real`) throws `ArgumentException` naming the
config key.

## Adding a real provider later

1. Implement the Application-layer port in `src/FixNGo.Infrastructure/Services/` (or a new
   provider project) using credentials from `data/secrets.json` or environment variables —
   never commit keys.
2. Replace the corresponding `Real*` stub registration in
   `src/FixNGo.Infrastructure/DependencyInjection.cs` with the new adapter, selected when the
   mode is `Real`.
3. Keep `ProviderOptions.FromValues` strict; remove the throw for that key only once the
   adapter and its key validation are present, and validate keys at startup.
4. Document required keys below and add tests that assert `Real` without keys still fails fast.

## Evidence

`tests/FixNGo.Application.Tests/ProviderOptionsTests.cs` proves: all-fake selection, null/invalid
values, case-insensitivity, fail-fast with a clear message for each of the four keys, stub
first-use throwing, and DI registration of fakes vs. stubs.
