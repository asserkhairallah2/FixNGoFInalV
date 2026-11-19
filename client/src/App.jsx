import React, { useState, useEffect } from 'react';
import { Languages, Moon, Sun, Loader2, WifiOff, ShieldAlert, Home, Wrench, FileText, User, LayoutGrid } from 'lucide-react';
import {
  PrefsProvider, usePrefs, SessionProvider, useSession, NavProvider, useNav,
  getScreen, allScreens, homeForUser, PROVIDER_ROLES
} from './app/stores.jsx';
import './app/screens.jsx';
import { get } from './api/http.js';
import { connectSignalR, disconnectSignalR } from './api/signalr.js';
import { renderView } from './ui/renderers.jsx';
import { useColors, PrimaryButton, ShieldLogo } from './ui/kit.jsx';
import SimulatorDock from './sim/SimulatorDock.jsx';

// Preferred landing screen for each bottom-nav tab (the first registered screen is
// not always the right one: C01 is the empty garage, C02 is the real home, etc.).
const PREFERRED_TAB_SCREEN = {
  CarOwner: { home: 'C02' },
  Mechanic: { console: 'M01' },
  TowCaptain: { console: 'T01' },
  ServiceCenter: { overview: 'SC01' },
  Admin: { overview: 'AD01' }
};
const TAB_ICONS = { home: Home, garage: LayoutGrid, centers: Wrench, requests: FileText, profile: User, console: LayoutGrid, earnings: FileText, jobs: FileText, trips: FileText, overview: LayoutGrid, appointments: FileText, services: Wrench, reports: FileText, kyc: ShieldAlert, users: User, settings: Wrench };
const TAB_LABEL = {
  home: ['Home', 'الرئيسية'], garage: ['Garage', 'جراجي'], centers: ['Centers', 'المراكز'], requests: ['Requests', 'الطلبات'],
  profile: ['Profile', 'الملف'], console: ['Console', 'اللوحة'], earnings: ['Earnings', 'الأرباح'], jobs: ['Jobs', 'المهام'],
  trips: ['Trips', 'الرحلات'], overview: ['Overview', 'نظرة عامة'], appointments: ['Appointments', 'المواعيد'],
  services: ['Services', 'الخدمات'], reports: ['Reports', 'التقارير'], kyc: ['Verification', 'التوثيق'],
  users: ['Users', 'المستخدمون'], settings: ['Settings', 'الإعدادات']
};

function SystemRibbon({ status }) {
  if (!status) return null;
  if (!status.setupComplete) return <div className="fixed inset-x-0 top-0 z-50 bg-amber-500 text-white text-center text-xs py-2">System not set up — run setup.bat</div>;
  if (status.mode === 'dummy') return <div className="fixed inset-x-0 top-0 z-50 bg-fuchsia-700 text-white text-center text-xs font-bold py-2">DUMMY DATA MODE — NOT REAL</div>;
  return null;
}

function ThemeLangControls() {
  const { theme, setTheme, lang, setLang } = usePrefs();
  return (
    <div className="flex gap-2 items-center">
      <button aria-label="Toggle language" title="Toggle language" data-testid="toggle-lang"
        onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
        className="w-9 h-9 rounded-full border border-slate-300 dark:border-slate-600 grid place-items-center text-slate-600 dark:text-slate-300">
        <Languages size={17} />
      </button>
      <button aria-label="Toggle theme" title="Toggle theme" data-testid="toggle-theme"
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        className="w-9 h-9 rounded-full border border-slate-300 dark:border-slate-600 grid place-items-center text-slate-600 dark:text-slate-300">
        {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
      </button>
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
  const module = ({ CarOwner: 'owner', Mechanic: 'mechanic', TowCaptain: 'captain', ServiceCenter: 'center', Admin: 'admin' })[role];
  const candidates = allScreens().filter((s) => s.module === module && s.main && s.tab && s.roles.includes(role));
  const byTab = new Map();
  for (const s of candidates) {
    const preferred = PREFERRED_TAB_SCREEN[role]?.[s.tab];
    const existing = byTab.get(s.tab);
    if (!existing || s.code === preferred) byTab.set(s.tab, s.code === preferred ? s : existing);
  }
  const unique = Array.from(byTab.values());
  return (
    <nav className={`shrink-0 border-t ${c.border} ${c.surface}`} style={{ gridTemplateColumns: `repeat(${Math.max(unique.length, 1)}, minmax(0,1fr))`, display: 'grid' }} aria-label="Main navigation">
      {unique.map((s) => {
        const Icon = TAB_ICONS[s.tab] || Home;
        const label = TAB_LABEL[s.tab] || [s.tab, s.tab];
        const active = current === s.code;
        return (
          <button key={s.code} data-testid={`nav-${s.tab}`} onClick={() => nav.go(s.code)}
            className={`py-2.5 flex flex-col items-center gap-1 text-[10px] font-semibold min-h-[50px] ${active ? 'text-[#E51C23]' : c.secondaryText}`}>
            <Icon size={18} /><span>{isAr ? label[1] : label[0]}</span>
          </button>
        );
      })}
    </nav>
  );
}

function ScreenRouter({ user }) {
  const nav = useNav(); const { code, params } = nav.route;
  const entry = getScreen(code);
  const allowed = entry && (!user ? entry.roles.includes('guest') : entry.roles.includes(user.role));
  if (!allowed) return <NotFound code={code} />;
  return renderView(entry.view, params.id, params);
}

function AuthenticatedApp({ user }) {
  const { isAr } = usePrefs();
  useEffect(() => {
    connectSignalR();
    const onRevoked = () => { window.location.hash = '#/A03'; };
    window.addEventListener('fixngo:session-revoked', onRevoked);
    return () => { disconnectSignalR(); window.removeEventListener('fixngo:session-revoked', onRevoked); };
  }, []);
  const current = useNav().route.code;
  return (
    <div className="h-full flex flex-col relative">
      <div className="absolute top-2 end-3 z-40"><ThemeLangControls /></div>
      <div className="flex-1 min-h-0 overflow-hidden" data-testid="screen-container">
        <ScreenRouter user={user} />
      </div>
      <BottomNav role={user.role} current={current} />
      {isAr && <span className="sr-only">اتجاه عربي</span>}
    </div>
  );
}

function GuestApp() {
  const nav = useNav(); const { isAr } = usePrefs();
  const code = nav.route.code;
  const entry = getScreen(code);
  const allowed = entry && entry.roles.includes('guest');
  return (
    <div className="h-full flex flex-col relative">
      <div className="absolute top-2 end-3 z-40"><ThemeLangControls /></div>
      <div className="flex-1 min-h-0 overflow-hidden" data-testid="screen-container">
        {allowed ? renderView(entry.view) : <NotFound code={code} />}
      </div>
      <div className="shrink-0 text-center py-2 text-[10px] text-slate-400">{isAr ? 'مساعدة على الطريق · FixNGo' : 'Roadside assistance · FixNGo'}</div>
    </div>
  );
}

function Shell() {
  const { user, ready } = useSession();
  const [status, setStatus] = useState(null);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

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
        <div className="flex items-start justify-center gap-4 w-full max-w-[1120px]">
          <div className="phone-frame shrink-0">
            {!online && <div data-testid="offline-banner" className="bg-amber-500 text-white text-center text-[10px] py-1 flex items-center justify-center gap-1"><WifiOff size={12} />Offline — requests will replay</div>}
            <div className="h-full overflow-hidden">
              {blocked ? <SetupNeeded /> : !ready ? (
                <div className="h-full grid place-items-center"><Loader2 className="animate-spin text-[#E51C23]" size={32} /></div>
              ) : user ? <AuthenticatedApp user={user} /> : <GuestApp />}
            </div>
          </div>
          {status?.simulatorsEnabled && user && <SimulatorDock />}
        </div>
      </div>
    </>
  );
}

// Hook-free fatal fallback: ErrorBoundary sits ABOVE all context providers, so the
// fallback must not call usePrefs()/useNav() (they would return null and crash again).
function FatalFallback() {
  return (
    <div data-testid="not-found" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, textAlign: 'center', background: '#F8FAFC', color: '#0F172A' }}>
      <ShieldAlert size={44} color="#E51C23" />
      <strong>Screen not available</strong>
      <a href="#/A02" style={{ color: '#E51C23', fontSize: 12 }}>Back to start</a>
    </div>
  );
}

// Keeps an unexpected render error inside the phone frame and offers a safe exit.
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
