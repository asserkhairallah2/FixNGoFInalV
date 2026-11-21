import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Loader2, WifiOff, ShieldAlert, Home, Wrench,
  FileText, User, Car, Building2, CreditCard, Truck, Calendar
} from 'lucide-react';
import {
  PrefsProvider, usePrefs, SessionProvider, useSession, NavProvider, useNav,
  getScreen, homeForUser
} from './app/stores.jsx';
import './app/screens.jsx';
import { get, post, ensureFileToken, clearFileToken, refreshAccessToken } from './api/http.js';
import { connectSignalR, disconnectSignalR } from './api/signalr.js';
import { useLiveSync } from './api/live.js';
import { renderView } from './ui/renderers.jsx';
import { useColors, PrimaryButton, ShieldLogo } from './ui/kit.jsx';
import SimulatorDock from './sim/SimulatorDock.jsx';

const TAPPABLE_SELECTOR =
  'button, a, input, select, textarea, label, [role="button"], [data-testid^="nav-"], [data-testid="data-row"]';

const ROLE_TABS = {
  CarOwner: [
    { id: 'home', code: 'C02', en: 'Home', ar: 'الرئيسية', icon: Home, match: ['C01', 'C02', 'C06', 'C07', 'C08', 'C09', 'C10', 'C11', 'C12', 'C13', 'C14', 'C15', 'C22', 'C25', 'C26', 'C27', 'C28', 'C29', 'C30', 'C31', 'C32', 'C35', 'SH03', 'SH19'] },
    { id: 'garage', code: 'C04', en: 'Garage', ar: 'الجراج', icon: Car, match: ['C04', 'C05', 'C24'] },
    { id: 'requests', code: 'C20', en: 'Requests', ar: 'الطلبات', icon: FileText, match: ['C20', 'C21', 'C16', 'C41', 'C42', 'SH01', 'SH04'] },
    { id: 'centers', code: 'C17', en: 'Centers', ar: 'المراكز', icon: Building2, match: ['C17', 'C18', 'C19', 'C36', 'C37', 'C38', 'C39', 'C40', 'C43'] },
    { id: 'profile', code: 'C23', en: 'Profile', ar: 'حسابي', icon: User, match: ['C23'] }
  ],
  Mechanic: [
    { id: 'console', code: 'M01', en: 'Console', ar: 'الرئيسية', icon: Home, match: ['M01', 'M02', 'SH03', 'SH19'] },
    { id: 'jobs', code: 'M10', en: 'Jobs', ar: 'المهام', icon: Wrench, match: ['M03', 'M04', 'M05', 'M06', 'M10', 'M11', 'M12', 'SH01'] },
    { id: 'earnings', code: 'M07', en: 'Earnings', ar: 'الأرباح', icon: CreditCard, match: ['M07', 'SH14', 'SH15', 'SH16', 'SH20'] },
    { id: 'history', code: 'M08', en: 'History', ar: 'السجل', icon: FileText, match: ['M08', 'M13'] },
    { id: 'profile', code: 'M09', en: 'Profile', ar: 'حسابي', icon: User, match: ['M09', 'M14', 'M15'] }
  ],
  TowCaptain: [
    { id: 'dashboard', code: 'T01', en: 'Dashboard', ar: 'الرئيسية', icon: Home, match: ['T01', 'T02', 'SH03', 'SH19'] },
    { id: 'trips', code: 'T11', en: 'Trips', ar: 'الرحلات', icon: Truck, match: ['T03', 'T04', 'T05', 'T06', 'T07', 'T08', 'T11', 'T14', 'SH01'] },
    { id: 'earnings', code: 'T09', en: 'Earnings', ar: 'الأرباح', icon: CreditCard, match: ['T09', 'SH14', 'SH15', 'SH16', 'SH20'] },
    { id: 'history', code: 'T12', en: 'History', ar: 'السجل', icon: FileText, match: ['T12', 'T13'] },
    { id: 'profile', code: 'T10', en: 'Profile', ar: 'حسابي', icon: User, match: ['T10', 'T15'] }
  ],
  ServiceCenter: [
    { id: 'overview', code: 'SC01', en: 'Overview', ar: 'نظرة عامة', icon: Home, match: ['SC01', 'SC06', 'SC07', 'SC13', 'SC14', 'SH03', 'SH19'] },
    { id: 'bookings', code: 'SC02', en: 'Bookings', ar: 'الحجوزات', icon: Calendar, match: ['SC02', 'SC03', 'SC10', 'SC11', 'SC12', 'SC16', 'SH01'] },
    { id: 'catalog', code: 'SC04', en: 'Catalog', ar: 'الخدمات', icon: Wrench, match: ['SC04', 'SC05', 'SC17'] },
    { id: 'reports', code: 'SC08', en: 'Reports', ar: 'التقارير', icon: FileText, match: ['SC08'] },
    { id: 'profile', code: 'SC09', en: 'Profile', ar: 'حسابي', icon: User, match: ['SC09', 'SC15', 'SH14', 'SH15', 'SH16', 'SH20'] }
  ],
  Admin: [
    { id: 'overview', code: 'AD01', en: 'Overview', ar: 'نظرة عامة', icon: Home, match: ['AD01', 'AD07', 'AD08', 'AD09', 'AD10', 'AD16', 'AD17', 'AD18', 'SH03', 'SH19'] },
    { id: 'verify', code: 'AD02', en: 'Verify', ar: 'التوثيق', icon: Car, match: ['AD02', 'AD03', 'AD15', 'SH17'] },
    { id: 'users', code: 'AD04', en: 'Users', ar: 'المستخدمين', icon: FileText, match: ['AD04', 'AD11', 'AD12'] },
    { id: 'pricing', code: 'AD05', en: 'Pricing', ar: 'التسعير', icon: Building2, match: ['AD05'] },
    { id: 'profile', code: 'AD06', en: 'Profile', ar: 'حسابي', icon: User, match: ['AD06', 'AD13', 'AD14'] }
  ]
};

function formatClock() {
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Africa/Cairo'
    }).format(new Date());
  } catch {
    return '9:41 AM';
  }
}

function SystemRibbon({ status }) {
  if (!status) return null;
  if (!status.setupComplete) {
    return (
      <div className="fixed top-3 start-3 z-40 px-3 py-1 rounded-full bg-amber-500/90 text-white text-[10px] font-bold shadow-lg backdrop-blur">
        System not set up — run setup.bat
      </div>
    );
  }
  if (status.mode === 'dummy') {
    return (
      <div className="fixed top-3 start-3 z-40 px-3 py-1 rounded-full bg-slate-900/75 border border-white/10 text-slate-300 text-[10px] font-semibold shadow-lg backdrop-blur">
        DUMMY DATA MODE
      </div>
    );
  }
  return null;
}

function PhoneStatusBar() {
  const c = useColors();
  const [clock, setClock] = useState(formatClock);

  useEffect(() => {
    const id = setInterval(() => {
      const next = formatClock();
      setClock((prev) => (prev === next ? prev : next));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={`mob-statusbar border-b ${c.border} ${c.bg} select-none`} dir="ltr">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`text-[12px] font-bold tracking-tight ${c.text}`}>{clock}</span>
      </div>
      <span className="mob-island" aria-hidden="true" />
      <div className={`flex items-center gap-2 ${c.text}`}>
        <div className="flex items-center gap-1 opacity-90" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M5 13a10 10 0 0 1 14 0" />
            <path d="M8.5 16.3a5 5 0 0 1 7 0" />
            <path d="M12 19.2h.01" />
          </svg>
          <svg viewBox="0 0 28 14" width="20" height="11" fill="none">
            <rect x="1" y="2" width="22" height="10" rx="2.8" stroke="currentColor" strokeWidth="1.6" opacity="0.7" />
            <rect x="3" y="4" width="18" height="6" rx="1.4" fill="currentColor" />
            <path d="M25 5.2v3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function usePhoneInteractions(stageRef, frameRef, cursorRef) {
  useEffect(() => {
    const stage = stageRef.current;
    const frame = frameRef.current;
    const cursor = cursorRef.current;
    if (!stage || !frame || !cursor) return;

    const hitTappable = (el) => !!(el && el.closest && el.closest(TAPPABLE_SELECTOR));

    const getScrollChain = (startNode) => {
      const chain = [];
      let el = startNode && startNode.nodeType === 1 ? startNode : startNode?.parentElement;
      while (el && frame.contains(el)) {
        if (el.scrollHeight > el.clientHeight + 1) {
          const oy = window.getComputedStyle(el).overflowY;
          if (oy === 'auto' || oy === 'scroll' || el.dataset?.testid === 'screen-container') {
            chain.push(el);
          }
        }
        el = el.parentElement;
      }
      const mainPane = frame.querySelector('[data-testid="screen-container"]');
      if (mainPane && !chain.includes(mainPane) && mainPane.scrollHeight > mainPane.clientHeight + 1) {
        chain.push(mainPane);
      }
      return chain;
    };

    const scrollByChain = (chain, deltaY) => {
      if (!deltaY || chain.length === 0) return false;
      let remaining = deltaY;
      let movedAny = false;
      for (const pane of chain) {
        if (Math.abs(remaining) < 0.25) break;
        const maxTop = pane.scrollHeight - pane.clientHeight;
        if (maxTop <= 0) continue;
        const prev = pane.scrollTop;
        const next = Math.max(0, Math.min(maxTop, prev + remaining));
        const consumed = next - prev;
        if (Math.abs(consumed) > 0) {
          pane.scrollTop = next;
          remaining -= consumed;
          movedAny = true;
        }
      }
      return movedAny;
    };

    const updateCursorPos = (clientX, clientY, target) => {
      const r = stage.getBoundingClientRect();
      cursor.style.left = `${clientX - r.left}px`;
      cursor.style.top = `${clientY - r.top}px`;
      cursor.classList.add('live');
      cursor.classList.remove('leave');
      cursor.classList.toggle('on', hitTappable(target));
    };

    // Touch-style drag-to-scroll state (works even when starting on inputs, selects, buttons, or nested boxes)
    let pointerDown = false;
    let dragging = false;
    let activePointerId = null;
    let startX = 0;
    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let maxMoved = 0;
    let vel = 0;
    let momentumId = 0;
    let suppressClickUntil = 0;
    let activeChain = [];
    let downTarget = null;
    let targetWasFocused = false;

    const stopMomentum = () => {
      if (momentumId) {
        cancelAnimationFrame(momentumId);
        momentumId = 0;
      }
      vel = 0;
    };

    const clearDragFlag = () => {
      document.documentElement.removeAttribute('data-phone-dragging');
    };

    const onFramePointerMove = (e) => {
      if (frame.contains(e.target)) {
        updateCursorPos(e.clientX, e.clientY, e.target);
      }
    };

    const onFramePointerEnter = (e) => {
      updateCursorPos(e.clientX, e.clientY, e.target);
    };

    const onFramePointerLeave = () => {
      cursor.classList.add('leave');
      cursor.classList.remove('press');
    };

    const onFramePointerDown = (e) => {
      if (e.button !== 0) return;
      if (!frame.contains(e.target)) return;
      updateCursorPos(e.clientX, e.clientY, e.target);
      cursor.classList.add('press');

      // Allow range sliders to drag natively
      if (e.target?.closest?.('input[type="range"]')) return;

      stopMomentum();
      downTarget = e.target;
      targetWasFocused = document.activeElement === e.target;
      pointerDown = true;
      dragging = false;
      activePointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      lastY = e.clientY;
      lastT = e.timeStamp || performance.now();
      maxMoved = 0;
      activeChain = getScrollChain(e.target);
    };

    const onWindowPointerMove = (e) => {
      if (!pointerDown) return;
      if (activePointerId !== null && e.pointerId !== activePointerId) return;

      if (frame.contains(e.target)) {
        updateCursorPos(e.clientX, e.clientY, e.target);
      }

      const totalDy = startY - e.clientY;
      const totalDx = startX - e.clientX;
      maxMoved = Math.max(maxMoved, Math.hypot(totalDx, totalDy));

      if (!dragging && Math.abs(totalDy) > 5 && activeChain.length > 0) {
        dragging = true;
        document.documentElement.setAttribute('data-phone-dragging', '1');
        try {
          window.getSelection?.()?.removeAllRanges?.();
          const ae = document.activeElement;
          if (ae && ae === downTarget && !targetWasFocused && typeof ae.blur === 'function') {
            ae.blur();
          } else if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA') && typeof ae.setSelectionRange === 'function') {
            const pos = ae.selectionStart ?? 0;
            ae.setSelectionRange(pos, pos);
          }
        } catch {
          // Some input types (e.g. number/email) do not support setSelectionRange
        }
      }

      if (dragging) {
        if (e.cancelable) e.preventDefault();
        const stepY = lastY - e.clientY;
        scrollByChain(activeChain, stepY);
        const now = e.timeStamp || performance.now();
        const dt = now - lastT;
        if (dt > 0) {
          const instVel = stepY / dt;
          vel = vel * 0.35 + instVel * 0.65;
        }
        lastY = e.clientY;
        lastT = now;
      }
    };

    const endGesture = () => {
      cursor.classList.remove('press');
      if (!pointerDown) return;
      const wasDragging = dragging && maxMoved > 6;
      const chainSnapshot = activeChain;
      let v = vel;

      pointerDown = false;
      dragging = false;
      activePointerId = null;
      clearDragFlag();

      if (wasDragging) {
        suppressClickUntil = Date.now() + 340;
        const glide = () => {
          if (pointerDown || Math.abs(v) < 0.025 || chainSnapshot.length === 0) {
            momentumId = 0;
            return;
          }
          const moved = scrollByChain(chainSnapshot, v * 16);
          if (!moved) {
            momentumId = 0;
            return;
          }
          v *= 0.94;
          momentumId = requestAnimationFrame(glide);
        };
        glide();
      }
    };

    const onFrameClickCapture = (e) => {
      if (Date.now() < suppressClickUntil) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onFrameWheel = (e) => {
      stopMomentum();
      const target = e.target;
      const isNumberInput = target?.tagName === 'INPUT' && target?.type === 'number';
      if (isNumberInput && document.activeElement === target) {
        target.blur();
      }
      const chain = getScrollChain(target);
      if (chain.length > 0 && (isNumberInput || !target?.closest?.('[data-testid="screen-container"]'))) {
        if (e.cancelable) e.preventDefault();
        scrollByChain(chain, e.deltaY);
      }
    };

    const onWindowBlur = () => {
      cursor.classList.add('leave');
      cursor.classList.remove('press');
      endGesture();
    };

    frame.addEventListener('pointermove', onFramePointerMove);
    frame.addEventListener('pointerenter', onFramePointerEnter);
    frame.addEventListener('pointerleave', onFramePointerLeave);
    frame.addEventListener('pointerdown', onFramePointerDown, true);
    frame.addEventListener('click', onFrameClickCapture, true);
    frame.addEventListener('wheel', onFrameWheel, { passive: false });
    window.addEventListener('pointermove', onWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', endGesture);
    window.addEventListener('pointercancel', endGesture);
    window.addEventListener('blur', onWindowBlur);

    return () => {
      stopMomentum();
      clearDragFlag();
      frame.removeEventListener('pointermove', onFramePointerMove);
      frame.removeEventListener('pointerenter', onFramePointerEnter);
      frame.removeEventListener('pointerleave', onFramePointerLeave);
      frame.removeEventListener('pointerdown', onFramePointerDown, true);
      frame.removeEventListener('click', onFrameClickCapture, true);
      frame.removeEventListener('wheel', onFrameWheel);
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', endGesture);
      window.removeEventListener('pointercancel', endGesture);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [stageRef, frameRef, cursorRef]);
}

function NotFound({ code }) {
  const c = useColors(); const nav = useNav(); const { isAr } = usePrefs(); const { user } = useSession();
  const home = homeForUser(user);
  return (
    <div className={`h-full flex flex-col items-center justify-center gap-4 p-8 text-center ${c.bg}`} data-testid="not-found">
      <ShieldAlert size={44} className="text-amber-400" />
      <h1 className={`text-lg font-bold ${c.text}`}>{isAr ? 'الشاشة غير متاحة' : 'Screen not available'}</h1>
      <p className={`text-xs ${c.secondaryText}`}>{code}</p>
      <PrimaryButton onClick={() => nav.replace(home)} testId="screen-primary">{isAr ? 'العودة للرئيسية' : 'Back to home'}</PrimaryButton>
    </div>
  );
}

function SetupNeeded() {
  const c = useColors(); const { isAr } = usePrefs();
  return (
    <div className={`h-full flex flex-col items-center justify-center gap-4 p-8 text-center ${c.bg}`} data-testid="setup-needed">
      <ShieldLogo size={60} />
      <h1 className={`text-lg font-bold ${c.text}`}>{isAr ? 'النظام غير مُعدّ' : 'System not set up'}</h1>
      <p className={`text-xs ${c.secondaryText}`}>{isAr ? 'يرجى تشغيل setup.bat لإنشاء حساب المشرف الأول.' : 'Run setup.bat to create the first administrator account.'}</p>
    </div>
  );
}

function BottomNav({ role, current }) {
  const { isAr } = usePrefs(); const nav = useNav(); const c = useColors();
  // Never display bottom tabs on Auth & Onboarding screens (A01-A13) or Sign-out confirmation (SH13)
  if (/^A\d{2}$/.test(current) || current === 'SH13') return null;
  const tabs = ROLE_TABS[role] || ROLE_TABS.CarOwner;
  const isTabActive = (t) => {
    if (role === 'CarOwner' && (current === 'C33' || current === 'C34')) {
      const fromCheckout = Boolean(nav.route.params?.id) && nav.route.params?.from !== 'profile';
      return fromCheckout ? t.id === 'home' : t.id === 'profile';
    }
    if (t.match.includes(current)) return true;
    if (t.id === 'profile' && /^SH(02|05|06|07|08|09|10|11|12|18|21)$/.test(current)) return true;
    if (t.id === 'profile' && current === 'SH17' && role !== 'Admin') return true;
    return false;
  };
  return (
    <nav className={`shrink-0 w-full border-t ${c.border} ${c.bg} px-2 pt-1.5 pb-1 z-30`} aria-label="Main navigation">
      <div className="grid grid-cols-5">
        {tabs.map((t) => {
          const Icon = t.icon || Home;
          const active = isTabActive(t);
          return (
            <button key={t.id} data-testid={`nav-${t.id}`} onClick={() => nav.go(t.code)}
              className={`flex flex-col items-center justify-center gap-1 py-1 transition ${active ? 'text-[#E51C23]' : c.secondaryText}`}>
              <Icon size={18} className={active ? 'stroke-[2.4]' : 'stroke-[1.8]'} />
              <span className="text-[10px] font-semibold">{isAr ? t.ar : t.en}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

class ScreenErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidUpdate(prevProps) {
    if (prevProps.code !== this.props.code && this.state.error) {
      this.setState({ error: null });
    }
  }
  render() {
    if (!this.state.error) return this.props.children;
    return <NotFound code={this.props.code} />;
  }
}

function ScreenRouter({ user }) {
  const nav = useNav(); const { code, params } = nav.route;
  const entry = getScreen(code);
  const allowed = entry && (!user ? entry.roles.includes('guest') : entry.roles.includes(user.role));
  if (!allowed) return <NotFound code={code} />;
  const Comp = entry.Component;
  return (
    <ScreenErrorBoundary code={code}>
      {Comp ? <Comp id={params.id} params={params} code={code} entry={entry} /> : renderView(entry.view, params.id, params)}
    </ScreenErrorBoundary>
  );
}

function AuthenticatedApp({ user }) {
  const { isAr } = usePrefs();
  const c = useColors();
  const nav = useNav();
  const scrollRef = useRef(null);
  const [filesReady, setFilesReady] = useState(false);
  useLiveSync();

  useEffect(() => {
    connectSignalR();
    // Short-lived, download-only token for <img>/<a> file URLs (never the JWT).
    let cancelled = false;
    ensureFileToken().finally(() => { if (!cancelled) setFilesReady(true); });
    const refresher = setInterval(() => { ensureFileToken(true); }, 4 * 60_000);
    // Proactively rotate the 15-minute access JWT every 10 minutes so active tabs never hit 401 mid-session.
    const jwtRefresher = setInterval(() => {
      refreshAccessToken().then((ok) => { if (ok) connectSignalR(); }).catch(() => {});
    }, 10 * 60_000);
    const onTokenRefreshed = () => { connectSignalR(); };
    const onRevoked = () => { nav.replace('A03'); };
    window.addEventListener('fixngo:token-refreshed', onTokenRefreshed);
    window.addEventListener('fixngo:session-revoked', onRevoked);
    return () => {
      cancelled = true;
      clearInterval(refresher);
      clearInterval(jwtRefresher);
      clearFileToken();
      disconnectSignalR();
      window.removeEventListener('fixngo:token-refreshed', onTokenRefreshed);
      window.removeEventListener('fixngo:session-revoked', onRevoked);
    };
  }, [user.id, nav.replace]);

  useEffect(() => {
    if (user.role !== 'Mechanic' && user.role !== 'TowCaptain') return undefined;
    const hb = setInterval(() => {
      get('/providers/me')
        .then((prof) => {
          if (prof?.isOnline) {
            post('/providers/heartbeat', {
              latitude: prof.latitude ?? null,
              longitude: prof.longitude ?? null
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }, 25_000);
    return () => clearInterval(hb);
  }, [user.id, user.role]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [nav.route.code, nav.route.params?.id]);

  const current = nav.route.code;
  if (!filesReady) {
    return <div className="h-full grid place-items-center"><Loader2 className="animate-spin text-[#E51C23]" size={32} /></div>;
  }
  return (
    <div className={`h-full flex flex-col relative ${c.bg}`}>
      <PhoneStatusBar />
      <div ref={scrollRef} className="mob-scroll-pane flex-1 min-h-0 overflow-y-auto" data-testid="screen-container">
        <ScreenRouter user={user} />
      </div>
      <BottomNav role={user.role} current={current} />
      <div className="mob-home-indicator" aria-hidden="true" />
      {isAr && <span className="sr-only">اتجاه عربي</span>}
    </div>
  );
}

function GuestApp() {
  const nav = useNav(); const { isAr } = usePrefs(); const c = useColors();
  const scrollRef = useRef(null);
  const { code, params } = nav.route;
  const entry = getScreen(code);
  const allowed = entry && entry.roles.includes('guest');
  const Comp = entry?.Component;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [code, params?.id]);

  return (
    <div className={`h-full flex flex-col relative ${c.bg}`}>
      <PhoneStatusBar />
      <div ref={scrollRef} className="mob-scroll-pane flex-1 min-h-0 overflow-y-auto" data-testid="screen-container">
        {allowed ? (
          <ScreenErrorBoundary code={code}>
            {Comp ? <Comp id={params.id} params={params} code={code} entry={entry} /> : renderView(entry.view, params.id, params)}
          </ScreenErrorBoundary>
        ) : <NotFound code={code} />}
      </div>
      <div className="mob-home-indicator" aria-hidden="true" />
      {isAr && <span className="sr-only">اتجاه عربي</span>}
    </div>
  );
}

function Shell() {
  const { user, ready } = useSession();
  const qc = useQueryClient();
  const prevUserId = useRef(undefined);
  const stageRef = useRef(null);
  const frameRef = useRef(null);
  const cursorRef = useRef(null);
  const [status, setStatus] = useState(null);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  usePhoneInteractions(stageRef, frameRef, cursorRef);

  useEffect(() => {
    const nextId = user?.id || null;
    if (prevUserId.current !== undefined && prevUserId.current !== nextId) {
      qc.clear();
    }
    prevUserId.current = nextId;
  }, [user?.id, qc]);

  useEffect(() => { get('/system/status').then(setStatus).catch(() => setStatus(null)); }, []);
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false);
    window.addEventListener('online', up); window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  const blocked = status && status.setupComplete === false;
  return (
    <>
      <SystemRibbon status={status} />
      <div className="min-h-screen w-full flex items-center justify-center p-3 md:p-5">
        <div ref={stageRef} className="phone-stage" id="phoneRoot">
          <div ref={frameRef} className="phone-frame iphone-frame shrink-0">
            <div className="iphone-inner">
              <div className="iphone-screen" data-screen>
                {!online && (
                  <div data-testid="offline-banner" className="shrink-0 bg-amber-500 text-white text-center text-[10px] py-1 flex items-center justify-center gap-1">
                    <WifiOff size={12} />Offline — requests will replay
                  </div>
                )}
                <div className="flex-1 min-h-0 overflow-hidden">
                  {blocked ? <SetupNeeded /> : !ready ? (
                    <div className="h-full grid place-items-center"><Loader2 className="animate-spin text-[#E51C23]" size={32} /></div>
                  ) : user ? <AuthenticatedApp user={user} /> : <GuestApp />}
                </div>
              </div>
            </div>
          </div>
          <span ref={cursorRef} className="mob-cursor" data-cursor aria-hidden="true" />
        </div>
      </div>
      {status?.simulatorsEnabled && <SimulatorDock />}
    </>
  );
}

function FatalFallback() {
  return (
    <div data-testid="not-found" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, textAlign: 'center', background: '#F8FAFC', color: '#0F172A' }}>
      <ShieldAlert size={44} color="#E51C23" />
      <strong>Screen not available</strong>
      <a href="/" style={{ color: '#E51C23', fontSize: 12 }}>Back to start</a>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('Screen render failed', error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <FatalFallback />;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <PrefsProvider>
        <SessionProvider>
          <NavProvider>
            <Shell />
          </NavProvider>
        </SessionProvider>
      </PrefsProvider>
    </ErrorBoundary>
  );
}
