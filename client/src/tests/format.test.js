import { describe, it, expect } from 'vitest';
import { fmtMoney, fmtNumber, fmtDate, fmtTime, fmtDistance } from '../i18n/format.js';

describe('Intl format helpers', () => {
  it('formats money in EN and AR locales without hard-coded digits', () => {
    const en = fmtMoney(123450, 'en');
    const ar = fmtMoney(123450, 'ar');
    expect(en).toContain('1,234.50');
    expect(en).toContain('EGP');
    expect(ar).toContain('١٬٢٣٤٫٥٠');
    expect(ar).not.toEqual(en);
  });

  it('formats numbers with locale-aware grouping', () => {
    expect(fmtNumber(98765, 'en')).toBe('98,765');
    expect(fmtNumber(98765, 'ar')).toContain('٩٨٬٧٦٥');
  });

  it('formats dates and times in the Cairo timezone', () => {
    const iso = '2026-11-06T12:00:00Z';
    expect(fmtDate(iso, 'en')).toContain('2026');
    expect(fmtTime(iso, 'en')).toMatch(/14:00/);
    expect(fmtDate(null, 'en')).toBe('—');
  });

  it('formats distance from raw kilometres', () => {
    expect(fmtDistance(8.2, 'en')).toBe('8.2 km');
    expect(fmtDistance(8, 'en')).toBe('8 km');
    expect(fmtDistance(8.2, 'ar')).toContain('كم');
  });
});
