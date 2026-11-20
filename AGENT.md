# FixNGo — Agent Instructions & Architecture Contract (`AGENT.md`)

> Purpose: fixed engineering and architectural contract for the FixNGo platform so every contributor and AI session operates against the exact Clean Architecture and ASP.NET Core 8 MVC conventions defined in the SRS and SDD.

---

## 1. Approved Technology Stack

* **Primary Language & Runtime:** C# 12 / .NET 8 LTS
* **Web Application Framework:** **ASP.NET Core 8 MVC** (`Controllers`, Razor `.cshtml` Views, `ViewModels`, `TagHelpers`, `ViewComponents`, Action Filters, Middlewares) + RESTful APIs (`/api/v1/...`) + SignalR Hubs (`/hubs/app`). No static `index.html` hosting.
* **Architecture:** **Clean Architecture** strictly separated into four layers (`Domain`, `Application`, `Infrastructure`, `Web`) plus `FixNGo.Cli` for administrative console operations.
* **Data Access:** Entity Framework Core 8 (Code-First), one dedicated `IEntityTypeConfiguration<T>` file per entity, `IRepository<T>` + `IUnitOfWork` pattern.
* **Supported Databases:** **SQLite** (local dev, test & portable file tooling) and **SQL Server** (`Database:Provider = "SqlServer"` for production).
* **Validation & Mapping:** **FluentValidation** across all modules + **AutoMapper** (`FixNGoMappingProfile` & `WebViewModelMappingProfile`).
* **Caching, Idempotency & Events:** `IMemoryCache` (`ICacheService`), `Idempotency-Key` replay middleware (`IIdempotencyStore`), and domain event outbox (`IOutboxPublisher`).
* **Interactive UI Modules:** Razor Views (`Views/Shared/_Layout.cshtml`, `Views/Home/Index.cshtml`, `Views/ServiceCentersMvc/*`, `Views/ArchitectureMvc/*`) + interactive mobile components compiled into `/assets/fixngo-app.js` and `/assets/fixngo-app.css`.

---

## 2. Clean Architecture Layer Rules

1. **`FixNGo.Domain` (Pure Core):**
   * Entities (one class per file), Value Objects (`Money`, `GeoCoordinate`, `EgyptianPhoneNumber`, `VehiclePlate`), Domain Events (`IDomainEvent`), Specifications (`ISpecification<T>`), State Machines, and Domain Exceptions.
   * **Strict rule:** Zero external NuGet or framework dependencies.
2. **`FixNGo.Application` (Use Cases & Contracts):**
   * Service Interfaces (`IAuthService`, `IVehicleService`, `IRequestService`, `IOfferService`, `IQuoteService`, `IPaymentService`, `ICenterService`, `IProviderService`, `INotificationService`, `IReviewService`, `IChatService`, `ISupportService`, `IAdminService`, `ILookupService`, `ISettingsService`, `IFileAccessService`, `ISystemStatusService`), DTOs, AutoMapper Profiles, FluentValidation Validators, and Infrastructure Port Interfaces (`IRepository<T>`, `IUnitOfWork`, `ICacheService`, `IIdempotencyStore`, `IOutboxPublisher`, `IRoutingService`, `IGeocoderService`, `IOtpSender`, `IPaymentGateway`, `INotifier`, `IFileStore`).
   * Depends **only** on `FixNGo.Domain`. Never references `Infrastructure` or `Web`.
3. **`FixNGo.Infrastructure` (Persistence & Adapters):**
   * `AppDbContext`, 60 individual `IEntityTypeConfiguration<T>` classes (one file per entity), `EfRepository<T>`, `UnitOfWork`, SQLite & SQL Server provider registration, Caching, Idempotency, Outbox, and Strategy/Adapter implementations.
   * Depends on `Application` + `Domain`.
4. **`FixNGo.Web` (ASP.NET Core 8 MVC & API Presentation):**
   * MVC Controllers (`HomeController`, `ServiceCentersMvcController`, `ArchitectureMvcController`), Razor Views (`.cshtml`), `ViewModels`, Custom `TagHelpers`, `ViewComponents`, REST API Controllers, SignalR Hub, and Middlewares.
   * **Strict rule:** Controllers inject **Application Service Interfaces** only — never concrete Application services and never `DbContext` / `IAppDbContext`. Domain Entities are never passed to Views or serialized in API responses.

---

## 3. Strict Coding Guardrails

1. **Configuration over Annotations:** Every entity relationship and index is configured in its own `IEntityTypeConfiguration<T>` class under `src/FixNGo.Infrastructure/Configurations/`.
2. **ViewModels & DTOs Only:** Views bind exclusively to `FixNGo.Web.ViewModels.*`; API endpoints return `FixNGo.Application.DTOs.*` mapped via AutoMapper.
3. **Double Validation:** Client-side validation + server-side FluentValidation mapped to RFC 7807 `ProblemDetails`; domain invariants enforced in Domain State Machines and Value Objects.
4. **Secrets & Security:** No secrets, passwords, OTPs, or PAN/CVV data in source or logs; security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) applied globally.
5. **Scoped Lifetimes:** `AppDbContext`, `IUnitOfWork`, `IRepository<T>`, and Application Services are registered as `Scoped`.
