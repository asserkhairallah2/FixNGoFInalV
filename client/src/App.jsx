import React, { useState, useEffect } from 'react';
import { ShieldCheck, Sun, Moon, Languages, Loader2, AlertCircle } from 'lucide-react';
import { PrefsProvider, usePrefs, SessionProvider, useSession, NavProvider, useNav } from './app/stores.jsx';
import { get } from './api/http.js';

function SystemRibbon({ status }) {
  if (!status) return null;
  if (!status.setupComplete) {
    return (
      <div className="fixed inset-x-0 top-0 z-50 bg-amber-500 text-white text-center text-xs py-2">
        System not set up — run setup.bat
      </div>
    );
  }
  if (status.mode === 'dummy') {
    return <div className="fixed inset-x-0 top-0 z-50 bg-fuchsia-700 text-white text-center text-xs font-bold py-2">DUMMY DATA MODE — NOT REAL</div>;
  }
  return null;
}

function ThemeLangControls() {
  const { theme, setTheme, lang, setLang } = usePrefs();
  return (
    <div className="flex gap-2 items-center">
      <button aria-label="Toggle language" title="Toggle language"
        onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
        className="w-9 h-9 rounded-full border border-slate-300 dark:border-slate-600 grid place-items-center text-slate-600 dark:text-slate-300">
        <Languages size={17} />
      </button>
      <button aria-label="Toggle theme" title="Toggle theme"
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        className="w-9 h-9 rounded-full border border-slate-300 dark:border-slate-600 grid place-items-center text-slate-600 dark:text-slate-300">
        {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
      </button>
    </div>
  );
}

function LoginScreen() {
  const { isAr } = usePrefs();
  const { login } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const t = (en, ar) => (isAr ? ar : en);

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try { await login(email.trim(), password); }
    catch (err) {
      setError(err.status === 401 ? t('Invalid email or password.', 'البريد أو كلمة المرور غير صحيحة.') : (err.message || t('Could not sign in.', 'تعذر تسجيل الدخول.')));
    } finally { setBusy(false); }
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900">
      <div className="bg-gradient-to-br from-[#E51C23] to-[#B7151A] text-white px-7 pt-16 pb-12 rounded-b-[36px]">
        <div className="flex items-center gap-2 mb-8">
          <ShieldCheck size={24} />
          <span className="text-xl font-extrabold tracking-tight">FixNGo</span>
        </div>
        <h1 className="text-3xl font-extrabold leading-tight">{t('Welcome back', 'مرحباً بعودتك')}</h1>
        <p className="text-white/80 text-sm mt-2">{t('Sign in to continue', 'سجّل الدخول للمتابعة')}</p>
      </div>
      <form onSubmit={submit} className="flex-1 px-7 py-8 flex flex-col gap-4 overflow-y-auto">
        <div className="flex justify-end"><ThemeLangControls /></div>
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {t('Email', 'البريد الإلكتروني')}
          <input data-testid="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="field-input mt-1" autoComplete="username" required />
        </label>
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {t('Password', 'كلمة المرور')}
          <input data-testid="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="field-input mt-1" autoComplete="current-password" required />
        </label>
        {error && (
          <div data-testid="login-error" className="flex items-start gap-2 text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 rounded-xl p-3">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
          </div>
        )}
        <button data-testid="login-submit" type="submit" disabled={busy} className="btn-primary mt-2 flex items-center justify-center gap-2">
          {busy && <Loader2 size={18} className="animate-spin" />}
          {t('Sign in', 'تسجيل الدخول')}
        </button>
      </form>
    </div>
  );
}

function HomeScreen() {
  const { user, logout } = useSession();
  const { isAr } = usePrefs();
  const { go } = useNav();
  const t = (en, ar) => (isAr ? ar : en);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 overflow-y-auto">
      <header className="bg-white dark:bg-slate-800 px-6 py-5 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('Signed in as', 'مسجّل الدخول كـ')}</p>
          <h1 className="text-lg font-extrabold text-slate-800 dark:text-white">{user?.fullName}</h1>
          <p className="text-xs font-semibold text-[#E51C23]">{user?.role}</p>
        </div>
        <ThemeLangControls />
      </header>
      <main className="px-6 py-8 flex-1">
        <div className="rounded-2xl bg-gradient-to-br from-[#E51C23] to-[#B7151A] text-white p-6 mb-5">
          <h2 className="text-xl font-extrabold">{t('Roadside help, fast', 'مساعدة على الطريق بسرعة')}</h2>
          <p className="text-sm text-white/80 mt-1">{t('Your account is ready.', 'حسابك جاهز.')}</p>
        </div>
        <button onClick={() => go('A03')} className="btn-primary">{t('Sign out', 'تسجيل الخروج')}</button>
      </main>
    </div>
  );
}

function Shell() {
  const { user, ready } = useSession();
  const [status, setStatus] = useState(null);

  useEffect(() => {
    get('/system/status').then(setStatus).catch(() => setStatus(null));
  }, []);

  return (
    <>
      <SystemRibbon status={status} />
      <div className="min-h-screen w-full flex items-center justify-center p-4 md:p-6">
        <div className="phone-frame">
          {!ready ? (
            <div className="h-full grid place-items-center"><Loader2 className="animate-spin text-[#E51C23]" size={32} /></div>
          ) : user ? <HomeScreen /> : <LoginScreen />}
        </div>
      </div>
    </>
  );
}

export default function App() {
  return (
    <PrefsProvider>
      <SessionProvider>
        <NavProvider>
          <Shell />
        </NavProvider>
      </SessionProvider>
    </PrefsProvider>
  );
}
