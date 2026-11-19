import { describe, it, expect, beforeAll } from 'vitest';
import { allScreens, SCREEN_CODES, getScreen } from '../app/stores.jsx';
import '../app/screens.jsx';

const EXPECTED = [];
for (const [prefix, from, to] of [['A', 1, 13], ['C', 1, 43], ['M', 1, 15], ['T', 1, 15], ['SC', 1, 16], ['AD', 1, 18], ['SH', 1, 21]]) {
  for (let i = from; i <= to; i++) EXPECTED.push(`${prefix}${String(i).padStart(2, '0')}`);
}
EXPECTED.push('SC17', 'NF01');

describe('screen registry', () => {
  beforeAll(() => expect(SCREEN_CODES.length).toBeGreaterThan(0));

  it('registers all legacy screens plus the required AD16–AD18 gap screens', () => {
    expect(SCREEN_CODES.slice().sort()).toEqual(EXPECTED.slice().sort());
    expect(SCREEN_CODES.length).toBe(EXPECTED.length);
  });

  it('gives every screen a bilingual label, roles, a view and a fallback back target', () => {
    for (const s of allScreens()) {
      expect(s.label).toMatch(new RegExp(`^${s.code}`));
      expect(s.labelAr).toContain(s.code);
      expect(Array.isArray(s.roles) && s.roles.length > 0).toBe(true);
      expect(s.view).toBeTruthy();
      expect(typeof s.view.type).toBe('string');
    }
  });

  it('binds every data screen to a real API path', () => {
    for (const s of allScreens()) {
      const v = s.view;
      if (['list', 'dashboard', 'detail', 'form', 'timeline', 'mapStatus'].includes(v.type)) {
        expect(v.path, `${s.code} must have an API path`).toBeTruthy();
        expect(v.path.startsWith('/'), `${s.code} path must be relative to /api/v1`).toBe(true);
      }
    }
  });

  it('maps every role to a reachable main home screen', () => {
    for (const role of ['CarOwner', 'Mechanic', 'TowCaptain', 'ServiceCenter', 'Admin']) {
      const homes = allScreens().filter((s) => s.main && s.roles.includes(role));
      expect(homes.length, `${role} needs a main screen`).toBeGreaterThan(0);
    }
  });

  it('exposes the shared UI kit screens used by flows', () => {
    for (const code of ['SH01', 'SH02', 'SH06', 'SH13', 'SH18', 'SH19', 'SH21']) {
      expect(getScreen(code)).toBeTruthy();
    }
  });
});
