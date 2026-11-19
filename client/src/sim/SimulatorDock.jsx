// Phase 4 Simulator Dock — five live panels next to the phone frame.
// This is a developer tool backed by the real /api/v1/sim/* endpoints (functional providers,
// not mock data). It is only rendered when the server reports simulatorsEnabled = true.
import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell, CreditCard, MessageSquare, KeyRound, MapPin, RefreshCw, Check, X,
  Copy, Navigation, Radio, WifiOff, Send, Clock, ChevronDown, ChevronUp
} from 'lucide-react';
import { get, post, put } from '../api/http.js';
import { useColors } from '../ui/kit.jsx';
import { usePrefs, useNav } from '../app/stores.jsx';

const TABS = [
  { id: 'push', icon: Bell, en: 'Notifications', ar: 'الإشعارات' },
  { id: 'payments', icon: CreditCard, en: 'Payments', ar: 'المدفوعات' },
  { id: 'messages', icon: MessageSquare, en: 'SMS', ar: 'الرسائل' },
  { id: 'otps', icon: KeyRound, en: 'OTP', ar: 'الرموز' },
  { id: 'gps', icon: MapPin, en: 'GPS', ar: 'الموقع' }
];

const TIME = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
const MONEY = (minor, ar) => new Intl.NumberFormat(ar ? 'ar-EG' : 'en-GB').format((minor || 0) / 100);

function PanelShell({ children, c }) {
  return <div className={`flex-1 min-h-0 overflow-y-auto p-3 space-y-2 ${c.bg}`}>{children}</div>;
}

function Empty({ c, en, ar, isAr }) {
  return <div className={`rounded-xl border border-dashed ${c.border} p-6 text-center text-xs ${c.secondaryText}`}>{isAr ? ar : en}</div>;
}

function Row({ c, children, tone }) {
  return <div className={`rounded-xl border ${c.border} ${c.surface} p-2.5 text-xs ${tone === 'new' ? 'ring-1 ring-[#E51C23]' : ''}`}>{children}</div>;
}

function MiniBtn({ children, onClick, c, disabled, tone }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`px-2 py-1 rounded-lg text-[10px] font-semibold border ${c.border} ${tone === 'danger' ? 'text-rose-500' : tone === 'good' ? 'text-emerald-500' : c.text} ${c.elevated} disabled:opacity-40`}>
      {children}
    </button>
  );
}

// ---- Panel 1: notifications / fake push ----
function PushPanel({ c, isAr }) {
  const qc = useQueryClient();
  const nav = useNav();
  const [all, setAll] = useState(false);
  const { data = [], isLoading } = useQuery({
    queryKey: ['sim', 'push', all], queryFn: () => get(`/sim/push?all=${all}`), refetchInterval: 4000
  });
  const markAll = useMutation({ mutationFn: () => post('/sim/push/read-all'), onSuccess: () => qc.invalidateQueries(['sim', 'push']) });
  const markOne = useMutation({ mutationFn: (id) => post(`/sim/push/${id}/read`), onSuccess: () => qc.invalidateQueries(['sim', 'push']) });
  const open = (p) => {
    if (!p.isRead) markOne.mutate(p.id);
    const link = p.deepLink || '';
    if (!link) return;
    const raw = link.replace(/^#\/?/, '');
    const [code, query = ''] = raw.split('?');
    if (code) nav.go(code, Object.fromEntries(new URLSearchParams(query)));
  };
  return (
    <PanelShell c={c}>
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-bold ${c.secondaryText}`}>{isAr ? 'إشعارات المستخدم' : 'USER NOTIFICATIONS'}</span>
        <div className="flex gap-1">
          <MiniBtn c={c} onClick={() => setAll((v) => !v)}>{all ? (isAr ? 'المستخدم الحالي' : 'Current user') : (isAr ? 'كل المستخدمين' : 'All users')}</MiniBtn>
          <MiniBtn c={c} onClick={() => markAll.mutate()}><Check size={11} /> {isAr ? 'قراءة الكل' : 'Read all'}</MiniBtn>
        </div>
      </div>
      {isLoading ? <div className={`text-xs ${c.secondaryText}`}>…</div> : data.length === 0
        ? <Empty c={c} isAr={isAr} en="No notifications yet." ar="لا توجد إشعارات بعد." />
        : data.map((p) => (
          <Row key={p.id} c={c} tone={p.isRead ? undefined : 'new'}>
            <button className="w-full text-start" onClick={() => open(p)} data-testid={`sim-push-${p.id}`}>
              <div className="flex items-center gap-2">
                {!p.isRead && <span className="w-1.5 h-1.5 rounded-full bg-[#E51C23] shrink-0" />}
                <span className={`font-bold flex-1 ${c.text}`}>{p.title}</span>
                <span className={`text-[9px] ${c.secondaryText}`}>{TIME(p.createdAt)}</span>
              </div>
              <div className={`mt-1 ${c.secondaryText}`}>{p.body}</div>
              {all && p.userName && <div className={`mt-1 text-[9px] ${c.secondaryText}`}>{p.userName}</div>}
            </button>
          </Row>
        ))}
    </PanelShell>
  );
}

// ---- Panel 2: fake payment gateway ----
function PaymentPanel({ c, isAr }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState('charges');
  const { data: charges = [] } = useQuery({ queryKey: ['sim', 'payments'], queryFn: () => get('/sim/payments'), refetchInterval: 5000 });
  const { data: withdrawals = [] } = useQuery({ queryKey: ['sim', 'withdrawals'], queryFn: () => get('/sim/withdrawals'), refetchInterval: 5000 });
  const act = useMutation({
    mutationFn: ({ id, kind }) => post(`/sim/${kind === 'wadvance' ? 'withdrawals' : 'payments'}/${id}/${kind.replace('w', '').toLowerCase()}`, {}),
    onSuccess: () => { qc.invalidateQueries(['sim', 'payments']); qc.invalidateQueries(['sim', 'withdrawals']); }
  });
  return (
    <PanelShell c={c}>
      <div className="flex gap-1">
        <MiniBtn c={c} tone={tab === 'charges' ? 'good' : undefined} onClick={() => setTab('charges')}>{isAr ? 'الشحنات' : 'Charges'}</MiniBtn>
        <MiniBtn c={c} tone={tab === 'bank' ? 'good' : undefined} onClick={() => setTab('bank')}>{isAr ? 'البنك' : 'Bank'}</MiniBtn>
      </div>
      {tab === 'charges' ? (
        charges.length === 0 ? <Empty c={c} isAr={isAr} en="No gateway transactions." ar="لا توجد معاملات." /> : charges.map((p) => (
          <Row key={p.id} c={c}>
            <div className="flex justify-between gap-2">
              <span className={`font-mono font-bold ${c.text}`}>{p.reference}</span>
              <span className={`text-[10px] font-bold ${p.status === 'Succeeded' ? 'text-emerald-500' : p.status === 'Failed' ? 'text-rose-500' : 'text-amber-500'}`}>{p.status}</span>
            </div>
            <div className={`mt-1 ${c.secondaryText}`}>{p.payer} · {p.method} · {MONEY(p.amountMinor, isAr)}</div>
            {p.reason && <div className="mt-1 text-rose-500">{p.reason}</div>}
            <div className="mt-2 flex flex-wrap gap-1">
              {p.requiresApproval && p.status === 'Pending' && <>
                <MiniBtn c={c} tone="good" onClick={() => act.mutate({ id: p.id, kind: 'approve' })}>{isAr ? 'موافقة' : 'Approve'}</MiniBtn>
                <MiniBtn c={c} tone="danger" onClick={() => act.mutate({ id: p.id, kind: 'decline' })}>{isAr ? 'رفض' : 'Decline'}</MiniBtn>
              </>}
              {p.status === 'Succeeded' && <MiniBtn c={c} onClick={() => act.mutate({ id: p.id, kind: 'refund' })}>{isAr ? 'استرداد' : 'Refund'}</MiniBtn>}
            </div>
          </Row>
        ))
      ) : (
        withdrawals.length === 0 ? <Empty c={c} isAr={isAr} en="No withdrawals." ar="لا توجد سحوبات." /> : withdrawals.map((w) => (
          <Row key={w.id} c={c}>
            <div className="flex justify-between"><span className={`font-mono font-bold ${c.text}`}>{w.code}</span><span className="text-amber-500">{w.status}</span></div>
            <div className={`mt-1 ${c.secondaryText}`}>{w.userName || w.userId} · {MONEY(w.netMinor, isAr)}</div>
            <div className="mt-2 flex gap-1">
              <MiniBtn c={c} tone="good" onClick={() => act.mutate({ id: w.id, kind: 'wadvance' })}>{isAr ? 'تقديم' : 'Advance'}</MiniBtn>
              <MiniBtn c={c} tone="danger" onClick={() => act.mutate({ id: w.id, kind: 'wfail' })}>{isAr ? 'فشل' : 'Fail'}</MiniBtn>
            </div>
          </Row>
        ))
      )}
      <div className={`rounded-xl border ${c.border} p-2 text-[10px] ${c.secondaryText}`}>
        <div className={`font-bold ${c.text}`}>{isAr ? 'بطاقات الاختبار' : 'Test cards'}</div>
        <div dir="ltr">4242 4242 4242 4242 → OK</div>
        <div dir="ltr">4000 0000 0000 0002 → card_declined</div>
        <div dir="ltr">4000 0000 0000 9995 → insufficient_funds</div>
      </div>
    </PanelShell>
  );
}

// ---- Panel 3: SMS / email inbox ----
function MessagePanel({ c, isAr }) {
  const [channel, setChannel] = useState('Sms');
  const { data = [] } = useQuery({ queryKey: ['sim', 'messages', channel], queryFn: () => get(`/sim/messages?channel=${channel}`), refetchInterval: 4000 });
  return (
    <PanelShell c={c}>
      <div className="flex gap-1">
        <MiniBtn c={c} tone={channel === 'Sms' ? 'good' : undefined} onClick={() => setChannel('Sms')}>SMS</MiniBtn>
        <MiniBtn c={c} tone={channel === 'Email' ? 'good' : undefined} onClick={() => setChannel('Email')}>{isAr ? 'بريد' : 'Email'}</MiniBtn>
      </div>
      {data.length === 0 ? <Empty c={c} isAr={isAr} en="Inbox is empty." ar="صندوق الوارد فارغ." /> : data.map((m) => (
        <Row key={m.id} c={c} tone={m.isRead ? undefined : 'new'}>
          <div className="flex justify-between gap-2">
            <span className={`font-bold ${c.text}`}>{m.recipientName || m.recipient}</span>
            <span className={`text-[9px] ${c.secondaryText}`}>{TIME(m.createdAt)}</span>
          </div>
          <div dir="ltr" className={`mt-1 text-[10px] ${c.secondaryText}`}>{m.recipient}</div>
          <div className="mt-1">{m.body}</div>
          <div className="mt-2 flex gap-1">
            <MiniBtn c={c} onClick={() => navigator.clipboard?.writeText(m.body || '')}><Copy size={10} /> {isAr ? 'نسخ' : 'Copy'}</MiniBtn>
          </div>
        </Row>
      ))}
    </PanelShell>
  );
}

// ---- Panel 4: OTP codes with autofill ----
function OtpPanel({ c, isAr }) {
  const { data = [] } = useQuery({ queryKey: ['sim', 'otps'], queryFn: () => get('/sim/otps'), refetchInterval: 3000 });
  const autofill = (code) => window.dispatchEvent(new CustomEvent('fixngo:otp-autofill', { detail: code }));
  return (
    <PanelShell c={c}>
      {data.length === 0 ? <Empty c={c} isAr={isAr} en="No active codes." ar="لا توجد رموز نشطة." /> : data.map((o) => (
        <Row key={o.id} c={c} tone={o.consumed || o.secondsRemaining <= 0 ? undefined : 'new'}>
          <div className="flex justify-between">
            <span className={`font-bold ${c.text}`}>{o.target}</span>
            <span className={`text-[9px] ${c.secondaryText}`}>{o.purpose}</span>
          </div>
          <div dir="ltr" className={`mt-1 font-mono text-lg font-black tracking-[0.4em] ${o.consumed || o.secondsRemaining <= 0 ? c.secondaryText : 'text-[#E51C23]'}`}>{o.code}</div>
          <div className={`mt-1 flex items-center gap-2 text-[10px] ${c.secondaryText}`}>
            <Clock size={10} /> {o.secondsRemaining}s · {isAr ? 'محاولات' : 'attempts'} {o.attemptsLeft} · {isAr ? 'إعادة' : 'resends'} {o.resendCount}
          </div>
          <div className="mt-2 flex gap-1">
            <MiniBtn c={c} onClick={() => navigator.clipboard?.writeText(o.code)}><Copy size={10} /> {isAr ? 'نسخ' : 'Copy'}</MiniBtn>
            <MiniBtn c={c} tone="good" disabled={o.consumed || o.secondsRemaining <= 0} onClick={() => autofill(o.code)}><Send size={10} /> {isAr ? 'ملء تلقائي' : 'Autofill'}</MiniBtn>
          </div>
        </Row>
      ))}
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
  const [weak, setWeak] = useState(() => localStorage.getItem('fixngo.weakNetwork') === 'true');
  const { data = [] } = useQuery({ queryKey: ['sim', 'gps'], queryFn: () => get('/sim/gps?all=true'), refetchInterval: 4000 });
  const [lat, setLat] = useState('30.0444'), [lng, setLng] = useState('31.2357');
  const setGps = useMutation({ mutationFn: (body) => put('/sim/gps', body), onSuccess: () => qc.invalidateQueries(['sim', 'gps']) });
  const drive = useMutation({ mutationFn: (body) => post('/sim/gps/drive', body) });
  const stale = useMutation({ mutationFn: (body) => post('/sim/gps/stale', body) });
  const providers = data.filter((g) => g.isOnline);
  const toggleWeak = () => {
    const next = !weak; setWeak(next); localStorage.setItem('fixngo.weakNetwork', String(next));
    window.dispatchEvent(new CustomEvent('fixngo:weak-network', { detail: next }));
  };
  return (
    <PanelShell c={c}>
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-bold ${c.secondaryText}`}>{isAr ? 'مواقع الأجهزة' : 'DEVICE LOCATIONS'}</span>
        <MiniBtn c={c} tone={weak ? 'danger' : undefined} onClick={toggleWeak}><WifiOff size={10} /> {isAr ? 'شبكة ضعيفة' : 'Weak network'}</MiniBtn>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {AREAS.map((a) => <MiniBtn key={a.en} c={c} onClick={() => { setLat(String(a.lat)); setLng(String(a.lng)); setGps.mutate({ latitude: a.lat, longitude: a.lng, areaLabel: isAr ? a.ar : a.en }); }}>{isAr ? a.ar : a.en}</MiniBtn>)}
      </div>
      <div className="flex gap-1">
        <input aria-label="Latitude" dir="ltr" value={lat} onChange={(e) => setLat(e.target.value)} className={`w-1/2 rounded-lg border ${c.border} ${c.inputBg} ${c.text} px-2 py-1 text-[10px]`} />
        <input aria-label="Longitude" dir="ltr" value={lng} onChange={(e) => setLng(e.target.value)} className={`w-1/2 rounded-lg border ${c.border} ${c.inputBg} ${c.text} px-2 py-1 text-[10px]`} />
        <MiniBtn c={c} tone="good" onClick={() => setGps.mutate({ latitude: Number(lat), longitude: Number(lng) })}>{isAr ? 'تطبيق' : 'Set'}</MiniBtn>
      </div>
      {data.length === 0 ? <Empty c={c} isAr={isAr} en="No device positions." ar="لا توجد مواقع." /> : data.map((g) => (
        <Row key={g.userId} c={c}>
          <div className="flex justify-between">
            <span className={`font-bold ${c.text}`}>{g.fullName || g.userId}</span>
            <span className={g.isOnline ? 'text-emerald-500' : c.secondaryText}>{g.isOnline ? (isAr ? 'متصل' : 'Online') : (isAr ? 'آخر ظهور' : 'Last seen')}</span>
          </div>
          <div dir="ltr" className={`mt-1 font-mono text-[10px] ${c.secondaryText}`}>{g.latitude?.toFixed(4)}, {g.longitude?.toFixed(4)} · {g.areaLabel || ''}</div>
          {TIME(g.lastHeartbeatAt) !== '—' && <div className={`text-[9px] ${c.secondaryText}`}>{TIME(g.lastHeartbeatAt)}</div>}
          {g.isOnline && <div className="mt-2 flex gap-1">
            <MiniBtn c={c} tone="good" onClick={() => drive.mutate({ providerId: g.userId, steps: 5, speedKmh: 30 })}><Navigation size={10} /> {isAr ? 'قيادة' : 'Drive'}</MiniBtn>
            <MiniBtn c={c} tone="danger" onClick={() => stale.mutate({ providerId: g.userId })}><Radio size={10} /> {isAr ? 'توقف' : 'Go stale'}</MiniBtn>
          </div>}
        </Row>
      ))}
    </PanelShell>
  );
}

export default function SimulatorDock({ notices = {} }) {
  const c = useColors(); const { isAr } = usePrefs();
  const [tab, setTab] = useState('push');
  const [open, setOpen] = useState(true);
  const { data: pushes = [] } = useQuery({ queryKey: ['sim', 'push', false], queryFn: () => get('/sim/push'), refetchInterval: 4000 });
  const { data: messages = [] } = useQuery({ queryKey: ['sim', 'messages', 'Sms'], queryFn: () => get('/sim/messages?channel=Sms'), refetchInterval: 4000 });
  const { data: otps = [] } = useQuery({ queryKey: ['sim', 'otps'], queryFn: () => get('/sim/otps'), refetchInterval: 3000 });
  const unread = {
    push: pushes.filter((p) => !p.isRead).length,
    messages: messages.filter((m) => !m.isRead).length,
    otps: otps.filter((o) => !o.consumed && o.secondsRemaining > 0).length
  };
  const badges = { ...unread, ...notices };
  const Active = { push: PushPanel, payments: PaymentPanel, messages: MessagePanel, otps: OtpPanel, gps: GpsPanel }[tab];
  return (
    <aside data-testid="simulator-dock" dir={isAr ? 'rtl' : 'ltr'}
      className={`${c.surface} border ${c.border} rounded-2xl shadow-xl w-full md:w-[340px] shrink-0 flex flex-col overflow-hidden ${open ? 'h-[420px] md:h-[720px]' : 'h-[52px]'}`}>
      <div className={`flex items-center justify-between px-3 py-2 border-b ${c.border}`}>
        <span className={`text-xs font-black ${c.text}`}>{isAr ? 'محاكاة الخدمات' : 'SIMULATOR DOCK'}</span>
        <button aria-label="Toggle dock" data-testid="sim-toggle" onClick={() => setOpen((v) => !v)} className={c.secondaryText}>
          {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>
      {open && <>
        <div className={`grid grid-cols-5 border-b ${c.border}`} role="tablist">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} role="tab" aria-selected={tab === t.id} data-testid={`sim-tab-${t.id}`}
                onClick={() => setTab(t.id)} title={isAr ? t.ar : t.en}
                className={`relative py-2 flex flex-col items-center gap-0.5 text-[9px] font-bold ${tab === t.id ? 'text-[#E51C23]' : c.secondaryText}`}>
                <Icon size={15} />
                {!!badges[t.id] && <span className="absolute top-0.5 end-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[#E51C23] text-white text-[8px] grid place-items-center">{badges[t.id]}</span>}
              </button>
            );
          })}
        </div>
        <Active c={c} isAr={isAr} />
      </>}
    </aside>
  );
}
