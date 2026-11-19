# FixNGo — Agent Instructions & Conventions (`AGENT.md`)

> Purpose: fixed rules for AI agents working in this repository so every session starts with the same, accurate context instead of assumptions. `STATE.md` is the live status snapshot; this file is the stable architecture and coding contract.
>
> This file was rewritten in Phase 7 to describe the system that was actually built. Deliberate differences from the original brief/SRS are recorded in `docs/DEVIATIONS.md`, not here.

---

## 1. Approved technology stack (as delivered)

* **Language / runtime:** C# 12 / .NET 8 LTS, ASP.NET Core 8 **REST API** (no Razor/MVC views).
* **Architecture:** Clean Architecture in four projects — `Domain`, `Application`, `Infrastructure`, `Web` — plus a `Cli` project that owns the five root `.bat` tools.
* **Data access:** Entity Framework Core 8, Code-First, one `IEntityTypeConfiguration<T>` class per entity, migrations in `Infrastructure`.
* **Database:** SQLite for local dev, test and evaluation (no SQL Server instance is available). The schema is created by EF migrations; secrets live in `data/secrets.json` or environment variables, never in source.
* **Client:** `client/` — Vite 6 + React 18 + JavaScript/JSX, Tailwind CSS 3.4, `@tanstack/react-query`, `@microsoft/signalr`, `lucide-react`, `qrcode`. Built into `src/FixNGo.Web/wwwroot` and served by the API. No CDN or remote images at runtime.
* **Validation / mapping:** FluentValidation + AutoMapper; JWT access + rotating refresh tokens; RBAC policies; SignalR hub; hosted background workers; Serilog file + console logging.
* **External services:** fake-but-functional OTP/SMS/email, payments, maps and push providers writing real rows to SQLite, exposed through the five-panel Simulator Dock.

---

## 2. Architecture rules

1. **`FixNGo.Domain`** — pure core: entities, enums, value objects, state machines, domain exceptions. No external dependencies, no framework or database references.
2. **`FixNGo.Application`** — use cases as services, DTOs, validators, mapping profiles and infrastructure *port interfaces* (`IOtpSender`, `IPaymentGateway`, `IClock`, `IFileStore`, `INotifier`). Depends only on Domain.
3. **`FixNGo.Infrastructure`** — `AppDbContext`, entity configurations, migrations, SQLite, fake providers, file store, workers, Serilog setup. Depends on Application + Domain.
4. **`FixNGo.Web`** — API controllers under `/api/v1/`, JWT auth, RBAC, exception middleware, SignalR hub, static SPA hosting. Talks to Application through service classes; never touches `DbContext` directly from controllers.
5. **`FixNGo.Cli`** — thin C# command layer behind the `.bat` wrappers. All script business logic (backup, reset, dummy data, restore, self-test) is C# and unit/integration testable.

---

## 3. Strict conventions and guardrails

1. **Configuration over annotations:** entity relationships are configured in `IEntityTypeConfiguration<T>` classes, never via data annotations.
2. **No domain entities in HTTP responses:** controllers return DTOs from Application; never leak EF entities or navigation graphs.
3. **Double validation:** client-side React form checks + server-side FluentValidation; domain invariants are enforced again in Domain state machines.
4. **Secrets:** no passwords, OTPs, tokens or card data in source, logs or evidence. Secrets come from `data/secrets.json` or environment variables and are git-ignored.
5. **Service lifetimes:** `DbContext` and application services are `Scoped`; stateless infrastructure helpers are `Singleton`.
6. **No mock data in product code:** the client is driven entirely by API responses/props. A forbidden-literal scan (`tools/mock-scan.ps1`) must report zero hits before any gate passes.
7. **Deterministic tests:** .NET tests use `WebApplicationFactory` + temporary SQLite; script tests S1–S10 use isolated `FIXNGO_DATA_DIR` / `FIXNGO_LOG_DIR`; browser tests use a private port. The real `data\` folder is never a test target.
8. **Evidence discipline:** every claim must be backed by a file under `docs/evidence/`. Never claim an unperformed check; never skip, weaken or delete a failing test — fix the root cause and re-run the whole suite.
9. **Phase discipline:** complete the gate for a phase with proof before moving on; append `docs/AGENT_LOG.md`, update `docs/PROGRESS.md` `RESUME HERE`, and commit after each verified step.

---

## 4. Planner / executor model

* **Planner:** analyse the SRS/brief, identify requirements, propose steps and responsibilities, write no random code.
* **Executor:** implement step by step against these rules, then run the relevant tests immediately and record the result.

---

## 5. Fast orientation

* Start here: `README.md` → `docs/PROGRESS.md` → `docs/AGENT_LOG.md` (latest entries) → `docs/FINAL_REPORT.md`.
* Requirements: `reference/fixngo_software_requirements_specification.md`, `reference/fixngo_system_analysis_design.md`.
* Original brief and acceptance criteria: `docs/agent-brief/`.
* Authoritative gate: `tools/verify-all.ps1` (writes `docs/evidence/test-output/verify-all.txt`).
* Original front-end prototype is read-only at `legacy-prototype/`; `reference/design-images/` is the visual source of truth.
