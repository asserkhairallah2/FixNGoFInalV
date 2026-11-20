import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Languages, Moon, Sun, Loader2, WifiOff, ShieldAlert, Home, Wrench,
  FileText, User, Car, Building2, CreditCard, Truck, Calendar
} from 'lucide-react';
import {
  PrefsProvider, usePrefs, SessionProvider, useSession, NavProvider, useNav,
  getScreen, homeForUser
} from './app/stores.jsx';
import './app/screens.jsx';
import { get } from './api/http.js';
import { connectSignalR, disconnectSignalR } from './api/signalr.js';
import { renderView } from './ui/renderers.jsx';
import { useColors, PrimaryButton, ShieldLogo } from './ui/kit.jsx';
import SimulatorDock from './sim/SimulatorDock.jsx';

const ROLE_TABS = {
  CarOwner: [
    { id: 'home', code: 'C02', en: 'Home', ar: 'الرئيسية', icon: Home, match: ['C01', 'C02', 'C06', 'C07', 'C08', 'C09', 'C10', 'C11', 'C12', 'C13', 'C14', 'C15', 'C16', 'C22', 'C25', 'C26', 'C27', 'C28', 'C29', 'C30', 'C31', 'C32', 'C33', 'C34', 'C35', 'C41', 'C42', 'SH03', 'SH19'] },
    { id: 'garage', code: 'C04', en: 'Garage', ar: 'الجراج', icon: Car, match: ['C04', 'C05', 'C24'] },
    { id: 'requests', code: 'C20', en: 'Requests', ar: 'الطلبات', icon: FileText, match: ['C20', 'C21', 'SH01', 'SH04'] },
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
    { id: 'profile', code: 'SC09', en: 'Profile', ar: 'حسابي', icon: User, match: ['SC09', 'SC15', 'SH14', 'SH20'] }
  ],
  Admin: [
    { id: 'overview', code: 'AD01', en: 'Overview', ar: 'نظرة عامة', icon: Home, match: ['AD01', 'AD07', 'AD08', 'AD09', 'AD10', 'AD16', 'AD17', 'AD18', 'SH03', 'SH19'] },
    { id: 'verify', code: 'AD02', en: 'Verify', ar: 'التوثيق', icon: Car, match: ['AD02', 'AD03', 'AD15', 'SH17'] },
    { id: 'users', code: 'AD04', en: 'Users', ar: 'المستخدمين', icon: FileText, match: ['AD04', 'AD11', 'AD12'] },
    { id: 'pricing', code: 'AD05', en: 'Pricing', ar: 'التسعير', icon: Building2, match: ['AD05'] },
    { id: 'profile', code: 'AD06', en: 'Profile', ar: 'حسابي', icon: User, match: ['AD06', 'AD13', 'AD14'] }
  ]
};

function SystemRibbon({ status }) {
  if (!status) return null;
  if (!status.setupComplete) return <div className="fixed inset-x-0 top-0 z-50 bg-amber-500 text-white text-center text-xs py-2">System not set up — run setup.bat</div>;
  if (status.mode === 'dummy') return <div className="fixed inset-x-0 top-0 z-50 bg-fuchsia-700 text-white text-center text-xs font-bold py-2">DUMMY DATA MODE — NOT REAL</div>;
  return null;
}

function ThemeLangControls() {
  const { theme, setTheme, lang, setLang, isDark } = usePrefs();
  return (
    <div className="flex gap-1.5 items-center">
      <button aria-label="Toggle language" title="Toggle language" data-testid="toggle-lang"
        onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
        className={`h-7 px-2 rounded-full border text-[10px] font-bold flex items-center gap-1 transition ${
          isDark ? 'border-[#262936] bg-[#1A1D26] text-slate-200' : 'border-slate-200 bg-slate-100 text-slate-700'
        }`}>
        <Languages size={12} />
        <span>{lang === 'en' ? 'AR' : 'EN'}</span>
      </button>
      <button aria-label="Toggle theme" title="Toggle theme" data-testid="toggle-theme"
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        className={`w-7 h-7 rounded-full border grid place-items-center transition ${
          isDark ? 'border-[#262936] bg-[#1A1D26] text-amber-400' : 'border-slate-200 bg-slate-100 text-slate-700'
        }`}>
        {theme === 'light' ? <Moon size={13} /> : <Sun size={13} />}
      </button>
    </div>
  );
}

function PhoneStatusBar() {
  const c = useColors();
  return (
    <div className={`shrink-0 h-9 px-4 flex items-center justify-between border-b ${c.border} ${c.bg} select-none`}>
      <span className={`text-[11px] font-bold tracking-tight ${c.text}`} dir="ltr">9:41</span>
      <ThemeLangControls />
    </div>
  );
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
    if (t.match.includes(current)) return true;
    if (t.id === 'profile' && /^SH(02|05|06|07|08|09|10|11|12|18|21)$/.test(current)) return true;
    if (t.id === 'profile' && current === 'SH17' && role !== 'Admin') return true;
    return false;
  };
  return (
    <nav className={`shrink-0 w-full border-t ${c.border} ${c.bg} px-2 pt-1.5 pb-2 z-30`} aria-label="Main navigation">
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
      <div className="w-28 h-1 rounded-full bg-slate-500/40 mx-auto mt-1" />
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
  useEffect(() => {
    connectSignalR();
    const onRevoked = () => { window.location.hash = '#/A03'; };
    window.addEventListener('fixngo:session-revoked', onRevoked);
    return () => { disconnectSignalR(); window.removeEventListener('fixngo:session-revoked', onRevoked); };
  }, []);
  const current = useNav().route.code;
  return (
    <div className={`h-full flex flex-col relative ${c.bg}`}>
      <PhoneStatusBar />
      <div className="flex-1 min-h-0 overflow-y-auto" data-testid="screen-container">
        <ScreenRouter user={user} />
      </div>
      <BottomNav role={user.role} current={current} />
      {isAr && <span className="sr-only">اتجاه عربي</span>}
    </div>
  );
}

function GuestApp() {
  const nav = useNav(); const { isAr } = usePrefs(); const c = useColors();
  const { code, params } = nav.route;
  const entry = getScreen(code);
  const allowed = entry && entry.roles.includes('guest');
  const Comp = entry?.Component;
  return (
    <div className={`h-full flex flex-col relative ${c.bg}`}>
      <PhoneStatusBar />
      <div className="flex-1 min-h-0 overflow-y-auto" data-testid="screen-container">
        {allowed ? (
          <ScreenErrorBoundary code={code}>
            {Comp ? <Comp id={params.id} params={params} code={code} entry={entry} /> : renderView(entry.view, params.id, params)}
          </ScreenErrorBoundary>
        ) : <NotFound code={code} />}
      </div>
      {isAr && <span className="sr-only">اتجاه عربي</span>}
    </div>
  );
}

function Shell() {
  const { user, ready } = useSession();
  const qc = useQueryClient();
  const prevUserId = useRef(undefined);
  const [status, setStatus] = useState(null);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

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
      <div className="min-h-screen w-full flex items-center justify-center p-4 md:p-6 bg-[#EEF2F6] dark:bg-[#090A0D]">
        <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-4 w-full max-w-[1120px]">
          <div className="phone-frame shrink-0 flex flex-col">
            {!online && <div data-testid="offline-banner" className="shrink-0 bg-amber-500 text-white text-center text-[10px] py-1 flex items-center justify-center gap-1"><WifiOff size={12} />Offline — requests will replay</div>}
            <div className="flex-1 min-h-0 overflow-hidden">
              {blocked ? <SetupNeeded /> : !ready ? (
                <div className="h-full grid place-items-center"><Loader2 className="animate-spin text-[#E51C23]" size={32} /></div>
              ) : user ? <AuthenticatedApp user={user} /> : <GuestApp />}
            </div>
          </div>
          {status?.simulatorsEnabled && <SimulatorDock />}
        </div>
      </div>
    </>
  );
}

function FatalFallback() {
  return (
    <div data-testid="not-found" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, textAlign: 'center', background: '#F8FAFC', color: '#0F172A' }}>
      <ShieldAlert size={44} color="#E51C23" />
      <strong>Screen not available</strong>
      <a href="#/A02" style={{ color: '#E51C23', fontSize: 12 }}>Back to start</a>
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
