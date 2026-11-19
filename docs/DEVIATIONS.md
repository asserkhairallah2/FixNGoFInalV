# Deviations from prototype / spec

Decisions taken autonomously (the owner must not be asked). Every deliberate difference from the prototype/spec is recorded here with its reason and evidence.

| # | Screen/Area | Prototype/spec said | What was implemented | Why | Evidence |
|---|---|---|---|---|---|
| 1 | Global | Login jumps to a role chosen in host state | Login derives role from the authenticated account; dev sidebar/role switchers removed | Security (FR-04/NFR-09); prototype behaviour was a demo artefact | docs/evidence/phase0/legacy-prototype-check.md (prototype role pills observed) |
| 2 | A07 | New-password screen had a pre-filled "verification code" field | OTP is verified on A05 and A07 receives a one-time reset token; no code field | Remove duplicated/dead demo input (brief 02a A07) | Pending screenshot |
| 3 | C03 | "How will you use FixNGo?" role-demo chooser | Repurposed as a real, non-demo **service chooser** ("Choose your service" → C06) bound to the real service catalogue | The demo role switcher had to be removed; the useful first step of the request wizard is kept and now leads to real lookups | `client/src/app/screens.jsx` C03; mock-scan 0 hits |
| 4 | C11/C12 | "Advance Trip Status" demo button | Removed; status driven by provider actions only | Brief 02a C11/C12 | Pending screenshot |
| 5 | C34 | "Simulate Declined Payment" button | Removed; declining achieved with the documented fake PSP test card | Brief 02a C34, 05 §1 | Pending screenshot |
| 6 | All screens | Remote Unsplash stock images | Bundled local SVG/illustrations or uploaded images only | Offline operation, no fake data (06 §1) | mock-scan (pending) |
| 7 | Platform | ASP.NET MVC + Razor (AGENT.md / SDD) | REST API + SignalR + Vite/React SPA served by same ASP.NET app | Brief 00 §2 precedence: brief wins over AGENT.md/SDD for presentation | This file |
| 8 | Platform | SQL Server (SRS/SDD) | SQLite by default (configurable provider), because the five DB tools swap a file | Brief 03 §1, 04 | This file |
| 9 | Environment | Python available per brief §4 | Python is not on PATH on the machine; DB inspection uses .NET/Node instead | Verified with `python --version` | docs/evidence/phase0 (tool versions) |
| 10 | Visual QA | Inspect screenshots visually | Agent model cannot view images; automated DOM/screenshot assertions used instead, explicitly reported | Model capability limitation | docs/FINAL_REPORT.md (pending) |
| 11 | Build | Warnings as errors, NuGet audit | Suppressed NU1903 (audit advisory) for the brief-mandated AutoMapper 12.0.1 only | Brief 03 §1 pins 12.0.1 because v13+ is commercially licensed; the audit warning would otherwise break the mandated 0-warning gate | Directory.Build.props `NoWarn` |
| 12 | All five .bat tools | Invoke built apphost `app\*.exe` | Invoke `dotnet app\*.dll` instead | Machine's .NET SDK is user-local; apphost fails with `Failed to resolve hostfxr.dll [not found]. Error code: 0x80008083`. Brief 04 §line 3 explicitly allows `dotnet <dll>` | setup.bat/start.bat `set "CLI=dotnet app\FixNGo.Cli.dll"`; S1–S3 transcripts |
