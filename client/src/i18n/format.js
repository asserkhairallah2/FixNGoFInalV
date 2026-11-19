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

export function fmtDate(value, lang) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Cairo'
  }).format(new Date(value));
}

export function fmtTime(value, lang) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Cairo'
  }).format(new Date(value));
}

export function fmtDateTime(value, lang) {
  if (!value) return '—';
  return `${fmtDate(value, lang)} · ${fmtTime(value, lang)}`;
}

export function fmtDistance(km, lang) {
  return `${fmtNumber(Math.round(km ?? 0), lang)} ${lang === 'ar' ? 'كم' : 'km'}`;
}
