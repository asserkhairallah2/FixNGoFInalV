import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
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

function sameRouteEntry(a, b) {
  if (!a || !b || a.code !== b.code) return false;
  const pa = sanitizeParams(a.params);
  const pb = sanitizeParams(b.params);
  const ka = Object.keys(pa).sort();
  const kb = Object.keys(pb).sort();
  if (ka.length !== kb.length) return false;
  return ka.every((k, i) => k === kb[i] && String(pa[k]) === String(pb[k]));
}

function readStoredHistory() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem('fixngo.history') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatRoutePath(code, params = {}) {
  const clean = sanitizeParams(params);
  const qs = Object.keys(clean).length ? '?' + new URLSearchParams(clean).toString() : '';
  return `#/${code || 'A02'}${qs}`;
}

function stripBrowserUrl() {
  if (typeof window === 'undefined') return;
  if (window.location.hash || window.location.search || (window.location.pathname && window.location.pathname !== '/')) {
    try {
      window.history.replaceState(null, '', '/');
    } catch {}
  }
}

function parseHashString(rawInput) {
  const raw = String(rawInput || '').replace(/^#\/?/, '');
  const resolved = resolveDeepLink(raw);
  if (resolved) {
    const code = resolved.code || 'A02';
    const params = sanitizeParams(resolved.params);
    return { code, params };
  }
  const [code, query = ''] = raw.split('?');
  const params = sanitizeParams(Object.fromEntries(new URLSearchParams(query)));
  return { code: code || 'A02', params };
}

function persistRouteState(entry) {
  const clean = { code: entry?.code || 'A02', params: sanitizeParams(entry?.params) };
  const path = formatRoutePath(clean.code, clean.params);
  if (typeof window !== 'undefined') {
    window.__fixngoRoute = { ...clean, path };
    try {
      sessionStorage.setItem('fixngo.route', JSON.stringify(clean));
      sessionStorage.setItem('fixngo.routePath', path);
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent('fixngo:navigate', { detail: { ...clean, path } }));
    } catch {}
  }
  return clean;
}

function readInitialRoute() {
  if (typeof window === 'undefined') return { code: 'A02', params: {} };
  let incoming = '';
  try {
    incoming = window.location.hash || sessionStorage.getItem('fixngo.pendingHash') || '';
    if (incoming) sessionStorage.removeItem('fixngo.pendingHash');
  } catch {
    incoming = window.location.hash || '';
  }
  stripBrowserUrl();
  if (incoming) {
    try {
      sessionStorage.setItem('fixngo.phoneOpen', '1');
      window.dispatchEvent(new CustomEvent('fixngo:phone-open'));
    } catch {}
    return persistRouteState(parseHashString(incoming));
  }
  try {
    const stored = JSON.parse(sessionStorage.getItem('fixngo.route') || 'null');
    if (stored && typeof stored.code === 'string' && stored.code) {
      return persistRouteState({ code: stored.code, params: stored.params || {} });
    }
  } catch {}
  return persistRouteState({ code: 'A02', params: {} });
}

export function NavProvider({ children }) {
  const session = useSession();
  const user = session?.user ?? null;
  const [route, setRoute] = useState(readInitialRoute);
  const [history, setHistory] = useState(readStoredHistory);
  const prevAuthIdRef = useRef(undefined);
  const [flow, setFlowState] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('fixngo.flow') || '{}'); } catch { return {}; }
  });

  const saveHistory = useCallback((updater) => {
    setHistory((prev) => {
      const raw = typeof updater === 'function' ? updater(prev) : updater;
      const trimmed = Array.isArray(raw) ? raw.slice(-50) : [];
      try {
        if (trimmed.length) sessionStorage.setItem('fixngo.history', JSON.stringify(trimmed));
        else sessionStorage.removeItem('fixngo.history');
      } catch {}
      return trimmed;
    });
  }, []);

  useEffect(() => {
    const authId = user?.id ?? null;
    if (prevAuthIdRef.current !== undefined && prevAuthIdRef.current !== authId) {
      saveHistory([]);
    }
    prevAuthIdRef.current = authId;
  }, [user?.id, saveHistory]);

  useEffect(() => {
    stripBrowserUrl();
    const onHash = () => {
      const incoming = window.location.hash;
      stripBrowserUrl();
      if (!incoming) return;
      try {
        sessionStorage.setItem('fixngo.phoneOpen', '1');
        window.dispatchEvent(new CustomEvent('fixngo:phone-open'));
      } catch {}
      const parsed = parseHashString(incoming);
      setRoute(persistRouteState(parsed));
    };
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
    const nextEntry = { code: targetCode, params: cleanParams };
    const curEntry = { code: route.code, params: sanitizeParams(route.params) };
    if (!sameRouteEntry(curEntry, nextEntry)) {
      if (targetCode === 'A01' || targetCode === 'A02') {
        saveHistory([]);
      } else {
        saveHistory((h) => {
          const last = h[h.length - 1];
          return sameRouteEntry(last, curEntry) ? h : [...h, curEntry];
        });
      }
    }
    setRoute(persistRouteState(nextEntry));
    stripBrowserUrl();
  }, [route, saveHistory]);

  const replace = useCallback((code, params = {}) => {
    const resolved = resolveDeepLink(code) || { code, params: {} };
    const targetCode = resolved.code || code;
    const cleanParams = sanitizeParams({ ...resolved.params, ...(params || {}) });
    setRoute(persistRouteState({ code: targetCode, params: cleanParams }));
    stripBrowserUrl();
  }, []);

  const back = useCallback((fallback) => {
    const curEntry = { code: route.code, params: sanitizeParams(route.params) };
    for (let idx = history.length - 1; idx >= 0; idx--) {
      const candidate = history[idx];
      if (!candidate?.code || sameRouteEntry(candidate, curEntry)) continue;
      const entry = getScreen(candidate.code);
      const allowed = entry && (!user ? entry.roles.includes('guest') : entry.roles.includes(user.role));
      if (!allowed) continue;
      saveHistory(history.slice(0, idx));
      replace(candidate.code, candidate.params || {});
      return;
    }
    if (route.code === 'AD18' && route.params?.id) {
      replace('AD18', {});
      return;
    }
    const safeFallback = typeof fallback === 'string' && fallback ? fallback : null;
    const screenFallback = getScreen(route.code)?.fallbackBack || null;
    const target = safeFallback || screenFallback || homeForUser(user);
    const keepParams = Boolean(safeFallback || screenFallback) && target !== route.code && !getScreen(target)?.main;
    replace(target, keepParams ? (route.params || {}) : {});
  }, [history, replace, route.code, route.params, saveHistory, user]);

  return (
    <NavContext.Provider value={{ route, go, replace, back, flow, updateFlow, clearFlow, history }}>
      {children}
    </NavContext.Provider>
  );
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
