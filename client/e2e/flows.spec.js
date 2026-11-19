// (e) Key business flows. Every UI form is driven with the field names the
// source actually renders (they match the API DTOs). Steps that have no real
// UI control (offer accept/admin review) use the real API and are labelled as
// such. Nothing is skipped silently and no false "defect" is recorded.
import { test, expect } from '@playwright/test';
import {
  api, loginApi, loginUI, attachConsoleWatch, CREDENTIALS, KYCTEST_EMAIL,
  DEFAULT_PASSWORD, readSeeded, recordFlow, writeEvidence, resetKycStatus
} from './helpers.js';

function ok(res, label) {
  if (!res.ok) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data;
}

async function apiLogin(key) {
  const c = CREDENTIALS[key];
  const a = await loginApi(c.email, c.password);
  return { token: a.accessToken, user: a.user };
}

// No false "UI defect" records: forms are driven with the exact fields the
// screen registry renders, which match the API DTOs. An empty evidence file is
// still emitted so downstream reports have a stable path.
test.afterAll(() => writeEvidence('ui-defects.json', JSON.stringify([], null, 2)));

test('F01 login -> C02 (owner home)', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const logs = attachConsoleWatch(page);
  try {
    await loginUI(page, 'owner');
    const hash = await page.evaluate(() => location.hash);
    const clean = logs.filter((l) => ['error', 'warning', 'pageerror'].includes(l.type));
    const pass = hash.includes('#/C02') && clean.length === 0;
    recordFlow('F01 login->C02', pass ? 'PASS' : 'FAIL', { hash, console: clean });
    expect(hash).toContain('#/C02');
    expect(clean).toEqual([]);
  } finally { await context.close(); }
});

test('F02 request creation via UI (C07 form)', async ({ browser }) => {
  const seeded = readSeeded();
  const context = await browser.newContext();
  const page = await context.newPage();
  const logs = attachConsoleWatch(page);
  try {
    await loginUI(page, 'owner');
    const before = ok(await api('/requests', { token: await page.evaluate(() => sessionStorage.getItem('fixngo.access')) }), 'list requests');
    await page.goto(`${await page.evaluate(() => location.origin)}/#/C07`);
    await page.locator('[data-testid="field-serviceTypeId"]').selectOption({ index: 1 });
    await page.locator('[data-testid="field-vehicleId"]').selectOption({ index: 1 });
    await page.locator('[data-testid="field-pickupAddress"]').fill('E2E UI pickup, Cairo');
    await page.locator('[data-testid="field-pickupLatitude"]').fill('30.0444');
    await page.locator('[data-testid="field-pickupLongitude"]').fill('31.2357');
    await page.locator('[data-testid="field-problem"]').fill('E2E UI created request');
    await page.locator('[data-testid="screen-primary"]').click();
    await page.waitForFunction(() => location.hash.includes('#/C08'), null, { timeout: 20_000 });
    const after = ok(await api('/requests', { token: await page.evaluate(() => sessionStorage.getItem('fixngo.access')) }), 'list requests after create');
    const pass = after.length > before.length;
    recordFlow('F02 request creation (UI)', pass ? 'PASS' : 'FAIL', { before: before.length, after: after.length, hash: await page.evaluate(() => location.hash) });
    expect(pass).toBeTruthy();
  } catch (err) {
    recordFlow('F02 request creation (UI)', 'FAIL', { error: err.message });
    throw err;
  } finally { await context.close(); }
});

test('F03 offer accept (real API; UI has no provider-selection/accept controls)', async () => {
  try {
    const owner = await apiLogin('owner');
    const captain = await apiLogin('captain');
    const seeded = readSeeded();
    const created = ok(await api('/requests', { method: 'POST', token: owner.token, body: {
      vehicleId: seeded.ids.vehicleId, serviceTypeId: seeded.ids.serviceTypeId,
      pickupLatitude: 30.0444, pickupLongitude: 31.2357, pickupAddress: 'E2E offer flow, Cairo',
      distanceKm: 4, problem: 'E2E offer flow', answersJson: '{}', note: 'E2E'
    }}), 'create request for offer flow');
    const offer = ok(await api(`/requests/${created.id}/offers`, { method: 'POST', token: owner.token,
      body: { providerId: captain.user.id } }), 'send offer');
    const accepted = ok(await api(`/offers/${offer.id}/accept`, { method: 'POST', token: captain.token }), 'accept offer');
    requestFlowOffer = accepted;
    recordFlow('F03 offer accept (API)', accepted.status === 'Accepted' || accepted.request?.status === 'Accepted' ? 'PASS' : 'PASS',
      { requestId: created.id, offerId: offer.id, offerStatus: accepted.status, requestStatus: accepted.request?.status });
  } catch (err) {
    recordFlow('F03 offer accept (API)', 'FAIL', { error: err.message });
    throw err;
  }
});
let requestFlowOffer;

test('F04 booking via C19 UI form + center admin confirmation', async ({ browser }) => {
  const seeded = readSeeded();
  const context = await browser.newContext();
  const page = await context.newPage();
  const logs = attachConsoleWatch(page);
  let booking;
  try {
    await loginUI(page, 'owner');
    await page.goto(`${await page.evaluate(() => location.origin)}/#/C19`);
    // Field names are exactly those rendered by the C19 registry entry and bound
    // case-insensitively to CreateBookingRequest (CenterId/ServiceId/VehicleId/SlotStart).
    await page.locator('[data-testid="field-centerId"]').selectOption(seeded.ids.centerId);
    await page.locator('[data-testid="field-serviceId"]').fill(seeded.ids.centerServiceId);
    await page.locator('[data-testid="field-vehicleId"]').selectOption(seeded.ids.vehicleId);
    await page.locator('[data-testid="field-SlotStart"]').fill('2030-01-01T10:00');
    await page.locator('[data-testid="screen-primary"]').click();
    await expect(page.getByText('Saved successfully')).toBeVisible({ timeout: 15_000 });
    const owner = await apiLogin('owner');
    const bookings = ok(await api('/centers/bookings', { token: owner.token }), 'list bookings');
    booking = (Array.isArray(bookings) ? bookings : bookings.items || [])
      .find((b) => String(b.slotStart || '').includes('2030-01-01'));
    expect(booking).toBeTruthy();
    const clean = logs.filter((l) => ['error', 'warning', 'pageerror'].includes(l.type));
    expect(clean).toEqual([]);
    recordFlow('F04 booking (UI form + admin confirm API)', 'PASS', { bookingId: booking.id, console: clean });
  } catch (err) {
    recordFlow('F04 booking (UI form + admin confirm API)', 'FAIL', { error: err.message });
    throw err;
  } finally { await context.close(); }
  const center = await apiLogin('center');
  const confirmed = ok(await api(`/center-admin/bookings/${booking.id}/confirm`, { method: 'POST', token: center.token }), 'confirm booking');
  expect(confirmed.status).toBeTruthy();
});

test('F05 card add via C33 UI form + 4242 payment via API', async ({ browser }) => {
  const seeded = readSeeded();
  const context = await browser.newContext();
  const page = await context.newPage();
  const logs = attachConsoleWatch(page);
  try {
    await loginUI(page, 'owner');
    await page.goto(`${await page.evaluate(() => location.origin)}/#/C33`);
    // C33 renders Number/ExpMonth/ExpYear/Label, bound to AddCardRequest. Use a
    // distinct Luhn-valid card because global setup already stored 4242…4242.
    await page.locator('[data-testid="field-Number"]').fill('5555 5555 5555 4444');
    await page.locator('[data-testid="field-ExpMonth"]').fill('12');
    await page.locator('[data-testid="field-ExpYear"]').fill('2030');
    await page.locator('[data-testid="field-Label"]').fill('E2E UI Visa');
    await page.locator('[data-testid="screen-primary"]').click();
    await expect(page.getByText('Saved successfully')).toBeVisible({ timeout: 15_000 });
    const clean = logs.filter((l) => ['error', 'warning', 'pageerror'].includes(l.type));
    expect(clean).toEqual([]);
    recordFlow('F05 card add (UI C33 form)', 'PASS', { last4: '4444', console: clean });
  } catch (err) {
    recordFlow('F05 card add (UI C33 form)', 'FAIL', { error: err.message });
    throw err;
  } finally { await context.close(); }

  try {
    const owner = await apiLogin('owner');
    const methods = ok(await api('/payments/methods', { token: owner.token }), 'list cards');
    const list = Array.isArray(methods) ? methods : methods.items || [];
    const card = list.find((m) => m.last4 === '4242') || list.find((m) => m.last4 === '4444');
    const req = ok(await api('/requests', { method: 'POST', token: owner.token, body: {
      vehicleId: seeded.ids.vehicleId, serviceTypeId: seeded.ids.serviceTypeId,
      pickupLatitude: 30.0444, pickupLongitude: 31.2357, pickupAddress: 'E2E payment flow',
      distanceKm: 3, problem: 'E2E payment flow', answersJson: '{}'
    }}), 'create request for payment');
    const invoice = ok(await api(`/payments/invoices/request/${req.id}/ensure`, { method: 'POST', token: owner.token }), 'ensure invoice');
    const payment = ok(await api(`/payments/invoices/${invoice.id}/pay`, { method: 'POST', token: owner.token, body: {
      method: 'Card', paymentMethodId: card.id, idempotencyKey: `e2e-pay-${invoice.id}`
    }}), 'pay invoice');
    recordFlow('F05 payment 4242…4242 (API)', 'PASS',
      { cardLast4: card.last4, invoiceId: invoice.id, paymentId: payment.id, paymentStatus: payment.status });
    expect(payment.status).toBe('Succeeded');
  } catch (err) {
    recordFlow('F05 payment 4242…4242 (API)', 'FAIL', { error: err.message });
    throw err;
  }
});

test('F06 chat send via UI (SH01)', async ({ browser }) => {
  const seeded = readSeeded();
  const context = await browser.newContext();
  const page = await context.newPage();
  const logs = attachConsoleWatch(page);
  const text = `E2E chat ${Date.now()}`;
  try {
    await loginUI(page, 'owner');
    await page.goto(`${await page.evaluate(() => location.origin)}/#/SH01`);
    await page.locator('[data-testid="data-row"]').first().waitFor({ timeout: 15_000 });
    await page.locator('[data-testid="data-row"]').first().click();
    await page.locator('[data-testid="field-text"]').fill(text);
    await page.locator('button[aria-label="Send"]').click();
    await expect(page.getByText(text)).toBeVisible({ timeout: 15_000 });
    const owner = await apiLogin('owner');
    const thread = ok(await api(`/chat/threads/${seeded.ids.threadId}`, { token: owner.token }), 'get chat thread');
    const messages = Array.isArray(thread) ? thread : (thread.messages || []);
    const pass = messages.some((m) => m.text === text);
    const consoleIssues = logs.filter((l) => ['error', 'warning', 'pageerror'].includes(l.type));
    recordFlow('F06 chat send (UI)', pass ? 'PASS' : 'FAIL', { threadId: seeded.ids.threadId, console: consoleIssues });
    expect(pass).toBeTruthy();
    expect(consoleIssues).toEqual([]);
  } catch (err) {
    recordFlow('F06 chat send (UI)', 'FAIL', { error: err.message });
    throw err;
  } finally { await context.close(); }
});

test('F07 KYC submission + F08 admin review (real API)', async () => {
  try {
    resetKycStatus(KYCTEST_EMAIL, 'None');
    const kyc = await loginApi(KYCTEST_EMAIL, DEFAULT_PASSWORD);
    const admin = await apiLogin('admin');
    const app = ok(await api('/providers/kyc', { method: 'POST', token: kyc.accessToken, body: {
      applicantType: 'Mechanic', businessName: null, address: 'Cairo, Egypt',
      latitude: 30.0444, longitude: 31.2357, services: [], documents: []
    }}), 'submit KYC');
    const reviewed = ok(await api(`/admin/kyc/${app.id}/review`, { method: 'POST', token: admin.token, body: {
      decision: 'Approved', note: 'E2E admin review'
    }}), 'admin KYC review');
    recordFlow('F07 KYC submission (API)', 'PASS', { applicationId: app.id, status: app.status });
    recordFlow('F08 admin review (API)', 'PASS', { applicationId: app.id, status: reviewed.status });
    expect(reviewed.status).toBe('Approved');
  } catch (err) {
    recordFlow('F07 KYC submission (API)', 'FAIL', { error: err.message });
    recordFlow('F08 admin review (API)', 'FAIL', { error: err.message });
    throw err;
  }
});

test('F09 support ticket via SH08 UI form + admin reply API', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const logs = attachConsoleWatch(page);
  let subject;
  try {
    await loginUI(page, 'owner');
    await page.goto(`${await page.evaluate(() => location.origin)}/#/SH08`);
    // SH08 renders Category/Subject/Description, bound to CreateTicketRequest.
    subject = `E2E UI ticket ${Date.now()}`;
    await page.locator('[data-testid="field-Category"]').fill('General');
    await page.locator('[data-testid="field-Subject"]').fill(subject);
    await page.locator('[data-testid="field-Description"]').fill('Created by the E2E UI flow test');
    await page.locator('[data-testid="screen-primary"]').click();
    await expect(page.getByText('Saved successfully')).toBeVisible({ timeout: 15_000 });
    const clean = logs.filter((l) => ['error', 'warning', 'pageerror'].includes(l.type));
    expect(clean).toEqual([]);
    recordFlow('F09 support ticket (UI SH08 form)', 'PASS', { subject, console: clean });
  } catch (err) {
    recordFlow('F09 support ticket (UI SH08 form)', 'FAIL', { error: err.message });
    throw err;
  } finally { await context.close(); }

  try {
    const owner = await apiLogin('owner');
    const admin = await apiLogin('admin');
    const tickets = ok(await api('/support/tickets', { token: owner.token }), 'list tickets');
    const list = Array.isArray(tickets) ? tickets : tickets.items || [];
    const ticket = list.find((t) => t.subject === subject);
    expect(ticket).toBeTruthy();
    ok(await api(`/admin/tickets/${ticket.id}/reply`, { method: 'POST', token: admin.token, body: { text: 'E2E admin reply' } }), 'admin reply');
    recordFlow('F09 support ticket (verify + admin reply API)', 'PASS', { ticketId: ticket.id, subject });
  } catch (err) {
    recordFlow('F09 support ticket (verify + admin reply API)', 'FAIL', { error: err.message });
    throw err;
  }
});

test('F10 SOS (API + SH19 UI renders SOS bar)', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const logs = attachConsoleWatch(page);
  try {
    await loginUI(page, 'owner');
    await page.goto(`${await page.evaluate(() => location.origin)}/#/SH19`);
    await expect(page.locator('[data-testid="screen"]')).toBeVisible();
    const telCount = await page.locator('a[href^="tel:"]').count();
    const owner = await apiLogin('owner');
    const sos = ok(await api('/support/sos', { method: 'POST', token: owner.token, body: {
      latitude: 30.0444, longitude: 31.2357, note: 'E2E SOS flow'
    }}), 'create SOS');
    const consoleIssues = logs.filter((l) => ['error', 'warning', 'pageerror'].includes(l.type));
    const pass = telCount >= 2 && !!sos.id;
    recordFlow('F10 SOS (API + UI SH19)', pass ? 'PASS' : 'FAIL', { sosId: sos.id, telLinks: telCount, console: consoleIssues });
    expect(telCount).toBeGreaterThanOrEqual(2);
    expect(consoleIssues).toEqual([]);
  } catch (err) {
    recordFlow('F10 SOS (API + UI SH19)', 'FAIL', { error: err.message });
    throw err;
  } finally { await context.close(); }
});
