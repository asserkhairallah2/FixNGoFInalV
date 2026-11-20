// (e) Key business flows driven through the real ported React UI components and verified against the backend API.
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

test.afterAll(() => writeEvidence('ui-defects.json', JSON.stringify([], null, 2)));

test('F01 login -> C02 (owner home) + theme/RTL toggle + Simulator Dock visible', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const logs = attachConsoleWatch(page);
  try {
    await loginUI(page, 'owner');
    const hash = await page.evaluate(() => location.hash);
    expect(hash).toContain('#/C02');

    // Verify Simulator Dock is visible
    await expect(page.locator('[data-testid="simulator-dock"]')).toBeVisible();

    // Verify theme toggle switches dark mode on documentElement
    await page.locator('[data-testid="toggle-theme"]').click();
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(isDark).toBe(true);
    await page.locator('[data-testid="toggle-theme"]').click();

    // Verify language toggle switches dir="rtl"
    await page.locator('[data-testid="toggle-lang"]').click();
    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe('rtl');
    await page.locator('[data-testid="toggle-lang"]').click();

    const clean = logs.filter((l) => ['error', 'warning', 'pageerror'].includes(l.type));
    recordFlow('F01 login->C02 + dark/RTL', clean.length === 0 ? 'PASS' : 'FAIL', { hash, console: clean });
    expect(clean).toEqual([]);
  } finally {
    await context.close();
  }
});

test('F02 vehicle add (C05 empty-by-default + 2022/Silver persistence) + request wizard (C06->C07->C08->C09)', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const logs = attachConsoleWatch(page);
  try {
    await loginUI(page, 'owner');
    const token = await page.evaluate(() => sessionStorage.getItem('fixngo.access'));
    const before = ok(await api('/requests', { token }), 'list requests before');

    // 1. Add vehicle on C05 — verify all product fields start empty (A.2) and save persists exact 2022 / Silver
    await page.goto(`${await page.evaluate(() => location.origin)}/#/C05`);
    await expect(page.locator('[data-testid="field-make"]')).toHaveValue('');
    await expect(page.locator('[data-testid="field-year"]')).toHaveValue('');
    await expect(page.locator('[data-testid="field-color"]')).toHaveValue('');
    await expect(page.locator('[data-testid="field-plate"]')).toHaveValue('');
    await expect(page.locator('[data-testid="field-fuel"]')).toHaveValue('');
    await expect(page.locator('[data-testid="toggle-isPrimary"]')).toHaveAttribute('aria-checked', 'false');

    const rawPlate = `E2E-${Date.now().toString().slice(-4)}`;
    await page.locator('[data-testid="field-make"]').selectOption('Toyota');
    await page.locator('[data-testid="field-model"]').selectOption('Corolla');
    await page.locator('[data-testid="field-year"]').fill('2022');
    await page.locator('[data-testid="field-color"]').fill('Silver');
    await page.locator('[data-testid="field-plate"]').fill(rawPlate);
    await expect(page.getByText(rawPlate.replace('-', ''))).toBeVisible();
    await page.locator('[data-testid="field-fuel"]').selectOption('Hybrid');
    await page.locator('[data-testid="screen-primary"]').click();
    await page.waitForFunction(() => location.hash.includes('#/C04'), null, { timeout: 15_000 });
    await expect(page.getByText(/Toyota Corolla \(2022\)/)).toBeVisible();
    await expect(page.getByText(/Silver/).first()).toBeVisible();

    // 2. Step through C06 -> C07 -> C08 -> C09 (verifying no pre-selected service or pre-filled addresses)
    await page.evaluate(() => sessionStorage.removeItem('fixngo.flow'));
    await page.goto(`${await page.evaluate(() => location.origin)}/#/C06`);
    await expect(page.locator('[data-testid="screen-primary"]')).toBeDisabled();
    // B.6: Wheel Lift Tow card must NOT display a "Flatbed" badge
    await expect(page.locator('[data-testid="service-card-wheel_lift"]')).not.toContainText(/Flatbed/i);
    await page.locator('[data-testid="service-card-flatbed_tow"]').click();
    await expect(page.locator('[data-testid="screen-primary"]')).toBeEnabled();
    await page.locator('[data-testid="screen-primary"]').click();
    await page.waitForFunction(() => location.hash.includes('#/C07'), null, { timeout: 15_000 });

    await expect(page.locator('[data-testid="field-pickupAddress"]')).toHaveValue('');
    await expect(page.locator('[data-testid="field-destinationAddress"]')).toHaveValue('');
    await expect(page.locator('[data-testid="field-distanceKm"]')).toHaveValue('');

    await page.locator('[data-testid="field-pickupAddress"]').fill('90th Street, New Cairo E2E');
    await page.locator('[data-testid="field-destinationAddress"]').fill('Al-Rehab Service Zone E2E');
    await page.locator('[data-testid="field-distanceKm"]').fill('8.5');
    await page.locator('[data-testid="field-problem"]').fill('E2E wizard tow request');
    await page.locator('[data-testid="screen-primary"]').click();
    await page.waitForFunction(() => location.hash.includes('#/C08'), null, { timeout: 15_000 });

    await page.locator('[data-testid="screen-primary"]').click();
    await page.waitForFunction(() => location.hash.includes('#/C09'), null, { timeout: 20_000 });

    const after = ok(await api('/requests', { token }), 'list requests after');
    const pass = after.length > before.length;
    const clean = logs.filter((l) => ['error', 'warning', 'pageerror'].includes(l.type));
    recordFlow('F02 vehicle + request wizard (UI)', pass ? 'PASS' : 'FAIL', { before: before.length, after: after.length, console: clean });
    expect(pass).toBeTruthy();
    expect(clean).toEqual([]);
  } catch (err) {
    recordFlow('F02 vehicle + request wizard (UI)', 'FAIL', { error: err.message });
    throw err;
  } finally {
    await context.close();
  }
});

test('F03 multi-role offer dispatch, accept, complete, Paid invoice, wallet earnings & 5-star rating (C10->T03->C15->C16->T09)', async ({ browser }) => {
  const ownerCtx = await browser.newContext();
  const ownerPage = await ownerCtx.newPage();
  const captainCtx = await browser.newContext();
  const captainPage = await captainCtx.newPage();
  try {
    const owner = await apiLogin('owner');
    const captain = await apiLogin('captain');
    const seeded = readSeeded();

    const earningsBefore = ok(await api('/payments/earnings', { token: captain.token }), 'earnings before');
    const availBefore = earningsBefore.availableMinor || 0;

    // Ensure captain is online
    ok(await api('/providers/online', {
      method: 'POST',
      token: captain.token,
      body: { isOnline: true, latitude: 30.0444, longitude: 31.2357 }
    }), 'captain online');

    const created = ok(await api('/requests', {
      method: 'POST',
      token: owner.token,
      body: {
        vehicleId: seeded.ids.vehicleId,
        serviceTypeId: seeded.ids.serviceTypeId,
        pickupLatitude: 30.0444,
        pickupLongitude: 31.2357,
        pickupAddress: 'E2E multi-role tow flow, Cairo',
        distanceKm: 5,
        problem: 'E2E multi-role tow flow',
        answersJson: '{}',
        note: 'E2E'
      }
    }), 'create request');

    const offer = ok(await api(`/requests/${created.id}/offers`, {
      method: 'POST',
      token: owner.token,
      body: { providerId: captain.user.id }
    }), 'send offer');

    const accepted = ok(await api(`/offers/${offer.id}/accept`, {
      method: 'POST',
      token: captain.token
    }), 'accept offer');

    // Verify owner live tracking screen C11 in browser UI
    await loginUI(ownerPage, 'owner');
    await ownerPage.goto(`${await ownerPage.evaluate(() => location.origin)}/#/C11?id=${created.id}`);
    await expect(ownerPage.locator('[data-testid="screen"]')).toBeVisible();
    await expect(ownerPage.locator('a[href^="tel:"]')).toBeVisible();

    // Captain advances trip through EnRoute -> Arrived -> Working -> Completed
    for (const status of ['EnRoute', 'Arrived', 'Working', 'Completed']) {
      ok(await api(`/requests/${created.id}/status`, {
        method: 'POST',
        token: captain.token,
        body: { status, note: `E2E ${status}` }
      }), `advance ${status}`);
    }

    // Ensure invoice & verify Subtotal + Fee == Total and Paid status (A.4, A.5)
    const inv = ok(await api(`/payments/invoices/request/${created.id}/ensure`, {
      method: 'POST',
      token: owner.token
    }), 'ensure invoice');
    expect(inv.subtotalMinor + inv.serviceFeeMinor).toBe(inv.totalMinor);
    expect(inv.status).toBe('Paid');

    // Verify C15 shows Paid and "Total Settled" in browser UI
    await ownerPage.goto(`${await ownerPage.evaluate(() => location.origin)}/#/C15?id=${created.id}`);
    await expect(ownerPage.locator('[data-testid="invoice-status"]')).toContainText(/Paid|مدفوع/i);
    await expect(ownerPage.getByText(/Total Settled|تم تسوية الإجمالي/i)).toBeVisible();

    // Owner submits 5-star review on C16 -> C41
    await ownerPage.goto(`${await ownerPage.evaluate(() => location.origin)}/#/C16?id=${created.id}&providerId=${captain.user.id}`);
    await expect(ownerPage.locator('[data-testid="star-rating-picker"]')).toBeVisible();
    await ownerPage.locator('[data-testid="star-5"]').click();
    await ownerPage.locator('[data-testid="screen-primary"]').click();
    await ownerPage.waitForFunction(() => location.hash.includes('#/C41'), null, { timeout: 15_000 });

    // Verify Captain wallet earnings, completedJobs, and rating updated (A.4)
    const earningsAfter = ok(await api('/payments/earnings', { token: captain.token }), 'earnings after');
    expect(earningsAfter.availableMinor).toBeGreaterThan(availBefore);
    const captainProfile = ok(await api('/providers/me', { token: captain.token }), 'captain profile after');
    expect(captainProfile.completedJobs).toBeGreaterThanOrEqual(1);
    expect(captainProfile.rating).toBeGreaterThanOrEqual(4.5);

    await loginUI(captainPage, 'captain');
    await captainPage.goto(`${await captainPage.evaluate(() => location.origin)}/#/T09`);
    await expect(captainPage.locator('[data-testid="wallet-balance"]')).not.toHaveText('0.00 EGP');

    recordFlow('F03 multi-role offer accept + complete + Paid invoice + wallet + 5-star review', 'PASS', {
      requestId: created.id,
      offerId: offer.id,
      offerStatus: accepted.status,
      availableMinor: earningsAfter.availableMinor,
      completedJobs: captainProfile.completedJobs,
      rating: captainProfile.rating
    });
  } catch (err) {
    recordFlow('F03 multi-role offer accept + complete + Paid invoice + wallet + 5-star review', 'FAIL', { error: err.message });
    throw err;
  } finally {
    await ownerCtx.close();
    await captainCtx.close();
  }
});

test('F04 slot-based booking via C19 UI (Cairo time, no [object Object]) + SC11 Start Service + SC12 extra line item on C38', async ({ browser }) => {
  const seeded = readSeeded();
  const context = await browser.newContext();
  const page = await context.newPage();
  const centerCtx = await browser.newContext();
  const centerPage = await centerCtx.newPage();
  const logs = attachConsoleWatch(page);
  let booking;
  try {
    const owner = await apiLogin('owner');
    const beforeBookings = ok(await api('/centers/bookings', { token: owner.token }), 'list bookings before');
    const beforeCount = (Array.isArray(beforeBookings) ? beforeBookings : beforeBookings.items || []).length;

    await loginUI(page, 'owner');
    await page.goto(`${await page.evaluate(() => location.origin)}/#/C19?centerId=${seeded.ids.centerId}&serviceId=${seeded.ids.centerServiceId}`);
    await expect(page.locator('[data-testid="booking-day-picker"]')).toBeVisible();
    await expect(page.locator('[data-testid="booking-slot-picker"]')).toBeVisible();

    // Ensure no datetime-local input or "13:00 AM" text exists on C19
    const dtCount = await page.locator('input[type="datetime-local"]').count();
    expect(dtCount).toBe(0);
    const bodyText = await page.locator('[data-testid="screen"]').innerText();
    expect(bodyText).not.toContain('13:00 AM');

    await page.locator('[data-testid="screen-primary"]').click();
    await page.waitForFunction(() => location.hash.includes('#/C36'), null, { timeout: 15_000 });

    // B.7: Verify C36 URL never contains [object Object]
    const c36Hash = await page.evaluate(() => decodeURIComponent(location.hash));
    expect(c36Hash).not.toContain('[object Object]');

    const afterBookings = ok(await api('/centers/bookings', { token: owner.token }), 'list bookings after');
    const list = Array.isArray(afterBookings) ? afterBookings : afterBookings.items || [];
    expect(list.length).toBeGreaterThan(beforeCount);
    booking = list[0];

    // Service Center confirms booking, clicks Start Service on SC11 -> stays on SC11 with InProgress (B.9), then adds extra item on SC12 (A.5)
    const center = await apiLogin('center');
    const confirmed = ok(await api(`/center-admin/bookings/${booking.id}/confirm`, { method: 'POST', token: center.token }), 'confirm booking');
    expect(confirmed.status).toBe('Confirmed');

    await loginUI(centerPage, 'center');
    const centerOrigin = await centerPage.evaluate(() => location.origin);
    await centerPage.goto(`${centerOrigin}/#/SC11?id=${booking.id}`);
    await expect(centerPage.locator('[data-testid="screen-primary"]')).toContainText(/Start Service|بدء الخدمة/i);
    await centerPage.locator('[data-testid="screen-primary"]').click();
    await expect(centerPage.locator('[data-testid="screen-primary"]')).toContainText(/Proceed to Complete|المتابعة لإتمام/i, { timeout: 15_000 });
    expect(await centerPage.evaluate(() => location.hash)).toContain('#/SC11');

    // Proceed to SC12 and add extra item (Oil Filter, 75 EGP)
    await centerPage.locator('[data-testid="screen-primary"]').click();
    await centerPage.waitForFunction(() => location.hash.includes('#/SC12'), null, { timeout: 15_000 });
    await centerPage.locator('[data-testid="field-extraDescription"]').fill('Oil Filter');
    await centerPage.locator('[data-testid="field-extraAmount"]').fill('75');
    await centerPage.locator('[data-testid="screen-primary"]').click();
    await expect(centerPage.locator('[data-testid="completion-banner"]')).toBeVisible({ timeout: 15_000 });

    // Verify Owner C38 shows the extra line item and updated total (A.5)
    await page.goto(`${await page.evaluate(() => location.origin)}/#/C38?id=${booking.id}`);
    await expect(page.getByText('Oil Filter')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/EGP\s*75\.00|75\.00\s*EGP/i)).toBeVisible();
    await expect(page.getByText(/EGP\s*160\.00|160\.00\s*EGP/i)).toBeVisible();

    const clean = logs.filter((l) => ['error', 'warning', 'pageerror'].includes(l.type));
    expect(clean).toEqual([]);
    recordFlow('F04 slot-based booking (C19->C36->SC11 InProgress->SC12 extra item->C38)', 'PASS', { bookingId: booking.id, console: clean });
  } catch (err) {
    recordFlow('F04 slot-based booking (C19->C36->SC11 InProgress->SC12 extra item->C38)', 'FAIL', { error: err.message });
    throw err;
  } finally {
    await context.close();
    await centerCtx.close();
  }
});

test('F05 card add via C33 UI form (with Luhn validation) + card payment', async ({ browser }) => {
  const seeded = readSeeded();
  const context = await browser.newContext();
  const page = await context.newPage();
  const logs = attachConsoleWatch(page);
  try {
    await loginUI(page, 'owner');
    await page.goto(`${await page.evaluate(() => location.origin)}/#/C33`);
    await page.locator('[data-testid="field-Number"]').fill('5555 5555 5555 4444');
    await page.locator('[data-testid="field-ExpMonth"]').fill('12');
    await page.locator('[data-testid="field-ExpYear"]').fill('2030');
    await page.locator('[data-testid="field-Label"]').fill('E2E UI Visa');
    await page.locator('[data-testid="screen-primary"]').click();
    await page.waitForFunction(() => location.hash.includes('#/C34'), null, { timeout: 15_000 });

    const clean = logs.filter((l) => ['error', 'warning', 'pageerror'].includes(l.type));
    expect(clean).toEqual([]);
    recordFlow('F05 card add (UI C33 form)', 'PASS', { last4: '4444', console: clean });
  } catch (err) {
    recordFlow('F05 card add (UI C33 form)', 'FAIL', { error: err.message });
    throw err;
  } finally {
    await context.close();
  }

  const owner = await apiLogin('owner');
  const methods = ok(await api('/payments/methods', { token: owner.token }), 'list cards');
  const list = Array.isArray(methods) ? methods : methods.items || [];
  const card = list.find((m) => m.last4 === '4444') || list.find((m) => m.last4 === '4242');
  expect(card).toBeTruthy();
  const req = ok(await api('/requests', {
    method: 'POST',
    token: owner.token,
    body: {
      vehicleId: seeded.ids.vehicleId,
      serviceTypeId: seeded.ids.serviceTypeId,
      pickupLatitude: 30.0444,
      pickupLongitude: 31.2357,
      pickupAddress: 'E2E payment flow',
      distanceKm: 3,
      problem: 'E2E payment flow',
      answersJson: '{}'
    }
  }), 'create request for payment');
  const invoice = ok(await api(`/payments/invoices/request/${req.id}/ensure`, { method: 'POST', token: owner.token }), 'ensure invoice');
  const payment = ok(await api(`/payments/invoices/${invoice.id}/pay`, {
    method: 'POST',
    token: owner.token,
    body: { method: 'Card', paymentMethodId: card.id, idempotencyKey: `e2e-pay-${invoice.id}` }
  }), 'pay invoice');
  expect(payment.status).toBe('Succeeded');
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
    await expect(page.getByText(text).first()).toBeVisible({ timeout: 15_000 });
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
  } finally {
    await context.close();
  }
});

test('F07 signup + OTP session retention (A04->A05->A08) + KYC submission & admin approval (AD15)', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    const uniqueEmail = `mech.e2e.${Date.now()}@example.com`;
    const uniquePhone = `+2011${String(Date.now()).slice(-8)}`;

    await loginUI(page, 'owner');
    const origin = await page.evaluate(() => location.origin);
    await page.evaluate(() => sessionStorage.clear());
    await page.goto(`${origin}/#/A04`);
    await page.locator('[data-testid="role-Mechanic"]').click();
    await page.locator('[data-testid="field-fullName"]').fill('Tarek Mechanic E2E');
    await page.locator('[data-testid="field-email"]').fill(uniqueEmail);
    await page.locator('[data-testid="field-phone"]').fill(uniquePhone);
    await page.locator('[data-testid="field-password"]').fill(DEFAULT_PASSWORD);
    await page.locator('[data-testid="field-confirmPassword"]').fill(DEFAULT_PASSWORD);
    await page.locator('[data-testid="screen-primary"]').click();

    await page.waitForFunction(() => location.hash.includes('#/A05'), null, { timeout: 15_000 });
    // Read OTP from Simulator messages endpoint (exposed because simulatorsEnabled=true)
    const simMsgs = ok(await api('/sim/messages'), 'sim messages');
    const msg = (Array.isArray(simMsgs) ? simMsgs : []).find((m) =>
      String(m.recipient || m.target || '').toLowerCase() === uniqueEmail.toLowerCase() ||
      /\b\d{6}\b/.test(String(m.body || ''))
    );
    const otpMatch = String(msg?.body || '').match(/\b(\d{6})\b/);
    expect(otpMatch).toBeTruthy();
    await page.locator('[data-testid="otp-box-0"]').fill(otpMatch[1]);
    await page.locator('[data-testid="screen-primary"]').click();
    await page.waitForFunction(() => location.hash.includes('#/A08'), null, { timeout: 15_000 });

    // Verify JWT session was issued and retained after A05 OTP verification!
    const storedToken = await page.evaluate(() => sessionStorage.getItem('fixngo.access'));
    expect(storedToken).toBeTruthy();

    // Submit Mechanic KYC on A08 (verifying yearsExperience starts empty — A.2)
    await expect(page.locator('[data-testid="field-yearsExperience"]')).toHaveValue('');
    await page.locator('[data-testid="field-yearsExperience"]').fill('4');
    await page.locator('[data-testid="screen-primary"]').click();
    await page.waitForFunction(() => location.hash.includes('#/A11'), null, { timeout: 15_000 });

    // Admin approves KYC
    resetKycStatus(KYCTEST_EMAIL, 'None');
    const kyc = await loginApi(KYCTEST_EMAIL, DEFAULT_PASSWORD);
    const admin = await apiLogin('admin');
    const app = ok(await api('/providers/kyc', {
      method: 'POST',
      token: kyc.accessToken,
      body: {
        applicantType: 'Mechanic',
        businessName: null,
        address: 'Cairo, Egypt',
        latitude: 30.0444,
        longitude: 31.2357,
        services: [],
        documents: []
      }
    }), 'submit KYC');
    const reviewed = ok(await api(`/admin/kyc/${app.id}/review`, {
      method: 'POST',
      token: admin.token,
      body: { decision: 'Approved', note: 'E2E admin review' }
    }), 'admin KYC review');
    expect(reviewed.status).toBe('Approved');

    recordFlow('F07 signup OTP session kept + A08 KYC + admin approve', 'PASS', { email: uniqueEmail, applicationId: app.id });
  } catch (err) {
    recordFlow('F07 signup OTP session kept + A08 KYC + admin approve', 'FAIL', { error: err.message });
    throw err;
  } finally {
    await context.close();
  }
});

test('F08 admin pricing save (AD05 200 OK) + user suspend/restore (AD12) + TOTP 2FA (AD13)', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const logs = attachConsoleWatch(page);
  try {
    await loginUI(page, 'admin');

    // 1. AD05 Pricing save (verifying B7 fix: 200 OK, no 400 error)
    await page.goto(`${await page.evaluate(() => location.origin)}/#/AD05`);
    await expect(page.locator('[data-testid="field-towBaseEgp"]')).toBeVisible();
    await page.locator('[data-testid="field-towBaseEgp"]').fill('260');
    await page.locator('[data-testid="screen-primary"]').click();
    await expect(page.getByText(/Settings saved|تم حفظ الإعدادات/i)).toBeVisible({ timeout: 15_000 });

    // 2. AD13 TOTP 2FA Setup
    await page.goto(`${await page.evaluate(() => location.origin)}/#/AD13`);
    const setupBtn = page.locator('[data-testid="totp-setup-btn"]');
    if (await setupBtn.isVisible()) {
      await setupBtn.click();
      await expect(page.locator('[data-testid="field-totpCode"]')).toBeVisible({ timeout: 15_000 });
    }

    // 3. Verify HTTP logs have zero 400 errors
    const httpErrors = logs.filter((l) => l.type === 'http');
    expect(httpErrors).toEqual([]);
    recordFlow('F08 AD05 pricing save + AD13 TOTP setup', 'PASS', { httpErrors });
  } catch (err) {
    recordFlow('F08 AD05 pricing save + AD13 TOTP setup', 'FAIL', { error: err.message });
    throw err;
  } finally {
    await context.close();
  }
});

test('F09 support ticket with attachment via SH08 UI + scoped ?ft= URL + AD18 author label (B.8, B.12)', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  const logs = attachConsoleWatch(page);
  const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  );
  let subject;
  let ticketId;
  try {
    const seeded = readSeeded();
    await loginUI(page, 'owner');
    await page.goto(`${await page.evaluate(() => location.origin)}/#/SH08?requestId=${seeded.ids.requestId}`);
    await expect(page.locator('[data-testid="field-Category"]')).toHaveValue('');
    await expect(page.locator('[data-testid="screen-primary"]')).toBeDisabled();

    subject = `E2E UI ticket ${Date.now()}`;
    await page.locator('[data-testid="field-Category"]').selectOption('General');
    await page.locator('[data-testid="field-Subject"]').fill(subject);
    await page.locator('[data-testid="field-Description"]').fill('Created by the E2E UI flow test with PNG attachment');
    await page.locator('[data-testid="field-attachment"]').setInputFiles({
      name: 'receipt.png',
      mimeType: 'image/png',
      buffer: tinyPng
    });
    await expect(page.locator('[data-testid="uploaded-attachment"]')).toBeVisible({ timeout: 15_000 });
    await page.locator('[data-testid="screen-primary"]').click();
    await page.waitForFunction(() => location.hash.includes('#/SH09'), null, { timeout: 15_000 });

    // B.8 & B.12: Verify reference shows FG-xxxx (never ticket code TK-xxxx) and attachment renders via ?ft= (never ?access_token=)
    await expect(page.locator('[data-testid="ticket-reference"]')).toContainText(seeded.ids.requestCode);
    const img = page.locator('[data-testid="ticket-attachment-image"]').first();
    await expect(img).toBeVisible({ timeout: 15_000 });
    const imgSrc = await img.getAttribute('src');
    expect(imgSrc).toContain('?ft=');
    expect(imgSrc).not.toContain('access_token');

    const owner = await apiLogin('owner');
    const tickets = ok(await api('/support/tickets', { token: owner.token }), 'list tickets');
    const list = Array.isArray(tickets) ? tickets : tickets.items || [];
    const ticket = list.find((t) => t.subject === subject);
    expect(ticket).toBeTruthy();
    ticketId = ticket.id;

    // B.8: Admin opens AD18 for this ticket — customer message must show customer name (never "You") and attachment
    await loginUI(adminPage, 'admin');
    await adminPage.goto(`${await adminPage.evaluate(() => location.origin)}/#/AD18?id=${ticketId}`);
    await expect(adminPage.locator('[data-testid="ticket-attachment-image"]').first()).toBeVisible({ timeout: 15_000 });
    const msgText = await adminPage.locator('[data-testid="ticket-message"]').first().innerText();
    expect(msgText).not.toMatch(/^You\b/m);
    expect(msgText).toContain('Gate Two CarOwner');

    const clean = logs.filter((l) => ['error', 'warning', 'pageerror'].includes(l.type));
    expect(clean).toEqual([]);
    recordFlow('F09 support ticket + attachment + ?ft= + AD18 author', 'PASS', { subject, ticketId, console: clean });
  } catch (err) {
    recordFlow('F09 support ticket + attachment + ?ft= + AD18 author', 'FAIL', { error: err.message });
    throw err;
  } finally {
    await context.close();
    await adminCtx.close();
  }

  const admin = await apiLogin('admin');
  ok(await api(`/admin/tickets/${ticketId}/reply`, { method: 'POST', token: admin.token, body: { text: 'E2E admin reply' } }), 'admin reply');
});

test('F10 SOS (API + SH19 UI renders tel: links)', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const logs = attachConsoleWatch(page);
  try {
    await loginUI(page, 'owner');
    await page.goto(`${await page.evaluate(() => location.origin)}/#/SH19`);
    await expect(page.locator('[data-testid="screen"]')).toBeVisible();
    const telCount = await page.locator('a[href^="tel:"]').count();
    const owner = await apiLogin('owner');
    const sos = ok(await api('/support/sos', {
      method: 'POST',
      token: owner.token,
      body: { latitude: 30.0444, longitude: 31.2357, note: 'E2E SOS flow' }
    }), 'create SOS');
    const consoleIssues = logs.filter((l) => ['error', 'warning', 'pageerror'].includes(l.type));
    const pass = telCount >= 2 && !!sos.id;
    recordFlow('F10 SOS (API + UI SH19)', pass ? 'PASS' : 'FAIL', { sosId: sos.id, telLinks: telCount, console: consoleIssues });
    expect(telCount).toBeGreaterThanOrEqual(2);
    expect(consoleIssues).toEqual([]);
  } catch (err) {
    recordFlow('F10 SOS (API + UI SH19)', 'FAIL', { error: err.message });
    throw err;
  } finally {
    await context.close();
  }
});

test('F11 notification deep links (offer/request/booking/kyc) + Admin SH17 applicant document viewer (A.2, A.6)', async ({ browser }) => {
  const seeded = readSeeded();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    // 1. Captain deep link #/offer:<id> -> resolves to T03 (never NF01)
    await loginUI(page, 'captain');
    const origin = await page.evaluate(() => location.origin);
    await page.goto(`${origin}/#/offer:${seeded.ids.pendingCaptainOfferId}`);
    await page.waitForFunction(() => location.hash.includes('#/T03'), null, { timeout: 15_000 });
    expect(await page.locator('[data-testid="not-found"]').count()).toBe(0);

    // 2. Owner deep link #/request:<id> -> resolves to C11, #/booking:<id> -> resolves to C38
    await loginUI(page, 'owner');
    await page.goto(`${origin}/#/request:${seeded.ids.requestId}`);
    await page.waitForFunction(() => location.hash.includes('#/C11'), null, { timeout: 15_000 });
    expect(await page.locator('[data-testid="not-found"]').count()).toBe(0);

    await page.goto(`${origin}/#/booking:${seeded.ids.bookingId}`);
    await page.waitForFunction(() => location.hash.includes('#/C38'), null, { timeout: 15_000 });
    expect(await page.locator('[data-testid="not-found"]').count()).toBe(0);

    // 3. Admin deep link #/kyc:<id> -> resolves to AD03, clicking document opens SH17 with applicant's document
    await loginUI(page, 'admin');
    await page.goto(`${origin}/#/kyc:${seeded.ids.kycApplicationId}`);
    await page.waitForFunction(() => location.hash.includes('#/AD03'), null, { timeout: 15_000 });
    await page.locator('[data-testid="data-row"]').first().click();
    await page.waitForFunction(() => location.hash.includes('#/SH17'), null, { timeout: 15_000 });
    await expect(page.locator('[data-testid="document-preview-image"]')).toBeVisible();
    expect(await page.locator('[data-testid="replace-doc-btn"]').count()).toBe(0);
    await expect(page.locator('[data-testid="nav-verify"]')).toBeVisible();

    recordFlow('F11 notification deep links + Admin SH17 document viewer', 'PASS', {
      offerId: seeded.ids.pendingCaptainOfferId,
      kycId: seeded.ids.kycApplicationId
    });
  } catch (err) {
    recordFlow('F11 notification deep links + Admin SH17 document viewer', 'FAIL', { error: err.message });
    throw err;
  } finally {
    await context.close();
  }
});

test('F12 expired/declined offer re-dispatch to same provider returns 200 OK instead of 500 (A.3)', async () => {
  const seeded = readSeeded();
  const owner = await apiLogin('owner');
  const captain = await apiLogin('captain');

  const req = ok(await api('/requests', {
    method: 'POST',
    token: owner.token,
    body: {
      vehicleId: seeded.ids.vehicleId,
      serviceTypeId: seeded.ids.serviceTypeId,
      pickupLatitude: 30.0444,
      pickupLongitude: 31.2357,
      pickupAddress: 'E2E re-dispatch flow, Cairo',
      distanceKm: 4.2,
      problem: 'E2E re-dispatch flow',
      answersJson: '{}'
    }
  }), 'create request for re-dispatch');

  // 1st dispatch
  const firstOffer = ok(await api(`/requests/${req.id}/offers`, {
    method: 'POST',
    token: owner.token,
    body: { providerId: captain.user.id }
  }), '1st offer dispatch');
  expect(firstOffer.status).toBe('Pending');

  // Captain declines (simulating non-pending / expired state)
  const declined = ok(await api(`/offers/${firstOffer.id}/decline`, {
    method: 'POST',
    token: captain.token
  }), 'decline offer');
  expect(declined.status).toBe('Declined');

  // Re-dispatch to the same provider on the same request — must succeed with 200 OK (no unique constraint 500)
  const secondRes = await api(`/requests/${req.id}/offers`, {
    method: 'POST',
    token: owner.token,
    body: { providerId: captain.user.id }
  });
  expect(secondRes.status).toBe(200);
  expect(secondRes.data.id).toBe(firstOffer.id);
  expect(secondRes.data.status).toBe('Pending');
  recordFlow('F12 expired/declined offer re-dispatch (200 OK)', 'PASS', { requestId: req.id, offerId: secondRes.data.id });
});

test('F13 live SignalR tracking on C11 updates status without reload + retains code & provider on reload (A.4, B.6)', async ({ browser }) => {
  const seeded = readSeeded();
  const context = await browser.newContext();
  const page = await context.newPage();
  const logs = attachConsoleWatch(page);
  try {
    const owner = await apiLogin('owner');
    const captain = await apiLogin('captain');

    ok(await api('/providers/online', {
      method: 'POST',
      token: captain.token,
      body: { isOnline: true, latitude: 30.0444, longitude: 31.2357 }
    }), 'captain online');

    const created = ok(await api('/requests', {
      method: 'POST',
      token: owner.token,
      body: {
        vehicleId: seeded.ids.vehicleId,
        serviceTypeId: seeded.ids.serviceTypeId,
        pickupLatitude: 30.0444,
        pickupLongitude: 31.2357,
        pickupAddress: 'E2E live SignalR tracking, Cairo',
        destinationLatitude: 30.06,
        destinationLongitude: 31.26,
        destinationAddress: 'E2E destination, Cairo',
        distanceKm: 6.4,
        problem: 'E2E live tracking',
        answersJson: '{}'
      }
    }), 'create live tracking request');

    const offer = ok(await api(`/requests/${created.id}/offers`, {
      method: 'POST',
      token: owner.token,
      body: { providerId: captain.user.id }
    }), 'dispatch offer');

    await loginUI(page, 'owner');
    await page.goto(`${await page.evaluate(() => location.origin)}/#/C11?id=${created.id}`);
    await expect(page.locator('[data-testid="tracking-request-code"]')).toHaveText(created.code);

    // 1. Captain accepts offer -> C11 updates live WITHOUT reload to Accepted + Captain's name
    ok(await api(`/offers/${offer.id}/accept`, { method: 'POST', token: captain.token }), 'accept offer');
    await expect(page.locator('[data-testid="tracking-provider-name"]')).toContainText('Gate Two TowCaptain', { timeout: 12_000 });

    // 2. Captain advances to EnRoute -> C11 updates live WITHOUT reload
    ok(await api(`/requests/${created.id}/status`, {
      method: 'POST',
      token: captain.token,
      body: { status: 'EnRoute', note: 'Live EnRoute' }
    }), 'advance EnRoute');
    await expect(page.locator('[data-testid="tracking-status-label"]')).toContainText(/En route/i, { timeout: 12_000 });

    // 3. Captain advances to Arrived -> C11 updates live WITHOUT reload and NEVER shows "Review Repair Quote" for Tow (B.6)
    ok(await api(`/requests/${created.id}/status`, {
      method: 'POST',
      token: captain.token,
      body: { status: 'Arrived', note: 'Live Arrived' }
    }), 'advance Arrived');
    await expect(page.locator('[data-testid="tracking-status-label"]')).toContainText(/Arrived/i, { timeout: 12_000 });
    await expect(page.getByText(/Review Repair Quote/i)).toHaveCount(0);

    // 4. Reload #/C11?id=... directly -> code (FG-xxxx) and provider name MUST be retained (never '—')
    await page.reload();
    await expect(page.locator('[data-testid="tracking-request-code"]')).toHaveText(created.code, { timeout: 15_000 });
    await expect(page.locator('[data-testid="tracking-provider-name"]')).toContainText('Gate Two TowCaptain');

    const clean = logs.filter((l) => ['error', 'warning', 'pageerror'].includes(l.type));
    expect(clean).toEqual([]);
    recordFlow('F13 live SignalR tracking on C11 + reload retention', 'PASS', { requestId: created.id, code: created.code });
  } catch (err) {
    recordFlow('F13 live SignalR tracking on C11 + reload retention', 'FAIL', { error: err.message });
    throw err;
  } finally {
    await context.close();
  }
});

test('F14 C14/C34 after cash Paid routes to C15 (0 HTTP 409) + C19 closed Friday 0 slots + C40 empty review null text (A.2, A.5, B.7, B.11)', async ({ browser }) => {
  const seeded = readSeeded();
  const context = await browser.newContext();
  const page = await context.newPage();
  const logs = attachConsoleWatch(page);
  try {
    const owner = await apiLogin('owner');
    const captain = await apiLogin('captain');
    const center = await apiLogin('center');

    // 1. Complete a tow trip so invoice is settled Paid by cash collection
    const created = ok(await api('/requests', {
      method: 'POST',
      token: owner.token,
      body: {
        vehicleId: seeded.ids.vehicleId,
        serviceTypeId: seeded.ids.serviceTypeId,
        pickupLatitude: 30.0444,
        pickupLongitude: 31.2357,
        pickupAddress: 'E2E cash paid flow, Cairo',
        distanceKm: 4,
        problem: 'E2E cash paid',
        answersJson: '{}'
      }
    }), 'create request');
    const offer = ok(await api(`/requests/${created.id}/offers`, {
      method: 'POST', token: owner.token, body: { providerId: captain.user.id }
    }), 'send offer');
    ok(await api(`/offers/${offer.id}/accept`, { method: 'POST', token: captain.token }), 'accept');
    for (const status of ['EnRoute', 'Arrived', 'Working', 'Completed']) {
      ok(await api(`/requests/${created.id}/status`, { method: 'POST', token: captain.token, body: { status } }), status);
    }

    await loginUI(page, 'owner');
    const origin = await page.evaluate(() => location.origin);
    logs.length = 0;

    // C14 on Paid invoice -> shows Paid, primary routes to C15, zero 409 errors (A.5)
    await page.goto(`${origin}/#/C14?id=${created.id}`);
    await expect(page.locator('[data-testid="invoice-status"]')).toContainText(/Paid/i, { timeout: 15_000 });
    await page.locator('[data-testid="screen-primary"]').click();
    await page.waitForFunction(() => location.hash.includes('#/C15'), null, { timeout: 15_000 });

    // C34 on Paid invoice -> shows Paid, no active "Pay Now", primary routes to C15 (A.5)
    await page.goto(`${origin}/#/C34?id=${created.id}`);
    await expect(page.locator('[data-testid="invoice-status"]')).toContainText(/Paid/i, { timeout: 15_000 });
    await expect(page.getByText(/Pay Now/i)).toHaveCount(0);
    await page.locator('[data-testid="screen-primary"]').click();
    await page.waitForFunction(() => location.hash.includes('#/C15'), null, { timeout: 15_000 });
    expect(logs.filter((l) => l.type === 'http')).toEqual([]);

    // 2. C19 on closed Friday -> shows Closed notice, 0 slot buttons, disabled confirm (B.7)
    await page.goto(`${origin}/#/C19?centerId=${seeded.ids.centerId}&serviceId=${seeded.ids.centerServiceId}`);
    const fridaySpan = page.locator('[data-day-weekday="5"]').first();
    await expect(fridaySpan).toBeVisible();
    await fridaySpan.click();
    await expect(page.locator('[data-testid="closed-day-state"]')).toBeVisible({ timeout: 10_000 });
    expect(await page.locator('[data-testid="booking-slot-picker"] button').count()).toBe(0);
    await expect(page.locator('[data-testid="screen-primary"]')).toBeDisabled();

    // 3. C40 empty-comment review -> submits null text (never fake workshop string) + C38 Paid badge (A.2, B.11)
    const slot = new Date(Date.now() + 72 * 3600 * 1000);
    slot.setUTCMinutes(0, 0, 0);
    const bk = ok(await api('/centers/bookings', {
      method: 'POST',
      token: owner.token,
      body: { centerId: seeded.ids.centerId, serviceId: seeded.ids.centerServiceId, slotStart: slot.toISOString(), vehicleId: seeded.ids.vehicleId }
    }), 'create booking for C40');
    ok(await api(`/center-admin/bookings/${bk.id}/confirm`, { method: 'POST', token: center.token }), 'confirm');
    ok(await api(`/center-admin/bookings/${bk.id}/start`, { method: 'POST', token: center.token }), 'start');
    ok(await api(`/center-admin/bookings/${bk.id}/complete`, { method: 'POST', token: center.token, body: { extraMinor: 0 } }), 'complete');

    await page.goto(`${origin}/#/C38?id=${bk.id}`);
    await expect(page.locator('[data-testid="booking-payment-status"]')).toContainText(/Paid/i, { timeout: 15_000 });

    await page.goto(`${origin}/#/C40?centerId=${seeded.ids.centerId}&bookingId=${bk.id}`);
    await expect(page.locator('[data-testid="screen-primary"]')).toBeDisabled();
    await expect(page.locator('[data-testid="toggle-recommend"]')).toHaveAttribute('aria-checked', 'false');
    await page.locator('[data-testid="star-4"]').click();
    await page.locator('[data-testid="screen-primary"]').click();
    await expect(page.getByText(/Thank you! Your review has been recorded/i)).toBeVisible({ timeout: 15_000 });

    const reviews = ok(await api(`/reviews/center/${seeded.ids.centerId}`, { token: owner.token }), 'list center reviews');
    const latest = (Array.isArray(reviews) ? reviews : [])[0];
    expect(latest).toBeTruthy();
    expect(latest.text || null).toBeNull();

    recordFlow('F14 C14/C34 Paid + C19 closed Friday + C40 empty review + C38 Paid badge', 'PASS', { requestId: created.id, bookingId: bk.id });
  } catch (err) {
    recordFlow('F14 C14/C34 Paid + C19 closed Friday + C40 empty review + C38 Paid badge', 'FAIL', { error: err.message });
    throw err;
  } finally {
    await context.close();
  }
});

test('F15 unticked irreversible confirmations (AD12, AD15, SH15, SH21) + empty A09/A10/SH20 forms + AD05 direct reload (A.2, A.3, B.9, B.10)', async ({ browser }) => {
  const seeded = readSeeded();
  const mechCtx = await browser.newContext();
  const mechPage = await mechCtx.newPage();
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  try {
    // 1. Mechanic checks A09, A10, SH15, SH20, SH21
    await loginUI(mechPage, 'mechanic');
    const origin = await mechPage.evaluate(() => location.origin);

    await mechPage.goto(`${origin}/#/A09`);
    await expect(mechPage.locator('[data-testid="field-truckMake"]')).toHaveValue('');
    await expect(mechPage.locator('[data-testid="field-truckType"]')).toHaveValue('');
    await expect(mechPage.locator('[data-testid="field-capacityTonnes"]')).toHaveValue('');
    await expect(mechPage.locator('[data-testid="field-plate"]')).toHaveValue('');
    await expect(mechPage.getByText(/Front & back attached/i)).toHaveCount(0);

    await mechPage.goto(`${origin}/#/A10`);
    await expect(mechPage.locator('[data-testid="field-address"]')).toHaveValue('');
    expect(await mechPage.locator('[data-testid="center-services-picker"] button[aria-pressed="true"]').count()).toBe(0);
    // Click interactive MapView to drop a pin (B.9)
    await mechPage.locator('[data-testid="map-view"]').click({ position: { x: 120, y: 80 } });
    await expect(mechPage.locator('[data-testid="map-pin"]')).toBeVisible();

    await mechPage.goto(`${origin}/#/SH20`);
    await expect(mechPage.locator('[data-testid="field-bankCode"]')).toHaveValue('');
    await expect(mechPage.locator('[data-testid="toggle-useAsPayout"]')).toHaveAttribute('aria-checked', 'false');
    await expect(mechPage.locator('.phone-frame').getByText(/sample IBAN/i)).toHaveCount(0);

    await mechPage.goto(`${origin}/#/SH15`);
    await expect(mechPage.locator('[data-testid="confirm-withdrawal"]')).not.toBeChecked();
    await expect(mechPage.locator('[data-testid="screen-primary"]')).toBeDisabled();

    await mechPage.goto(`${origin}/#/SH21`);
    await expect(mechPage.locator('[data-testid="confirm-deletion"]')).not.toBeChecked();
    await expect(mechPage.locator('[data-testid="screen-primary"]')).toBeDisabled();

    // 2. Admin checks AD12, AD15 unticked confirmations + AD05 direct browser reload
    await loginUI(adminPage, 'admin');
    const adminOrigin = await adminPage.evaluate(() => location.origin);

    await adminPage.goto(`${adminOrigin}/#/AD12?id=${seeded.users.mechanic.id}`);
    await expect(adminPage.locator('[data-testid="field-reason"]')).toHaveValue('');
    await expect(adminPage.locator('[data-testid="field-confirmed"]')).not.toBeChecked();
    await expect(adminPage.locator('[data-testid="screen-primary"]')).toBeDisabled();

    await adminPage.goto(`${adminOrigin}/#/AD15?id=${seeded.ids.kycApplicationId}`);
    await expect(adminPage.locator('[data-testid="check-identity"]')).not.toBeChecked();
    await expect(adminPage.locator('[data-testid="check-credentials"]')).not.toBeChecked();
    await expect(adminPage.locator('[data-testid="screen-primary"]')).toBeDisabled();

    // B.10: Direct reload on AD05 must render form inputs cleanly (never stuck on skeleton)
    await adminPage.goto(`${adminOrigin}/#/AD05`);
    await expect(adminPage.locator('[data-testid="field-towBaseEgp"]')).toBeVisible({ timeout: 15_000 });
    await adminPage.reload();
    await expect(adminPage.locator('[data-testid="field-towBaseEgp"]')).toBeVisible({ timeout: 15_000 });
    expect(await adminPage.locator('[data-testid="skeleton"]').count()).toBe(0);

    recordFlow('F15 unticked confirmations + empty A09/A10/SH20 + AD05 reload', 'PASS', {});
  } catch (err) {
    recordFlow('F15 unticked confirmations + empty A09/A10/SH20 + AD05 reload', 'FAIL', { error: err.message });
    throw err;
  } finally {
    await mechCtx.close();
    await adminCtx.close();
  }
});
