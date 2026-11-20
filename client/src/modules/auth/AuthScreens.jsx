import React, { useState, useEffect, useRef } from 'react';
import {
  Shield, MapPin, Eye, EyeOff, Mail, KeyRound, Upload, CheckCircle2,
  AlertCircle, FileText, Clock, Phone, Building2, Truck, Wrench
} from 'lucide-react';
import { usePrefs, useNav, useSession, homeForUser } from '../../app/stores.jsx';
import { post, put, uploadFile } from '../../api/http.js';
import { useBootstrap, useKyc, useSubmitKyc } from '../../api/hooks.js';
import {
  useColors, AppTopBar, PrimaryButton, SecondaryButton, StatusBadge,
  ShieldLogo, MapView, Toast, formatLabel
} from '../../ui/kit.jsx';
import { providerLabel } from './providerLabels.js';
import { fmtDate, fmtNumber } from '../../i18n/format.js';
import { NIGHT_CAR_IMAGE } from '../../assets/images.js';

// ─── A01: Splash Screen ───────────────────────────────────────────────────────
export function A01Screen() {
  const c = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const { user, ready } = useSession();

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      nav.replace(user ? homeForUser(user) : 'A02');
    }, 900);
    return () => clearTimeout(t);
  }, [ready, user, nav]);

  return (
    <div className={`min-h-full flex flex-col items-center justify-between p-6 ${c.bg}`} data-testid="view-splash">
      <div />
      <div className="flex flex-col items-center py-12">
        <div className="w-44 h-44 rounded-full bg-[#E51C23]/5 border border-[#E51C23]/15 flex items-center justify-center">
          <div className="w-32 h-32 rounded-full bg-[#E51C23]/10 flex flex-col items-center justify-center gap-2">
            <ShieldLogo size={64} />
            <span className={`text-xl font-black italic ${c.text}`} dir="ltr">
              Fix<span className="text-[#FF0000]">N</span>Go
            </span>
          </div>
        </div>
        <p className={`mt-5 text-[10px] tracking-[0.2em] uppercase font-semibold ${c.secondaryText}`}>
          {isAr ? 'نعود إلى الطريق.. معاً' : 'BACK ON THE ROAD. TOGETHER.'}
        </p>
      </div>
      <div className="w-full space-y-2 text-center pb-2">
        <PrimaryButton onClick={() => nav.go(user ? homeForUser(user) : 'A02')} testId="screen-primary">
          {isAr ? 'متابعة' : 'Continue'}
        </PrimaryButton>
        <p className={`text-[10px] ${c.secondaryText}`}>
          {isAr ? 'ثقة وأمان على الطريق ٢٤/٧' : 'Roadside confidence, 24/7'}
        </p>
      </div>
    </div>
  );
}

// ─── A02: Onboarding (Get Started) ────────────────────────────────────────────
export function A02Screen() {
  const c = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();

  return (
    <div className={`min-h-full flex flex-col justify-between ${c.bg}`} data-testid="view-hero">
      <AppTopBar showBack={false} />
      <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
        <div className="space-y-3.5">
          <div className="w-full h-56 rounded-2xl overflow-hidden border border-white/10 shadow-md relative">
            <img src={NIGHT_CAR_IMAGE} alt="FixNGo Car" className="w-full h-full object-cover" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E51C23]/15 border border-[#E51C23]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E51C23]" />
            <span className="text-[10px] font-semibold text-[#E51C23]">
              {isAr ? 'مساعدة على الطريق ٢٤/٧' : '24/7 roadside assistance'}
            </span>
          </div>
          <div className="space-y-1.5">
            <h1 className={`text-2xl font-extrabold leading-tight ${c.text}`}>
              {isAr ? (
                <>مشكلة بسيطة؟<br />دعم كبير في انتظارك.</>
              ) : (
                <>A little trouble.<br />A lot of backup.</>
              )}
            </h1>
            <p className={`text-xs leading-relaxed ${c.secondaryText}`}>
              {isAr
                ? 'ميكانيكيون معتمدون، كباتن أوناش ومراكز خدمة موثوقة أينما يأخذك الطريق.'
                : 'Trusted mechanics, tow captains and service centers. Wherever the road takes you.'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            <span className="w-5 h-1 rounded-full bg-[#E51C23]" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500/40" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500/40" />
          </div>
        </div>
        <div className="space-y-2.5 pt-2">
          <PrimaryButton onClick={() => nav.go('A04')} testId="screen-primary">
            {isAr ? 'ابدأ الآن' : 'Get Started'}
          </PrimaryButton>
          <div className="text-center">
            <button onClick={() => nav.go('A03')} className={`text-xs ${c.secondaryText}`} data-testid="goto-login">
              {isAr ? 'لديك حساب بالفعل؟ ' : 'Already have an account? '}
              <span className="text-[#E51C23] font-semibold">
                {isAr ? 'تسجيل الدخول' : 'Log In'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── A03: Welcome back (Login) ────────────────────────────────────────────────
export function A03Screen() {
  const c = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const { login } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError(isAr ? 'يرجى إدخال البريد الإلكتروني وكلمة المرور.' : 'Please enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      const user = await login(email.trim(), password);
      nav.replace(homeForUser(user));
    } catch (err) {
      if (err.code === 'auth.otp_required') {
        sessionStorage.setItem('fixngo.otpTarget', email.trim().toLowerCase());
        sessionStorage.setItem('fixngo.otpPurpose', 'Login');
        nav.go('A05');
        return;
      }
      if (err.status === 403 || err.code === 'auth.account_blocked') {
        setError(isAr ? 'هذا الحساب موقوف. تواصل مع الدعم.' : 'Your account has been suspended. Please contact support.');
      } else if (err.status === 401) {
        setError(isAr ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' : 'Invalid email or password.');
      } else {
        setError(err.message || (isAr ? 'تعذر تسجيل الدخول.' : 'Could not sign in.'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${c.bg}`} data-testid="view-login">
      <AppTopBar showBack={true} onBack={() => nav.back('A02')} />
      <form onSubmit={handleSubmit} className="p-5 space-y-3.5 flex-1 flex flex-col justify-between">
        <div className="space-y-3.5">
          <div>
            <h1 className={`text-xl font-bold ${c.text}`}>
              {isAr ? 'مرحباً بعودتك' : 'Welcome back'}
            </h1>
            <p className={`text-xs ${c.secondaryText}`}>
              {isAr ? 'طريقك آمن مع دعمنا الموثوق.' : 'Your road. Your reliable backup.'}
            </p>
          </div>
          <div className="w-full h-32 rounded-2xl overflow-hidden border border-white/10">
            <img src={NIGHT_CAR_IMAGE} alt="Car" className="w-full h-full object-cover" />
          </div>
          <div className="space-y-1">
            <label htmlFor="login-email" className={`block text-[11px] font-medium ${c.secondaryText}`}>
              {isAr ? 'البريد الإلكتروني' : 'Email address'}
            </label>
            <div className={`flex items-center justify-between px-3.5 h-11 rounded-xl border ${c.border} ${c.inputBg}`}>
              <input
                id="login-email"
                data-testid="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                autoComplete="username"
                className={`bg-transparent text-xs w-full focus:outline-none ${c.text}`}
                required
              />
              <Mail size={14} className={c.secondaryText} />
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="login-password" className={`block text-[11px] font-medium ${c.secondaryText}`}>
              {isAr ? 'كلمة المرور' : 'Password'}
            </label>
            <div className={`flex items-center justify-between px-3.5 h-11 rounded-xl border ${c.border} ${c.inputBg}`}>
              <input
                id="login-password"
                data-testid="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className={`bg-transparent text-xs w-full focus:outline-none ${c.text}`}
                required
              />
              <button
                type="button"
                aria-label="Toggle password visibility"
                onClick={() => setShowPassword((s) => !s)}
              >
                {showPassword ? (
                  <Eye size={14} className={c.secondaryText} />
                ) : (
                  <EyeOff size={14} className={c.secondaryText} />
                )}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className={`text-[10px] ${c.secondaryText}`}>
              {isAr
                ? 'وصول آمن لمركباتك ورحلاتك وحجوزاتك.'
                : 'Secure access to your vehicles, trips and bookings.'}
            </span>
            <button
              type="button"
              onClick={() => nav.go('A06')}
              className="text-xs font-semibold text-[#E51C23] shrink-0"
            >
              {isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
            </button>
          </div>
          {error && (
            <div data-testid="login-error" role="alert" className="text-xs text-rose-500 rounded-xl p-3 bg-rose-500/10 border border-rose-500/30">
              {error}
            </div>
          )}
        </div>
        <div className="space-y-2.5 pt-2">
          <PrimaryButton type="submit" disabled={busy} testId="login-submit">
            {busy ? (isAr ? 'جارٍ الدخول…' : 'Signing in…') : (isAr ? 'تسجيل الدخول' : 'Login')}
          </PrimaryButton>
          <div className="text-center">
            <button type="button" onClick={() => nav.go('A04')} className={`text-xs ${c.secondaryText}`}>
              {isAr ? 'جديد في FixNGo؟ ' : 'New to FixNGo? '}
              <span className="text-[#E51C23] font-semibold">
                {isAr ? 'إنشاء حساب' : 'Sign Up'}
              </span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ─── A04: Create your account (Sign Up) ───────────────────────────────────────
export function A04Screen() {
  const c = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('CarOwner');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const roles = [
    { id: 'CarOwner', label: isAr ? 'مالك سيارة' : 'Car Owner' },
    { id: 'Mechanic', label: isAr ? 'ميكانيكي' : 'Mechanic' },
    { id: 'TowCaptain', label: isAr ? 'كابتن ونش' : 'Tow Captain' },
    { id: 'ServiceCenter', label: isAr ? 'مركز خدمة' : 'Service Center' }
  ];

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setError('');
    if (fullName.trim().length < 2) {
      setError(isAr ? 'يجب أن يكون الاسم حرفين على الأقل.' : 'Name must be at least 2 characters.');
      return;
    }
    if (confirmPassword && password !== confirmPassword) {
      setError(isAr ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        role,
        businessName: role === 'ServiceCenter' ? fullName.trim() : null
      };
      const data = await post('/auth/signup', payload);
      const target = data.target || email.trim().toLowerCase();
      sessionStorage.setItem('fixngo.otpTarget', target);
      sessionStorage.setItem('fixngo.otpPurpose', 'Signup');
      sessionStorage.setItem('fixngo.otpRole', role);
      nav.updateFlow({
        signupName: fullName.trim(),
        signupBusinessName: role === 'ServiceCenter' ? fullName.trim() : '',
        signupEmail: target,
        signupPhone: payload.phone,
        signupRole: role
      });
      nav.go('A05');
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر إنشاء الحساب.' : 'Could not create account.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${c.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back('A02')} />
      <form onSubmit={handleSubmit} className="p-5 space-y-3 flex-1 flex flex-col justify-between">
        <div className="space-y-2.5">
          <div>
            <h1 className={`text-xl font-bold ${c.text}`}>
              {isAr ? 'إنشاء حسابك' : 'Create your account'}
            </h1>
            <p className={`text-xs ${c.secondaryText}`}>
              {isAr ? 'انضم إلى تجربة أفضل للمساعدة على الطريق.' : 'Join a better roadside experience.'}
            </p>
          </div>
          <div className="space-y-1">
            <label className={`text-[10px] ${c.secondaryText}`}>
              {role === 'ServiceCenter'
                ? (isAr ? 'اسم المركز / المنشأة' : 'Business name')
                : (isAr ? 'الاسم الكامل' : 'Full name')}
            </label>
            <input
              data-testid="field-fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={`w-full px-3 h-10 rounded-xl border ${c.border} ${c.inputBg} text-xs ${c.text}`}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className={`text-[10px] ${c.secondaryText}`}>
                {isAr ? 'البريد الإلكتروني' : 'Email address'}
              </label>
              <input
                data-testid="field-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-3 h-10 rounded-xl border ${c.border} ${c.inputBg} text-xs ${c.text}`}
                required
              />
            </div>
            <div className="space-y-1">
              <label className={`text-[10px] ${c.secondaryText}`}>
                {isAr ? 'رقم الموبايل' : 'Mobile number'}
              </label>
              <input
                data-testid="field-phone"
                type="tel"
                dir="ltr"
                placeholder="+20 10..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`w-full px-3 h-10 rounded-xl border ${c.border} ${c.inputBg} text-xs ${c.text}`}
                required
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className={`text-[10px] ${c.secondaryText}`}>
              {isAr ? 'كلمة المرور' : 'Password'}
            </label>
            <div className={`flex items-center justify-between px-3 h-10 rounded-xl border ${c.border} ${c.inputBg}`}>
              <input
                data-testid="field-password"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`bg-transparent text-xs w-full focus:outline-none ${c.text}`}
                required
              />
              <button type="button" onClick={() => setShowPass((v) => !v)}>
                {showPass ? <Eye size={13} className={c.secondaryText} /> : <EyeOff size={13} className={c.secondaryText} />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className={`text-[10px] ${c.secondaryText}`}>
              {isAr ? 'تأكيد كلمة المرور' : 'Confirm password'}
            </label>
            <input
              data-testid="field-confirmPassword"
              type={showPass ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`w-full px-3 h-10 rounded-xl border ${c.border} ${c.inputBg} text-xs ${c.text}`}
            />
          </div>
          <div className="space-y-1.5 pt-1">
            <label className={`text-[10px] ${c.secondaryText}`}>
              {isAr ? 'أنضم بصفتي' : 'I am joining as'}
            </label>
            <div className="grid grid-cols-2 gap-1.5" data-testid="role-chooser">
              {roles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  data-testid={`role-${r.id}`}
                  onClick={() => setRole(r.id)}
                  className={`py-2 px-2 rounded-xl text-[11px] font-semibold border transition ${
                    role === r.id
                      ? 'border-[#E51C23] bg-[#E51C23]/15 text-[#E51C23]'
                      : `${c.border} ${c.surface} ${c.secondaryText}`
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
        </div>
        <div className="space-y-2 pt-2">
          <PrimaryButton type="submit" disabled={busy} testId="screen-primary">
            {busy ? (isAr ? 'جارٍ الإنشاء…' : 'Creating…') : (isAr ? 'إنشاء الحساب' : 'Create Account')}
          </PrimaryButton>
          <div className="text-center">
            <button type="button" onClick={() => nav.go('A03')} className={`text-[11px] ${c.secondaryText}`}>
              {isAr ? 'مسجل بالفعل؟ ' : 'Already registered? '}
              <span className="text-[#E51C23] font-semibold">
                {isAr ? 'تسجيل الدخول' : 'Log In'}
              </span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ─── A05: Check your inbox (OTP) ──────────────────────────────────────────────
export function A05Screen() {
  const c = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const { user, applyAuth } = useSession();

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [secondsLeft, setSecondsLeft] = useState(120);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const boxes = useRef([]);

  const target = sessionStorage.getItem('fixngo.otpTarget') || nav.flow?.signupEmail || user?.email || '';
  const purpose = sessionStorage.getItem('fixngo.otpPurpose') || 'Signup';
  const signupRole = sessionStorage.getItem('fixngo.otpRole') || nav.flow?.signupRole || 'CarOwner';
  const code = digits.join('');

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
      setCooldown((cd) => (cd > 0 ? cd - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onFill = (e) => {
      const chars = String(e.detail || '').replace(/\D/g, '').slice(0, 6).split('');
      setDigits(Array.from({ length: 6 }, (_, i) => chars[i] || ''));
    };
    window.addEventListener('fixngo:otp-autofill', onFill);
    return () => window.removeEventListener('fixngo:otp-autofill', onFill);
  }, []);

  const setDigit = (idx, raw) => {
    const cleaned = raw.replace(/\D/g, '');
    if (cleaned.length > 1) {
      const arr = cleaned.slice(0, 6).split('');
      setDigits(Array.from({ length: 6 }, (_, i) => arr[i] || ''));
      boxes.current[Math.min(5, arr.length)]?.focus();
      return;
    }
    const ch = cleaned.slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[idx] = ch;
      return next;
    });
    if (ch && idx < 5) boxes.current[idx + 1]?.focus();
  };

  const handlePaste = (e) => {
    const pasted = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      e.preventDefault();
      setDigits(Array.from({ length: 6 }, (_, i) => pasted[i] || ''));
    }
  };

  async function handleResend() {
    if (!target || cooldown > 0) return;
    setError('');
    try {
      await post('/auth/resend-otp', { target, purpose });
      setSecondsLeft(120);
      setCooldown(30);
      setToast(isAr ? 'تم إرسال رمز جديد.' : 'A new code has been sent.');
    } catch (err) {
      setError(err.message || (isAr ? 'يرجى الانتظار قبل إعادة الإرسال.' : 'Please wait before requesting another code.'));
    }
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    if (code.length !== 6) return;
    setError('');
    setBusy(true);
    try {
      if (purpose === 'Forgot') {
        const data = await post('/auth/reset-otp', { target, code, purpose: 'Forgot' });
        sessionStorage.setItem('fixngo.resetToken', typeof data === 'string' ? data : data.resetToken);
        nav.go('A07');
      } else if (purpose === 'Login') {
        const data = await post('/auth/login/verify-otp', { target, code, purpose: 'Login' });
        const authedUser = applyAuth(data);
        nav.replace(homeForUser(authedUser));
      } else {
        const data = await post('/auth/verify-otp', { target, code, purpose: 'Signup', issueSession: true });
        applyAuth(data);
        const role = data?.user?.role || signupRole;
        if (role === 'Mechanic') nav.go('A08');
        else if (role === 'TowCaptain') nav.go('A09');
        else if (role === 'ServiceCenter') nav.go('A10');
        else nav.go('A12');
      }
    } catch (err) {
      setError(err.message || (isAr ? 'الرمز غير صحيح أو منتهي الصلاحية.' : 'Incorrect or expired verification code.'));
    } finally {
      setBusy(false);
    }
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const backTarget = purpose === 'Forgot' ? 'A06' : purpose === 'Signup' ? 'A04' : 'A03';

  return (
    <div className={`min-h-full flex flex-col ${c.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back(backTarget)} />
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      <form onSubmit={handleSubmit} className="p-5 flex-1 flex flex-col justify-between">
        <div className="space-y-4">
          <div>
            <h1 className={`text-xl font-bold ${c.text}`}>
              {isAr ? 'تحقق من بريدك الوارد' : 'Check your inbox'}
            </h1>
            <p className={`text-xs ${c.secondaryText}`}>
              {isAr ? 'أرسلنا رمزاً مكوناً من ٦ أرقام إلى بريدك الإلكتروني.' : 'We sent a six-digit code to your email.'}
            </p>
          </div>
          <div className={`p-4 rounded-2xl border ${c.border} ${c.surface} space-y-1.5`}>
            <Mail size={18} className="text-[#E51C23]" />
            <p className={`text-xs font-bold ${c.text}`} dir="ltr">{target || '—'}</p>
            <p className={`text-[11px] ${c.secondaryText}`}>
              {isAr
                ? 'أدخل الرمز أدناه لتأكيد حسابك.'
                : 'Enter the code below to verify your account.'}
            </p>
          </div>
          <div className="grid grid-cols-6 gap-2" dir="ltr" data-testid="otp-boxes" onPaste={handlePaste}>
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => { boxes.current[idx] = el; }}
                aria-label={`Digit ${idx + 1}`}
                data-testid={`otp-box-${idx}`}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={digit}
                onChange={(e) => setDigit(idx, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
                    boxes.current[idx - 1]?.focus();
                  }
                }}
                className={`h-11 rounded-xl text-center font-bold text-sm border ${
                  digit ? 'border-[#E51C23]' : c.border
                } ${c.surface} ${c.text}`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className={c.secondaryText}>
              {isAr ? 'ينتهي الرمز خلال ' : 'Code expires in '}
              <span className={`font-bold ${c.text}`} dir="ltr">{mm}:{ss}</span>
            </span>
          </div>
          <button
            type="button"
            data-testid="otp-resend"
            disabled={cooldown > 0}
            onClick={handleResend}
            className="text-xs font-bold text-[#E51C23] disabled:opacity-50"
          >
            {cooldown > 0
              ? (isAr ? `إعادة الإرسال خلال ${cooldown} ث` : `Resend OTP (${cooldown}s)`)
              : (isAr ? 'إعادة إرسال الرمز' : 'Resend OTP')}
          </button>
          {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
        </div>
        <PrimaryButton type="submit" disabled={busy || code.length !== 6} testId="screen-primary">
          {busy ? (isAr ? 'جارٍ التحقق…' : 'Verifying…') : (isAr ? 'تأكيد البريد الإلكتروني' : 'Verify Email')}
        </PrimaryButton>
      </form>
    </div>
  );
}

// ─── A06: Forgot password? ────────────────────────────────────────────────────
export function A06Screen() {
  const c = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await post('/auth/forgot-password', { email: email.trim() });
      sessionStorage.setItem('fixngo.otpTarget', email.trim().toLowerCase());
      sessionStorage.setItem('fixngo.otpPurpose', 'Forgot');
      nav.go('A05');
    } catch (err) {
      setError(err.message || (isAr ? 'حدث خطأ.' : 'Could not send code.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${c.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back('A03')} />
      <form onSubmit={handleSubmit} className="p-5 flex-1 flex flex-col justify-between">
        <div className="space-y-4">
          <div>
            <h1 className={`text-xl font-bold ${c.text}`}>
              {isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
            </h1>
            <p className={`text-xs ${c.secondaryText}`}>
              {isAr ? 'دعنا نساعدك في استعادة حسابك.' : "Let's get you back into your account."}
            </p>
          </div>
          <div className={`p-4 rounded-2xl border ${c.border} ${c.surface} space-y-1.5`}>
            <KeyRound size={18} className="text-[#E51C23]" />
            <p className={`text-xs font-bold ${c.text}`}>
              {isAr ? 'بداية جديدة بأمان.' : 'A fresh start, securely.'}
            </p>
            <p className={`text-[11px] ${c.secondaryText}`}>
              {isAr
                ? 'أدخل بريدك الإلكتروني المسجل وسنرسل لك رمز تحقق لإعادة تعيين كلمة المرور.'
                : "Enter your registered email and we'll send a verification code."}
            </p>
          </div>
          <div className="space-y-1">
            <label className={`text-[11px] ${c.secondaryText}`}>
              {isAr ? 'البريد الإلكتروني' : 'Email address'}
            </label>
            <input
              data-testid="field-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full px-3.5 h-11 rounded-xl border ${c.border} ${c.inputBg} text-xs ${c.text}`}
              required
            />
          </div>
          {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
        </div>
        <PrimaryButton type="submit" disabled={busy} testId="screen-primary">
          {busy ? '…' : (isAr ? 'إرسال رمز التحقق' : 'Send Verification Code')}
        </PrimaryButton>
      </form>
    </div>
  );
}

// ─── A07: Set a new password (NO reset-token input field) ─────────────────────
export function A07Screen() {
  const c = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const hasMinLen = newPassword.length >= 8;
  const hasComplexity = /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) && /\d/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword);
  const matches = newPassword.length > 0 && newPassword === confirmPassword;

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setError('');
    if (!hasMinLen || !hasComplexity) {
      setError(isAr ? 'يرجى استيفاء شروط قوة كلمة المرور.' : 'Password does not meet security requirements.');
      return;
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      setError(isAr ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const resetToken = sessionStorage.getItem('fixngo.resetToken') || '';
      await post('/auth/reset-password', { resetToken, newPassword });
      sessionStorage.removeItem('fixngo.resetToken');
      nav.go('A13');
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر تحديث كلمة المرور.' : 'Could not update password.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${c.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back('A06')} />
      <form onSubmit={handleSubmit} className="p-5 flex-1 flex flex-col justify-between">
        <div className="space-y-3">
          <div>
            <h1 className={`text-xl font-bold ${c.text}`}>
              {isAr ? 'تعيين كلمة مرور جديدة' : 'Set a new password'}
            </h1>
            <p className={`text-xs ${c.secondaryText}`}>
              {isAr ? 'حافظ على أمان حسابك وبياناتك.' : 'Keep your account and roadside details safe.'}
            </p>
          </div>
          <div className="space-y-1">
            <label className={`text-[10px] ${c.secondaryText}`}>
              {isAr ? 'كلمة المرور الجديدة' : 'New password'}
            </label>
            <div className={`flex items-center justify-between px-3.5 h-10 rounded-xl border ${c.border} ${c.inputBg}`}>
              <input
                data-testid="field-newPassword"
                type={showPass ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`bg-transparent text-xs w-full focus:outline-none ${c.text}`}
                required
              />
              <button type="button" onClick={() => setShowPass((v) => !v)}>
                {showPass ? <Eye size={14} className={c.secondaryText} /> : <EyeOff size={14} className={c.secondaryText} />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className={`text-[10px] ${c.secondaryText}`}>
              {isAr ? 'تأكيد كلمة المرور الجديدة' : 'Confirm new password'}
            </label>
            <input
              data-testid="field-confirmPassword"
              type={showPass ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`w-full px-3.5 h-10 rounded-xl border ${c.border} ${c.inputBg} text-xs ${c.text}`}
              required
            />
          </div>
          <div className={`p-3.5 rounded-2xl border ${c.border} ${c.surface} space-y-1.5 text-[11px]`}>
            <p className={`font-bold ${c.text}`}>
              {isAr ? 'اجعل كلمة المرور قوية' : 'Make it a strong one'}
            </p>
            <p className={hasMinLen ? 'text-emerald-400 font-semibold' : c.secondaryText}>
              {hasMinLen ? '✓ ' : '• '}
              {isAr ? '٨ أحرف على الأقل' : 'At least 8 characters'}
            </p>
            <p className={hasComplexity ? 'text-emerald-400 font-semibold' : c.secondaryText}>
              {hasComplexity ? '✓ ' : '• '}
              {isAr ? 'حرف كبير وحرف صغير ورقم ورمز' : 'Uppercase, lowercase, number & symbol'}
            </p>
            <p className={matches ? 'text-emerald-400 font-semibold' : c.secondaryText}>
              {matches ? '✓ ' : '• '}
              {isAr ? 'تطابق كلمتي المرور' : 'Passwords match'}
            </p>
          </div>
          {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
        </div>
        <PrimaryButton type="submit" disabled={busy} testId="screen-primary">
          {busy ? '…' : (isAr ? 'إعادة تعيين كلمة المرور' : 'Reset Password')}
        </PrimaryButton>
      </form>
    </div>
  );
}

// ─── Shared Document Upload Tile for A08 / A09 / A10 ──────────────────────────
function KycDocUploadRow({ label, subtitle, docType, uploaded, onUploaded, c, isAr }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const existing = uploaded.find((d) => d.documentType === docType);
  const promptText = subtitle || (isAr ? 'اضغط للرفع' : 'Tap to upload');

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErr('');
    try {
      const dto = await uploadFile(file, 'kyc');
      onUploaded({ documentType: docType, fileId: dto.id, fileName: dto.fileName || file.name });
    } catch (error) {
      setErr(error.message || (isAr ? 'فشل رفع الملف' : 'Upload failed'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <label className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border ${existing ? 'border-emerald-500/40 bg-emerald-500/5' : `${c.border} ${c.elevated}`} cursor-pointer transition`}>
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-semibold ${c.text}`}>{label}</p>
        <p className={`text-[10px] truncate ${existing ? 'text-emerald-400 font-semibold' : c.secondaryText}`}>
          {uploading ? (isAr ? 'جارٍ الرفع…' : 'Uploading…') : existing ? existing.fileName : promptText}
        </p>
        {err && <p className="text-[10px] text-rose-500">{err}</p>}
      </div>
      <div className="shrink-0">
        {existing ? <CheckCircle2 size={16} className="text-emerald-400" aria-label="Uploaded" /> : <Upload size={15} className="text-[#E51C23]" />}
      </div>
      <input
        type="file"
        data-testid={`upload-${docType}`}
        accept=".jpg,.jpeg,.png,.webp,.pdf"
        className="sr-only"
        onChange={handleFile}
      />
    </label>
  );
}

// ─── A08: Join as a mechanic (Step 2/2) ───────────────────────────────────────
export function A08Screen() {
  const c = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const { user, loadMe } = useSession();
  const boot = useBootstrap();
  const submitKyc = useSubmitKyc();

  const [fullName, setFullName] = useState(user?.fullName || nav.flow?.signupName || '');
  const [phone, setPhone] = useState(user?.phone || nav.flow?.signupPhone || '');
  const [yearsExperience, setYearsExperience] = useState('');
  const [selectedServices, setSelectedServices] = useState([]);
  const [docs, setDocs] = useState([]);
  const [error, setError] = useState('');

  const rawServiceOptions = (boot.data?.serviceTypes || []).filter((s) => s.kind !== 'Tow');
  const serviceOptions = rawServiceOptions.length > 0
    ? [...rawServiceOptions, ...(rawServiceOptions.some((s) => s.key === 'other') ? [] : [{ id: '00000000-0000-0000-0000-000000000099', key: 'other', nameEn: 'Other', nameAr: 'أخرى' }])]
    : [
        { id: '00000000-0000-0000-0000-000000000001', key: 'mechanic', nameEn: 'Mobile diagnostics', nameAr: 'تشخيص الأعطال المتنقل' },
        { id: '00000000-0000-0000-0000-000000000002', key: 'battery', nameEn: 'Battery jump & tire change', nameAr: 'شحن البطارية وتغيير الإطارات' },
        { id: '00000000-0000-0000-0000-000000000003', key: 'fuel', nameEn: 'Fuel delivery', nameAr: 'توصيل الوقود' },
        { id: '00000000-0000-0000-0000-000000000099', key: 'other', nameEn: 'Other', nameAr: 'أخرى' }
      ];

  const toggleService = (id) => {
    setSelectedServices((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const addDoc = (doc) => {
    setDocs((prev) => [...prev.filter((d) => d.documentType !== doc.documentType), doc]);
  };

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setError('');
    if (!fullName.trim()) {
      setError(isAr ? 'يرجى إدخال الاسم الكامل.' : 'Please enter your full name.');
      return;
    }
    if (!phone.trim()) {
      setError(isAr ? 'يرجى إدخال رقم الهاتف.' : 'Please enter your phone number.');
      return;
    }
    const rawExp = String(yearsExperience).trim();
    const expNum = Number(rawExp);
    if (rawExp === '' || !Number.isInteger(expNum) || expNum < 0 || expNum > 60) {
      setError(isAr ? 'يرجى إدخال عدد صحيح لسنوات الخبرة (٠ أو أكثر).' : 'Please enter a valid integer for years of experience (0 or more).');
      return;
    }
    try {
      const validGuids = selectedServices.filter((id) => /^[0-9a-fA-F-]{36}$/.test(String(id)));
      await submitKyc.mutateAsync({
        applicantType: 'Mechanic',
        fullName: fullName.trim(),
        phone: phone.trim(),
        yearsExperience: expNum,
        services: validGuids,
        documents: docs.map(({ documentType, fileId }) => ({ documentType, fileId }))
      });
      await loadMe();
      nav.go('A11');
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر إرسال الطلب.' : 'Could not submit application.'));
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${c.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back('A04')} />
      <form onSubmit={handleSubmit} className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-3">
          <div>
            <h1 className={`text-xl font-bold ${c.text}`}>
              {isAr ? 'الانضمام كميكانيكي' : 'Join as a mechanic'}
            </h1>
            <p className={`text-xs ${c.secondaryText}`}>
              {isAr ? 'البيانات المهنية · خطوة ٢ من ٢' : 'Professional details · Step 2 of 2'}
            </p>
          </div>
          <div className="space-y-1">
            <label htmlFor="a08-fullName" className={`block text-[10px] ${c.secondaryText}`}>{isAr ? 'الاسم الكامل' : 'Full name'}</label>
            <input
              id="a08-fullName"
              data-testid="field-fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={isAr ? 'الاسم الكامل' : 'Your full name'}
              className={`w-full px-3 h-10 rounded-xl border ${c.border} ${c.inputBg} text-xs ${c.text}`}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label htmlFor="a08-phone" className={`block text-[10px] ${c.secondaryText}`}>{isAr ? 'رقم الهاتف' : 'Phone number'}</label>
              <input
                id="a08-phone"
                data-testid="field-phone"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`w-full px-3 h-10 rounded-xl border ${c.border} ${c.inputBg} text-xs ${c.text}`}
                required
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="a08-yearsExperience" className={`block text-[10px] ${c.secondaryText}`}>{isAr ? 'سنوات الخبرة' : 'Experience (years)'}</label>
              <input
                id="a08-yearsExperience"
                data-testid="field-yearsExperience"
                type="number"
                min={0}
                max={60}
                step={1}
                placeholder={isAr ? 'مثال: ٣' : 'e.g. 3'}
                value={yearsExperience}
                onChange={(e) => setYearsExperience(e.target.value)}
                className={`w-full px-3 h-10 rounded-xl border ${c.border} ${c.inputBg} text-xs ${c.text}`}
                required
              />
            </div>
          </div>

          <div className={`p-3 rounded-2xl border ${c.border} ${c.surface} space-y-2 text-xs`}>
            <p className={`font-bold ${c.text}`}>
              {isAr ? 'تخصصاتك' : 'Your expertise'}
            </p>
            <div className="flex flex-wrap gap-1.5" data-testid="mechanic-expertise-picker">
              {serviceOptions.map((s) => {
                const active = selectedServices.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={active}
                    data-testid={`expertise-chip-${s.key || s.id}`}
                    onClick={() => toggleService(s.id)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition inline-flex items-center gap-1 ${
                      active
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                        : `${c.border} ${c.secondaryText}`
                    }`}
                  >
                    {active && <CheckCircle2 size={11} className="shrink-0" />}
                    <span>{isAr ? s.nameAr : s.nameEn}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`p-3 rounded-2xl border ${c.border} ${c.surface} space-y-2 text-xs`}>
            <p className={`font-bold ${c.text}`}>
              {isAr ? 'المستندات المطلوبة' : 'Credentials'}
            </p>
            <KycDocUploadRow
              c={c}
              isAr={isAr}
              docType="NationalId"
              uploaded={docs}
              onUploaded={addDoc}
              label={isAr ? 'البطاقة الشخصية والشهادة المهنية' : 'National ID & professional certificate'}
              subtitle={isAr ? 'اضغط للرفع · JPG/PNG/PDF (≤10MB)' : 'Tap to upload · JPG/PNG/PDF (≤10MB)'}
            />
            <KycDocUploadRow
              c={c}
              isAr={isAr}
              docType="DrivingLicense"
              uploaded={docs}
              onUploaded={addDoc}
              label={isAr ? 'رخصة القيادة' : 'Driving license'}
              subtitle={isAr ? 'اضغط للرفع · صورة واضحة للوجه والخلف' : 'Tap to upload · Clear front & back photo'}
            />
          </div>
          {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
        </div>

        <PrimaryButton type="submit" disabled={submitKyc.isPending} testId="screen-primary">
          {submitKyc.isPending ? (isAr ? 'جارٍ الإرسال…' : 'Submitting…') : (isAr ? 'إرسال الطلب' : 'Submit Application')}
        </PrimaryButton>
      </form>
    </div>
  );
}

// ─── A09: Join as a tow captain (Step 2/2) ────────────────────────────────────
export function A09Screen() {
  const c = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const { user, loadMe } = useSession();
  const submitKyc = useSubmitKyc();

  const [fullName, setFullName] = useState(user?.fullName || nav.flow?.signupName || '');
  const [phone, setPhone] = useState(user?.phone || nav.flow?.signupPhone || '');
  const [truckMake, setTruckMake] = useState('');
  const [truckType, setTruckType] = useState('');
  const [capacityTonnes, setCapacityTonnes] = useState('');
  const [plate, setPlate] = useState('');
  const [docs, setDocs] = useState([]);
  const [error, setError] = useState('');

  const addDoc = (doc) => {
    setDocs((prev) => [...prev.filter((d) => d.documentType !== doc.documentType), doc]);
  };

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setError('');
    const capNum = Number(capacityTonnes);
    if (!fullName.trim() || !phone.trim()) {
      setError(isAr ? 'يرجى إدخال الاسم ورقم الهاتف.' : 'Please enter your name and phone number.');
      return;
    }
    if (!truckMake.trim() || !truckType) {
      setError(isAr ? 'يرجى إدخال ماركة ونوع الونش.' : 'Please enter truck make and select truck type.');
      return;
    }
    if (!capacityTonnes || !Number.isFinite(capNum) || capNum <= 0) {
      setError(isAr ? 'يرجى إدخال حمولة صحيحة بالطن.' : 'Please enter a valid truck capacity in tonnes.');
      return;
    }
    if (!plate.trim()) {
      setError(isAr ? 'يرجى إدخال رقم لوحة الونش.' : 'Please enter your truck plate.');
      return;
    }
    try {
      await submitKyc.mutateAsync({
        applicantType: 'TowCaptain',
        fullName: fullName.trim(),
        phone: phone.trim(),
        truckMake: truckMake.trim(),
        truckType,
        truckCapacityTonnes: capNum,
        truckPlate: plate.trim(),
        services: [],
        documents: docs.map(({ documentType, fileId }) => ({ documentType, fileId }))
      });
      await loadMe();
      nav.go('A11');
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر إرسال الطلب.' : 'Could not submit application.'));
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${c.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back('A04')} />
      <form onSubmit={handleSubmit} className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-3">
          <div>
            <h1 className={`text-xl font-bold ${c.text}`}>
              {isAr ? 'الانضمام ككابتن ونش' : 'Join as a tow captain'}
            </h1>
            <p className={`text-xs ${c.secondaryText}`}>
              {isAr ? 'بيانات الونش والمستندات · خطوة ٢ من ٢' : 'Your truck & credentials · Step 2 of 2'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label htmlFor="a09-fullName" className={`block text-[10px] ${c.secondaryText}`}>{isAr ? 'الاسم الكامل' : 'Full name'}</label>
              <input
                id="a09-fullName"
                data-testid="field-fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={`w-full px-3 h-10 rounded-xl border ${c.border} ${c.inputBg} text-xs ${c.text}`}
                required
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="a09-phone" className={`block text-[10px] ${c.secondaryText}`}>{isAr ? 'رقم الهاتف' : 'Phone number'}</label>
              <input
                id="a09-phone"
                data-testid="field-phone"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`w-full px-3 h-10 rounded-xl border ${c.border} ${c.inputBg} text-xs ${c.text}`}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label htmlFor="a09-truckMake" className={`block text-[10px] ${c.secondaryText}`}>{isAr ? 'ماركة الونش' : 'Truck make & model'}</label>
              <input
                id="a09-truckMake"
                data-testid="field-truckMake"
                value={truckMake}
                onChange={(e) => setTruckMake(e.target.value)}
                placeholder={isAr ? 'مثال: شفروليه جامبو' : 'Make & model'}
                className={`w-full px-3 h-10 rounded-xl border ${c.border} ${c.inputBg} text-xs ${c.text}`}
                required
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="a09-truckType" className={`block text-[10px] ${c.secondaryText}`}>{isAr ? 'نوع الونش' : 'Truck type'}</label>
              <select
                id="a09-truckType"
                data-testid="field-truckType"
                value={truckType}
                onChange={(e) => setTruckType(e.target.value)}
                className={`w-full px-3 h-10 rounded-xl border ${c.border} ${c.inputBg} text-xs ${c.text}`}
                required
              >
                <option value="">{isAr ? 'اختر نوع الونش...' : 'Select truck type...'}</option>
                <option value="Flatbed">{isAr ? 'ونش سطحة' : 'Flatbed'}</option>
                <option value="WheelLift">{isAr ? 'رفع العجلات' : 'Wheel-Lift'}</option>
                <option value="Hook">{isAr ? 'خطاف وسلسلة' : 'Hook & Chain'}</option>
                <option value="Carry">{isAr ? 'ونش حمّال' : 'Self-Loader / Carry'}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label htmlFor="a09-capacityTonnes" className={`block text-[10px] ${c.secondaryText}`}>{isAr ? 'الحمولة (طن)' : 'Capacity (tonnes)'}</label>
              <input
                id="a09-capacityTonnes"
                data-testid="field-capacityTonnes"
                type="number"
                step="0.5"
                min="0.5"
                max="50"
                placeholder="0.0"
                value={capacityTonnes}
                onChange={(e) => setCapacityTonnes(e.target.value)}
                className={`w-full px-3 h-10 rounded-xl border ${c.border} ${c.inputBg} text-xs ${c.text}`}
                required
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="a09-plate" className={`block text-[10px] ${c.secondaryText}`}>{isAr ? 'لوحة الونش' : 'Truck plate'}</label>
              <input
                id="a09-plate"
                data-testid="field-plate"
                dir="ltr"
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                className={`w-full px-3 h-10 rounded-xl border ${c.border} ${c.inputBg} text-xs ${c.text}`}
                required
              />
            </div>
          </div>

          <div className={`p-3 rounded-2xl border ${c.border} ${c.surface} space-y-2 text-xs`}>
            <p className={`font-bold ${c.text}`}>
              {isAr ? 'المستندات المطلوبة' : 'Required documents'}
            </p>
            <KycDocUploadRow
              c={c}
              isAr={isAr}
              docType="DrivingLicense"
              uploaded={docs}
              onUploaded={addDoc}
              label={isAr ? 'البطاقة ورخصة القيادة المهنية' : 'National ID & driving license'}
              subtitle={isAr ? 'اضغط للرفع · وجه وخلف الرخصة' : 'Tap to upload · Front & back photo'}
            />
            <KycDocUploadRow
              c={c}
              isAr={isAr}
              docType="TruckRegistration"
              uploaded={docs}
              onUploaded={addDoc}
              label={isAr ? 'رخصة تسيير الونش والتأمين' : 'Truck registration & insurance'}
              subtitle={isAr ? 'اضغط للرفع · رخصة التسيير السارية' : 'Tap to upload · Current registration'}
            />
          </div>
          {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
        </div>

        <PrimaryButton type="submit" disabled={submitKyc.isPending} testId="screen-primary">
          {submitKyc.isPending ? (isAr ? 'جارٍ الإرسال…' : 'Submitting…') : (isAr ? 'إرسال الطلب' : 'Submit Application')}
        </PrimaryButton>
      </form>
    </div>
  );
}

// ─── A10: Register your center (Step 2/2) ─────────────────────────────────────
export function A10Screen() {
  const c = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const { user, loadMe } = useSession();
  const submitKyc = useSubmitKyc();

  const CENTER_PINS = [
    { id: 'new_cairo', en: 'Fifth Settlement, New Cairo', ar: 'التجمع الخامس، القاهرة الجديدة', lat: 30.025, lng: 31.49 },
    { id: 'nasr_city', en: 'Abbas El-Akkad, Nasr City', ar: 'عباس العقاد، مدينة نصر', lat: 30.0561, lng: 31.3301 },
    { id: 'maadi', en: 'Autostrad Industrial Zone, Maadi', ar: 'المنطقة الصناعية بالأوتوستراد، المعادي', lat: 29.9602, lng: 31.2569 },
    { id: 'october', en: 'Central Axis, 6th of October', ar: 'المحور المركزي، ٦ أكتوبر', lat: 29.9723, lng: 30.9435 }
  ];

  const CENTER_SERVICE_CATALOG = [
    { id: '00000000-0000-0000-00c0-000000000001', key: 'oil_filter', en: 'Oil & filter change', ar: 'تغيير زيت وفلتر' },
    { id: '00000000-0000-0000-00c0-000000000002', key: 'brakes', en: 'Brake inspection & pads', ar: 'فحص وتغيير الفرامل' },
    { id: '00000000-0000-0000-00c0-000000000003', key: 'diagnostics', en: 'Full computer diagnostics', ar: 'فحص شامل بالكمبيوتر' },
    { id: '00000000-0000-0000-00c0-000000000004', key: 'ac', en: 'AC maintenance & recharge', ar: 'صيانة وشحن التكييف' },
    { id: '00000000-0000-0000-00c0-000000000005', key: 'tires', en: 'Tires & wheel alignment', ar: 'إطارات وضبط زوايا' },
    { id: '00000000-0000-0000-00c0-000000000006', key: 'periodic', en: 'Periodic maintenance', ar: 'صيانة دورية شاملة' }
  ];

  const [businessName, setBusinessName] = useState(nav.flow?.signupBusinessName || '');
  const [phone, setPhone] = useState(user?.phone || nav.flow?.signupPhone || '');
  const [address, setAddress] = useState('');
  const [pin, setPin] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [docs, setDocs] = useState([]);
  const [error, setError] = useState('');

  const toggleCenterService = (id) => {
    setSelectedServices((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectPin = (preset) => {
    setPin({ lat: preset.lat, lng: preset.lng });
    setAddress(isAr ? preset.ar : preset.en);
  };

  const addDoc = (doc) => {
    setDocs((prev) => [...prev.filter((d) => d.documentType !== doc.documentType), doc]);
  };

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setError('');
    if (!businessName.trim()) {
      setError(isAr ? 'يرجى إدخال اسم المركز.' : 'Please enter your business name.');
      return;
    }
    if (!phone.trim()) {
      setError(isAr ? 'يرجى إدخال هاتف المركز.' : 'Please enter your business phone.');
      return;
    }
    if (!address.trim()) {
      setError(isAr ? 'يرجى إدخال عنوان المركز أو تحديده على الخريطة.' : 'Please enter your center address or pick a map pin.');
      return;
    }
    try {
      await submitKyc.mutateAsync({
        applicantType: 'ServiceCenter',
        businessName: businessName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        latitude: pin?.lat ?? null,
        longitude: pin?.lng ?? null,
        services: selectedServices,
        documents: docs.map(({ documentType, fileId }) => ({ documentType, fileId }))
      });
      await loadMe();
      nav.go('A11');
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر إرسال الطلب.' : 'Could not submit application.'));
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${c.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back('A04')} />
      <form onSubmit={handleSubmit} className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-3">
          <div>
            <h1 className={`text-xl font-bold ${c.text}`}>
              {isAr ? 'تسجيل مركز الخدمة' : 'Register your center'}
            </h1>
            <p className={`text-xs ${c.secondaryText}`}>
              {isAr ? 'بيانات المركز · خطوة ٢ من ٢' : 'Business details · Step 2 of 2'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label htmlFor="a10-businessName" className={`block text-[10px] ${c.secondaryText}`}>{isAr ? 'اسم المركز' : 'Business name'}</label>
              <input
                id="a10-businessName"
                data-testid="field-businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder={isAr ? 'اسم المركز التجاري' : 'Center business name'}
                className={`w-full px-3 h-10 rounded-xl border ${c.border} ${c.inputBg} text-xs ${c.text}`}
                required
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="a10-phone" className={`block text-[10px] ${c.secondaryText}`}>{isAr ? 'هاتف المركز' : 'Business phone'}</label>
              <input
                id="a10-phone"
                data-testid="field-phone"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`w-full px-3 h-10 rounded-xl border ${c.border} ${c.inputBg} text-xs ${c.text}`}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="a10-address" className={`block text-[10px] ${c.secondaryText}`}>{isAr ? 'العنوان والموقع على الخريطة' : 'Address & map pin'}</label>
            <input
              id="a10-address"
              data-testid="field-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={isAr ? 'أدخل عنوان المركز أو اضغط على الخريطة' : 'Enter street address or tap the map'}
              className={`w-full px-3 h-10 rounded-xl border ${c.border} ${c.inputBg} text-xs ${c.text}`}
              required
            />
            <MapView
              height={165}
              interactive
              pin={pin}
              onPick={({ lat, lng }) => {
                setPin({ lat, lng });
                if (!address.trim()) setAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
              }}
              label={pin ? `${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}` : undefined}
              subtitle={address || undefined}
            />
            <div className="flex flex-wrap gap-1.5 pt-1" data-testid="center-pin-picker">
              {CENTER_PINS.map((preset) => {
                const isSelected = Boolean(pin && Math.abs(pin.lat - preset.lat) < 0.001 && Math.abs(pin.lng - preset.lng) < 0.001);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    data-testid={`pin-${preset.id}`}
                    onClick={() => selectPin(preset)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition ${
                      isSelected ? 'border-[#E51C23] bg-[#E51C23]/15 text-[#E51C23]' : `${c.border} ${c.secondaryText}`
                    }`}
                  >
                    📍 {isAr ? preset.ar : preset.en}
                  </button>
                );
              })}
            </div>
          </div>
          <div className={`p-3 rounded-2xl border ${c.border} ${c.surface} space-y-2 text-xs`}>
            <p className={`font-bold ${c.text}`}>
              {isAr ? 'الخدمات المقدمة (اختر خدمات المركز)' : 'Services offered (select all that apply)'}
            </p>
            <div className="flex flex-wrap gap-1.5" data-testid="center-services-picker">
              {CENTER_SERVICE_CATALOG.map((svc) => {
                const active = selectedServices.includes(svc.id);
                return (
                  <button
                    key={svc.key}
                    type="button"
                    aria-pressed={active}
                    data-testid={`center-service-${svc.key}`}
                    onClick={() => toggleCenterService(svc.id)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition inline-flex items-center gap-1 ${
                      active ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400' : `${c.border} ${c.secondaryText}`
                    }`}
                  >
                    {active && <CheckCircle2 size={11} className="shrink-0" />}
                    <span>{isAr ? svc.ar : svc.en}</span>
                  </button>
                );
              })}
            </div>
            <p className={`text-[10px] ${c.secondaryText}`}>
              {isAr
                ? 'ستُضاف الخدمات المختارة إلى قائمة خدماتك لتحديد الأسعار وتفعيلها.'
                : 'Selected services are added to your Service Catalog so you can set prices and activate them.'}
            </p>
          </div>
          <div className={`p-3 rounded-2xl border ${c.border} ${c.surface} space-y-2 text-xs`}>
            <p className={`font-bold ${c.text}`}>
              {isAr ? 'تراخيص المركز' : 'Business license & tax registration'}
            </p>
            <KycDocUploadRow
              c={c}
              isAr={isAr}
              docType="CommercialLicense"
              uploaded={docs}
              onUploaded={addDoc}
              label={isAr ? 'السجل التجاري والبطاقة الضريبية' : 'Commercial license & tax ID'}
              subtitle={isAr ? 'اضغط للرفع · المستندات الرسمية للتحقق' : 'Tap to upload · Required for verification'}
            />
            <KycDocUploadRow
              c={c}
              isAr={isAr}
              docType="CenterPhoto"
              uploaded={docs}
              onUploaded={addDoc}
              label={isAr ? 'صور المركز ومنصات الصيانة' : 'Center photos'}
              subtitle={isAr ? 'اضغط للرفع · واجهة المركز ومنصات العمل' : 'Tap to upload · Exterior and service bays'}
            />
          </div>
          {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
        </div>

        <PrimaryButton type="submit" disabled={submitKyc.isPending} testId="screen-primary">
          {submitKyc.isPending ? (isAr ? 'جارٍ الإرسال…' : 'Submitting…') : (isAr ? 'إرسال الطلب' : 'Submit Application')}
        </PrimaryButton>
      </form>
    </div>
  );
}

// ─── A11: Application status ──────────────────────────────────────────────────
export function A11Screen() {
  const c = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const { user } = useSession();
  const kycQuery = useKyc();

  const kyc = kycQuery.data;
  const status = kyc?.status || user?.kycStatus || 'Submitted';
  const code = kyc?.code || '—';
  const submittedDate = kyc?.submittedAt ? fmtDate(kyc.submittedAt, lang) : fmtDate(new Date().toISOString(), lang);
  const documents = kyc?.documents || [];

  return (
    <div className={`min-h-full flex flex-col ${c.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back('A04')} />
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-3">
          <div>
            <h1 className={`text-xl font-bold ${c.text}`}>
              {isAr ? 'حالة الطلب' : 'Application status'}
            </h1>
            <p className={`text-xs ${c.secondaryText}`}>
              {code} · {isAr ? `تم الإرسال ${submittedDate}` : `Submitted ${submittedDate}`}
            </p>
          </div>
          <div>
            <StatusBadge status={status} />
          </div>

          <div className={`p-3.5 rounded-2xl border ${c.border} ${c.surface} space-y-1.5 text-xs`}>
            <p className={`font-bold ${c.text}`}>
              {status === 'Approved'
                ? (isAr ? 'تم اعتماد حسابك' : 'Application approved')
                : status === 'ChangesNeeded'
                ? (isAr ? 'تحديث مطلوب للمستندات' : 'One update needed')
                : status === 'Rejected'
                ? (isAr ? 'تم رفض الطلب' : 'Application rejected')
                : (isAr ? 'طلبك قيد المراجعة' : 'Under verification review')}
            </p>
            <p className={c.secondaryText}>
              {kyc?.reviewerNote || (status === 'Approved'
                ? (isAr ? 'حسابك موثق الآن ويمكنك استقبال الطلبات.' : 'Your account is verified. You can now go online and accept requests.')
                : (isAr ? 'يقوم فريق التوثيق بمراجعة مستنداتك. يمكنك تحديث أو إضافة مستند في أي وقت.' : 'Our verification team is reviewing your credentials. You can upload or replace a document anytime.'))}
            </p>
          </div>

          <div className={`p-3.5 rounded-2xl border ${c.border} ${c.surface} space-y-2 text-xs`}>
            <p className={`font-bold ${c.text}`}>{isAr ? 'تحديثات الطلب' : 'Application updates'}</p>
            <div className="flex justify-between">
              <span className={c.secondaryText}>{isAr ? 'تاريخ التقديم' : 'Submitted'}</span>
              <span className={`font-semibold ${c.text}`}>{submittedDate}</span>
            </div>
            <div className="flex justify-between">
              <span className={c.secondaryText}>{isAr ? 'نوع الحساب' : 'Applicant type'}</span>
              <span className={`font-semibold ${c.text}`}>{providerLabel(kyc?.applicantType || user?.role || 'Provider', isAr)}</span>
            </div>
            <div className="flex justify-between">
              <span className={c.secondaryText}>{isAr ? 'المستندات المرفقة' : 'Documents attached'}</span>
              <span className={`font-semibold ${c.text}`}>{fmtNumber(documents.length, lang)}</span>
            </div>
          </div>

          {documents.length > 0 && (
            <div className="space-y-1.5">
              {documents.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => nav.go('SH17', { id: d.id, fileId: d.fileId, type: d.documentType })}
                  className={`w-full p-3 rounded-xl border ${c.border} ${c.surface} flex items-center justify-between text-xs`}
                >
                  <span className={`font-semibold ${c.text}`}>{providerLabel(d.documentType, isAr)}</span>
                  <StatusBadge status={d.status} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2 pt-2">
          {status === 'Approved' ? (
            <PrimaryButton onClick={() => nav.replace(homeForUser({ ...user, kycStatus: 'Approved' }))} testId="screen-primary">
              {isAr ? 'الدخول إلى لوحة التحكم' : 'Continue to Console'}
            </PrimaryButton>
          ) : (
            <PrimaryButton
              onClick={() => {
                nav.updateFlow({ replaceDocType: documents[0]?.documentType || 'DrivingLicense' });
                nav.go('SH18', { type: documents[0]?.documentType || 'DrivingLicense' });
              }}
              testId="screen-primary"
            >
              {isAr ? 'استبدال المستند وإعادة الإرسال' : 'Replace Document & Resubmit'}
            </PrimaryButton>
          )}
          <SecondaryButton onClick={() => nav.go('A03')}>
            {isAr ? 'العودة لتسجيل الدخول' : 'Back to Login'}
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}

// ─── A12: Find help near you (Location permission) ────────────────────────────
export function A12Screen() {
  const c = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const { loadMe } = useSession();
  const [busy, setBusy] = useState(false);

  async function handleAllow() {
    setBusy(true);
    try {
      await put('/auth/me', {
        latitude: 30.0444,
        longitude: 31.2357,
        areaLabel: isAr ? 'القاهرة الجديدة، القاهرة' : 'New Cairo, Cairo'
      });
      await loadMe();
    } catch { /* guest or offline fallback */ }
    finally {
      setBusy(false);
      nav.replace('C02');
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${c.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back('A04')} />
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-4 my-auto">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-[#E51C23]/15 text-[#E51C23] flex items-center justify-center mx-auto">
              <MapPin size={26} />
            </div>
            <h1 className={`text-lg font-bold ${c.text}`}>
              {isAr ? 'المساعدة المناسبة في المكان المناسب.' : 'The right help. The right place.'}
            </h1>
            <p className={`text-xs ${c.secondaryText}`}>
              {isAr
                ? 'استخدم موقعك الحالي للعثور على أقرب مقدمي الخدمة المعتمدين وتحديد نقطة الالتقاء بدقة.'
                : 'Use your current location to find nearby verified providers and set an accurate pickup pin.'}
            </p>
          </div>

          <div className={`p-3.5 rounded-2xl border ${c.border} ${c.surface} space-y-1.5 text-xs`}>
            <p className={`font-bold ${c.text}`}>{isAr ? 'أنت المتحكم' : "You're in control"}</p>
            <p className="text-emerald-400">{isAr ? '✓ يُشارك فقط مع مقدم الخدمة المعيّن لك' : '✓ Shared only with your assigned provider'}</p>
            <p className="text-emerald-400">{isAr ? '✓ يُستخدم أثناء طلب المساعدة النشط فقط' : '✓ Used during an active roadside request'}</p>
            <p className="text-emerald-400">{isAr ? '✓ يمكنك إدخال العنوان يدوياً بدلاً من ذلك' : '✓ You can enter an address instead'}</p>
          </div>
        </div>

        <div className="space-y-2">
          <PrimaryButton onClick={handleAllow} disabled={busy} testId="screen-primary">
            {isAr ? 'السماح بالوصول للموقع' : 'Allow Location Access'}
          </PrimaryButton>
          <SecondaryButton onClick={() => nav.go('C25')}>
            {isAr ? 'إدخال الموقع يدوياً' : 'Enter Location Manually'}
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}

// ─── A13: Password updated ────────────────────────────────────────────────────
export function A13Screen() {
  const c = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();

  return (
    <div className={`min-h-full flex flex-col ${c.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back('A03')} />
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div className="space-y-3 text-center my-auto">
          <Shield size={38} className="mx-auto text-emerald-400" />
          <h1 className={`text-lg font-bold ${c.text}`}>
            {isAr ? 'تم تحديث كلمة المرور بأمان.' : 'A fresh start, securely.'}
          </h1>
          <p className={`text-xs ${c.secondaryText}`}>
            {isAr
              ? 'تمت إعادة تعيين كلمة المرور بنجاح. سجل الدخول بكلمة المرور الجديدة للمتابعة.'
              : 'Your password was reset successfully. Sign in with your new password to continue.'}
          </p>
        </div>
        <PrimaryButton onClick={() => nav.go('A03')} testId="screen-primary">
          {isAr ? 'العودة لتسجيل الدخول' : 'Back to Login'}
        </PrimaryButton>
      </div>
    </div>
  );
}

export const AUTH_COMPONENTS = {
  A01: A01Screen,
  A02: A02Screen,
  A03: A03Screen,
  A04: A04Screen,
  A05: A05Screen,
  A06: A06Screen,
  A07: A07Screen,
  A08: A08Screen,
  A09: A09Screen,
  A10: A10Screen,
  A11: A11Screen,
  A12: A12Screen,
  A13: A13Screen
};
