# Test report

Run: 2026-11-19 · Phase 1 Gate 1 · Machine: Windows, dotnet 8.0.428, node 26.13.1, npm 11.20.0, git 2.47.1

Status: **Phase 1 Gate 1 — PASS** (backend foundation + real auth + CLI + tools + client login shell).

| Suite | Command | Total | Passed | Failed | Skipped | Duration |
|---|---|---|---|---|---|---|
| Domain unit | `dotnet test tests/FixNGo.Domain.Tests -c Release` | 1 | 1 | 0 | 0 | < 1 s |
| Application unit (auth) | `dotnet test tests/FixNGo.Application.Tests -c Release` | 9 | 9 | 0 | 0 | 5 s |
| API integration | `dotnet test tests/FixNGo.Api.Tests -c Release` | 7 | 7 | 0 | 0 | 5 s |
| Script tests S1–S3 | `powershell -File tools/script-tests.ps1 -Scenarios S1,S2,S3` | 11 assertions | 11 | 0 | 0 | ~30 s |
| Browser login E2E | Chromium login + POST /auth/login + authenticated shell | 4 checks | 4 | 0 | 0 | ~10 s |
| Mock/forbidden-literal scan | `powershell -File tools/mock-scan.ps1` | 49 files / 33 literals | 0 hits | 0 | — | < 1 s |
| Release build | `dotnet build FixNGo.sln -c Release` | 0 warnings, 0 errors | — | 0 | — | 3 s |

Evidence:
- `docs/evidence/test-output/dotnet-test-gate1.txt` (raw full-suite output, 17/17)
- `docs/evidence/test-output/mock-scan.txt` (0 hits)
- `docs/evidence/scripts/S1-start-first-run.txt`, `S2-setup-already-set-up.txt`, `S3-admin-login.txt`
- `docs/evidence/screens/login-screen.jpeg`, `login-success-shell.jpeg`
- `docs/AGENT_LOG.md` (append-only chronological log), `docs/DEVIATIONS.md` (rows 1–12)

This file is regenerated after every full test run in Phases 1–6 by `tools/verify-all.ps1`.
