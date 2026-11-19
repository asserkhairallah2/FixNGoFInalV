// (c)+(d)+(b) Full-screen sweep: every code in the client screen registry,
// logged in as a role that owns it, in EN-light and AR-dark. For each screen we
// capture a phone-frame screenshot, assert a rendered screen / designed empty
// or error state, forbid undefined/NaN/[object Object] text and horizontal
// overflow, and require zero console errors or warnings.
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import {
  attachConsoleWatch, loginUI, screenCodes, roleForCode, settleOnScreen,
  screenDiagnostics, readSeeded, screenshotRoot, writeEvidence
} from './helpers.js';

const codes = screenCodes();
const seeded = readSeeded();
const variants = [
  { dir: 'light-en', theme: 'light', lang: 'en' },
  { dir: 'dark-en', theme: 'dark', lang: 'en' },
  { dir: 'light-ar', theme: 'light', lang: 'ar' },
  { dir: 'dark-ar', theme: 'dark', lang: 'ar' }
];
const byRole = { owner: [], mechanic: [], captain: [], center: [], admin: [] };
for (const code of codes) byRole[roleForCode(code)].push(code);

function sampleId(code) {
  const ids = seeded.ids || {};
  const request = ids.requestId;
  const map = {
    C11: request, C12: request, C13: request, C15: request, C16: request,
    C18: ids.centerId, C21: request, C24: ids.vehicleId, C27: request,
    C29: request, C31: request, C32: request, C34: request, C38: ids.bookingId,
    C39: ids.bookingId, C40: ids.centerId, C42: request, C43: ids.bookingId,
    M03: ids.pendingMechanicOfferId, M04: ids.mechanicRequestId,
    M05: ids.mechanicRequestId, M06: ids.mechanicRequestId,
    M11: ids.mechanicRequestId, M12: ids.mechanicRequestId, M13: ids.mechanicRequestId,
    T03: ids.pendingCaptainOfferId, T04: request, T05: request, T07: request, T13: request,
    T14: request,
    SC03: ids.bookingId, SC07: ids.centerId, SC11: ids.bookingId,
    SC12: ids.bookingId, SC13: ids.workOrderId, SC14: ids.workOrderId,
    AD03: ids.kycApplicationId, AD08: ids.paymentReviewId, AD10: ids.safetyReportId,
    AD11: seeded.users?.mechanic?.id, AD15: ids.kycApplicationId,
    AD18: ids.ticketId,
    SH09: ids.ticketId
  };
  return map[code] || null;
}

function summaryFor(variant, rows) {
  return {
    variant: variant.dir,
    screens: rows.length,
    screenshots: rows.filter((r) => r.screenshot).length,
    withScreenState: rows.filter((r) => r.diagnostics?.hasContent).length,
    consoleErrors: rows.reduce((n, r) => n + r.console.filter((c) => c.type === 'error' || c.type === 'pageerror').length, 0),
    consoleWarnings: rows.reduce((n, r) => n + r.console.filter((c) => c.type === 'warning').length, 0),
    failedRequests: rows.reduce((n, r) => n + r.console.filter((c) => c.type === 'requestfailed' || c.type === 'http').length, 0),
    forbiddenText: rows.filter((r) => r.diagnostics?.bad?.length).map((r) => ({ code: r.code, bad: r.diagnostics.bad })),
    horizontalOverflow: rows.filter((r) => r.diagnostics?.overflow?.frame > 2 || r.diagnostics?.overflow?.document > 2)
      .map((r) => ({ code: r.code, overflow: r.diagnostics.overflow })),
    noVisibleState: rows.filter((r) => !r.diagnostics?.hasContent).map((r) => r.code),
    rows
  };
}

for (const variant of variants) {
  test.describe(`screen sweep ${variant.dir}`, () => {
    const allRows = [];

    for (const role of Object.keys(byRole)) {
      const roleCodes = byRole[role];
      if (!roleCodes.length) continue;
      test(`${variant.dir}: ${role} — ${roleCodes.length} screens`, async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        await context.addInitScript(({ theme, lang }) => {
          localStorage.setItem('fixngo.theme', theme);
          localStorage.setItem('fixngo.lang', lang);
        }, variant);
        const page = await context.newPage();
        const logs = attachConsoleWatch(page);
        await loginUI(page, role);
        logs.length = 0; // login noise (if any) is reported by auth.spec.js

        const rows = [];
        const dir = path.join(screenshotRoot, variant.dir);
        fs.mkdirSync(dir, { recursive: true });

        for (const code of roleCodes) {
          logs.length = 0;
          const id = sampleId(code);
          const suffix = id ? `?id=${id}` : '';
          await page.evaluate(({ code, suffix }) => {
            window.location.hash = `#/${code}${suffix}`;
          }, { code, suffix });
          await settleOnScreen(page);
          const diagnostics = await screenDiagnostics(page);
          const shot = path.join(dir, `${code}.png`);
          await page.locator('.phone-frame').screenshot({ path: shot });

          const consoleEntries = [...logs];
          const real = consoleEntries.filter((l) => ['error', 'warning', 'pageerror', 'requestfailed'].includes(l.type));
          rows.push({ code, role, hash: await page.evaluate(() => location.hash), screenshot: path.relative(process.cwd(), shot),
            diagnostics, console: consoleEntries });

          expect.soft(diagnostics.hasContent, `${variant.dir}/${code}: no screen or designed state rendered`).toBe(true);
          expect.soft(diagnostics.bad, `${variant.dir}/${code}: forbidden text ${JSON.stringify(diagnostics.bad)}`).toEqual([]);
          expect.soft(diagnostics.overflow.frame, `${variant.dir}/${code}: phone-frame horizontal overflow`).toBeLessThanOrEqual(2);
          expect.soft(diagnostics.overflow.document, `${variant.dir}/${code}: document horizontal overflow`).toBeLessThanOrEqual(2);
          expect.soft(real, `${variant.dir}/${code}: console errors/warnings ${JSON.stringify(real)}`).toEqual([]);
        }

        writeEvidence(`sweep-${variant.dir}-${role}.json`, JSON.stringify(rows, null, 2));
        allRows.push(...rows);
        await context.close();
      });
    }

    test.afterAll(() => {
      writeEvidence(`sweep-${variant.dir}-summary.json`, JSON.stringify(summaryFor(variant, allRows), null, 2));
    });
  });
}

test(`registry size is fully covered (${codes.length} codes)`, () => {
  const swept = new Set(Object.values(byRole).flat());
  expect(swept.size).toBe(codes.length);
  writeEvidence('screen-registry.json', JSON.stringify({
    count: codes.length, codes, variants: variants.map((v) => v.dir)
  }, null, 2));
});
