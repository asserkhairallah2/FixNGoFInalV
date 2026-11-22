// Playwright global setup: provision the temp database with the five Gate 2
// accounts plus the minimum real data needed by the screen sweep and flows.
// Everything runs against the server started by e2e/server.mjs (temp data dir).
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import {
  api, baseURL, loginApi, CREDENTIALS, KYCTEST_EMAIL, DEFAULT_PASSWORD,
  evidenceDir, writeEvidence
} from './helpers.js';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));

function assertOk(res, label) {
  if (!res.ok) throw new Error(`${label} failed: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data;
}

// Providers created through signup have KycStatus=Submitted but no KycApplication,
// and the KYC state machine forbids Submitted→Submitted. This fixture patch is
// limited to the throwaway E2E SQLite file so matching/candidates can be tested.
function patchKycStatus(dataDir, email, value) {
  const db = new DatabaseSync(path.join(dataDir, 'fixngo.db'));
  try {
    const result = db.prepare('UPDATE Users SET KycStatus = ? WHERE lower(Email) = lower(?)').run(value, email);
    if (!result.changes) throw new Error(`Could not patch KYC status for ${email}`);
  } finally { db.close(); }
}

// The API hides non-Pending offers, and seeded offers expire after 30 seconds.
// The two incoming-offer screens are visited minutes later, so keep these
// fixture offers Pending with a far-future expiry in the throwaway DB only.
function patchOfferExpiry(dataDir, offerId) {
  const db = new DatabaseSync(path.join(dataDir, 'fixngo.db'));
  try {
    const result = db.prepare(
      "UPDATE Offers SET Status = 'Pending', ExpiresAt = '2099-01-01 00:00:00.0000000' WHERE lower(Id) = lower(?)"
    ).run(offerId);
    if (!result.changes) throw new Error(`Could not patch offer expiry for ${offerId}`);
  } finally { db.close(); }
}

// Quotes may only be issued from Arrived/QuotePending/Disputed. The main
// fixture request has just been accepted, so move it to Arrived in the
// throwaway DB before creating the estimate/invoice fixture.
function patchRequestStatus(dataDir, requestId, value) {
  const db = new DatabaseSync(path.join(dataDir, 'fixngo.db'));
  try {
    const result = db.prepare(
      'UPDATE ServiceRequests SET Status = ? WHERE lower(Id) = lower(?)'
    ).run(value, requestId);
    if (!result.changes) throw new Error(`Could not patch request status for ${requestId}`);
  } finally { db.close(); }
}

async function ensureUser(key) {
  const cred = CREDENTIALS[key];
  try {
    const auth = await loginApi(cred.email, cred.password);
    return { ...auth, created: false };
  } catch {
    const signup = await api('/auth/signup', {
      method: 'POST',
      body: {
        fullName: `Gate Two ${cred.role}`,
        email: cred.email,
        phone: `+2010${String(Object.keys(CREDENTIALS).indexOf(key) + 2).padStart(8, '0')}`,
        password: cred.password,
        role: cred.role,
        businessName: key === 'center' ? 'Gate Two Service Center' : null
      }
    });
    assertOk(signup, `signup ${key}`);
    const devCode = signup.data.devCode;
    if (!devCode) throw new Error(`No devCode returned for ${key} (simulator OTP not exposed)`);
    const verify = await api('/auth/verify-otp', {
      method: 'POST',
      body: { target: cred.email, code: devCode, purpose: 'Signup' }
    });
    assertOk(verify, `verify OTP ${key}`);
    const auth = await loginApi(cred.email, cred.password);
    return { ...auth, created: true };
  }
}

export default async function globalSetup() {
  const base = baseURL();
  let healthy = false;
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${base}/health`); if (r.ok) { healthy = true; break; } } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!healthy) throw new Error(`E2E server never became healthy at ${base}/health`);

  const runtime = JSON.parse(fs.readFileSync(path.join(e2eDir, '.runtime.json'), 'utf8'));
  const seeded = { at: new Date().toISOString(), baseURL: base, dataDir: runtime.dataDir, users: {}, ids: {}, prerequisites: {} };

  const admin = await loginApi(CREDENTIALS.admin.email, CREDENTIALS.admin.password);
  seeded.users.admin = { id: admin.user.id, email: admin.user.email, role: admin.user.role };

  const auth = {};
  for (const key of ['owner', 'mechanic', 'captain', 'center']) {
    const a = await ensureUser(key);
    auth[key] = a;
    seeded.users[key] = { id: a.user.id, email: a.user.email, role: a.user.role, created: a.created };
  }

  // KYC test account: created via signup then reset to None so the real
  // SubmitKyc → AdminReview flow can be exercised from a legal first state.
  let kycAuth;
  try { kycAuth = await loginApi(KYCTEST_EMAIL, DEFAULT_PASSWORD); }
  catch {
    const s = await api('/auth/signup', { method: 'POST', body: {
      fullName: 'Gate Two KYC Tester', email: KYCTEST_EMAIL,
      phone: '+201000000099', password: DEFAULT_PASSWORD, role: 'Mechanic'
    }});
    assertOk(s, 'signup kyc test user');
    assertOk(await api('/auth/verify-otp', { method: 'POST', body: {
      target: KYCTEST_EMAIL, code: s.data.devCode, purpose: 'Signup'
    }}), 'verify kyc test user');
    kycAuth = await loginApi(KYCTEST_EMAIL, DEFAULT_PASSWORD);
  }
  auth.kyc = kycAuth;
  seeded.users.kyc = { id: kycAuth.user.id, email: KYCTEST_EMAIL, role: kycAuth.user.role };

  // Fixture-only DB patches (see comment on patchKycStatus).
  // The mechanic role needs a real KYC application (with uploaded credential PNGs)
  // for A11/M09/SH17 and for the admin queue (AD02/AD03/AD15); submit it from None first.
  const uploadFixturePng = async (token, fileName) => {
    const pngBytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    );
    const fd = new FormData();
    fd.append('file', new Blob([pngBytes], { type: 'image/png' }), fileName);
    const upRes = await fetch(`${base}/api/v1/files/upload?purpose=kyc`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd
    });
    if (!upRes.ok) throw new Error(`upload ${fileName} failed: ${upRes.status}`);
    return await upRes.json();
  };

  patchKycStatus(runtime.dataDir, CREDENTIALS.mechanic.email, 'None');
  const mechIdDoc = await uploadFixturePng(auth.mechanic.accessToken, 'national-id.png');
  const mechLicDoc = await uploadFixturePng(auth.mechanic.accessToken, 'driving-license.png');
  const mechanicKyc = assertOk(await api('/providers/kyc', {
    method: 'POST',
    token: auth.mechanic.accessToken,
    body: {
      applicantType: 'Mechanic', businessName: null, address: 'Cairo, Egypt',
      latitude: 30.0444, longitude: 31.2357, services: [],
      documents: [
        { documentType: 'NationalId', fileId: mechIdDoc.id },
        { documentType: 'DrivingLicense', fileId: mechLicDoc.id }
      ]
    }
  }), 'seed mechanic KYC application');
  seeded.ids.kycApplicationId = mechanicKyc.id;

  patchKycStatus(runtime.dataDir, CREDENTIALS.captain.email, 'Approved');
  patchKycStatus(runtime.dataDir, CREDENTIALS.mechanic.email, 'Approved');
  patchKycStatus(runtime.dataDir, CREDENTIALS.center.email, 'Approved');
  patchKycStatus(runtime.dataDir, KYCTEST_EMAIL, 'None');

  // Online providers with a fixed Cairo location so matching/ranking works.
  for (const key of ['captain', 'mechanic']) {
    assertOk(await api('/providers/online', { method: 'POST', token: auth[key].accessToken,
      body: { isOnline: true, latitude: 30.0444, longitude: 31.2357 } }), `online ${key}`);
  }

  // Owner vehicle + one tow request, then a captain offer that is accepted.
  const bootstrap = assertOk(await api('/lookups/bootstrap', { token: auth.owner.accessToken }), 'bootstrap');
  const towService = bootstrap.serviceTypes.find((s) => s.kind === 'Tow') || bootstrap.serviceTypes[0];
  const mechanicService = bootstrap.serviceTypes.find((s) => s.kind !== 'Tow') || bootstrap.serviceTypes[0];
  seeded.ids.serviceTypeId = towService.id;
  seeded.ids.mechanicServiceTypeId = mechanicService.id;
  if (!towService) throw new Error('No service types were seeded by the backend');

  const vehicle = assertOk(await api('/vehicles', { method: 'POST', token: auth.owner.accessToken, body: {
    make: 'Toyota', model: 'Corolla', year: 2020, plate: 'E2E-4242',
    color: 'Silver', fuel: 'Petrol', isPrimary: true
  }}), 'create vehicle');
  seeded.ids.vehicleId = vehicle.id;

  const createFixtureVehicle = async (idx) => assertOk(await api('/vehicles', {
    method: 'POST',
    token: auth.owner.accessToken,
    body: {
      make: 'Hyundai',
      model: 'Elantra',
      year: 2021,
      plate: `FXT-900${idx}`,
      color: 'White',
      fuel: 'Petrol',
      isPrimary: false
    }
  }), `create fixture vehicle ${idx}`);

  const fxtVeh1 = await createFixtureVehicle(1);
  const request = assertOk(await api('/requests', { method: 'POST', token: auth.owner.accessToken, body: {
    vehicleId: fxtVeh1.id, serviceTypeId: towService.id,
    pickupLatitude: 30.0444, pickupLongitude: 31.2357,
    pickupAddress: 'E2E pickup point, Cairo',
    destinationLatitude: 30.05, destinationLongitude: 31.24,
    destinationAddress: 'E2E drop-off, Cairo', distanceKm: 5,
    problem: 'E2E seeded tow request', answersJson: '{}', note: 'E2E fixture'
  }}), 'create request');
  seeded.ids.requestId = request.id;
  seeded.ids.requestCode = request.code;

  const candidates = assertOk(await api(`/requests/${request.id}/candidates`, { token: auth.owner.accessToken }), 'candidates');
  seeded.prerequisites.candidates = candidates.length;
  const captainCandidate = candidates.find((c) => c.providerId === auth.captain.user.id);
  if (captainCandidate) {
    const offer = assertOk(await api(`/requests/${request.id}/offers`, { method: 'POST',
      token: auth.owner.accessToken, body: { providerId: captainCandidate.providerId } }), 'send offer');
    seeded.ids.offerId = offer.id;
    assertOk(await api(`/offers/${offer.id}/accept`, { method: 'POST', token: auth.captain.accessToken }), 'accept offer');
    seeded.prerequisites.offerAccepted = true;
  } else {
    seeded.prerequisites.offerAccepted = false;
  }

  // Helper for the additional provider fixtures below (each on its own non-primary fixture vehicle
  // so the primary vehicle stays free for active-request E2E flows while honoring duplicate-request guards).
  let fxtCounter = 2;
  const createRequest = async (serviceTypeId, problem) => {
    const fv = await createFixtureVehicle(fxtCounter++);
    return assertOk(await api('/requests', {
      method: 'POST',
      token: auth.owner.accessToken,
      body: {
        vehicleId: fv.id, serviceTypeId,
        pickupLatitude: 30.0444, pickupLongitude: 31.2357,
        pickupAddress: `E2E ${problem}, Cairo`, distanceKm: 4,
        problem: `E2E seeded ${problem}`, answersJson: '{}', note: 'E2E provider fixture'
      }
    }), `create ${problem} request`);
  };

  // Mechanic screens: /offers/{id} only returns PENDING offers, so the incoming
  // offer screen needs a separate unaccepted offer from the assigned request.
  const mechanicRequest = await createRequest(mechanicService.id, 'mechanic assigned');
  seeded.ids.mechanicRequestId = mechanicRequest.id;
  const mechanicOffer = assertOk(await api(`/requests/${mechanicRequest.id}/offers`, {
    method: 'POST', token: auth.owner.accessToken, body: { providerId: auth.mechanic.user.id }
  }), 'send mechanic offer');
  assertOk(await api(`/offers/${mechanicOffer.id}/accept`, {
    method: 'POST', token: auth.mechanic.accessToken
  }), 'accept mechanic offer');

  const mechanicIncoming = await createRequest(mechanicService.id, 'mechanic incoming');
  const mechanicPending = assertOk(await api(`/requests/${mechanicIncoming.id}/offers`, {
    method: 'POST', token: auth.owner.accessToken, body: { providerId: auth.mechanic.user.id }
  }), 'send pending mechanic offer');
  seeded.ids.pendingMechanicOfferId = mechanicPending.id;
  patchOfferExpiry(runtime.dataDir, mechanicPending.id);

  // Captain incoming-offer screen needs its own pending offer as well.
  const captainIncoming = await createRequest(towService.id, 'captain incoming');
  const captainPending = assertOk(await api(`/requests/${captainIncoming.id}/offers`, {
    method: 'POST', token: auth.owner.accessToken, body: { providerId: auth.captain.user.id }
  }), 'send pending captain offer');
  seeded.ids.pendingCaptainOfferId = captainPending.id;
  patchOfferExpiry(runtime.dataDir, captainPending.id);

  // Quote + approval gives the estimate/invoice screens real data.
  try {
    patchRequestStatus(runtime.dataDir, request.id, 'Arrived');
    const quote = assertOk(await api(`/requests/${request.id}/quotes`, { method: 'POST',
      token: auth.captain.accessToken,
      body: { calloutMinor: 12000, laborMinor: 5000, partsMinor: 0, diagnosis: 'E2E diagnosis' } }), 'create quote');
    seeded.ids.quoteId = quote.id;
    assertOk(await api(`/requests/${request.id}/quotes/${quote.id}/approve`, { method: 'POST',
      token: auth.owner.accessToken }), 'approve quote');
  } catch (e) { seeded.prerequisites.quote = `failed: ${e.message}`; }

  // Service center catalog + one booking that the center confirms.
  try {
    const service = assertOk(await api('/center-admin/services', { method: 'POST', token: auth.center.accessToken, body: {
      name: 'E2E Oil Change', description: 'Fixture service', priceMinor: 8500, durationMinutes: 45
    }}), 'center service');
    seeded.ids.centerServiceId = service.id;
    const owned = assertOk(await api('/center-admin/profile', { token: auth.center.accessToken }), 'center profile');
    seeded.ids.centerId = owned.id;
    const slot = new Date(Date.now() + 48 * 3600 * 1000);
    slot.setUTCMinutes(0, 0, 0);
    const booking = assertOk(await api('/centers/bookings', { method: 'POST', token: auth.owner.accessToken, body: {
      centerId: owned.id, serviceId: service.id, slotStart: slot.toISOString(),
      vehicleId: vehicle.id, note: 'E2E booking'
    }}), 'create booking');
    seeded.ids.bookingId = booking.id;
    assertOk(await api(`/center-admin/bookings/${booking.id}/confirm`, { method: 'POST',
      token: auth.center.accessToken }), 'confirm booking');
    const workOrders = assertOk(await api('/center-admin/work-orders', {
      token: auth.center.accessToken
    }), 'list work orders');
    seeded.ids.workOrderId = workOrders[0]?.id || null;
  } catch (e) { seeded.prerequisites.booking = `failed: ${e.message}`; }

  // Card + invoice + successful fake-gateway charge.
  try {
    const card = assertOk(await api('/payments/methods/card', { method: 'POST', token: auth.owner.accessToken, body: {
      number: '4242424242424242', expMonth: 12, expYear: 2030, label: 'E2E Visa', isDefault: true
    }}), 'add card');
    seeded.ids.cardId = card.id;
    const invoice = assertOk(await api(`/payments/invoices/request/${request.id}/ensure`, { method: 'POST',
      token: auth.owner.accessToken }), 'ensure invoice');
    seeded.ids.invoiceId = invoice.id;
    const payment = assertOk(await api(`/payments/invoices/${invoice.id}/pay`, { method: 'POST',
      token: auth.owner.accessToken, body: { method: 'Card', paymentMethodId: card.id,
        idempotencyKey: `e2e-seed-${request.id}` } }), 'pay invoice');
    seeded.ids.paymentId = payment.id;
  } catch (e) { seeded.prerequisites.payment = `failed: ${e.message}`; }

  // Admin AD08 needs a real cash payment review (only the Cash method creates
  // one; the card payment above is settled immediately).
  try {
    const cashRequest = await createRequest(mechanicService.id, 'cash review');
    const cashInvoice = assertOk(await api(`/payments/invoices/request/${cashRequest.id}/ensure`, {
      method: 'POST', token: auth.owner.accessToken
    }), 'ensure cash invoice');
    assertOk(await api(`/payments/invoices/${cashInvoice.id}/pay`, {
      method: 'POST',
      token: auth.owner.accessToken,
      body: { method: 'Cash', idempotencyKey: `e2e-cash-${cashInvoice.id}` }
    }), 'pay cash invoice');
    const reviews = assertOk(await api('/admin/payment-reviews', { token: admin.accessToken }), 'list payment reviews');
    seeded.ids.paymentReviewId = reviews[0]?.id || null;
  } catch (e) { seeded.prerequisites.paymentReview = `failed: ${e.message}`; }

  // Chat thread, support ticket (answered by admin) and an SOS event.
  try {
    const thread = assertOk(await api(`/requests/${request.id}/chat`, { method: 'POST',
      token: auth.owner.accessToken, body: {} }), 'start chat');
    seeded.ids.threadId = thread.id;
    assertOk(await api(`/chat/threads/${thread.id}/messages`, { method: 'POST',
      token: auth.owner.accessToken, body: { text: 'E2E seeded message' } }), 'send chat message');
  } catch (e) { seeded.prerequisites.chat = `failed: ${e.message}`; }
  try {
    const ticket = assertOk(await api('/support/tickets', { method: 'POST', token: auth.owner.accessToken, body: {
      category: 'General', subject: 'E2E seeded ticket', description: 'Seeded for screen sweep'
    }}), 'create ticket');
    seeded.ids.ticketId = ticket.id;
    assertOk(await api(`/admin/tickets/${ticket.id}/reply`, { method: 'POST', token: admin.accessToken,
      body: { text: 'E2E seeded admin reply' } }), 'admin ticket reply');
  } catch (e) { seeded.prerequisites.ticket = `failed: ${e.message}`; }
  try {
    const sos = assertOk(await api('/support/sos', { method: 'POST', token: auth.owner.accessToken, body: {
      latitude: 30.0444, longitude: 31.2357, note: 'E2E seeded SOS'
    }}), 'create SOS');
    seeded.ids.sosId = sos.id;
  } catch (e) { seeded.prerequisites.sos = `failed: ${e.message}`; }
  try {
    const report = assertOk(await api('/support/safety', {
      method: 'POST',
      token: auth.owner.accessToken,
      body: {
        category: 'Other', reportedUserId: null, requestId: request.id,
        description: 'E2E seeded safety report'
      }
    }), 'create safety report');
    seeded.ids.safetyReportId = report.id;
  } catch (e) { seeded.prerequisites.safetyReport = `failed: ${e.message}`; }

  fs.writeFileSync(path.join(e2eDir, '.seeded.json'), JSON.stringify(seeded, null, 2));
  writeEvidence('global-setup.json', JSON.stringify(seeded, null, 2));
  console.log(`[e2e] seeded 5 roles, ${Object.keys(seeded.ids).length} entity ids`);
}
