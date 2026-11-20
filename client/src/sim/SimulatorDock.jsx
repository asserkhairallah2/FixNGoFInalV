// Phase 4 Simulator Dock — five live panels next to the phone frame.
// This is a developer tool backed by the real /api/v1/sim/* endpoints (functional providers,
// not mock data). It is only rendered when the server reports simulatorsEnabled = true.
import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell, CreditCard, MessageSquare, KeyRound, MapPin, Check,
  Copy, Navigation, Radio, WifiOff, Send, Clock, ChevronDown, ChevronUp
} from 'lucide-react';
import { get, post, put } from '../api/http.js';
import { on } from '../api/signalr.js';
import { useColors, formatLabel } from '../ui/kit.jsx';
import { usePrefs, useNav, useSession, resolveDeepLink } from '../app/stores.jsx';
import { fmtDateTime } from '../i18n/format.js';

const TABS = [
  { id: 'push', icon: Bell, en: 'Notifications', ar: 'الإشعارات' },
  { id: 'payments', icon: CreditCard, en: 'Payments', ar: 'المدفوعات' },
  { id: 'messages', icon: MessageSquare, en: 'SMS', ar: 'الرسائل' },
  { id: 'otps', icon: KeyRound, en: 'OTP', ar: 'الرموز' },
  { id: 'gps', icon: MapPin, en: 'GPS', ar: 'الموقع' }
];

const AR_NOTIF_TITLES = {
  'Account suspended': 'تم إيقاف الحساب',
  'Account restored': 'تمت استعادة الحساب',
  'Payment reviewed': 'تمت مراجعة الدفعة',
  'Withdrawal update': 'تحديث طلب السحب',
  'Session revoked': 'تم إلغاء الجلسة',
  'New booking': 'حجز جديد',
  'Booking confirmed': 'تم تأكيد الحجز',
  'Booking rejected': 'تم رفض الحجز',
  'Appointment started': 'بدأت الخدمة',
  'Appointment complete': 'اكتمل الموعد',
  'Booking rescheduled': 'تمت إعادة جدولة الحجز',
  'New message': 'رسالة جديدة',
  'New offer': 'عرض جديد',
  'Provider assigned': 'تم تعيين مقدم الخدمة',
  'Payment successful': 'تم الدفع بنجاح',
  'Payment failed': 'فشل الدفع',
  'Cash confirmed': 'تم تأكيد الدفع النقدي',
  'KYC Approved': 'تمت الموافقة على التوثيق',
  'KYC Rejected': 'تم رفض التوثيق',
  'KYC ChangesNeeded': 'مطلوب تعديل بيانات التوثيق',
  'New KYC application': 'طلب توثيق جديد',
  'Quote ready': 'المقايسة جاهزة',
  'Quote approved': 'تمت الموافقة على المقايسة',
  'Quote disputed': 'تم الاعتراض على المقايسة',
  'Request cancelled': 'تم إلغاء الطلب',
  'Request update': 'تحديث حالة الطلب',
  'Support reply': 'رد الدعم الفني',
  'SOS triggered': 'بلاغ طوارئ SOS',
  'Safety report': 'بلاغ أمان',
  'Safety outcome': 'نتيجة مراجعة بلاغ الأمان'
};

const AR_OTP_PURPOSE = {
  Signup: 'إنشاء حساب',
  Login: 'تسجيل دخول',
  ResetPassword: 'إعادة تعيين كلمة المرور',
  ContactChange: 'تغيير بيانات التواصل'
};

const SAMPLE_IBAN = 'EG380019000500000000263180002';

const DATETIME = (v, isAr = false) => fmtDateTime(v, isAr ? 'ar' : 'en');
const MONEY = (minor, ar) => new Intl.NumberFormat(ar ? 'ar-EG' : 'en-GB', {
  style: 'currency', currency: 'EGP', minimumFractionDigits: 2
}).format((minor ?? 0) / 100);

function localizeTitle(title, isAr) {
  if (!title) return '';
  if (!isAr) return title;
  return AR_NOTIF_TITLES[title] || title;
}

function formatBodyTimestamps(text, isAr) {
  if (!text) return '';
  return String(text).replace(
    /\b(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)Z\b/g,
    (_, datePart, timePart) => fmtDateTime(`${datePart}T${timePart}Z`, isAr ? 'ar' : 'en')
  );
}

function PanelShell({ children, c }) {
  return <div className={`flex-1 min-h-0 overflow-y-auto p-3 space-y-2 ${c.bg}`}>{children}</div>;
}

function Empty({ c, en, ar, isAr }) {
  return <div className={`rounded-xl border border-dashed ${c.border} p-6 text-center text-xs ${c.secondaryText}`}>{isAr ? ar : en}</div>;
}

function Row({ c, children, tone }) {
  return <div className={`rounded-xl border ${c.border} ${c.surface} p-2.5 text-xs ${tone === 'new' ? 'ring-1 ring-[#E51C23]' : ''}`}>{children}</div>;
}

function MiniBtn({ children, onClick, c, disabled, tone, className = '', testId }) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className={`px-2 py-1 rounded-lg text-[10px] font-semibold border inline-flex items-center justify-center gap-1 whitespace-nowrap shrink-0 ${c.border} ${tone === 'danger' ? 'text-rose-500' : tone === 'good' ? 'text-emerald-500' : c.text} ${c.elevated} disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

// ---- Panel 1: notifications / fake push ----
function PushPanel({ c, isAr }) {
  const qc = useQueryClient();
  const nav = useNav();
  const { user } = useSession();
  const [all, setAll] = useState(false);
  const { data = [], isLoading } = useQuery({
    queryKey: ['sim', 'push', all],
    queryFn: () => get(`/sim/push?all=${all}`),
    enabled: !!user,
    staleTime: 0,
    refetchInterval: 3000
  });
  const markAll = useMutation({
    mutationFn: () => post(`/sim/push/read-all?all=${all}`, {}),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['sim', 'push'] });
      qc.setQueriesData({ queryKey: ['sim', 'push'] }, (old) =>
        Array.isArray(old) ? old.map((p) => ({ ...p, isRead: true })) : old
      );
      qc.setQueryData(['notifications', 'unread'], { count: 0 });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sim', 'push'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    }
  });
  const markOne = useMutation({
    mutationFn: (id) => post(`/sim/push/${id}/read`, {}),
    onMutate: async (id) => {
      qc.setQueriesData({ queryKey: ['sim', 'push'] }, (old) =>
        Array.isArray(old) ? old.map((p) => (p.id === id ? { ...p, isRead: true } : p)) : old
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sim', 'push'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    }
  });
  const open = (p) => {
    if (!p.isRead) markOne.mutate(p.id);
    const link = p.deepLink || '';
    if (!link) return;
    const resolved = resolveDeepLink(link, user?.role);
    if (resolved?.code) nav.go(resolved.code, resolved.params);
  };
  return (
    <PanelShell c={c}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-bold ${c.secondaryText} truncate`}>
          {isAr ? 'إشعارات المستخدم' : 'USER NOTIFICATIONS'}
        </span>
        <div className="flex gap-1 shrink-0">
          <MiniBtn c={c} onClick={() => setAll((v) => !v)}>
            {all ? (isAr ? 'المستخدم الحالي' : 'Current user') : (isAr ? 'كل المستخدمين' : 'All users')}
          </MiniBtn>
          <MiniBtn c={c} testId="sim-push-read-all" disabled={!user} onClick={() => markAll.mutate()}>
            <Check size={11} /> {isAr ? 'قراءة الكل' : 'Read all'}
          </MiniBtn>
        </div>
      </div>
      {!user ? (
        <Empty c={c} isAr={isAr} en="Sign in to view user notifications." ar="سجّل الدخول لعرض الإشعارات." />
      ) : isLoading ? (
        <div className={`text-xs ${c.secondaryText}`}>…</div>
      ) : data.length === 0 ? (
        <Empty c={c} isAr={isAr} en="No notifications yet." ar="لا توجد إشعارات بعد." />
      ) : (
        data.map((p) => (
          <Row key={p.id} c={c} tone={p.isRead ? undefined : 'new'}>
            <button type="button" className="w-full text-start" onClick={() => open(p)} data-testid={`sim-push-${p.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  {!p.isRead && <span className="w-1.5 h-1.5 rounded-full bg-[#E51C23] shrink-0" />}
                  <span className={`font-bold truncate ${c.text}`}>{localizeTitle(p.title, isAr)}</span>
                </div>
                <span className={`text-[9px] whitespace-nowrap shrink-0 ${c.secondaryText}`}>
                  {DATETIME(p.createdAt, isAr)}
                </span>
              </div>
              <div className={`mt-1 break-words ${c.secondaryText}`}>{formatBodyTimestamps(p.body, isAr)}</div>
              {all && p.userName && <div className={`mt-1 text-[9px] ${c.secondaryText}`}>{p.userName}</div>}
            </button>
          </Row>
        ))
      )}
    </PanelShell>
  );
}

// ---- Panel 2: fake payment gateway ----
function PaymentPanel({ c, isAr }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState('charges');
  const [copiedIban, setCopiedIban] = useState(false);
  const { data: charges = [] } = useQuery({
    queryKey: ['sim', 'payments'],
    queryFn: () => get('/sim/payments'),
    staleTime: 0,
    refetchInterval: 4000
  });
  const { data: withdrawals = [] } = useQuery({
    queryKey: ['sim', 'withdrawals'],
    queryFn: () => get('/sim/withdrawals'),
    staleTime: 0,
    refetchInterval: 4000
  });
  const act = useMutation({
    mutationFn: ({ id, kind }) =>
      post(`/sim/${kind === 'wadvance' || kind === 'wfail' ? 'withdrawals' : 'payments'}/${id}/${kind.replace(/^w/, '').toLowerCase()}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sim', 'payments'] });
      qc.invalidateQueries({ queryKey: ['sim', 'withdrawals'] });
      qc.invalidateQueries({ queryKey: ['payments', 'withdrawals'] });
      qc.invalidateQueries({ queryKey: ['payments', 'wallet'] });
    }
  });
  const copySampleIban = () => {
    navigator.clipboard?.writeText(SAMPLE_IBAN).catch(() => {});
    setCopiedIban(true);
    setTimeout(() => setCopiedIban(false), 1500);
  };
  return (
    <PanelShell c={c}>
      <div className="flex gap-1">
        <MiniBtn c={c} testId="sim-pay-charges" tone={tab === 'charges' ? 'good' : undefined} onClick={() => setTab('charges')}>
          {isAr ? 'المدفوعات' : 'Charges'}
        </MiniBtn>
        <MiniBtn c={c} testId="sim-pay-bank" tone={tab === 'bank' ? 'good' : undefined} onClick={() => setTab('bank')}>
          {isAr ? 'البنك' : 'Bank'}
        </MiniBtn>
      </div>
      {tab === 'charges' ? (
        <>
          {charges.length === 0 ? (
            <Empty c={c} isAr={isAr} en="No gateway transactions." ar="لا توجد معاملات." />
          ) : (
            charges.map((p) => (
              <Row key={p.id} c={c}>
                <div className="flex justify-between items-center gap-2">
                  <span dir="ltr" className={`font-mono font-bold truncate ${c.text}`}>{p.reference}</span>
                  <span className={`text-[10px] font-bold shrink-0 ${p.status === 'Succeeded' ? 'text-emerald-500' : p.status === 'Failed' ? 'text-rose-500' : 'text-amber-500'}`}>
                    {formatLabel(p.status, isAr)}
                  </span>
                </div>
                <div className={`mt-1 ${c.secondaryText}`}>
                  {p.payer} · {formatLabel(p.method, isAr)} · {MONEY(p.amountMinor, isAr)}
                </div>
                <div className={`mt-0.5 text-[9px] ${c.secondaryText}`}>{DATETIME(p.createdAt, isAr)}</div>
                {p.reason && <div className="mt-1 text-rose-500">{p.reason}</div>}
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.requiresApproval && p.status === 'Pending' && (
                    <>
                      <MiniBtn c={c} tone="good" onClick={() => act.mutate({ id: p.id, kind: 'approve' })}>
                        {isAr ? 'موافقة' : 'Approve'}
                      </MiniBtn>
                      <MiniBtn c={c} tone="danger" onClick={() => act.mutate({ id: p.id, kind: 'decline' })}>
                        {isAr ? 'رفض' : 'Decline'}
                      </MiniBtn>
                    </>
                  )}
                  {p.status === 'Succeeded' && (
                    <MiniBtn c={c} onClick={() => act.mutate({ id: p.id, kind: 'refund' })}>
                      {isAr ? 'استرداد' : 'Refund'}
                    </MiniBtn>
                  )}
                </div>
              </Row>
            ))
          )}
          <div className={`rounded-xl border ${c.border} p-2.5 text-[10px] ${c.secondaryText} space-y-0.5`} data-testid="sim-test-cards">
            <div className={`font-bold ${c.text}`}>{isAr ? 'بطاقات الاختبار' : 'Test cards'}</div>
            <div dir="ltr">4242 4242 4242 4242 → OK</div>
            <div dir="ltr">4000 0000 0000 0002 → card_declined</div>
            <div dir="ltr">4000 0000 0000 9995 → insufficient_funds</div>
          </div>
        </>
      ) : (
        <>
          {withdrawals.length === 0 ? (
            <Empty c={c} isAr={isAr} en="No withdrawals." ar="لا توجد سحوبات." />
          ) : (
            withdrawals.map((w) => (
              <Row key={w.id} c={c}>
                <div className="flex justify-between items-center gap-2">
                  <span dir="ltr" className={`font-mono font-bold ${c.text}`}>{w.code}</span>
                  <span className="text-amber-500 text-[10px] font-bold">{formatLabel(w.status, isAr)}</span>
                </div>
                <div className={`mt-1 ${c.secondaryText}`}>{w.userName || w.userId} · {MONEY(w.netMinor, isAr)}</div>
                <div className={`mt-0.5 text-[9px] ${c.secondaryText}`}>{DATETIME(w.createdAt, isAr)}</div>
                <div className="mt-2 flex gap-1">
                  <MiniBtn c={c} tone="good" onClick={() => act.mutate({ id: w.id, kind: 'wadvance' })}>
                    {isAr ? 'تقديم المرحلة' : 'Advance'}
                  </MiniBtn>
                  <MiniBtn c={c} tone="danger" onClick={() => act.mutate({ id: w.id, kind: 'wfail' })}>
                    {isAr ? 'إفشال' : 'Fail'}
                  </MiniBtn>
                </div>
              </Row>
            ))
          )}
          <div className={`rounded-xl border ${c.border} p-2.5 text-[10px] ${c.secondaryText} space-y-1`} data-testid="sim-sample-iban">
            <div className="flex items-center justify-between gap-2">
              <span className={`font-bold ${c.text}`}>{isAr ? 'نموذج IBAN مصري صالح' : 'Sample IBAN'}</span>
              <MiniBtn c={c} onClick={copySampleIban}>
                <Copy size={10} /> {copiedIban ? (isAr ? 'تم النسخ' : 'Copied') : (isAr ? 'نسخ' : 'Copy')}
              </MiniBtn>
            </div>
            <div dir="ltr" className="font-mono break-all">{SAMPLE_IBAN}</div>
          </div>
        </>
      )}
    </PanelShell>
  );
}

// ---- Panel 3: SMS / email inbox ----
function MessagePanel({ c, isAr }) {
  const qc = useQueryClient();
  const [channel, setChannel] = useState('Sms');
  const { data = [] } = useQuery({
    queryKey: ['sim', 'messages', channel],
    queryFn: () => get(`/sim/messages?channel=${channel}`),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 2500
  });
  const markRead = useMutation({
    mutationFn: (id) => post(`/sim/messages/${id}/read`, {}),
    onMutate: async (id) => {
      qc.setQueriesData({ queryKey: ['sim', 'messages'] }, (old) =>
        Array.isArray(old) ? old.map((m) => (m.id === id ? { ...m, isRead: true } : m)) : old
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sim', 'messages'] })
  });
  return (
    <PanelShell c={c}>
      <div className="flex gap-1">
        <MiniBtn c={c} tone={channel === 'Sms' ? 'good' : undefined} onClick={() => setChannel('Sms')}>SMS</MiniBtn>
        <MiniBtn c={c} tone={channel === 'Email' ? 'good' : undefined} onClick={() => setChannel('Email')}>
          {isAr ? 'بريد إلكتروني' : 'Email'}
        </MiniBtn>
      </div>
      {data.length === 0 ? (
        <Empty c={c} isAr={isAr} en="Inbox is empty." ar="صندوق الوارد فارغ." />
      ) : (
        data.map((m) => (
          <Row key={m.id} c={c} tone={m.isRead ? undefined : 'new'}>
            <div className="flex justify-between items-start gap-2">
              <span className={`font-bold truncate ${c.text}`}>
                {m.recipientName || <span dir="ltr">{m.recipient}</span>}
              </span>
              <span className={`text-[9px] whitespace-nowrap shrink-0 ${c.secondaryText}`}>
                {DATETIME(m.createdAt, isAr)}
              </span>
            </div>
            <div dir="ltr" className={`mt-0.5 text-[10px] truncate ${c.secondaryText}`}>{m.recipient}</div>
            <div className="mt-1 break-words">{formatBodyTimestamps(m.body, isAr)}</div>
            <div className="mt-2 flex gap-1">
              <MiniBtn
                c={c}
                onClick={() => {
                  navigator.clipboard?.writeText(m.body || '');
                  if (!m.isRead) markRead.mutate(m.id);
                }}
              >
                <Copy size={10} /> {isAr ? 'نسخ' : 'Copy'}
              </MiniBtn>
            </div>
          </Row>
        ))
      )}
    </PanelShell>
  );
}

// ---- Panel 4: OTP codes with autofill ----
function OtpPanel({ c, isAr }) {
  const { data = [] } = useQuery({
    queryKey: ['sim', 'otps'],
    queryFn: () => get('/sim/otps'),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 2000
  });
  const autofill = (code) => window.dispatchEvent(new CustomEvent('fixngo:otp-autofill', { detail: code }));
  return (
    <PanelShell c={c}>
      {data.length === 0 ? (
        <Empty c={c} isAr={isAr} en="No active codes." ar="لا توجد رموز نشطة." />
      ) : (
        data.map((o) => (
          <Row key={o.id} c={c} tone={o.consumed || o.secondsRemaining <= 0 ? undefined : 'new'}>
            <div className="flex justify-between items-center gap-2">
              <span dir="ltr" className={`font-bold truncate ${c.text}`}>{o.target}</span>
              <span className={`text-[9px] shrink-0 ${c.secondaryText}`}>
                {isAr ? (AR_OTP_PURPOSE[o.purpose] || o.purpose) : o.purpose}
              </span>
            </div>
            <div dir="ltr" className={`mt-1 font-mono text-lg font-black tracking-[0.4em] ${o.consumed || o.secondsRemaining <= 0 ? c.secondaryText : 'text-[#E51C23]'}`}>
              {o.code}
            </div>
            <div className={`mt-1 flex items-center flex-wrap gap-1.5 text-[10px] ${c.secondaryText}`}>
              <Clock size={10} />
              <span dir="ltr">{o.secondsRemaining}s</span>
              <span>· {isAr ? 'محاولات' : 'attempts'} {o.attemptsLeft}</span>
              <span>· {isAr ? 'إعادة' : 'resends'} {o.resendCount}</span>
            </div>
            <div className="mt-2 flex gap-1">
              <MiniBtn c={c} onClick={() => navigator.clipboard?.writeText(o.code)}>
                <Copy size={10} /> {isAr ? 'نسخ' : 'Copy'}
              </MiniBtn>
              <MiniBtn
                c={c}
                tone="good"
                testId={`sim-otp-autofill-${o.id}`}
                disabled={o.consumed || o.secondsRemaining <= 0}
                onClick={() => autofill(o.code)}
              >
                <Send size={10} /> {isAr ? 'ملء تلقائي' : 'Autofill'}
              </MiniBtn>
            </div>
          </Row>
        ))
      )}
    </PanelShell>
  );
}

// ---- Panel 5: GPS / maps ----
const AREAS = [
  { en: 'New Cairo', ar: 'القاهرة الجديدة', lat: 30.025, lng: 31.49 },
  { en: 'Nasr City', ar: 'مدينة نصر', lat: 30.048, lng: 31.36 },
  { en: 'Maadi', ar: 'المعادي', lat: 29.96, lng: 31.26 },
  { en: 'Tahrir Square', ar: 'ميدان التحرير', lat: 30.0444, lng: 31.2357 }
];

function GpsPanel({ c, isAr }) {
  const qc = useQueryClient();
  const { user } = useSession();
  const [weak, setWeak] = useState(() => localStorage.getItem('fixngo.weakNetwork') === 'true');
  const { data = [] } = useQuery({
    queryKey: ['sim', 'gps'],
    queryFn: () => get('/sim/gps?all=true'),
    enabled: !!user,
    staleTime: 0,
    refetchInterval: 4000
  });
  const [lat, setLat] = useState('30.0444');
  const [lng, setLng] = useState('31.2357');
  const setGps = useMutation({
    mutationFn: (body) => put('/sim/gps', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sim', 'gps'] })
  });
  const drive = useMutation({
    mutationFn: (body) => post('/sim/gps/drive', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sim', 'gps'] })
  });
  const stale = useMutation({
    mutationFn: (body) => post('/sim/gps/stale', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sim', 'gps'] })
  });
  const toggleWeak = () => {
    const next = !weak;
    setWeak(next);
    localStorage.setItem('fixngo.weakNetwork', String(next));
    window.dispatchEvent(new CustomEvent('fixngo:weak-network', { detail: next }));
  };
  return (
    <PanelShell c={c}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-bold ${c.secondaryText} truncate`}>
          {isAr ? 'مواقع الأجهزة' : 'DEVICE LOCATIONS'}
        </span>
        <MiniBtn c={c} tone={weak ? 'danger' : undefined} onClick={toggleWeak} className="whitespace-nowrap">
          <WifiOff size={10} />
          <span className="whitespace-nowrap">{isAr ? 'شبكة ضعيفة' : 'Weak network'}</span>
        </MiniBtn>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {AREAS.map((a) => (
          <MiniBtn
            key={a.en}
            c={c}
            disabled={!user}
            onClick={() => {
              setLat(String(a.lat));
              setLng(String(a.lng));
              setGps.mutate({ latitude: a.lat, longitude: a.lng, areaLabel: isAr ? a.ar : a.en });
            }}
          >
            {isAr ? a.ar : a.en}
          </MiniBtn>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          aria-label="Latitude"
          dir="ltr"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          className={`flex-1 min-w-0 rounded-lg border ${c.border} ${c.inputBg} ${c.text} px-2.5 py-1.5 text-[11px] font-mono`}
        />
        <input
          aria-label="Longitude"
          dir="ltr"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          className={`flex-1 min-w-0 rounded-lg border ${c.border} ${c.inputBg} ${c.text} px-2.5 py-1.5 text-[11px] font-mono`}
        />
        <MiniBtn
          c={c}
          tone="good"
          disabled={!user}
          className="px-2.5 py-1.5"
          onClick={() => setGps.mutate({ latitude: Number(lat), longitude: Number(lng) })}
        >
          {isAr ? 'تطبيق' : 'Set'}
        </MiniBtn>
      </div>
      {!user ? (
        <Empty c={c} isAr={isAr} en="Sign in to inspect live GPS positions." ar="سجّل الدخول لعرض المواقع." />
      ) : data.length === 0 ? (
        <Empty c={c} isAr={isAr} en="No device positions." ar="لا توجد مواقع." />
      ) : (
        data.map((g) => (
          <Row key={g.userId} c={c}>
            <div className="flex justify-between items-center gap-2">
              <span className={`font-bold truncate ${c.text}`}>{g.fullName || g.userId}</span>
              <span className={`shrink-0 ${g.isOnline ? 'text-emerald-500' : c.secondaryText}`}>
                {g.isOnline ? (isAr ? 'متصل' : 'Online') : (isAr ? 'آخر ظهور' : 'Last seen')}
              </span>
            </div>
            <div dir="ltr" className={`mt-1 font-mono text-[10px] ${c.secondaryText}`}>
              {g.latitude?.toFixed(4)}, {g.longitude?.toFixed(4)}{g.areaLabel ? ` · ${g.areaLabel}` : ''}
            </div>
            {DATETIME(g.lastHeartbeatAt, isAr) !== '—' && (
              <div className={`text-[9px] ${c.secondaryText}`}>{DATETIME(g.lastHeartbeatAt, isAr)}</div>
            )}
            {g.isOnline && (
              <div className="mt-2 flex gap-1">
                <MiniBtn c={c} tone="good" onClick={() => drive.mutate({ providerId: g.userId, steps: 5, speedKmh: 30 })}>
                  <Navigation size={10} /> {isAr ? 'قيادة' : 'Drive'}
                </MiniBtn>
                <MiniBtn c={c} tone="danger" onClick={() => stale.mutate({ providerId: g.userId })}>
                  <Radio size={10} /> {isAr ? 'توقف' : 'Go stale'}
                </MiniBtn>
              </div>
            )}
          </Row>
        ))
      )}
    </PanelShell>
  );
}

export default function SimulatorDock({ notices = {} }) {
  const c = useColors();
  const { isAr } = usePrefs();
  const { user } = useSession();
  const qc = useQueryClient();
  const [tab, setTab] = useState('push');
  const [open, setOpen] = useState(false);

  const { data: pushes = [] } = useQuery({
    queryKey: ['sim', 'push', false],
    queryFn: () => get('/sim/push'),
    enabled: !!user,
    staleTime: 0,
    refetchInterval: 3000
  });
  const { data: messages = [] } = useQuery({
    queryKey: ['sim', 'messages', 'Sms'],
    queryFn: () => get('/sim/messages?channel=Sms'),
    staleTime: 0,
    refetchInterval: 2500
  });
  const { data: otps = [] } = useQuery({
    queryKey: ['sim', 'otps'],
    queryFn: () => get('/sim/otps'),
    staleTime: 0,
    refetchInterval: 2000
  });

  useEffect(() => {
    const refreshDock = () => {
      qc.invalidateQueries({ queryKey: ['sim', 'otps'] });
      qc.invalidateQueries({ queryKey: ['sim', 'messages'] });
      if (user) qc.invalidateQueries({ queryKey: ['sim', 'push'] });
    };
    const offs = ['notification', 'push', 'sim.event', 'notification.new'].map((evt) => on(evt, refreshDock));
    window.addEventListener('hashchange', refreshDock);
    return () => {
      offs.forEach((off) => off());
      window.removeEventListener('hashchange', refreshDock);
    };
  }, [qc, user]);

  const unread = {
    push: user ? pushes.filter((p) => !p.isRead).length : 0,
    messages: messages.filter((m) => !m.isRead).length,
    otps: otps.filter((o) => !o.consumed && o.secondsRemaining > 0).length
  };
  const badges = { ...unread, ...notices };
  const totalUnread = (badges.push ?? 0) + (badges.messages ?? 0) + (badges.otps ?? 0);
  const Active = { push: PushPanel, payments: PaymentPanel, messages: MessagePanel, otps: OtpPanel, gps: GpsPanel }[tab];
  return (
    <aside
      data-testid="simulator-dock"
      dir={isAr ? 'rtl' : 'ltr'}
      className={`fixed bottom-4 end-4 z-40 ${c.surface} border ${c.border} shadow-2xl flex flex-col overflow-hidden transition-all ${
        open ? 'w-[340px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-2rem)] rounded-2xl' : 'w-auto h-10 rounded-full'
      }`}
    >
      <button
        type="button"
        aria-label="Toggle dock"
        data-testid="sim-toggle"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center justify-between gap-2.5 px-3.5 h-10 shrink-0 ${open ? `border-b ${c.border} w-full` : ''}`}
      >
        <span className={`text-[11px] font-extrabold ${c.text} flex items-center gap-1.5`}>
          <Radio size={13} className="text-[#E51C23]" />
          <span>{isAr ? 'محاكاة الخدمات' : 'SIMULATOR'}</span>
          {!open && totalUnread > 0 && (
            <span className="min-w-[16px] h-[16px] px-1 rounded-full bg-[#E51C23] text-white text-[9px] font-bold grid place-items-center">
              {totalUnread}
            </span>
          )}
        </span>
        <span className={c.secondaryText}>
          {open ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </span>
      </button>
      {open && (
        <>
          <div className={`grid grid-cols-5 border-b ${c.border}`} role="tablist">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  data-testid={`sim-tab-${t.id}`}
                  onClick={() => setTab(t.id)}
                  title={isAr ? t.ar : t.en}
                  className={`relative py-2 flex flex-col items-center gap-0.5 text-[9px] font-bold ${tab === t.id ? 'text-[#E51C23]' : c.secondaryText}`}
                >
                  <Icon size={15} />
                  {!!badges[t.id] && (
                    <span
                      data-testid={`sim-badge-${t.id}`}
                      className="absolute top-0.5 end-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[#E51C23] text-white text-[8px] grid place-items-center"
                    >
                      {badges[t.id]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <Active c={c} isAr={isAr} />
        </>
      )}
    </aside>
  );
}
