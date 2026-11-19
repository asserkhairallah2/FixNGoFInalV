// Shared E2E helpers: credentials, API client, screen registry, login, console
// capture and evidence recording. No product source is imported or modified.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { expect } from '@playwright/test';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(e2eDir, '..');
const rootDir = path.resolve(clientDir, '..');
export const evidenceDir = path.join(rootDir, 'docs', 'evidence', 'e2e');
export const screenshotRoot = path.join(rootDir, 'docs', 'evidence', 'screenshots');
fs.mkdirSync(evidenceDir, { recursive: true });
fs.mkdirSync(screenshotRoot, { recursive: true });

// Seeded Gate 2 users. Env overrides are supported; the documented Gate 2
// values are the defaults. Passwords are NEVER written to evidence files.
export const CREDENTIALS = {
  admin: { email: process.env.E2E_ADMIN_EMAIL || 'admin@gate2.test', password: process.env.E2E_ADMIN_PASSWORD || 'Setup@2026', role: 'Admin', home: 'AD01' },
  owner: { email: process.env.E2E_OWNER_EMAIL || 'owner@gate2.test', password: process.env.E2E_OWNER_PASSWORD || 'Setup@2026', role: 'CarOwner', home: 'C02' },
  mechanic: { email: process.env.E2E_MECHANIC_EMAIL || 'mechanic@gate2.test', password: process.env.E2E_MECHANIC_PASSWORD || 'Setup@2026', role: 'Mechanic', home: 'M01' },
  captain: { email: process.env.E2E_CAPTAIN_EMAIL || 'captain@gate2.test', password: process.env.E2E_CAPTAIN_PASSWORD || 'Setup@2026', role: 'TowCaptain', home: 'T01' },
  center: { email: process.env.E2E_CENTER_EMAIL || 'center@gate2.test', password: process.env.E2E_CENTER_PASSWORD || 'Setup@2026', role: 'ServiceCenter', home: 'SC01' }
};
export const KYCTEST_EMAIL = process.env.E2E_KYC_EMAIL || 'kyctest@gate2.test';
export const DEFAULT_PASSWORD = process.env.E2E_TEST_PASSWORD || 'Setup@2026';

export function baseURL() {
  const runtime = JSON.parse(fs.readFileSync(path.join(e2eDir, '.runtime.json'), 'utf8'));
  return runtime.baseURL;
}

export async function api(pathname, { method = 'GET', token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${baseURL()}/api/v1${pathname}`, {
    method,
    headers,
    body: form || (body !== undefined ? JSON.stringify(body) : undefined)
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, ok: res.ok, data };
}

export async function loginApi(email, password = DEFAULT_PASSWORD) {
  const r = await api('/auth/login', { method: 'POST', body: { email, password } });
  if (!r.ok) throw new Error(`API login failed for ${email}: ${r.status} ${JSON.stringify(r.data)}`);
  return r.data;
}

export async function loginUI(page, key) {
  const cred = CREDENTIALS[key];
  await page.goto(`${baseURL()}/#/A03`);
  await page.locator('[data-testid="login-email"]').fill(cred.email);
  await page.locator('[data-testid="login-password"]').fill(cred.password);
  await page.locator('[data-testid="login-submit"]').click();
  // The authenticated shell exposes a stable screen container for every role.
  await expect(page.locator('[data-testid="screen-container"]')).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(new RegExp(`#/${cred.home}`), { timeout: 15_000 });
  return cred;
}

export function attachConsoleWatch(page) {
  const entries = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      entries.push({ type: msg.type(), text: msg.text(), url: msg.location()?.url || '' });
    }
  });
  page.on('pageerror', (err) => entries.push({ type: 'pageerror', text: err.message, url: '' }));
  page.on('requestfailed', (req) => entries.push({
    type: 'requestfailed', text: `${req.method()} ${req.url()} :: ${req.failure()?.errorText || ''}`, url: req.url()
  }));
  page.on('response', (res) => {
    if (res.status() >= 400) entries.push({ type: 'http', text: `${res.status()} ${res.url()}`, url: res.url() });
  });
  return entries;
}

export async function settleOnScreen(page) {
  await page.waitForFunction(() => !!document.querySelector(
    '[data-testid="screen"],[data-testid="view-splash"],[data-testid="view-hero"],' +
    '[data-testid="view-login"],[data-testid="not-found"],[data-testid="setup-needed"],' +
    '[data-testid="empty-state"],[data-testid="error-state"]'
  ), null, { timeout: 20_000 });
  await page.waitForFunction(() => !document.querySelector('[data-testid="skeleton"]'), null, { timeout: 10_000 })
    .catch(() => {});
  await page.waitForTimeout(150);
}

export function screenDiagnostics(page) {
  return page.evaluate(() => {
    const text = document.body.innerText || '';
    const bad = ['undefined', 'NaN', '[object Object]'].filter((s) => text.includes(s));
    const frame = document.querySelector('.phone-frame');
    const overflow = {
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      frame: frame ? frame.scrollWidth - frame.clientWidth : 0
    };
    const hasContent = !!document.querySelector(
      '[data-testid="screen"],[data-testid="view-splash"],[data-testid="view-hero"],' +
      '[data-testid="view-login"],[data-testid="not-found"],[data-testid="setup-needed"],' +
      '[data-testid="empty-state"],[data-testid="error-state"]'
    );
    return { bad, overflow, hasContent, chars: text.length };
  });
}

// The screen registry is the authoritative list of codes; parse it from the
// source file (read-only) so the sweep cannot silently miss a new screen.
export function runtimeInfo() {
  return JSON.parse(fs.readFileSync(path.join(e2eDir, '.runtime.json'), 'utf8'));
}

// Reset the throwaway KYC test account to a legal first state for the
// submit→review flow (the DB file belongs exclusively to this E2E run).
export function resetKycStatus(email, value = 'None') {
  const db = new DatabaseSync(path.join(runtimeInfo().dataDir, 'fixngo.db'));
  try {
    const r = db.prepare('UPDATE Users SET KycStatus = ? WHERE lower(Email) = lower(?)').run(value, email);
    if (!r.changes) throw new Error(`Could not reset KYC status for ${email}`);
  } finally { db.close(); }
}

export function screenCodes() {
  const src = fs.readFileSync(path.join(clientDir, 'src', 'app', 'screens.jsx'), 'utf8');
  const codes = [];
  for (const m of src.matchAll(/\bS\('([A-Z]{1,2}\d{2})'/g)) {
    if (!codes.includes(m[1])) codes.push(m[1]);
  }
  return codes;
}

export function roleForCode(code) {
  if (/^C\d{2}$/.test(code)) return 'owner';
  if (/^M\d{2}$/.test(code)) return 'mechanic';
  if (/^T\d{2}$/.test(code)) return 'captain';
  if (/^SC\d{2}$/.test(code)) return 'center';
  if (/^AD\d{2}$/.test(code)) return 'admin';
  if (['A11', 'SH17', 'SH18'].includes(code)) return 'mechanic';
  if (['SH14', 'SH15', 'SH16', 'SH20'].includes(code)) return 'mechanic';
  return 'owner';
}

export function readSeeded() {
  return JSON.parse(fs.readFileSync(path.join(e2eDir, '.seeded.json'), 'utf8'));
}

let flowLines = 0;
export function recordFlow(name, status, detail = {}) {
  const file = path.join(evidenceDir, 'flows.ndjson');
  const line = JSON.stringify({ at: new Date().toISOString(), name, status, ...detail }) + '\n';
  fs.writeFileSync(file, (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '') + line);
  flowLines++;
  return line;
}

export function writeEvidence(name, contents) {
  fs.writeFileSync(path.join(evidenceDir, name), contents);
}
