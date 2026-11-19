# Phase 0 — Legacy prototype verification

Date: 2026-11-19
Command (background): `cmd /c "legacy-prototype\run_localhost.bat"`
HTTP check: `Invoke-WebRequest` against `localhost:3000` (first free port in 3000..3010).

| URL | Status | Bytes |
|---|---|---|
| / | 200 | 3888 |
| /01_AuthOnboarding.js | 200 | 35782 |
| /02_CarOwner.js | 200 | 152415 |
| /06_Admin.js | 200 | 77200 |

Browser: Chromium (in-app browser tool), page title `FixNGo · Complete Interactive App (138 Screens)`.
12 screens were opened via the prototype's module selector + screen dropdown and their headings were read from the accessibility tree:

A03 Welcome back (Login) · A05 Check your inbox (OTP) · A11 Application status · C02 Home (Connected Car) · C11 Your captain is on the way · C34 Review & pay · C43 Cancel appointment? · AD01 Platform overview · AD03 Review application · AD13 Security & two-factor · SH01 Chat with your captain · SH19 Emergency assistance.

Console errors: **none** (browser console read at level=error after the sweep).
The approved visual design is in `reference/design-images/` (34 JPGs) — the agent model **cannot view images**, so visual comparison will be performed only via automated DOM/screenshot assertions; this limitation is recorded in `docs/FINAL_REPORT.md`.

Layout verified: `legacy-prototype/` (8 JS files + run_localhost.bat), `reference/` (SRS, SDD, design-images/, extra-images/), `docs/agent-brief/` (11 files), `AGENT.md`, `STATE.md` (ignored as outdated).

Git baseline commit: `e90d3a4 chore: baseline of untouched FixNGo prototype, brief and reference specs` (created after `.gitignore`).
