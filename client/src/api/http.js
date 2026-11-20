// Fetch wrapper: base URL, bearer auth, single refresh-on-401, ProblemDetails errors.

import { extractFieldErrors, localizeErrorMessage } from '../ui/validation.js';

let accessToken = sessionStorage.getItem('fixngo.access');
let refreshToken = sessionStorage.getItem('fixngo.refresh');

export function setTokens(access, refresh) {
  accessToken = access;
  refreshToken = refresh;
  if (access) sessionStorage.setItem('fixngo.access', access);
  else sessionStorage.removeItem('fixngo.access');
  if (refresh) sessionStorage.setItem('fixngo.refresh', refresh);
  else sessionStorage.removeItem('fixngo.refresh');
}

export function clearTokens() { setTokens(null, null); clearFileToken(); }
export function hasToken() { return !!accessToken; }
export function getToken() { return accessToken; }

// Download-only file token: short-lived (server: 10 min), scoped to GET /api/v1/files/{id}
// and still subject to per-file ownership checks. The JWT is never placed in a URL.
let fileToken = null;
let fileTokenExpiresAt = 0;
let fileTokenPromise = null;
export function clearFileToken() { fileToken = null; fileTokenExpiresAt = 0; fileTokenPromise = null; }
export async function ensureFileToken(force = false) {
  if (!accessToken) return null;
  if (!force && fileToken && Date.now() < fileTokenExpiresAt - 60_000) return fileToken;
  if (fileTokenPromise) return fileTokenPromise;
  fileTokenPromise = api('/files/token', { method: 'POST', body: {} })
    .then((r) => {
      fileToken = r?.token || null;
      fileTokenExpiresAt = r?.expiresAt ? Date.parse(r.expiresAt) : Date.now() + 5 * 60_000;
      return fileToken;
    })
    .catch(() => null)
    .finally(() => { fileTokenPromise = null; });
  return fileTokenPromise;
}
export function fileUrl(fileId) {
  if (!fileId) return '';
  return `/api/v1/files/${fileId}${fileToken ? `?ft=${encodeURIComponent(fileToken)}` : ''}`;
}

export class ApiError extends Error {
  constructor(status, payload, code) {
    const isAr = typeof localStorage !== 'undefined' && localStorage.getItem('fixngo.lang') === 'ar';
    const resolvedCode = code || payload?.code;
    const fieldErrors = extractFieldErrors(payload?.errors, resolvedCode, payload?.detail, isAr);
    const firstFieldMsg = Object.values(fieldErrors)[0] || '';
    const rawDetail = String(payload?.detail ?? '').trim();
    const isGenericDetail = !rawDetail || /^(Validation failed\.?|One or more validation errors occurred\.?)$/i.test(rawDetail);
    const bestMessage = (!isGenericDetail ? localizeErrorMessage(rawDetail, isAr) : '')
      || firstFieldMsg
      || localizeErrorMessage(payload?.title, isAr)
      || `HTTP ${status}`;

    super(bestMessage);
    this.status = status;
    this.code = resolvedCode;
    this.errors = payload?.errors;
    this.fieldErrors = fieldErrors;
  }
}

async function refresh() {
  if (!refreshToken) return false;
  try {
    const res = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch { return false; }
}

export async function api(path, options = {}) {
  const { method = 'GET', body, idempotencyKey, _retried = false, ...rest } = options;
  const headers = { ...(rest.headers || {}) };
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  // Simulator-driven weak network: adds latency so offline/queue states can be exercised.
  // Off by default and never enabled in tests, so it cannot affect normal operation.
  if (typeof localStorage !== 'undefined' && localStorage.getItem('fixngo.weakNetwork') === 'true') {
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  let res;
  try {
    res = await fetch(path.startsWith('http') ? path : `/api/v1${path}`, {
      method, headers, body: body !== undefined ? (isForm ? body : JSON.stringify(body)) : undefined, ...rest
    });
  } catch (e) {
    throw new ApiError(0, { detail: 'Connection interrupted.' }, 'network.offline');
  }

  if (res.status === 401 && !_retried && refreshToken) {
    if (await refresh()) return api(path, { ...options, _retried: true });
    clearTokens();
    window.dispatchEvent(new CustomEvent('fixngo:session-revoked'));
  }

  const text = await res.text();
  const payload = text ? (() => { try { return JSON.parse(text); } catch { return { detail: text }; } })() : null;
  if (!res.ok) throw new ApiError(res.status, payload, payload?.code);
  return payload;
}

export const get = (p, o) => api(p, { ...o, method: 'GET' });
export const post = (p, b, o) => api(p, { ...o, method: 'POST', body: b });
export const put = (p, b, o) => api(p, { ...o, method: 'PUT', body: b });
export const del = (p, o) => api(p, { ...o, method: 'DELETE' });
export async function uploadFile(file, purpose = 'document') {
  const fd = new FormData();
  fd.append('file', file);
  return api(`/files/upload?purpose=${encodeURIComponent(purpose)}`, { method: 'POST', body: fd });
}
