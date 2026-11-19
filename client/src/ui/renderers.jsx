// Declarative view renderers — each screen is a config interpreted here.
// Every value comes from a real API query; no hard-coded records or personas.
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight, Check, Bell, CreditCard, Wrench, FileText, Car, Users, Building2,
  Truck, Home, User, Send, MapPin, Navigation, Clock, ShieldCheck, LogOut, WifiOff
} from 'lucide-react';
import { usePrefs, useNav, useNavigate, useSession } from '../app/stores.jsx';
import { get, post, put } from '../api/http.js';
import {
  Card, PrimaryButton, SecondaryButton, ShieldLogo, BrandLockup, StatusBadge, MapView,
  EmergencySOSBar, Field, inputClass, Toggle, StarRating, Page, useColors
} from './kit.jsx';
import { ScreenBody, SectionTitle, Kpi, InfoRow, ListRow, EmptyAction, useT } from './data.jsx';
import { fmtMoney, fmtNumber, fmtDateTime, fmtDate, fmtTime, fmtDistance } from '../i18n/format.js';

const ICONS = { bell: Bell, card: CreditCard, wrench: Wrench, file: FileText, car: Car, users: Users, building: Building2, truck: Truck, home: Home, user: User };

function resolvePath(obj, path) { return path?.split('.').reduce((o, k) => o?.[k], obj); }
function useSource(path, key, enabled = true) {
  const usable = !!path && !path.includes('{') && !path.endsWith('/') && enabled;
  return useQuery({ queryKey: key || [path], queryFn: () => get(path), enabled: usable });
}
function useOptions(spec) {
  const bootstrap = useQuery({ queryKey: ['bootstrap'], queryFn: () => get('/lookups/bootstrap'), enabled: spec?.from === 'bootstrap' });
  const endpoint = useQuery({ queryKey: ['options', spec?.path], queryFn: () => get(spec.path), enabled: spec?.from === 'path' && !!spec?.path });
  const src = spec?.from === 'bootstrap' ? bootstrap.data : endpoint.data;
  if (!spec || !src) return [];
  let rows = spec.key ? src[spec.key] : src;
  if (!Array.isArray(rows)) return [];
  if (spec.filter) rows = rows.filter((r) => String(r[spec.filter.field]) === String(spec.filter.value));
  return rows.map((r) => ({
    value: r[spec.value || 'id'],
    en: spec.en ? r[spec.en] : (r.nameEn || r.name || r.make || r.fullName || String(r[spec.value || 'id'])),
    ar: spec.ar ? r[spec.ar] : (r.nameAr || r.name || r.make || r.fullName || String(r[spec.value || 'id']))
  }));
}
function rowsOf(data, view) {
  const raw = view.itemsPath ? resolvePath(data, view.itemsPath) : data;
  return Array.isArray(raw) ? raw : (raw?.items || []);
}
function rowTitle(row, view, t) {
  return row[view.titleField] || row.name || row.nameEn || row.fullName || row.code || row.make || t('Item', 'عنصر');
}
function rowSubtitle(row, view) {
  return (view.subtitleField && row[view.subtitleField]) || row.address || row.email || row.status || '';
}

// ---- Splash / hero / informational ----
export function SplashView({ view }) {
  const t = useT(); const go = useNavigate(); const c = useColors(); const { lang } = usePrefs();
  React.useEffect(() => {
    const id = setTimeout(() => go(view.next), 1100);
    return () => clearTimeout(id);
  }, [view.next, go]);
  return (
    <div className={`min-h-full flex flex-col items-center justify-between p-6 ${c.bg}`} data-testid="view-splash">
      <div />
      <div className="flex flex-col items-center">
        <div className="w-44 h-44 rounded-full bg-[#E51C23]/5 border border-[#E51C23]/15 flex items-center justify-center">
          <div className="w-32 h-32 rounded-full bg-[#E51C23]/10 flex flex-col items-center justify-center gap-2">
            <ShieldLogo size={64} />
            <span className={`text-xl font-black italic ${c.text}`} dir="ltr">Fix<span className="text-[#FF0000]">N</span>Go</span>
          </div>
        </div>
        <p className={`mt-5 text-[10px] tracking-[0.2em] uppercase font-semibold text-center ${c.secondaryText}`}>{t(view.taglineEn, view.taglineAr)}</p>
      </div>
      <div className="w-full space-y-2 text-center">
        <PrimaryButton onClick={() => go(view.next)} testId="screen-primary">{t('Continue', 'متابعة')}</PrimaryButton>
        <p className={`text-[10px] ${c.secondaryText}`}>{fmtNumber(new Date().getFullYear(), lang)}</p>
      </div>
    </div>
  );
}

export function HeroView({ view }) {
  const t = useT(); const go = useNavigate(); const c = useColors();
  return (
    <div className={`min-h-full flex flex-col ${c.bg}`} data-testid="view-hero">
      <div className="px-5 pt-4"><BrandLockup /></div>
      <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
        <div className="space-y-3.5">
          <div className="w-full h-56 rounded-2xl overflow-hidden border border-white/10 shadow-md bg-gradient-to-br from-[#E51C23] to-[#B7151A] flex items-center justify-center" role="img" aria-label="Roadside assistance">
            <Car size={96} className="text-white/80" strokeWidth={1} />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E51C23]/15 border border-[#E51C23]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E51C23]" />
            <span className="text-[10px] font-semibold text-[#E51C23]">{t('Roadside assistance', 'مساعدة على الطريق')}</span>
          </div>
          <h1 className={`text-2xl font-extrabold leading-tight ${c.text}`}>{t(view.titleEn, view.titleAr)}</h1>
          <p className={`text-xs leading-relaxed ${c.secondaryText}`}>{t(view.bodyEn, view.bodyAr)}</p>
        </div>
        <div className="space-y-2.5">
          <PrimaryButton onClick={() => go(view.next)} testId="screen-primary">{t(view.buttonEn, view.buttonAr)}</PrimaryButton>
          {view.alt && <div className="text-center"><button onClick={() => go(view.alt.to)} className={`text-xs ${c.secondaryText}`}>
            {t(view.alt.prefixEn, view.alt.prefixAr)} <span className="text-[#E51C23] font-semibold">{t(view.alt.labelEn, view.alt.labelAr)}</span>
          </button></div>}
        </div>
      </div>
    </div>
  );
}

export function InfoView({ view }) {
  const t = useT(); const go = useNavigate(); const c = useColors();
  return (
    <Page title={t(view.titleEn, view.titleAr)}>
      <div className="p-5 space-y-3">
        <h1 className={`text-xl font-bold ${c.text}`}>{t(view.headingEn || view.titleEn, view.headingAr || view.titleAr)}</h1>
        <p className={`text-xs leading-relaxed ${c.secondaryText}`}>{t(view.bodyEn, view.bodyAr)}</p>
        {view.points?.length > 0 && (
          <Card className="space-y-1.5">{view.points.map((p, i) => <p key={i} className={`text-xs ${c.text}`}>✓ {t(p.en, p.ar)}</p>)}</Card>
        )}
        {view.map && <MapView label={t('Pickup area', 'منطقة الالتقاء')} />}
        {view.sos && <EmergencySOSBar />}
        <div className="space-y-2 pt-2">
          {view.actions?.map((a, i) => a.secondary
            ? <SecondaryButton key={i} onClick={() => go(a.to)}>{t(a.en, a.ar)}</SecondaryButton>
            : <PrimaryButton key={i} onClick={() => go(a.to)} testId="screen-primary">{t(a.en, a.ar)}</PrimaryButton>)}
        </div>
      </div>
    </Page>
  );
}

// ---- Login / signup / OTP (real auth endpoints) ----
export function LoginView({ view }) {
  const { isAr } = usePrefs(); const { login } = useSession(); const { replace } = useNav(); const c = useColors();
  const [email, setEmail] = React.useState(''); const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState(''); const [busy, setBusy] = React.useState(false);
  const t = (en, ar) => (isAr ? ar : en);
  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const user = await login(email.trim(), password);
      replace(homeFor(user.role));
    } catch (err) {
      setError(err.status === 401 ? t('Invalid email or password.', 'البريد أو كلمة المرور غير صحيحة.') : (err.message || t('Could not sign in.', 'تعذر تسجيل الدخول.')));
    } finally { setBusy(false); }
  }
  return (
    <div className={`min-h-full flex flex-col ${c.bg}`} data-testid="view-login">
      <div className="bg-gradient-to-br from-[#E51C23] to-[#B7151A] text-white px-7 pt-16 pb-12 rounded-b-[36px]">
        <div className="flex items-center gap-2 mb-8"><ShieldCheck size={24} /><span className="text-xl font-extrabold tracking-tight">FixNGo</span></div>
        <h1 className="text-3xl font-extrabold leading-tight">{t('Welcome back', 'مرحباً بعودتك')}</h1>
        <p className="text-white/80 text-sm mt-2">{t('Sign in to continue', 'سجّل الدخول للمتابعة')}</p>
      </div>
      <form onSubmit={submit} className="flex-1 px-7 py-8 flex flex-col gap-4 overflow-y-auto">
        <label className={`text-sm font-semibold ${c.text}`}>{t('Email', 'البريد الإلكتروني')}
          <input data-testid="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field-input mt-1" autoComplete="username" required />
        </label>
        <label className={`text-sm font-semibold ${c.text}`}>{t('Password', 'كلمة المرور')}
          <input data-testid="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="field-input mt-1" autoComplete="current-password" required />
        </label>
        {error && <div data-testid="login-error" role="alert" className={`text-sm text-rose-600 dark:text-rose-400 rounded-xl p-3 ${c.elevated}`}>{error}</div>}
        <button data-testid="login-submit" type="submit" disabled={busy} className="btn-primary mt-2 flex items-center justify-center gap-2">
          {busy && <Clock size={18} className="animate-spin" />}{t('Sign in', 'تسجيل الدخول')}
        </button>
        <div className="text-center"><button type="button" onClick={() => go('A04')} className="text-xs text-[#E51C23] font-semibold">{t('Create an account', 'إنشاء حساب')}</button></div>
        <div className="text-center"><button type="button" onClick={() => go('A06')} className={`text-xs ${c.secondaryText}`}>{t('Forgot password?', 'نسيت كلمة المرور؟')}</button></div>
      </form>
    </div>
  );
}
function go(code) { window.location.hash = `#/${code}`; }
function homeFor(role) {
  return ({ CarOwner: 'C02', Mechanic: 'M02', TowCaptain: 'T02', ServiceCenter: 'SC01', Admin: 'AD01' })[role] || 'C02';
}

export function SignupView({ view }) {
  const t = useT(); const go = useNavigate(); const c = useColors();
  const [form, setForm] = React.useState({ role: 'CarOwner' });
  const [error, setError] = React.useState(''); const [busy, setBusy] = React.useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const data = await post('/auth/signup', form);
      sessionStorage.setItem('fixngo.otpTarget', data.target || form.email);
      sessionStorage.setItem('fixngo.otpPurpose', 'Signup');
      go('A05');
    } catch (err) { setError(err.message || '—'); } finally { setBusy(false); }
  }
  const roles = [
    { value: 'CarOwner', en: 'Car Owner', ar: 'مالك سيارة' },
    { value: 'Mechanic', en: 'Mechanic', ar: 'ميكانيكي' },
    { value: 'TowCaptain', en: 'Tow Captain', ar: 'كابتن ونش' },
    { value: 'ServiceCenter', en: 'Service Center', ar: 'مركز خدمة' }
  ];
  return (
    <Page title={t(view.titleEn, view.titleAr)}>
      <form onSubmit={submit} className="p-5 space-y-3">
        <h1 className={`text-xl font-bold ${c.text}`}>{t('Create your account', 'أنشئ حسابك')}</h1>
        {[
          ['fullName', 'Full name', 'الاسم الكامل', 'text'],
          ['email', 'Email', 'البريد الإلكتروني', 'email'],
          ['phone', 'Phone', 'رقم الهاتف', 'tel'],
          ['password', 'Password', 'كلمة المرور', 'password'],
          ['businessName', 'Business name (optional)', 'اسم المنشأة (اختياري)', 'text']
        ].map(([n, en, ar, type]) => (
          <Field key={n} label={t(en, ar)}><input type={type} className={inputClass()} value={form[n] || ''} onChange={(e) => set(n, e.target.value)} data-testid={`field-${n}`} required={n !== 'businessName'} /></Field>
        ))}
        <Field label={t('Join as', 'انضم كـ')}>
          <select className={inputClass()} value={form.role} onChange={(e) => set('role', e.target.value)} data-testid="field-role">
            {roles.map((r) => <option key={r.value} value={r.value}>{t(r.en, r.ar)}</option>)}
          </select>
        </Field>
        {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
        <PrimaryButton type="submit" disabled={busy} testId="screen-primary">{busy ? '…' : t('Continue', 'متابعة')}</PrimaryButton>
      </form>
    </Page>
  );
}

export function OtpView({ view }) {
  const t = useT(); const go = useNavigate(); const c = useColors();
  const [code, setCode] = React.useState(''); const [error, setError] = React.useState(''); const [busy, setBusy] = React.useState(false);
  const target = sessionStorage.getItem('fixngo.otpTarget') || '';
  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    const purpose = sessionStorage.getItem('fixngo.otpPurpose') || 'Signup';
    try {
      const endpoint = purpose === 'Forgot' ? '/auth/reset-otp' : '/auth/verify-otp';
      const data = await post(endpoint, { target, code, purpose });
      if (purpose === 'Forgot') { sessionStorage.setItem('fixngo.resetToken', typeof data === 'string' ? data : data.resetToken); go('A07'); }
      else go('A08');
    } catch (err) { setError(err.message || '—'); } finally { setBusy(false); }
  }
  return (
    <Page title={t(view.titleEn, view.titleAr)}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <h1 className={`text-xl font-bold ${c.text}`}>{t('Check your inbox', 'تحقق من بريدك')}</h1>
        <p className={`text-xs ${c.secondaryText}`}>{target}</p>
        <input dir="ltr" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} className={`${inputClass()} text-center tracking-[0.5em] text-lg`} placeholder="000000" data-testid="otp-input" required />
        {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
        <PrimaryButton type="submit" disabled={busy || code.length !== 6} testId="screen-primary">{t('Verify', 'تحقق')}</PrimaryButton>
      </form>
    </Page>
  );
}

// ---- Data screens ----
export function DashboardView({ view }) {
  const t = useT(); const go = useNavigate(); const c = useColors(); const { lang } = usePrefs();
  const src = useSource(view.path, view.queryKey);
  return (
    <Page title={t(view.titleEn, view.titleAr)}>
      <div className="p-5 space-y-4">
        <h1 className={`text-xl font-extrabold ${c.text}`}>{t(view.headingEn || view.titleEn, view.headingAr || view.titleAr)}</h1>
        {view.path ? (
          <ScreenBody query={src} emptyTitle={t(view.emptyEn || 'Nothing here yet', view.emptyAr || 'لا توجد بيانات بعد')} emptyMessage={t(view.emptyBodyEn, view.emptyBodyAr)}>
            {(data) => {
              const rows = rowsOf(data, view);
              const kpis = view.kpis || [{ labelEn: 'Records', labelAr: 'سجلات', path: null, value: fmtNumber(rows.length, lang), icon: 'file' }];
              return (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {kpis.map((kpi, i) => <Kpi key={i} label={t(kpi.labelEn, kpi.labelAr)}
                      value={kpi.value ?? fmtNumber(resolvePath(data, kpi.path) ?? 0, lang)} icon={ICONS[kpi.icon || 'file']} tone={kpi.tone || 'red'} />)}
                  </div>
                  {view.listPath && rows.length > 0 && (
                    <div className="space-y-2">
                      <SectionTitle>{t(view.listTitleEn || 'Recent', 'الأحدث')}</SectionTitle>
                      {rows.slice(0, 8).map((row, i) => (
                        <ListRow key={row.id || i} testId="data-row" title={rowTitle(row, view, t)} subtitle={rowSubtitle(row, view)}
                          badge={row.status} right={view.rightField && row[view.rightField] ? String(row[view.rightField]) : undefined}
                          icon={ICONS[view.icon || 'file']} onClick={() => view.rowTo && go(view.rowTo, { id: row.id })} />
                      ))}
                    </div>
                  )}
                </>
              );
            }}
          </ScreenBody>
        ) : (view.points?.length > 0 && <Card>{view.points.map((p, i) => <p key={i} className={`text-xs ${c.text}`}>✓ {t(p.en, p.ar)}</p>)}</Card>)}
        {view.actions?.length > 0 && <div className="space-y-2 pt-2">{view.actions.map((a, i) => <PrimaryButton key={i} onClick={() => go(a.to)} testId="screen-primary">{t(a.en, a.ar)}</PrimaryButton>)}</div>}
        {view.sos && <EmergencySOSBar />}
      </div>
    </Page>
  );
}

export function ListView({ view }) {
  const t = useT(); const go = useNavigate(); const c = useColors();
  const src = useSource(view.path, view.queryKey);
  return (
    <Page title={t(view.titleEn, view.titleAr)}>
      <div className="p-5 space-y-3">
        <h1 className={`text-xl font-extrabold ${c.text}`}>{t(view.headingEn || view.titleEn, view.headingAr || view.titleAr)}</h1>
        <ScreenBody query={src} emptyTitle={t(view.emptyEn || 'Nothing here yet', view.emptyAr || 'لا توجد بيانات بعد')} emptyMessage={t(view.emptyBodyEn, view.emptyBodyAr)}>
          {(data) => {
            const rows = rowsOf(data, view);
            return <div className="space-y-2">{rows.map((row, i) => (
              <ListRow key={row.id || i} testId="data-row" title={rowTitle(row, view, t)} subtitle={rowSubtitle(row, view)}
                badge={row.status} right={view.rightField && row[view.rightField] ? String(row[view.rightField]) : undefined}
                icon={ICONS[view.icon || 'file']} onClick={() => view.rowTo && go(view.rowTo, { id: row.id })} />
            ))}</div>;
          }}
        </ScreenBody>
        {view.actions?.map((a, i) => <PrimaryButton key={i} onClick={() => go(a.to)} testId="screen-primary">{t(a.en, a.ar)}</PrimaryButton>)}
      </div>
    </Page>
  );
}

export function DetailView({ view, id, params }) {
  const t = useT(); const go = useNavigate(); const c = useColors(); const { lang } = usePrefs();
  const path = view.path?.replace('{id}', id || '').replace('{vehicleId}', params?.vehicleId || '');
  const src = useSource(path, ['detail', view.titleEn, id]);
  return (
    <Page title={t(view.titleEn, view.titleAr)}>
      <div className="p-5 space-y-3">
        {view.map && <MapView label={t('Live location', 'الموقع المباشر')} />}
        <ScreenBody query={src} emptyTitle={t(view.emptyEn || 'Not found', view.emptyAr || 'غير موجود')} emptyMessage={t(view.emptyBodyEn, view.emptyBodyAr)}>
          {(data) => (
            <Card className="space-y-1">
              {(view.fields || Object.keys(data || {}).slice(0, 8).map((k) => ({ path: k, labelEn: k }))).map((f, i) => (
                <InfoRow key={i} label={t(f.labelEn, f.labelAr || f.labelEn)} mono={f.mono}
                  value={f.money ? fmtMoney(resolvePath(data, f.path), lang)
                    : f.date ? fmtDateTime(resolvePath(data, f.path), lang)
                    : f.distance ? fmtDistance(resolvePath(data, f.path), lang)
                    : f.time ? fmtTime(resolvePath(data, f.path), lang)
                    : f.status ? undefined : resolvePath(data, f.path)}
                  status={f.status ? resolvePath(data, f.path) : undefined} />
              ))}
            </Card>
          )}
        </ScreenBody>
        {view.actions?.map((a, i) => <div key={i} className="pt-1">{a.secondary
          ? <SecondaryButton onClick={() => go(a.to, { id })}>{t(a.en, a.ar)}</SecondaryButton>
          : <PrimaryButton onClick={() => go(a.to, { id })} testId="screen-primary">{t(a.en, a.ar)}</PrimaryButton>}</div>)}
        {view.sos && <EmergencySOSBar />}
      </div>
    </Page>
  );
}

export function FormView({ view, id }) {
  const t = useT(); const go = useNavigate(); const c = useColors();
  const [values, setValues] = React.useState({});
  const [error, setError] = React.useState(''); const [busy, setBusy] = React.useState(false); const [done, setDone] = React.useState(false);
  const dynamicOptions = React.useMemo(() => (view.fields || []).filter((f) => f.optionsFrom), [view.fields]);
  const optSets = dynamicOptions.map((f) => useOptions(f.optionsFrom));
  const optionMap = React.useMemo(() => Object.fromEntries(dynamicOptions.map((f, i) => [f.name, optSets[i]])), [dynamicOptions, optSets.join('|')]);

  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const missing = (view.fields || []).find((f) => f.required && !values[f.name]);
      if (missing) throw new Error(t('Please fill all required fields', 'يرجى تعبئة الحقول المطلوبة'));
      const body = {};
      for (const f of view.fields || []) {
        const raw = values[f.name];
        if (raw === undefined || raw === '') continue;
        body[f.name] = f.type === 'number' ? Number(raw) : f.type === 'checkbox' ? !!raw : raw;
      }
      if (view.body) Object.assign(body, typeof view.body === 'function' ? view.body(values, id) : view.body);
      const path = view.path?.replace('{id}', id || '');
      if (view.method === 'PUT') await put(path, body); else await post(path, body, { idempotencyKey: view.idempotent ? crypto.randomUUID() : undefined });
      setDone(true);
      if (view.next) setTimeout(() => go(view.next, { id }), 350);
    } catch (err) { setError(err.message || t('Could not save', 'تعذر الحفظ')); }
    finally { setBusy(false); }
  }
  return (
    <Page title={t(view.titleEn, view.titleAr)}>
      <form onSubmit={submit} className="p-5 space-y-3">
        <h1 className={`text-xl font-bold ${c.text}`}>{t(view.headingEn || view.titleEn, view.headingAr || view.titleAr)}</h1>
        <p className={`text-xs ${c.secondaryText}`}>{t(view.bodyEn, view.bodyAr)}</p>
        {(view.fields || []).map((f) => {
          const opts = f.options || optionMap[f.name] || [];
          return (
            <Field key={f.name} label={t(f.labelEn, f.labelAr)} hint={t(f.hintEn, f.hintAr)}>
              {f.type === 'checkbox' ? (
                <Toggle checked={!!values[f.name]} onChange={(v) => setValues({ ...values, [f.name]: v })} label={t(f.labelEn, f.labelAr)} />
              ) : opts.length ? (
                <select value={values[f.name] || ''} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} className={inputClass()} data-testid={`field-${f.name}`}>
                  <option value="">—</option>
                  {opts.map((o) => <option key={o.value} value={o.value}>{t(o.en, o.ar)}</option>)}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea rows={3} value={values[f.name] || ''} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} className={inputClass()} data-testid={`field-${f.name}`} />
              ) : (
                <input type={f.type || 'text'} value={values[f.name] || ''} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  className={inputClass()} placeholder={t(f.placeholderEn, f.placeholderAr) || ''} data-testid={`field-${f.name}`} />
              )}
            </Field>
          );
        })}
        {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
        {done && <p role="status" className="text-xs text-emerald-500">{t('Saved successfully', 'تم الحفظ بنجاح')}</p>}
        <PrimaryButton type="submit" disabled={busy} testId="screen-primary">{busy ? '…' : t(view.buttonEn || 'Save', view.buttonAr || 'حفظ')}</PrimaryButton>
      </form>
    </Page>
  );
}

export function TimelineView({ view, id }) {
  const t = useT(); const go = useNavigate(); const c = useColors(); const { lang } = usePrefs();
  const src = useSource(view.path?.replace('{id}', id || ''), ['timeline', id]);
  return (
    <Page title={t(view.titleEn, view.titleAr)}>
      <div className="p-5 space-y-3">
        <h1 className={`text-xl font-extrabold ${c.text}`}>{t(view.headingEn || view.titleEn, view.headingAr || view.titleAr)}</h1>
        <ScreenBody query={src} emptyTitle={t('No timeline yet', 'لا يوجد تسلسل زمني')}>
          {(data) => {
            const rows = Array.isArray(data) ? data : (data?.events || data?.items || []);
            return <Card className="space-y-0">{rows.map((row, i) => (
              <div key={i} className="flex gap-3 py-2">
                <div className="w-6 h-6 rounded-full bg-[#E51C23]/15 text-[#E51C23] grid place-items-center shrink-0"><Check size={12} /></div>
                <div><p className={`text-xs font-bold ${c.text}`}>{row.titleEn || row.title || row.status || row.code}</p>
                  <p className={`text-[10px] ${c.secondaryText}`}>{row.at || row.createdAt ? fmtDateTime(row.at || row.createdAt, lang) : ''}</p></div>
              </div>
            ))}</Card>;
          }}
        </ScreenBody>
        {view.actions?.map((a, i) => <PrimaryButton key={i} onClick={() => go(a.to, { id })}>{t(a.en, a.ar)}</PrimaryButton>)}
      </div>
    </Page>
  );
}
export function MapStatusView({ view, id, params }) {
  const t = useT(); const go = useNavigate(); const c = useColors();
  const path = view.path?.replace('{id}', id || '');
  const src = useSource(path, ['mapstatus', view.titleEn, id]);
  return (
    <Page title={t(view.titleEn, view.titleAr)}>
      <div className="p-5 space-y-3">
        <MapView label={t('Live location', 'الموقع المباشر')} mode={view.mode || 'route'} />
        <ScreenBody query={src} emptyTitle={t('No active trip', 'لا توجد رحلة نشطة')}>
          {(data) => (
            <Card className="space-y-1">
              <InfoRow label={t('Reference', 'المرجع')} value={data.code || data.id} mono />
              <InfoRow label={t('Status', 'الحالة')} status={data.status} />
              {data.provider?.fullName && <InfoRow label={t('Provider', 'مقدم الخدمة')} value={data.provider.fullName} />}
            </Card>
          )}
        </ScreenBody>
        {view.actions?.map((a, i) => <PrimaryButton key={i} onClick={() => go(a.to, { id })} testId="screen-primary">{t(a.en, a.ar)}</PrimaryButton>)}
        {view.sos && <EmergencySOSBar />}
      </div>
    </Page>
  );
}

export function ChatView({ view }) {
  const t = useT(); const c = useColors();
  const threads = useQuery({ queryKey: ['chat', 'threads'], queryFn: () => get('/chat/threads') });
  const [active, setActive] = React.useState(null);
  const thread = useQuery({ queryKey: ['chat', 'thread', active], queryFn: () => get(`/chat/threads/${active}`), enabled: !!active });
  const [text, setText] = React.useState(''); const [error, setError] = React.useState('');
  async function send(e) {
    e.preventDefault(); if (!text.trim() || !active) return;
    try { await post(`/chat/threads/${active}/messages`, { text }, { idempotencyKey: crypto.randomUUID() }); setText(''); thread.refetch(); }
    catch (err) { setError(err.message || '—'); }
  }
  return (
    <Page title={t(view.titleEn, view.titleAr)}>
      <div className="p-5 space-y-3">
        <ScreenBody query={threads} emptyTitle={t('No conversations', 'لا توجد محادثات')}>
          {(data) => {
            const rows = Array.isArray(data) ? data : (data?.items || []);
            return <div className="space-y-2">{rows.map((r) => (
              <ListRow key={r.id} testId="data-row" title={r.counterpart?.fullName || r.title || r.request?.code || t('Conversation', 'محادثة')}
                subtitle={r.lastMessage?.text || ''} onClick={() => setActive(r.id)} icon={User} />
            ))}</div>;
          }}
        </ScreenBody>
        {active && (
          <Card className="space-y-2">
            <ScreenBody query={thread} emptyTitle={t('No messages', 'لا توجد رسائل')}>
              {(data) => {
                const msgs = Array.isArray(data) ? data : (data?.messages || []);
                return <div className="space-y-2 max-h-56 overflow-y-auto">{msgs.map((m) => (
                  <div key={m.id} className={`text-xs p-2 rounded-xl max-w-[85%] ${m.fromMe || m.isMine ? 'bg-[#E51C23] text-white ms-auto' : c.elevated}`}>{m.text}</div>
                ))}</div>;
              }}
            </ScreenBody>
            <form onSubmit={send} className="flex gap-2"><input className={inputClass()} value={text} onChange={(e) => setText(e.target.value)} data-testid="field-text" placeholder={t('Write a message', 'اكتب رسالة')} />
              <button type="submit" className="px-3 rounded-xl bg-[#E51C23] text-white" aria-label="Send"><Send size={16} /></button></form>
            {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
          </Card>
        )}
      </div>
    </Page>
  );
}

export function OfflineView({ view }) {
  const c = useColors(); const t = useT(); const { replace } = useNav();
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
  return (
    <Page title={t(view.titleEn, view.titleAr)}>
      <div className="p-5 space-y-4 text-center">
        <WifiOff size={42} className="mx-auto text-amber-400" />
        <h1 className={`text-xl font-bold ${c.text}`}>{t(online ? 'Connection restored' : 'Connection interrupted', online ? 'تمت إعادة الاتصال' : 'انقطع الاتصال')}</h1>
        <p className={`text-xs ${c.secondaryText}`}>{t('Idempotent requests are replayed automatically when the connection returns.', 'تُعاد الطلبات الآمنة تلقائياً عند عودة الاتصال.')}</p>
        <EmergencySOSBar onClick={() => { window.location.hash = '#/SH19'; }} />
        <PrimaryButton onClick={() => replace('C02')} testId="screen-primary">{t('Back to home', 'العودة للرئيسية')}</PrimaryButton>
      </div>
    </Page>
  );
}

export function renderView(view, id, params) {
  switch (view.type) {
    case 'splash': return <SplashView view={view} />;
    case 'hero': return <HeroView view={view} />;
    case 'info': return <InfoView view={view} />;
    case 'login': return <LoginView view={view} />;
    case 'signup': return <SignupView view={view} />;
    case 'otp': return <OtpView view={view} />;
    case 'dashboard': return <DashboardView view={view} />;
    case 'list': return <ListView view={view} />;
    case 'detail': return <DetailView view={view} id={id} params={params} />;
    case 'form': return <FormView view={view} id={id} />;
    case 'timeline': return <TimelineView view={view} id={id} />;
    case 'mapStatus': return <MapStatusView view={view} id={id} params={params} />;
    case 'chat': return <ChatView view={view} />;
    case 'offline': return <OfflineView view={view} />;
    default: return <InfoView view={view} />;
  }
}
