// (a)+(b) Real UI login for every seeded role, with zero console errors or
// warnings on the login screen and the role home screen.
import { test, expect } from '@playwright/test';
import { attachConsoleWatch, loginUI, api, CREDENTIALS, writeEvidence } from './helpers.js';

const results = [];

for (const key of Object.keys(CREDENTIALS)) {
  const cred = CREDENTIALS[key];
  test(`login ${key} (${cred.role}) -> ${cred.home} with a clean console`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const logs = attachConsoleWatch(page);
    const entry = { role: cred.role, email: cred.email, home: cred.home, status: 'PASS', console: [] };
    try {
      await loginUI(page, key);
      await expect(page.locator('[data-testid="screen-container"]')).toBeVisible();
      const token = await page.evaluate(() => sessionStorage.getItem('fixngo.access'));
      expect(token, 'access token stored after real UI login').toBeTruthy();
      const me = await api('/auth/me', { token });
      expect(me.status, '/auth/me after UI login').toBe(200);
      expect(me.data.role, 'role returned by /auth/me').toBe(cred.role);
      entry.me = me.data;
      entry.hash = await page.evaluate(() => window.__fixngoRoute?.path || '');
      expect(entry.hash).toContain(`#/${cred.home}`);
      expect(await page.evaluate(() => location.hash)).toBe('');
      expect(await page.evaluate(() => location.pathname)).toBe('/');

      const real = logs.filter((l) => ['error', 'warning', 'pageerror', 'requestfailed'].includes(l.type));
      entry.console = real;
      entry.status = real.length === 0 ? 'PASS' : 'FAIL';
      expect.soft(real, `console errors/warnings for ${key}: ${JSON.stringify(real)}`).toEqual([]);
    } catch (err) {
      entry.status = 'FAIL';
      entry.error = err.message;
      throw err;
    } finally {
      results.push(entry);
      await context.close();
    }
  });
}

test.afterAll(() => {
  writeEvidence('auth-results.json', JSON.stringify(results, null, 2));
});
