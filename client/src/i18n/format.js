// Formatting helpers — raw values from the API are formatted per active locale.
// Timezone Africa/Cairo, locales ar-EG / en-GB.

export function fmtMoney(minor, lang, currency = 'EGP') {
  const amount = (minor ?? 0) / 100;
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    style: 'currency', currency, minimumFractionDigits: 2
  }).format(amount);
}

export function fmtNumber(value, lang) {
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-GB').format(value ?? 0);
}

export function toUtcDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const s = String(value).trim();
  // SQLite returns DateTimeKind.Unspecified serialized without 'Z'; treat bare ISO timestamps as UTC.
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s) ? `${s}Z` : s;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDate(value, lang) {
  const d = toUtcDate(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Cairo'
  }).format(d);
}

export function fmtTime(value, lang) {
  const d = toUtcDate(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Cairo'
  }).format(d);
}

export function fmtTime12(value, lang) {
  const d = toUtcDate(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Africa/Cairo'
  }).format(d);
}

export function fmtDateTime(value, lang) {
  const d = toUtcDate(value);
  if (!d) return '—';
  return `${fmtDate(d, lang)} · ${fmtTime(d, lang)}`;
}

export function fmtDistance(km, lang) {
  const rounded = Math.round(Number(km ?? 0) * 10) / 10;
  return `${fmtNumber(rounded, lang)} ${lang === 'ar' ? 'كم' : 'km'}`;
}
