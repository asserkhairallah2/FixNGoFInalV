import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { setTokens, clearTokens, hasToken, get, post, put, ApiError } from '../api/http.js';

// ---- Theme + language store ----
const PrefsContext = createContext(null);

export function PrefsProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem('fixngo.theme') || 'light');
  const [lang, setLangState] = useState(() => localStorage.getItem('fixngo.lang') || 'en');

  const apply = useCallback((t, l) => {
    document.documentElement.classList.toggle('dark', t === 'dark');
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  }, []);

  useEffect(() => apply(theme, lang), [theme, lang, apply]);

  const setTheme = (t) => {
    setThemeState(t);
    localStorage.setItem('fixngo.theme', t);
    if (hasToken()) put('/auth/me', { theme: t }).catch(() => {});
  };
  const setLang = (l) => {
    setLangState(l);
    localStorage.setItem('fixngo.lang', l);
    if (hasToken()) put('/auth/me', { language: l }).catch(() => {});
  };

  const isAr = lang === 'ar';
  const isDark = theme === 'dark';
  const t = useCallback((en, ar) => (isAr ? (ar ?? en) : en), [isAr]);

  return (
    <PrefsContext.Provider value={{ theme, setTheme, lang, setLang, isAr, isDark, t }}>
      {children}
    </PrefsContext.Provider>
  );
}

export const usePrefs = () => useContext(PrefsContext);

// ---- Role home resolver (single source of truth) ----
// Providers whose KYC is not approved are sent to the verification-status screen.
export const ROLE_HOME = {
  CarOwner: 'C02', Mechanic: 'M01', TowCaptain: 'T01', ServiceCenter: 'SC01', Admin: 'AD01'
};
export const PROVIDER_ROLES = ['Mechanic', 'TowCaptain', 'ServiceCenter'];
export function homeForUser(user) {
  if (!user) return 'A02';
  if (PROVIDER_ROLES.includes(user.role) && user.kycStatus && user.kycStatus !== 'Approved') return 'A11';
  return ROLE_HOME[user.role] || 'A02';
}

// ---- Navigation store (hash-based) ----
const NavContext = createContext(null);
const ROUTES = new Map();
export const SCREEN_CODES = [];
export function registerScreen(code, entry) {
  if (!ROUTES.has(code)) SCREEN_CODES.push(code);
  ROUTES.set(code, entry);
}
export function getScreen(code) { return ROUTES.get(code) || null; }
export function allScreens() { return Array.from(ROUTES.values()); }

export function resolveDeepLink(rawTarget, role) {
  if (!rawTarget) return null;
  const effectiveRole = role || sessionStorage.getItem('fixngo.role') || '';
  const cleaned = String(rawTarget).replace(/^#\/?/, '').trim();
  if (!cleaned) return null;
  const colonMatch = cleaned.match(/^([a-zA-Z]+):([^?]+)(\?(.*))?$/);
  if (colonMatch) {
    const kind = colonMatch[1].toLowerCase();
    const entityId = colonMatch[2];
    const extraParams = colonMatch[4] ? Object.fromEntries(new URLSearchParams(colonMatch[4])) : {};
    const params = { ...extraParams, id: entityId };
    if (kind === 'offer') {
      const code = effectiveRole === 'Mechanic' ? 'M03' : effectiveRole === 'CarOwner' ? 'C10' : 'T03';
      return { code, params };
    }
    if (kind === 'request') {
      const code = effectiveRole === 'TowCaptain' ? 'T04' : effectiveRole === 'Mechanic' ? 'M04' : effectiveRole === 'Admin' ? 'AD01' : 'C11';
      return { code, params };
    }
    if (kind === 'booking') {
      const code = effectiveRole === 'ServiceCenter' ? 'SC03' : 'C38';
      return { code, params };
    }
    if (kind === 'kyc') {
      const code = effectiveRole === 'Admin' ? 'AD03' : 'A11';
      return { code, params };
    }
    if (kind === 'ticket') {
      const code = effectiveRole === 'Admin' ? 'AD18' : 'SH09';
      return { code, params };
    }
    if (kind === 'invoice') {
      return { code: 'C15', params };
    }
    if (kind === 'withdrawal') {
      return { code: 'SH16', params };
    }
    if (kind === 'chat') {
      return { code: 'SH01', params: { ...params, threadId: entityId } };
    }
  }
  const [code, query = ''] = cleaned.split('?');
  const params = Object.fromEntries(new URLSearchParams(query));
  return { code: code || 'A02', params };
}

function sanitizeParams(params) {
  return Object.fromEntries(
    Object.entries(params || {}).filter(
      ([, v]) => v !== undefined && v !== null && v !== '' && typeof v !== 'object' && typeof v !== 'function'
    )
  );
}

export function NavProvider({ children }) {
  const [route, setRoute] = useState(() => parseHash());
  const [history, setHistory] = useState([]);
  const [flow, setFlowState] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('fixngo.flow') || '{}'); } catch { return {}; }
  });

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const updateFlow = useCallback((patch) => {
    setFlowState((prev) => {
      const next = { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) };
      try { sessionStorage.setItem('fixngo.flow', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const clearFlow = useCallback(() => {
    setFlowState({});
    try { sessionStorage.removeItem('fixngo.flow'); } catch {}
  }, []);

  const go = useCallback((code, params = {}) => {
    const resolved = resolveDeepLink(code) || { code, params: {} };
    const targetCode = resolved.code || code;
    const cleanParams = sanitizeParams({ ...resolved.params, ...(params || {}) });
    if (getScreen(targetCode)?.main) setHistory([]);
    else setHistory((h) => [...h, route]);
    setRoute({ code: targetCode, params: cleanParams });
    window.location.hash = `#/${targetCode}${Object.keys(cleanParams).length ? '?' + new URLSearchParams(cleanParams).toString() : ''}`;
  }, [route]);

  const replace = useCallback((code, params = {}) => {
    const resolved = resolveDeepLink(code) || { code, params: {} };
    const targetCode = resolved.code || code;
    const cleanParams = sanitizeParams({ ...resolved.params, ...(params || {}) });
    setRoute({ code: targetCode, params: cleanParams });
    window.location.hash = `#/${targetCode}${Object.keys(cleanParams).length ? '?' + new URLSearchParams(cleanParams).toString() : ''}`;
  }, []);

  const back = useCallback((fallback) => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      replace(prev.code, prev.params || {});
      return;
    }
    const target = fallback || getScreen(route.code)?.fallbackBack;
    if (target) {
      replace(target, route.params || {});
      return;
    }
    replace('A02');
  }, [history, replace, route.code, route.params]);

  return (
    <NavContext.Provider value={{ route, go, replace, back, flow, updateFlow, clearFlow, history }}>
      {children}
    </NavContext.Provider>
  );
}

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const resolved = resolveDeepLink(raw);
  if (resolved) {
    const code = resolved.code || 'A02';
    const params = sanitizeParams(resolved.params);
    if (raw.includes(':')) {
      const qs = Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '';
      try { window.history.replaceState(null, '', `#/${code}${qs}`); } catch {}
    }
    return { code, params };
  }
  const [code, query = ''] = raw.split('?');
  const params = sanitizeParams(Object.fromEntries(new URLSearchParams(query)));
  return { code: code || 'A02', params };
}

export const useNav = () => useContext(NavContext);

// Convenience hook used by shared UI kit components: navigate to a screen code.
export function useNavigate() {
  const { go } = useNav();
  return (code, params) => go(code, params);
}

// ---- Session/auth store ----
const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const updateUser = useCallback((nextUser) => {
    setUser(nextUser);
    try {
      if (nextUser?.role) sessionStorage.setItem('fixngo.role', nextUser.role);
      else sessionStorage.removeItem('fixngo.role');
    } catch {}
  }, []);

  const loadMe = useCallback(async () => {
    if (!hasToken()) { setReady(true); return null; }
    try {
      const me = await get('/auth/me');
      updateUser(me);
      return me;
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        clearTokens(); updateUser(null);
      }
      return null;
    } finally { setReady(true); }
  }, [updateUser]);

  useEffect(() => { loadMe(); }, [loadMe]);

  useEffect(() => {
    const onRevoked = () => { clearTokens(); updateUser(null); };
    window.addEventListener('fixngo:session-revoked', onRevoked);
    return () => window.removeEventListener('fixngo:session-revoked', onRevoked);
  }, [updateUser]);

  const applyAuth = useCallback((data) => {
    if (data?.accessToken) {
      setTokens(data.accessToken, data.refreshToken);
      const u = data.user || data;
      updateUser(u);
      return u;
    }
    return null;
  }, [updateUser]);

  const login = useCallback(async (email, password) => {
    const data = await post('/auth/login', { email, password });
    setTokens(data.accessToken, data.refreshToken);
    updateUser(data.user);
    return data.user;
  }, [updateUser]);

  const logout = useCallback(async () => {
    try {
      const refresh = sessionStorage.getItem('fixngo.refresh');
      if (refresh) await post('/auth/logout', { refreshToken: refresh });
    } catch { /* ignore */ }
    clearTokens(); updateUser(null);
  }, [updateUser]);

  return (
    <SessionContext.Provider value={{ user, setUser: updateUser, ready, login, logout, loadMe, applyAuth }}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
