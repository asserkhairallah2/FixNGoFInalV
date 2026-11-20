# FixNGo — Integrated Vehicle Roadside Assistance & Car Care Platform (.NET 8)

FixNGo is an ASP.NET Core 8 (.NET C# 12) web platform for roadside assistance and car care in Egypt, built on **Clean Architecture** with **ASP.NET Core MVC Razor Views**, **Entity Framework Core 8** (SQLite & SQL Server), **SignalR**, **AutoMapper**, **FluentValidation**, and bilingual English/Arabic (RTL) dark/light mobile-first interfaces.

## Clean Architecture Overview

| Layer | Project | Responsibility |
|---|---|---|
| **Domain** | `src/FixNGo.Domain` | Pure C# 12 core: 60 entity files, Value Objects (`Money`, `GeoCoordinate`, `EgyptianPhoneNumber`, `VehiclePlate`), Domain Events, Specifications (`ISpecification<T>`), State Machines, and Domain Exceptions. Zero external dependencies. |
| **Application** | `src/FixNGo.Application` | Use-case services & interfaces (`IAuthService`, `IRequestService`, `ICenterService`, etc.), DTOs, AutoMapper `FixNGoMappingProfile`, FluentValidation suites, and Repository/UnitOfWork/Cache/Outbox ports. Depends only on `Domain`. |
| **Infrastructure** | `src/FixNGo.Infrastructure` | EF Core 8 `AppDbContext`, 60 individual `IEntityTypeConfiguration<T>` classes, `EfRepository<T>` & `UnitOfWork`, configurable **SQLite / SQL Server** providers, `IMemoryCache`, `IdempotencyStore`, `OutboxPublisher`, and Strategy/Adapter implementations. |
| **Web (MVC + API)** | `src/FixNGo.Web` | **ASP.NET Core 8 MVC** (`HomeController`, `ServiceCentersMvcController`, `ArchitectureMvcController`), Razor Views (`.cshtml`), strongly-typed `ViewModels`, Custom `TagHelpers`, `ViewComponents`, REST APIs (`/api/v1/...`), JWT + RBAC, and SignalR (`/hubs/app`). |
| **CLI** | `src/FixNGo.Cli` | C# console administration commands backing `setup.bat`, `start.bat`, `remove-db.bat`, `dummy-db.bat`, and `restore-db.bat`. |

## Key Design Patterns Implemented

- **Clean Architecture** (strict 4-layer inward dependency rule, verified by automated architecture tests)
- **ASP.NET Core 8 MVC + Razor Views + TagHelpers + ViewComponents** (zero static `index.html` hosting)
- **Repository & Unit of Work** (`IRepository<T>`, `IUnitOfWork`) + **Specification Pattern** (`ISpecification<T>`)
- **AutoMapper Profiles** (Entity → DTO → ViewModel; zero Domain entities exposed to Views or Controllers)
- **FluentValidation** + **RFC 7807 ProblemDetails** exception pipeline
- **Strategy / Adapter Pattern** (configurable OTP, Payment Gateway, Haversine Routing, Cairo Geocoding, File Storage)
- **Idempotency-Key Replay Middleware**, **In-Memory Caching**, and **Domain Event Outbox**

## Prerequisites

- **.NET 8 SDK** (C# 12)
- **PowerShell 5.1+** (Windows) or Bash (Linux deployment)
- **Node.js 18+** (used during asset compilation into `wwwroot/assets/`)

## Quick Start

```bat
setup.bat
start.bat
```

- **Main Mobile Platform (ASP.NET Core MVC Host):** `http://localhost:5080/`
- **Server-Rendered MVC Service Centers Portal (Search / Filter / Sort / Pagination):** `http://localhost:5080/mvc/centers`
- **Clean Architecture Live Diagnostics View:** `http://localhost:5080/mvc/architecture`
- **OpenAPI / Swagger Documentation:** `http://localhost:5080/swagger`

## Build & Automated Verification

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\build.ps1
dotnet test FixNGo.sln -c Release
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\verify-all.ps1
```

## Administrative Tools

| Tool | Purpose |
|---|---|
| `setup.bat` | Interactive wizard creating the initial administrator account and launching `start.bat`. |
| `start.bat` | Compiles if needed, ensures setup, and starts the ASP.NET Core 8 MVC + SignalR host. |
| `remove-db.bat` | Creates a verified backup and resets the database to first-run state. |
| `dummy-db.bat` | Creates a verified backup, seeds 200+ realistic accounts/workflows, and writes `dummy-db.md`. |
| `restore-db.bat` | Restores the latest verified database backup byte-for-byte. |
