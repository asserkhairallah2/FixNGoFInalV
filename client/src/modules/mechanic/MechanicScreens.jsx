import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Wrench,
  Car,
  MapPin,
  Phone,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Check,
  MessageSquare,
  Navigation,
  Shield
} from 'lucide-react';
import { usePrefs, useNav, useSession } from '../../app/stores.jsx';
import { post, put, fileUrl } from '../../api/http.js';
import {
  useBootstrap,
  useProvider,
  useKyc,
  useProviderHistory,
  useGoOnline,
  useHeartbeat,
  useOffers,
  useAcceptOffer,
  useDeclineOffer,
  useRequests,
  useRequest,
  useTimeline,
  useQuotes,
  useAdvanceStatus,
  useEarnings,
  useWallet,
  useInvoiceForRequest,
  k
} from '../../api/hooks.js';
import {
  useColors,
  AppTopBar,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  MapView,
  EmergencySOSBar,
  Toast,
  formatLabel
} from '../../ui/kit.jsx';
import { providerLabel, plural, pluralCount } from '../auth/providerLabels.js';
import {
  fmtMoney,
  fmtNumber,
  fmtDate,
  fmtTime,
  fmtDateTime,
  fmtDistance
} from '../../i18n/format.js';

export const MECHANIC_MAIN_SCREENS = ['M01', 'M02', 'M07', 'M08', 'M09', 'M10'];

function MechanicShell({ code, children }) {
  const colors = useColors();
  const nav = useNav();
  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar
        showBack={!['M01', 'M02', 'M07', 'M08', 'M09', 'M10'].includes(code)}
        onBack={() => nav.back()}
      />
      <div className="p-4 space-y-3.5 flex-1">{children}</div>
    </div>
  );
}

function AvatarBadge({ name, tone = 'red' }) {
  const initials = String(name || 'M')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase();
  const cls =
    tone === 'emerald'
      ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
      : 'bg-[#E51C23]/15 text-[#E51C23] border-[#E51C23]/30';
  return (
    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-extrabold text-xs shrink-0 ${cls}`}>
      {initials || <Wrench size={16} />}
    </div>
  );
}

function getFullName(user, provider, isAr) {
  return provider?.fullName || user?.fullName || (isAr ? 'ميكانيكي معتمد' : 'Verified Mechanic');
}

function getFirstName(user, provider, isAr) {
  const full = getFullName(user, provider, isAr);
  return String(full).trim().split(/\s+/)[0] || (isAr ? 'ميكانيكي' : 'Mechanic');
}

function getArea(provider, user, isAr) {
  return provider?.coverageArea || user?.areaLabel || (isAr ? 'القاهرة' : 'Cairo');
}

function getServiceLabel(item, isAr) {
  if (!item) return isAr ? 'إصلاح على الطريق' : 'Roadside Repair';
  const raw = item.serviceName || item.service || item.serviceType || item.problem || item.kind || 'mechanic';
  return providerLabel(raw, isAr);
}

function getCustomerName(req, isAr) {
  return (
    req?.customerName ||
    req?.customerFullName ||
    req?.customer?.fullName ||
    req?.customerFirstName ||
    (isAr ? 'العميل' : 'Customer')
  );
}

function getVehicleSummary(req, isAr) {
  const make = req?.vehicleMake || req?.vehicle?.make || '';
  const model = req?.vehicleModel || req?.vehicle?.model || '';
  const year = req?.vehicleYear || req?.vehicle?.year || '';
  const color = req?.vehicleColor || req?.vehicle?.color || '';
  const base = [make, model].filter(Boolean).join(' ').trim();
  if (!base) return getServiceLabel(req, isAr);
  const meta = [year, color].filter(Boolean).join(' · ');
  return meta ? `${base} (${meta})` : base;
}

function getVehiclePlate(req) {
  return req?.vehiclePlate || req?.vehicle?.plate || '—';
}

function screenForRequestStatus(status) {
  switch (status) {
    case 'Accepted':
      return 'M04';
    case 'EnRoute':
      return 'M05';
    case 'Arrived':
    case 'QuotePending':
    case 'Disputed':
      return 'M11';
    case 'QuoteApproved':
    case 'Working':
      return 'M06';
    case 'AwaitingPayment':
      return 'M12';
    case 'Completed':
    case 'Cancelled':
      return 'M13';
    default:
      return 'M04';
  }
}

function useActiveRequest(id) {
  const single = useRequest(id);
  const list = useRequests();
  const all = Array.isArray(list.data) ? list.data : list.data?.items || [];
  const active = useMemo(() => {
    if (id && single.data) return single.data;
    if (id) {
      const match = all.find((r) => String(r.id) === String(id));
      if (match) return match;
    }
    return (
      all.find((r) => !['Completed', 'Cancelled', 'NoProviders'].includes(r.status)) ||
      all[0] ||
      null
    );
  }, [id, single.data, all]);
  return { req: active, isLoading: single.isLoading && list.isLoading, refetch: () => { single.refetch(); list.refetch(); } };
}

async function advanceRequestChain(reqId, currentStatus, targetStatus) {
  if (!reqId || currentStatus === targetStatus) return;
  const chains = {
    EnRoute: {
      Accepted: ['EnRoute']
    },
    Arrived: {
      Accepted: ['EnRoute', 'Arrived'],
      EnRoute: ['Arrived']
    },
    Working: {
      Accepted: ['EnRoute', 'Arrived', 'Working'],
      EnRoute: ['Arrived', 'Working'],
      Arrived: ['Working'],
      QuotePending: ['QuoteApproved', 'Working'],
      QuoteApproved: ['Working']
    },
    AwaitingPayment: {
      Accepted: ['EnRoute', 'Arrived', 'Working', 'AwaitingPayment'],
      EnRoute: ['Arrived', 'Working', 'AwaitingPayment'],
      Arrived: ['Working', 'AwaitingPayment'],
      QuotePending: ['QuoteApproved', 'Working', 'AwaitingPayment'],
      QuoteApproved: ['Working', 'AwaitingPayment'],
      Working: ['AwaitingPayment']
    },
    Completed: {
      Accepted: ['EnRoute', 'Arrived', 'Working', 'AwaitingPayment', 'Completed'],
      EnRoute: ['Arrived', 'Working', 'AwaitingPayment', 'Completed'],
      Arrived: ['Working', 'AwaitingPayment', 'Completed'],
      QuotePending: ['QuoteApproved', 'Working', 'AwaitingPayment', 'Completed'],
      QuoteApproved: ['Working', 'AwaitingPayment', 'Completed'],
      Working: ['AwaitingPayment', 'Completed'],
      AwaitingPayment: ['Completed']
    }
  };
  const steps = chains[targetStatus]?.[currentStatus] || [targetStatus];
  for (const step of steps) {
    try {
      await post(`/requests/${reqId}/status`, { status: step });
    } catch {
      // Ignore intermediate transition error if already past this state
    }
  }
}

// ==========================================
// M01: Mechanic console (Offline)
// ==========================================
export function M01Screen() {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const { user } = useSession();
  const { data: provider } = useProvider();
  const { data: requestsData } = useRequests();
  const { data: earnings } = useEarnings();
  const goOnline = useGoOnline();
  const [error, setError] = useState('');

  const firstName = getFirstName(user, provider, isAr);
  const area = getArea(provider, user, isAr);
  const requests = Array.isArray(requestsData) ? requestsData : requestsData?.items || [];
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayJobs = requests.filter((r) => String(r.createdAt || '').slice(0, 10) === todayStr).length;
  const rating = Number(provider?.rating ?? earnings?.rating ?? 0).toFixed(1);
  const todayEarningsMinor = earnings?.availableMinor ?? 0;

  if (provider?.isOnline) {
    return <M02Screen />;
  }

  const handleGoOnline = async () => {
    setError('');
    try {
      await goOnline.mutateAsync({
        isOnline: true,
        latitude: provider?.latitude ?? 30.0444,
        longitude: provider?.longitude ?? 31.2357
      });
      nav.go('M02');
    } catch (err) {
      setError(err?.message || (isAr ? 'يجب اعتماد التوثيق قبل الاتصال.' : 'Verification approval is required before going online.'));
    }
  };

  return (
    <MechanicShell code="M01">
      <div>
        <h1 className={`text-lg font-extrabold ${colors.text}`}>
          {isAr ? 'لوحة الميكانيكي' : 'Mechanic console'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {isAr
            ? `أهلاً يا ${firstName}. جاهز عندما تكون مستعداً.`
            : `Hello, ${firstName}. Ready when you are.`}
        </p>
      </div>

      <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} flex items-center justify-between`}>
        <div>
          <p className={`text-xs font-bold ${colors.text}`}>
            {isAr ? 'التغطية متوقفة' : 'Coverage OFF'}
          </p>
          <p className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'أنت لا تستقبل طلبات جديدة حالياً.' : "You're not receiving new requests."}
          </p>
        </div>
        <button
          type="button"
          onClick={handleGoOnline}
          disabled={goOnline.isPending}
          aria-label={isAr ? 'الاتصال الآن' : 'Go Online'}
          className="w-10 h-5 rounded-full bg-slate-300 p-0.5 flex items-center justify-start"
        >
          <span className="w-4 h-4 rounded-full bg-white shadow" />
        </button>
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-500">
          {error}
        </div>
      )}

      {(provider?.kycStatus || user?.kycStatus) && (provider?.kycStatus || user?.kycStatus) !== 'Approved' && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-amber-600 dark:text-amber-400">
              {isAr ? 'بانتظار اعتماد التوثيق' : 'Verification required to go online'}
            </span>
            <StatusBadge status={provider?.kycStatus || user?.kycStatus} />
          </div>
          <p className={`text-[11px] ${colors.secondaryText}`}>
            {isAr
              ? 'يجب اعتماد حسابك من الإدارة قبل استقبال طلبات الإصلاح الحية.'
              : 'Admin verification approval is required before receiving live roadside requests.'}
          </p>
          <button
            type="button"
            onClick={() => nav.go('A11')}
            className="text-[11px] font-bold text-[#E51C23] underline"
          >
            {isAr ? 'مراجعة حالة التوثيق ←' : 'Check verification status →'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
          <p className={`text-sm font-extrabold ${colors.text}`}>{fmtNumber(todayJobs, lang)}</p>
          <p className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'مهام اليوم' : "Today's jobs"}
          </p>
        </div>
        <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
          <p className={`text-sm font-extrabold ${colors.text}`}>{rating}</p>
          <p className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'التقييم' : 'Rating'}
          </p>
        </div>
        <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
          <p className={`text-sm font-extrabold ${colors.text}`}>{fmtMoney(todayEarningsMinor, lang)}</p>
          <p className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'الرصيد' : 'Balance'}
          </p>
        </div>
      </div>

      <MapView
        label={isAr ? `منطقة تغطية ${area}` : `${area} coverage zone`}
        subtitle={isAr ? 'غير متصل' : 'Offline'}
      />

      <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1`}>
        <p className={`text-xs font-bold ${colors.text}`}>
          {isAr ? 'اعمل بشروطك الخاصة' : 'Take the road on your terms'}
        </p>
        <p className={`text-[11px] ${colors.secondaryText}`}>
          {isAr
            ? 'اتصل الآن لرؤية طلبات الإصلاح القريبة والأرباح الواضحة قبل القبول.'
            : 'Go online to see nearby repair requests and clear earnings before you accept.'}
        </p>
      </div>

      <PrimaryButton onClick={handleGoOnline} disabled={goOnline.isPending} testId="screen-primary">
        {isAr ? 'الاتصال الآن (متاح)' : 'Go Online'}
      </PrimaryButton>
    </MechanicShell>
  );
}

// ==========================================
// M02: Mechanic console (Online)
// ==========================================
export function M02Screen() {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const { user } = useSession();
  const { data: provider } = useProvider();
  const { data: offersData } = useOffers();
  const { data: requestsData } = useRequests();
  const { data: earnings } = useEarnings();
  const goOnline = useGoOnline();
  const heartbeat = useHeartbeat();
  const [, setTick] = useState(0);

  useEffect(() => {
    const tickTimer = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(tickTimer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      heartbeat.mutate({
        latitude: provider?.latitude ?? 30.0444,
        longitude: provider?.longitude ?? 31.2357
      });
    }, 15_000);
    return () => clearInterval(timer);
  }, [provider?.latitude, provider?.longitude]);

  const fullName = getFullName(user, provider, isAr);
  const area = getArea(provider, user, isAr);
  const radius = provider?.coverageRadiusKm ?? 15;
  const offers = Array.isArray(offersData) ? offersData : offersData?.items || [];
  const requests = Array.isArray(requestsData) ? requestsData : requestsData?.items || [];
  const pendingOffers = offers.filter((o) => !o.status || o.status === 'Pending');
  const liveOffer = pendingOffers[0] || offers[0] || null;
  const extraOffers = pendingOffers.slice(1, 5);
  const activeJob =
    requests.find(
      (r) =>
        r.assignedProviderId &&
        String(r.assignedProviderId) === String(user?.id) &&
        !['Completed', 'Cancelled', 'NoProviders', 'Searching', 'Offered'].includes(String(r.status))
    ) || null;

  const completedJobs = earnings?.completedJobs ?? provider?.completedJobs ?? 0;
  const rating = Number(provider?.rating ?? earnings?.rating ?? 0).toFixed(1);
  const availableMinor = earnings?.availableMinor ?? 0;

  const handleGoOffline = async () => {
    try {
      await goOnline.mutateAsync({
        isOnline: false,
        latitude: provider?.latitude ?? 30.0444,
        longitude: provider?.longitude ?? 31.2357
      });
    } catch {
      // Allow navigation even if request fails
    }
    nav.go('M01');
  };

  const remainingLabel = (() => {
    if (!liveOffer?.expiresAt) return '05:00';
    const diff = Math.max(0, Math.round((new Date(liveOffer.expiresAt).getTime() - Date.now()) / 1000));
    const capped = Math.min(diff, 600);
    const mins = String(Math.floor(capped / 60)).padStart(2, '0');
    const secs = String(capped % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  })();

  return (
    <MechanicShell code="M02">
      <div>
        <h1 className={`text-lg font-extrabold ${colors.text}`}>
          {isAr ? 'لوحة الميكانيكي' : 'Mechanic console'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {`${fullName} · ${area}`}
        </p>
      </div>

      <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} flex items-center justify-between`}>
        <div className="space-y-1">
          <p className={`text-xs font-bold ${colors.text}`}>
            {isAr ? 'التغطية مفعلة' : 'Coverage ON'}
          </p>
          <StatusBadge status="Online" text={isAr ? 'متصل · يستقبل الطلبات' : 'Online · Receiving jobs'} />
        </div>
        <button
          type="button"
          onClick={handleGoOffline}
          disabled={goOnline.isPending}
          aria-label={isAr ? 'إيقاف الاتصال' : 'Go Offline'}
          className="w-10 h-5 rounded-full bg-emerald-500 p-0.5 flex items-center justify-end"
        >
          <span className="w-4 h-4 rounded-full bg-white shadow" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
          <p className={`text-sm font-extrabold ${colors.text}`}>{fmtNumber(completedJobs, lang)}</p>
          <p className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'مهام مكتملة' : 'Completed jobs'}
          </p>
        </div>
        <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
          <p className={`text-sm font-extrabold ${colors.text}`}>{rating}</p>
          <p className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'التقييم' : 'Rating'}
          </p>
        </div>
        <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
          <p className={`text-sm font-extrabold ${colors.text}`}>{fmtMoney(availableMinor, lang)}</p>
          <p className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'الرصيد' : 'Balance'}
          </p>
        </div>
      </div>

      {liveOffer && (
        <div
          role="button"
          tabIndex={0}
          data-testid="live-offer-card"
          onClick={() => nav.go('M03', { id: liveOffer.id })}
          className="p-3.5 rounded-2xl bg-[#E51C23] text-white space-y-1.5 cursor-pointer shadow-md"
        >
          <div className="flex justify-between text-[10px] opacity-90 font-semibold">
            <span>{`${isAr ? 'طلب قريب جديد' : 'New nearby request'}${liveOffer.requestCode ? ` · ${liveOffer.requestCode}` : ''}`}</span>
            <span dir="ltr">{remainingLabel}</span>
          </div>
          <p className="text-xs font-extrabold">
            {`${getServiceLabel(liveOffer, isAr)}${liveOffer.customerFirstName ? ` · ${liveOffer.customerFirstName}` : ''}`}
          </p>
          <p className="text-[11px] opacity-90">
            {`${liveOffer.pickupArea || area} · ${fmtDistance(liveOffer.distanceKm, lang)} · ${liveOffer.etaMinutes ?? 6} ${isAr ? 'دقائق' : 'min away'}`}
          </p>
          <div className="flex justify-between pt-1 border-t border-white/20 text-xs font-bold">
            <span>{isAr ? 'أرباحك المقدرة' : 'Your estimated earnings'}</span>
            <span>{`${fmtMoney(liveOffer.priceMinor, lang)} →`}</span>
          </div>
        </div>
      )}

      {extraOffers.length > 0 && (
        <div className="space-y-1.5">
          <p className={`text-[11px] font-bold ${colors.secondaryText}`}>
            {isAr ? `طلبات أخرى متاحة (${extraOffers.length})` : `More open requests nearby (${extraOffers.length})`}
          </p>
          {extraOffers.map((item) => (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => nav.go('M03', { id: item.id })}
              className={`p-3 rounded-2xl border border-[#E51C23]/30 ${colors.surface} flex items-center justify-between cursor-pointer text-xs`}
            >
              <div>
                <p className={`font-bold ${colors.text}`}>
                  {`${getServiceLabel(item, isAr)}${item.requestCode ? ` · ${item.requestCode}` : ''}`}
                </p>
                <p className={`text-[11px] ${colors.secondaryText}`}>
                  {`${item.pickupArea || area} · ${fmtDistance(item.distanceKm, lang)}`}
                </p>
              </div>
              <span className="font-extrabold text-[#E51C23] shrink-0">
                {`${fmtMoney(item.priceMinor, lang)} →`}
              </span>
            </div>
          ))}
        </div>
      )}

      {!liveOffer && !activeJob && (
        <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} flex items-center justify-between text-xs`}>
          <div>
            <p className={`font-bold ${colors.text}`}>
              {isAr ? 'بانتظار الطلبات القريبة مباشرة' : 'Listening live for nearby repair requests'}
            </p>
            <p className={`text-[11px] ${colors.secondaryText}`}>
              {isAr ? 'تظهر أي طلبات جديدة هنا تلقائياً في اللحظة نفسها.' : 'Any new customer request appears here automatically in real time.'}
            </p>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        </div>
      )}

      {activeJob && (
        <div
          role="button"
          tabIndex={0}
          data-testid="active-job-card"
          onClick={() => nav.go(screenForRequestStatus(activeJob.status), { id: activeJob.id })}
          className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 cursor-pointer text-xs`}
        >
          <div className="flex justify-between items-center">
            <span className={`font-extrabold ${colors.text}`}>
              {`${isAr ? 'مهمة نشطة' : 'Active job'} · ${activeJob.code || ''}`}
            </span>
            <StatusBadge status={activeJob.status} />
          </div>
          <p className={`text-[11px] ${colors.secondaryText}`}>
            {`${getServiceLabel(activeJob, isAr)} · ${activeJob.pickupAddress || area}`}
          </p>
          <span className="inline-block text-[11px] font-bold text-[#E51C23]">
            {isAr ? 'متابعة المهمة ←' : 'Continue active job →'}
          </span>
        </div>
      )}

      <MapView
        label={isAr ? `نطاق التغطية · ${fmtDistance(radius, lang)}` : `Coverage radius · ${fmtDistance(radius, lang)}`}
        subtitle={area}
      />

      <SecondaryButton onClick={handleGoOffline} disabled={goOnline.isPending}>
        {isAr ? 'إيقاف التواجد (غير متصل)' : 'Go Offline'}
      </SecondaryButton>
    </MechanicShell>
  );
}

// ==========================================
// M03: Incoming request
// ==========================================
export function M03Screen({ id }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const { data: offersData } = useOffers();
  const { data: requestsData } = useRequests();
  const acceptOffer = useAcceptOffer();
  const declineOffer = useDeclineOffer();
  const [error, setError] = useState('');

  const offers = Array.isArray(offersData) ? offersData : offersData?.items || [];
  const requests = Array.isArray(requestsData) ? requestsData : requestsData?.items || [];
  const offer = useMemo(() => {
    if (id) {
      const found = offers.find((o) => String(o.id) === String(id) || String(o.requestId) === String(id));
      if (found) return found;
    }
    return offers[0] || null;
  }, [id, offers]);

  const fallbackRequest = useMemo(() => {
    if (offer) return null;
    if (id) return requests.find((r) => String(r.id) === String(id)) || requests[0] || null;
    return requests[0] || null;
  }, [offer, id, requests]);

  const priceMinor = offer?.priceMinor ?? fallbackRequest?.estimateMinor ?? 40000;
  const feeMinor = 5000;
  const netMinor = Math.max(0, priceMinor - feeMinor);
  const distanceKm = offer?.distanceKm ?? fallbackRequest?.distanceKm ?? 2.4;
  const etaMinutes = offer?.etaMinutes ?? 6;
  const code = offer?.requestCode || offer?.code || fallbackRequest?.code || '—';
  const customerFirstName =
    offer?.customerFirstName ||
    (fallbackRequest ? getCustomerName(fallbackRequest, isAr).split(' ')[0] : isAr ? 'العميل' : 'Customer');
  const pickupArea = offer?.pickupArea || fallbackRequest?.pickupAddress || (isAr ? 'موقع العميل' : 'Customer area');
  const problem = offer?.problem || fallbackRequest?.problem || (isAr ? 'طلب مساعدة وإصلاح على الطريق' : 'Roadside assistance and repair request');

  const handleAccept = async () => {
    setError('');
    if (offer?.id) {
      try {
        const res = await acceptOffer.mutateAsync(offer.id);
        nav.go('M04', { id: res?.requestId || offer.requestId });
        return;
      } catch (err) {
        setError(err?.message || (isAr ? 'تعذر قبول العرض.' : 'Could not accept offer.'));
        return;
      }
    }
    if (fallbackRequest?.id) {
      nav.go('M04', { id: fallbackRequest.id });
    } else {
      nav.go('M04');
    }
  };

  const handleDecline = async () => {
    setError('');
    if (offer?.id) {
      try {
        await declineOffer.mutateAsync({ id: offer.id, reason: 'unavailable' });
      } catch {
        // Proceed back to console
      }
    }
    nav.go('M02');
  };

  return (
    <MechanicShell code="M03">
      <div>
        <h1 className={`text-lg font-bold ${colors.text}`}>
          {isAr ? 'طلب وارد' : 'Incoming request'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {isAr ? `طلب إصلاح · ${code}` : `Repair request · ${code}`}
        </p>
        <div className="pt-1">
          <StatusBadge status="Pending" text={isAr ? 'بانتظار الرد الفوري' : 'Awaiting your response'} />
        </div>
      </div>

      <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2`}>
        <div className="flex items-center gap-2.5">
          <AvatarBadge name={customerFirstName} />
          <div>
            <p className={`text-xs font-bold ${colors.text}`}>{customerFirstName}</p>
            <p className={`text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'مالك سيارة' : 'Car Owner'}
            </p>
          </div>
        </div>
        <p className={`text-xs font-bold ${colors.text}`}>
          {getServiceLabel(offer || fallbackRequest, isAr)}
        </p>
        <p className={`text-[11px] ${colors.secondaryText}`}>{problem}</p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
          <p className={`text-xs font-extrabold ${colors.text}`}>{fmtDistance(distanceKm, lang)}</p>
          <p className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'المسافة' : 'Distance'}
          </p>
        </div>
        <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
          <p className={`text-xs font-extrabold ${colors.text}`}>
            {isAr ? `${fmtNumber(etaMinutes, lang)} دقائق` : `${etaMinutes} min`}
          </p>
          <p className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'الوصول' : 'ETA'}
          </p>
        </div>
        <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
          <p className="text-xs font-extrabold text-emerald-500">{fmtMoney(netMinor, lang)}</p>
          <p className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'ربحك' : 'Earn'}
          </p>
        </div>
      </div>

      <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} text-xs space-y-1`}>
        <p className={`text-[10px] uppercase ${colors.secondaryText}`}>
          {isAr ? 'منطقة العميل' : 'PICKUP AREA'}
        </p>
        <p className={`font-bold ${colors.text}`}>{pickupArea}</p>
      </div>

      <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} text-xs space-y-1`}>
        <div className="flex justify-between">
          <span className={colors.secondaryText}>
            {isAr ? 'التكلفة التقديرية للعميل' : 'Customer estimate'}
          </span>
          <span className={`font-bold ${colors.text}`}>{fmtMoney(priceMinor, lang)}</span>
        </div>
        <div className="flex justify-between">
          <span className={colors.secondaryText}>
            {isAr ? 'رسوم المنصة' : 'Platform service fee'}
          </span>
          <span className={`font-bold ${colors.text}`}>{fmtMoney(feeMinor, lang)}</span>
        </div>
      </div>

      {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}

      <PrimaryButton onClick={handleAccept} disabled={acceptOffer.isPending} testId="screen-primary">
        {isAr ? 'قبول الطلب' : 'Accept Request'}
      </PrimaryButton>
      <SecondaryButton onClick={handleDecline} disabled={declineOffer.isPending}>
        {isAr ? 'رفض' : 'Decline'}
      </SecondaryButton>
    </MechanicShell>
  );
}

// ==========================================
// M04: Request details
// ==========================================
export function M04Screen({ id }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const qc = useQueryClient();
  const { req } = useActiveRequest(id);
  const advanceStatus = useAdvanceStatus();
  const [busy, setBusy] = useState(false);

  const customerName = getCustomerName(req, isAr);
  const vehicleStr = getVehicleSummary(req, isAr);
  const plate = getVehiclePlate(req);
  const photos = req?.photos || req?.photoFileIds || [];

  const handleNavigate = async () => {
    setBusy(true);
    try {
      if (req?.id) {
        if (req.status === 'Accepted') {
          await advanceStatus.mutateAsync({ id: req.id, status: 'EnRoute' });
        } else {
          await advanceRequestChain(req.id, req.status, 'EnRoute');
        }
        qc.invalidateQueries({ queryKey: k.requests });
      }
      nav.go('M05', req?.id ? { id: req.id } : {});
    } finally {
      setBusy(false);
    }
  };

  return (
    <MechanicShell code="M04">
      <div>
        <h1 className={`text-lg font-bold ${colors.text}`}>
          {isAr ? 'تفاصيل الطلب' : 'Request details'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {`${req?.code || '—'} · ${customerName}`}
        </p>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[11px]">
          <span className={colors.secondaryText}>{isAr ? 'خطوة ٢ من ٧' : 'Step 2 of 7'}</span>
          <span className={`font-bold ${colors.text}`}>{formatLabel(req?.status || 'Accepted', isAr)}</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-slate-500/20 overflow-hidden">
          <div className="h-full bg-[#E51C23] rounded-full" style={{ width: `${(2 / 7) * 100}%` }} />
        </div>
      </div>

      <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} space-y-1 text-xs`}>
        <div className="flex justify-between items-center gap-2">
          <span className={`font-bold ${colors.text}`}>{vehicleStr}</span>
          <span className={`font-bold font-mono ${colors.text}`} dir="ltr">{plate}</span>
        </div>
      </div>

      <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} space-y-2 text-xs`}>
        <p className={`font-bold ${colors.text}`}>{getServiceLabel(req, isAr)}</p>
        <p className={`text-[11px] ${colors.secondaryText}`}>
          {req?.note || req?.problem || (isAr ? 'لا توجد ملاحظات إضافية من العميل.' : 'No additional customer notes.')}
        </p>
        {photos.length > 0 && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            {photos.map((p, idx) => {
              const fid = typeof p === 'object' ? p.fileId || p.id : p;
              return (
                <img
                  key={fid || idx}
                  src={fileUrl(fid)}
                  alt={isAr ? 'صورة العطل' : 'Issue photo'}
                  className="w-full h-24 rounded-xl object-cover border border-slate-500/20"
                />
              );
            })}
          </div>
        )}
      </div>

      <MapView
        label={req?.pickupAddress || (isAr ? 'موقع العميل' : 'Customer pickup location')}
        subtitle={
          (req?.pickupDistanceKm ?? req?.distanceKm) > 0
            ? fmtDistance(req?.pickupDistanceKm ?? req?.distanceKm, lang)
            : undefined
        }
        markers={
          req?.pickupLatitude != null && req?.pickupLongitude != null
            ? [
                { lat: req.pickupLatitude, lng: req.pickupLongitude },
                ...(req?.providerLatitude != null && req?.providerLongitude != null
                  ? [{ lat: req.providerLatitude, lng: req.providerLongitude }]
                  : [])
              ]
            : []
        }
      />

      <div className="flex justify-between text-xs">
        <span className={colors.secondaryText}>
          {isAr ? 'السعر التقديري للعميل' : 'Estimated customer price'}
        </span>
        <span className={`font-bold ${colors.text}`}>
          {fmtMoney(req?.quoteMinor ?? req?.estimateMinor ?? 40000, lang)}
        </span>
      </div>

      <PrimaryButton onClick={handleNavigate} disabled={busy} testId="screen-primary">
        <Navigation size={14} />
        {isAr ? 'الانتقال إلى موقع العميل' : 'Navigate to Customer'}
      </PrimaryButton>
    </MechanicShell>
  );
}

// ==========================================
// M05: En route to customer
// ==========================================
export function M05Screen({ id }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const qc = useQueryClient();
  const { req } = useActiveRequest(id);
  const advanceStatus = useAdvanceStatus();
  const [busy, setBusy] = useState(false);

  const customerName = getCustomerName(req, isAr);
  const customerPhone = req?.customerPhone || req?.customer?.phone || '';
  const vehicleStr = getVehicleSummary(req, isAr);
  const plate = getVehiclePlate(req);

  const handleArrived = async () => {
    setBusy(true);
    try {
      if (req?.id) {
        if (req.status === 'EnRoute') {
          await advanceStatus.mutateAsync({ id: req.id, status: 'Arrived' });
        } else {
          await advanceRequestChain(req.id, req.status, 'Arrived');
        }
        qc.invalidateQueries({ queryKey: k.requests });
      }
      nav.go('M11', req?.id ? { id: req.id } : {});
    } finally {
      setBusy(false);
    }
  };

  return (
    <MechanicShell code="M05">
      <div>
        <h1 className={`text-lg font-bold ${colors.text}`}>
          {isAr ? 'في الطريق للعميل' : 'En route to customer'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {`${req?.code || '—'} · ${getServiceLabel(req, isAr)}`}
        </p>
      </div>

      <MapView
        label={
          (req?.pickupDistanceKm ?? req?.distanceKm) > 0
            ? `${fmtDistance(req?.pickupDistanceKm ?? req?.distanceKm, lang)} · ${isAr ? 'إلى العميل' : 'to customer'}`
            : (isAr ? 'في الطريق للعميل' : 'En route to customer')
        }
        subtitle={req?.pickupAddress || (isAr ? 'موقع العميل' : 'Pickup address')}
        markers={
          req?.pickupLatitude != null && req?.pickupLongitude != null
            ? [
                { lat: req.pickupLatitude, lng: req.pickupLongitude },
                ...(req?.providerLatitude != null && req?.providerLongitude != null
                  ? [{ lat: req.providerLatitude, lng: req.providerLongitude }]
                  : [])
              ]
            : []
        }
      />

      <div className="space-y-1">
        <div className="flex justify-between text-[11px]">
          <span className={colors.secondaryText}>{isAr ? 'خطوة ٣ من ٧' : 'Step 3 of 7'}</span>
          <span className={`font-bold ${colors.text}`}>{isAr ? 'في الطريق' : 'En route'}</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-slate-500/20 overflow-hidden">
          <div className="h-full bg-[#E51C23] rounded-full" style={{ width: `${(3 / 7) * 100}%` }} />
        </div>
      </div>

      <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} space-y-2 text-xs`}>
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <AvatarBadge name={customerName} />
            <div>
              <p className={`font-bold ${colors.text}`}>{customerName}</p>
              <p className={`text-[10px] ${colors.secondaryText}`}>
                {`${vehicleStr} · ${plate}`}
              </p>
            </div>
          </div>
          {customerPhone && (
            <a
              href={`tel:${customerPhone}`}
              data-testid="call-customer"
              className="px-3 py-2 rounded-xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 font-bold text-xs inline-flex items-center gap-1.5"
            >
              <Phone size={13} />
              {isAr ? 'اتصال' : 'Call'}
            </a>
          )}
        </div>
        <div className={`flex justify-between pt-1.5 border-t ${colors.border}`}>
          <span className={colors.secondaryText}>{isAr ? 'الموقع' : 'Pickup'}</span>
          <span className={`font-bold ${colors.text}`}>{req?.pickupAddress || '—'}</span>
        </div>
      </div>

      <PrimaryButton onClick={handleArrived} disabled={busy} testId="screen-primary">
        {isAr ? 'وصلت إلى العميل' : 'Arrived at customer'}
      </PrimaryButton>
      <SecondaryButton onClick={() => nav.go('SH01', req?.id ? { requestId: req.id, id: req.id } : {})}>
        <MessageSquare size={14} />
        {isAr ? `محادثة مع ${customerName}` : `Chat with ${customerName}`}
      </SecondaryButton>
    </MechanicShell>
  );
}

// ==========================================
// M11: Diagnosis & estimate
// ==========================================
export function M11Screen({ id }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const qc = useQueryClient();
  const { req } = useActiveRequest(id);
  const boot = useBootstrap();

  const [diagnosis, setDiagnosis] = useState('');
  const [calloutEgp, setCalloutEgp] = useState('');
  const [laborEgp, setLaborEgp] = useState('');
  const [partsEgp, setPartsEgp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const serviceFeeMinor = boot.data?.pricing?.serviceFeeMinor ?? 5000;
  const baseHintEgp = boot.data?.pricing?.mechanicBaseMinor
    ? String(Math.round(boot.data.pricing.mechanicBaseMinor / 100))
    : '0';

  const cVal = calloutEgp === '' ? 0 : Number(calloutEgp);
  const lVal = laborEgp === '' ? 0 : Number(laborEgp);
  const pVal = partsEgp === '' ? 0 : Number(partsEgp);
  const netEgp =
    (Number.isFinite(cVal) && cVal >= 0 ? cVal : 0) +
    (Number.isFinite(lVal) && lVal >= 0 ? lVal : 0) +
    (Number.isFinite(pVal) && pVal >= 0 ? pVal : 0);
  const netMinor = Math.round(netEgp * 100);
  const totalMinor = netMinor > 0 ? netMinor + serviceFeeMinor : 0;

  const handleSendQuote = async () => {
    setError('');
    if (!diagnosis.trim()) {
      setError(isAr ? 'يرجى كتابة تشخيص العطل.' : 'Please enter the on-site diagnosis.');
      return;
    }
    if (calloutEgp === '' && laborEgp === '') {
      setError(isAr ? 'يرجى إدخال تكلفة الانتقال أو المصنعية.' : 'Please enter call-out or labor fee.');
      return;
    }
    if (netMinor <= 0) {
      setError(isAr ? 'يجب أن تكون التكلفة التقديرية أكبر من صفر.' : 'Quote amount must be greater than zero.');
      return;
    }
    setBusy(true);
    try {
      if (req?.id) {
        if (!['Arrived', 'QuotePending', 'Disputed'].includes(req.status)) {
          await advanceRequestChain(req.id, req.status, 'Arrived');
        }
        await post('/requests/' + req.id + '/quotes', {
          calloutMinor: Math.round((Number.isFinite(cVal) && cVal >= 0 ? cVal : 0) * 100),
          laborMinor: Math.round((Number.isFinite(lVal) && lVal >= 0 ? lVal : 0) * 100),
          partsMinor: Math.round((Number.isFinite(pVal) && pVal >= 0 ? pVal : 0) * 100),
          diagnosis: diagnosis.trim()
        });
        qc.invalidateQueries({ queryKey: k.requests });
        qc.invalidateQueries({ queryKey: ['requests', req.id, 'quotes'] });
      }
      nav.go('M06', req?.id ? { id: req.id } : {});
    } catch (err) {
      setError(err?.message || (isAr ? 'تعذر إرسال العرض.' : 'Could not send quote.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <MechanicShell code="M11">
      <div>
        <h1 className={`text-lg font-bold ${colors.text}`}>
          {isAr ? 'التشخيص والتكلفة التقديرية' : 'Diagnosis & estimate'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {`${req?.code || '—'} · ${getServiceLabel(req, isAr)}`}
        </p>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[11px]">
          <span className={colors.secondaryText}>{isAr ? 'خطوة ٤ من ٧' : 'Step 4 of 7'}</span>
          <span className={`font-bold ${colors.text}`}>{isAr ? 'التشخيص' : 'Diagnosis'}</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-slate-500/20 overflow-hidden">
          <div className="h-full bg-[#E51C23] rounded-full" style={{ width: `${(4 / 7) * 100}%` }} />
        </div>
      </div>

      <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} space-y-1 text-xs`}>
        <p className={`font-bold ${colors.text}`}>
          {`${getVehicleSummary(req, isAr)} · ${getVehiclePlate(req)}`}
        </p>
        {req?.problem && (
          <p className={`text-[11px] ${colors.secondaryText}`}>{req.problem}</p>
        )}
      </div>

      <div>
        <label htmlFor="m11-diagnosis" className={`block text-[10px] ${colors.secondaryText}`}>
          {isAr ? 'التشخيص' : 'Diagnosis'}
        </label>
        <textarea
          id="m11-diagnosis"
          rows={2}
          data-testid="field-diagnosis"
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          placeholder={isAr ? 'اكتب تفاصيل التشخيص الفني...' : 'Describe the on-site diagnosis...'}
          className={`w-full p-2.5 rounded-xl border ${colors.border} ${colors.inputBg} text-xs ${colors.text}`}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label htmlFor="m11-callout" className={`block text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'الانتقال · ج.م' : 'Call-out · EGP'}
          </label>
          <input
            id="m11-callout"
            type="number"
            min="0"
            placeholder={baseHintEgp}
            data-testid="field-callout"
            value={calloutEgp}
            onChange={(e) => setCalloutEgp(e.target.value)}
            className={`w-full px-3 h-10 rounded-xl border ${colors.border} ${colors.inputBg} text-xs font-bold ${colors.text}`}
          />
        </div>
        <div>
          <label htmlFor="m11-labor" className={`block text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'المصنعية · ج.م' : 'Labor · EGP'}
          </label>
          <input
            id="m11-labor"
            type="number"
            min="0"
            placeholder="0"
            data-testid="field-labor"
            value={laborEgp}
            onChange={(e) => setLaborEgp(e.target.value)}
            className={`w-full px-3 h-10 rounded-xl border ${colors.border} ${colors.inputBg} text-xs font-bold ${colors.text}`}
          />
        </div>
        <div>
          <label htmlFor="m11-parts" className={`block text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'قطع الغيار · ج.م' : 'Parts · EGP'}
          </label>
          <input
            id="m11-parts"
            type="number"
            min="0"
            placeholder="0"
            data-testid="field-parts"
            value={partsEgp}
            onChange={(e) => setPartsEgp(e.target.value)}
            className={`w-full px-3 h-10 rounded-xl border ${colors.border} ${colors.inputBg} text-xs font-bold ${colors.text}`}
          />
        </div>
      </div>

      <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} space-y-1 text-xs`}>
        <div className="flex justify-between">
          <span className={colors.secondaryText}>{isAr ? 'رسوم الخدمة' : 'Service fee · Fixed'}</span>
          <span className={colors.text}>{fmtMoney(serviceFeeMinor, lang)}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span className={colors.text}>{isAr ? 'إجمالي العميل' : 'Customer total'}</span>
          <span className={colors.text}>{fmtMoney(totalMinor, lang)}</span>
        </div>
        <div className="flex justify-between font-extrabold text-emerald-500">
          <span>{isAr ? 'صافي أرباحك' : 'Your net earnings'}</span>
          <span>{fmtMoney(netMinor, lang)}</span>
        </div>
      </div>

      {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}

      <PrimaryButton onClick={handleSendQuote} disabled={busy} testId="screen-primary">
        {isAr
          ? `إرسال العرض · ${fmtMoney(totalMinor, lang)}`
          : `Send Quote · ${fmtMoney(totalMinor, lang)}`}
      </PrimaryButton>
    </MechanicShell>
  );
}

// ==========================================
// M06: Repair in progress
// ==========================================
export function M06Screen({ id }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const qc = useQueryClient();
  const { req } = useActiveRequest(id);
  const { data: quotesData } = useQuotes(req?.id);
  const [checks, setChecks] = useState([false, false, false, false]);
  const [busy, setBusy] = useState(false);

  const quotes = Array.isArray(quotesData) ? quotesData : quotesData?.items || [];
  const latestQuote = quotes[quotes.length - 1] || null;
  const calloutMinor = latestQuote?.calloutMinor ?? 15000;
  const laborMinor = latestQuote?.laborMinor ?? 20000;
  const partsMinor = latestQuote?.partsMinor ?? 0;
  const feeMinor = latestQuote?.serviceFeeMinor ?? 5000;
  const totalMinor = latestQuote?.totalMinor ?? req?.quoteMinor ?? calloutMinor + laborMinor + partsMinor + feeMinor;

  const checkItems = [
    isAr ? 'تأمين موقع المركبة وفحص السلامة' : 'Vehicle site secured and safety verified',
    isAr ? 'تنفيذ الإصلاح أو استبدال القطعة المطلوبة' : 'Repair or part replacement completed',
    isAr ? 'اختبار التشغيل والتأكد من زوال العطل' : 'Operational test performed and verified',
    isAr ? 'مراجعة الفحص النهائي مع العميل' : 'Final inspection reviewed with customer'
  ];

  const toggleCheck = (idx) => {
    setChecks((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  };

  const handleCompleteJob = async () => {
    setBusy(true);
    try {
      setChecks([true, true, true, true]);
      if (req?.id) {
        await advanceRequestChain(req.id, req.status, 'AwaitingPayment');
        qc.invalidateQueries({ queryKey: k.requests });
      }
      nav.go('M12', req?.id ? { id: req.id } : {});
    } finally {
      setBusy(false);
    }
  };

  return (
    <MechanicShell code="M06">
      <div>
        <h1 className={`text-lg font-bold ${colors.text}`}>
          {isAr ? 'جاري الإصلاح' : 'Repair in progress'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {`${req?.code || '—'} · ${fmtTime(req?.acceptedAt || req?.createdAt, lang)}`}
        </p>
        <div className="pt-1">
          <StatusBadge
            status="Working"
            text={isAr ? 'جاري العمل · تمت الموافقة على العرض' : 'Working · Quote approved'}
          />
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[11px]">
          <span className={colors.secondaryText}>{isAr ? 'خطوة ٥ من ٧' : 'Step 5 of 7'}</span>
          <span className={`font-bold ${colors.text}`}>{isAr ? 'جاري الإصلاح' : 'Repair in progress'}</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-slate-500/20 overflow-hidden">
          <div className="h-full bg-[#E51C23] rounded-full" style={{ width: `${(5 / 7) * 100}%` }} />
        </div>
      </div>

      <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} flex items-center gap-2.5 text-xs`}>
        <AvatarBadge name={getCustomerName(req, isAr)} />
        <div>
          <p className={`font-bold ${colors.text}`}>{getCustomerName(req, isAr)}</p>
          <p className={`text-[10px] ${colors.secondaryText}`}>
            {`${getServiceLabel(req, isAr)} · ${getVehicleSummary(req, isAr)}`}
          </p>
        </div>
      </div>

      <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs`}>
        <p className={`font-bold ${colors.text}`}>
          {isAr ? 'تفاصيل التكلفة' : 'Cost breakdown'}
        </p>
        <div className="flex justify-between">
          <span className={colors.secondaryText}>{isAr ? 'الانتقال والتشخيص' : 'Call-out & diagnosis'}</span>
          <span className={colors.text}>{fmtMoney(calloutMinor, lang)}</span>
        </div>
        <div className="flex justify-between">
          <span className={colors.secondaryText}>{isAr ? 'المصنعية' : 'Repair labor'}</span>
          <span className={colors.text}>{fmtMoney(laborMinor, lang)}</span>
        </div>
        {partsMinor > 0 && (
          <div className="flex justify-between">
            <span className={colors.secondaryText}>{isAr ? 'قطع الغيار' : 'Parts'}</span>
            <span className={colors.text}>{fmtMoney(partsMinor, lang)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className={colors.secondaryText}>{isAr ? 'رسوم الخدمة' : 'Service fee'}</span>
          <span className={colors.text}>{fmtMoney(feeMinor, lang)}</span>
        </div>
        <div className={`flex justify-between pt-1.5 border-t ${colors.border} font-extrabold`}>
          <span className={colors.text}>{isAr ? 'الإجمالي' : 'Total'}</span>
          <span className={colors.text}>{fmtMoney(totalMinor, lang)}</span>
        </div>
      </div>

      <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} space-y-2 text-xs`}>
        <div className="flex items-center justify-between">
          <p className={`font-bold ${colors.text}`}>
            {isAr ? 'قائمة فحص الإصلاح' : 'Repair checklist'}
          </p>
          <button
            type="button"
            data-testid="complete-all-checks"
            onClick={() => setChecks([true, true, true, true])}
            className="text-[10px] font-bold text-[#E51C23]"
          >
            {isAr ? 'تحديد الكل' : 'Complete all checks'}
          </button>
        </div>
        {checkItems.map((label, idx) => (
          <button
            key={idx}
            type="button"
            data-testid={`repair-check-${idx}`}
            onClick={() => toggleCheck(idx)}
            className="w-full flex items-center gap-2 text-start py-1"
          >
            <span
              className={`w-4 h-4 rounded flex items-center justify-center border ${
                checks[idx]
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : `${colors.border} ${colors.inputBg}`
              }`}
            >
              {checks[idx] && <Check size={11} />}
            </span>
            <span className={checks[idx] ? 'text-emerald-500 font-semibold' : colors.secondaryText}>
              {label}
            </span>
          </button>
        ))}
      </div>

      <PrimaryButton onClick={handleCompleteJob} disabled={busy} testId="screen-primary">
        {isAr ? 'إتمام المهمة' : 'Complete Job'}
      </PrimaryButton>
    </MechanicShell>
  );
}

// ==========================================
// M12: Complete job & payment
// ==========================================
export function M12Screen({ id }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const qc = useQueryClient();
  const { req } = useActiveRequest(id);
  const { data: quotesData } = useQuotes(req?.id);
  const { data: invoice } = useInvoiceForRequest(req?.id);
  const [checks, setChecks] = useState([false, false, false]);
  const [busy, setBusy] = useState(false);

  const quotes = Array.isArray(quotesData) ? quotesData : quotesData?.items || [];
  const latestQuote = quotes[quotes.length - 1] || null;
  const totalMinor =
    invoice?.totalMinor ??
    latestQuote?.totalMinor ??
    req?.quoteMinor ??
    req?.estimateMinor ??
    40000;

  const finalChecks = [
    isAr ? 'تم تركيب القطعة وتأمين المركبة بالكامل' : 'Part fitted and vehicle secured',
    isAr ? 'تم فحص عوامل الأمان والتشغيل' : 'Safety and operational checks verified',
    isAr ? 'تم إرشاد العميل لتعليمات القيادة الآمنة' : 'Customer given safe driving advice'
  ];

  const handleFinish = async () => {
    setBusy(true);
    try {
      if (req?.id) {
        if (req.status !== 'Completed') {
          await advanceRequestChain(req.id, req.status, 'Completed');
        }
        qc.invalidateQueries({ queryKey: k.requests });
        qc.invalidateQueries({ queryKey: k.providerHistory });
        qc.invalidateQueries({ queryKey: k.earnings });
        qc.invalidateQueries({ queryKey: k.wallet });
      }
      nav.go('M13', req?.id ? { id: req.id } : {});
    } finally {
      setBusy(false);
    }
  };

  return (
    <MechanicShell code="M12">
      <div>
        <h1 className={`text-lg font-bold ${colors.text}`}>
          {isAr ? 'إتمام المهمة والدفع' : 'Complete job & payment'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {`${req?.code || '—'} · ${getCustomerName(req, isAr)} · ${fmtDate(req?.createdAt, lang)}`}
        </p>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[11px]">
          <span className={colors.secondaryText}>{isAr ? 'خطوة ٦ من ٧' : 'Step 6 of 7'}</span>
          <span className={`font-bold ${colors.text}`}>{isAr ? 'تحصيل الدفعة' : 'Payment collection'}</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-slate-500/20 overflow-hidden">
          <div className="h-full bg-[#E51C23] rounded-full" style={{ width: `${(6 / 7) * 100}%` }} />
        </div>
      </div>

      <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs`}>
        <p className={`font-bold ${colors.text}`}>
          {isAr ? 'فحوصات الأمان النهائية' : 'Final safety checks'}
        </p>
        {finalChecks.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setChecks((prev) => prev.map((v, i) => (i === idx ? !v : v)))}
            className="w-full flex items-center gap-2 text-start py-0.5"
          >
            <span className={checks[idx] ? 'text-emerald-500 font-semibold' : colors.secondaryText}>
              {`${checks[idx] ? '✓' : '○'} ${item}`}
            </span>
          </button>
        ))}
      </div>

      <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} space-y-1 text-xs`}>
        <p className={`font-bold ${colors.text}`}>
          {isAr ? 'تأكيد الدفع' : 'Payment confirmation'}
        </p>
        <div className="flex justify-between">
          <span className={colors.secondaryText}>{isAr ? 'طريقة الدفع' : 'Payment method'}</span>
          <span className={`font-bold ${colors.text}`}>
            {invoice?.method ? formatLabel(invoice.method, isAr) : isAr ? 'نقداً (كاش)' : 'Cash'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className={colors.secondaryText}>{isAr ? 'المبلغ المطلوب تحصيله' : 'Amount to collect'}</span>
          <span className="font-extrabold text-[#E51C23]">{fmtMoney(totalMinor, lang)}</span>
        </div>
      </div>

      <PrimaryButton onClick={handleFinish} disabled={busy} testId="screen-primary">
        {isAr
          ? `تأكيد استلام النقدية · ${fmtMoney(totalMinor, lang)}`
          : `Confirm Cash Received · ${fmtMoney(totalMinor, lang)}`}
      </PrimaryButton>
    </MechanicShell>
  );
}

// ==========================================
// M13: Completed job details
// ==========================================
export function M13Screen({ id }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const { req } = useActiveRequest(id);
  const { data: timelineData } = useTimeline(req?.id);
  const { data: quotesData } = useQuotes(req?.id);

  const events = Array.isArray(timelineData) ? timelineData : timelineData?.events || timelineData?.items || [];
  const quotes = Array.isArray(quotesData) ? quotesData : quotesData?.items || [];
  const latestQuote = quotes[quotes.length - 1] || null;
  const totalMinor = latestQuote?.totalMinor ?? req?.quoteMinor ?? req?.estimateMinor ?? 40000;
  const feeMinor = latestQuote?.serviceFeeMinor ?? 5000;
  const netMinor = latestQuote?.providerNetMinor ?? Math.max(0, totalMinor - feeMinor);

  return (
    <MechanicShell code="M13">
      <div>
        <h1 className={`text-lg font-bold ${colors.text}`}>
          {isAr ? 'تفاصيل المهمة المكتملة' : 'Completed job details'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {`${req?.code || '—'} · ${fmtDate(req?.completedAt || req?.createdAt, lang)}`}
        </p>
        <div className="pt-1">
          <StatusBadge status={req?.status || 'Completed'} />
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[11px]">
          <span className={colors.secondaryText}>{isAr ? 'خطوة ٧ من ٧' : 'Step 7 of 7'}</span>
          <span className={`font-bold ${colors.text}`}>{formatLabel(req?.status || 'Completed', isAr)}</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-slate-500/20 overflow-hidden">
          <div className="h-full bg-[#E51C23] rounded-full" style={{ width: `${(7 / 7) * 100}%` }} />
        </div>
      </div>

      <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs`}>
        <p className={`font-bold ${colors.text}`}>{getServiceLabel(req, isAr)}</p>
        <p className={`text-[11px] ${colors.secondaryText}`}>
          {`${getCustomerName(req, isAr)} · ${getVehicleSummary(req, isAr)} · ${getVehiclePlate(req)}`}
        </p>
        <div className="flex justify-between pt-1">
          <span className={colors.secondaryText}>{isAr ? 'إجمالي العميل' : 'Customer total'}</span>
          <span className={`font-bold ${colors.text}`}>{fmtMoney(totalMinor, lang)}</span>
        </div>
        <div className="flex justify-between">
          <span className={colors.secondaryText}>{isAr ? 'رسوم الخدمة' : 'Service fee'}</span>
          <span className={`font-bold ${colors.text}`}>{fmtMoney(feeMinor, lang)}</span>
        </div>
        <div className="flex justify-between font-extrabold text-emerald-500">
          <span>{isAr ? 'صافي أرباحك' : 'Your net earnings'}</span>
          <span>{fmtMoney(netMinor, lang)}</span>
        </div>
      </div>

      <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} space-y-1 text-xs`}>
        <p className={`font-bold ${colors.text}`}>{isAr ? 'سجل المهمة' : 'Job timeline'}</p>
        {events.length === 0 ? (
          <p className={`text-[11px] ${colors.secondaryText}`}>
            {isAr ? 'لا توجد أحداث مسجلة بعد.' : 'No timeline events recorded yet.'}
          </p>
        ) : (
          events.map((ev, idx) => (
            <div key={ev.id || idx} className="flex justify-between text-[11px]">
              <span className={colors.text}>{`• ${formatLabel(ev.status, isAr)}`}</span>
              <span className={colors.secondaryText}>{fmtTime(ev.at || ev.createdAt, lang)}</span>
            </div>
          ))
        )}
      </div>

      <SecondaryButton onClick={() => nav.go('M07')}>
        {isAr ? 'عرض الأرباح' : 'View Earnings'}
      </SecondaryButton>
    </MechanicShell>
  );
}

// ==========================================
// M07: Your earnings
// ==========================================
export function M07Screen() {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const { user } = useSession();
  const { data: provider } = useProvider();
  const { data: earnings } = useEarnings();
  const { data: wallet } = useWallet();
  const [earningsPeriod, setEarningsPeriod] = useState('week');

  const fullName = getFullName(user, provider, isAr);
  const availableMinor = earnings?.availableMinor ?? wallet?.balanceMinor ?? 0;
  const lifetimeMinor = earnings?.lifetimeMinor ?? availableMinor;
  const completedJobs = earnings?.completedJobs ?? provider?.completedJobs ?? 0;
  const rating = Number(earnings?.rating ?? provider?.rating ?? 0).toFixed(1);
  const allEntries = Array.isArray(wallet?.entries) ? wallet.entries : [];

  const filteredEntries = useMemo(() => {
    if (earningsPeriod === 'all') return allEntries;
    const days = earningsPeriod === 'week' ? 7 : 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return allEntries.filter((e) => {
      const ts = new Date(e.at || e.createdAt || Date.now()).getTime();
      return ts >= cutoff;
    });
  }, [allEntries, earningsPeriod]);

  return (
    <MechanicShell code="M07">
      <div>
        <h1 className={`text-lg font-bold ${colors.text}`}>
          {isAr ? 'أرباحك' : 'Your earnings'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {`${fullName} · ${isAr ? 'تم التحديث الآن' : 'Updated just now'}`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {[
          { id: 'week', label: isAr ? 'هذا الأسبوع' : 'This week' },
          { id: 'month', label: isAr ? 'هذا الشهر' : 'This month' },
          { id: 'all', label: isAr ? 'الكل' : 'All time' }
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            data-testid={`period-${t.id}`}
            onClick={() => setEarningsPeriod(t.id)}
            className={`py-1.5 rounded-xl text-[10px] font-bold border ${
              earningsPeriod === t.id
                ? 'bg-[#E51C23] border-[#E51C23] text-white'
                : `${colors.border} ${colors.surface} ${colors.secondaryText}`
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 rounded-2xl bg-[#E51C23] text-white space-y-1 shadow-md">
        <p className="text-[10px] uppercase tracking-wider opacity-85">
          {isAr ? 'الرصيد المتاح' : 'AVAILABLE BALANCE'}
        </p>
        <p className="text-2xl font-extrabold">{fmtMoney(availableMinor, lang)}</p>
        <div className="flex justify-between text-[11px] opacity-90">
          <span>{isAr ? 'إجمالي الأرباح' : 'Lifetime earnings'}</span>
          <span>{fmtMoney(lifetimeMinor, lang)}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
          <p className={`text-sm font-extrabold ${colors.text}`}>{fmtNumber(completedJobs, lang)}</p>
          <p className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'مهام مكتملة' : 'Completed jobs'}
          </p>
        </div>
        <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
          <p className={`text-sm font-extrabold ${colors.text}`}>{fmtMoney(lifetimeMinor, lang)}</p>
          <p className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'الإجمالي' : 'Lifetime'}
          </p>
        </div>
        <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
          <p className={`text-sm font-extrabold ${colors.text}`}>{rating}</p>
          <p className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'التقييم' : 'Rating'}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className={`text-xs font-bold ${colors.text}`}>
          {isAr ? 'الأرباح اليومية وسجل المحفظة' : 'Daily earnings & ledger'}
        </p>
        {filteredEntries.length === 0 ? (
          <div className={`p-4 rounded-2xl border ${colors.border} ${colors.surface} text-center text-xs ${colors.secondaryText}`}>
            {isAr ? 'لا توجد معاملات مسجلة في هذه الفترة.' : 'No ledger entries in this period.'}
          </div>
        ) : (
          filteredEntries.map((entry, idx) => (
            <div
              key={entry.id || idx}
              className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} flex justify-between items-center text-xs`}
            >
              <div>
                <p className={`font-bold ${colors.text}`}>
                  {providerLabel(entry.type, isAr)}
                  {entry.reference ? ` · ${entry.reference}` : ''}
                </p>
                <p className={`text-[10px] ${colors.secondaryText}`}>
                  {fmtDateTime(entry.at || entry.createdAt, lang)}
                </p>
              </div>
              <span className={`font-extrabold ${colors.text}`}>
                {fmtMoney(entry.amountMinor, lang)}
              </span>
            </div>
          ))
        )}
      </div>

      <PrimaryButton onClick={() => nav.go('SH15')} testId="screen-primary">
        {isAr ? 'سحب الأرباح إلى البنك' : 'Withdraw to Bank'}
      </PrimaryButton>
      <SecondaryButton onClick={() => nav.go('SH14')}>
        {isAr ? 'الحسابات البنكية' : 'Bank Accounts'}
      </SecondaryButton>
    </MechanicShell>
  );
}

// ==========================================
// M08: Service history
// ==========================================
export function M08Screen() {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const { data: historyData } = useProviderHistory();
  const { data: requestsData } = useRequests();
  const [filter, setFilter] = useState('All');

  const historyList = useMemo(() => {
    const rawHistory = Array.isArray(historyData) ? historyData : historyData?.items || [];
    if (rawHistory.length > 0) return rawHistory;
    return Array.isArray(requestsData) ? requestsData : requestsData?.items || [];
  }, [historyData, requestsData]);

  const filtered = useMemo(() => {
    if (filter === 'All') return historyList;
    return historyList.filter((r) => String(r.status) === filter);
  }, [historyList, filter]);

  return (
    <MechanicShell code="M08">
      <div>
        <h1 className={`text-lg font-bold ${colors.text}`}>
          {isAr ? 'سجل الخدمات' : 'Service history'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {isAr ? 'عملك المتقن، مدعوم بتقييمات السائقين.' : 'Your work, backed by happy drivers.'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {[
          { id: 'All', label: isAr ? 'الكل' : 'All' },
          { id: 'Completed', label: isAr ? 'مكتمل' : 'Completed' },
          { id: 'Cancelled', label: isAr ? 'ملغي' : 'Cancelled' }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            data-testid={`history-filter-${tab.id.toLowerCase()}`}
            onClick={() => setFilter(tab.id)}
            className={`py-1.5 rounded-xl text-[10px] font-bold border ${
              filter === tab.id
                ? 'bg-[#E51C23] border-[#E51C23] text-white'
                : `${colors.border} ${colors.surface} ${colors.secondaryText}`
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className={`p-6 rounded-2xl border ${colors.border} ${colors.surface} text-center text-xs ${colors.secondaryText}`}>
          {isAr ? 'لا توجد مهام في هذا التصنيف.' : 'No service history items found.'}
        </div>
      ) : (
        filtered.map((r) => (
          <div
            key={r.id || r.code}
            role="button"
            tabIndex={0}
            data-testid="data-row"
            onClick={() => nav.go('M13', { id: r.id })}
            className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1 cursor-pointer text-xs`}
          >
            <div className="flex justify-between">
              <span className={`text-[10px] ${colors.secondaryText}`}>
                {fmtDateTime(r.completedAt || r.createdAt, lang)}
              </span>
              <span className={`font-extrabold ${colors.text}`}>
                {fmtMoney(r.quoteMinor ?? r.totalMinor ?? r.estimateMinor ?? 0, lang)}
              </span>
            </div>
            <p className={`font-bold ${colors.text}`}>
              {`${r.code || '—'} · ${getServiceLabel(r, isAr)}`}
            </p>
            <p className={`text-[11px] ${colors.secondaryText}`}>
              {`${getCustomerName(r, isAr)} · ${getVehicleSummary(r, isAr)}`}
            </p>
            <div className="flex justify-between items-center pt-1">
              <StatusBadge status={r.status || 'Completed'} />
              <span className="text-[11px] font-bold text-[#E51C23]">
                {isAr ? 'عرض المهمة ←' : 'View job →'}
              </span>
            </div>
          </div>
        ))
      )}
    </MechanicShell>
  );
}

// ==========================================
// M09: Provider profile
// ==========================================
export function M09Screen() {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const { user } = useSession();
  const { data: provider } = useProvider();
  const { data: kyc } = useKyc();
  const ForwardChevron = isAr ? ChevronLeft : ChevronRight;

  const fullName = getFullName(user, provider, isAr);
  const area = getArea(provider, user, isAr);
  const rating = Number(provider?.rating ?? 0).toFixed(1);
  const ratingCount = Number(provider?.ratingCount ?? 0);
  const recommendPercent = Number(provider?.recommendPercent ?? 0);
  const completedJobs = provider?.completedJobs ?? 0;
  const years = provider?.yearsExperience ?? 0;
  const radius = provider?.coverageRadiusKm ?? 10;
  const kycStatus = kyc?.status || provider?.kycStatus || user?.kycStatus || 'Approved';
  const docs = Array.isArray(kyc?.documents) ? kyc.documents : [];

  return (
    <MechanicShell code="M09">
      <div>
        <h1 className={`text-lg font-bold ${colors.text}`}>
          {isAr ? 'الملف الشخصي للميكانيكي' : 'Provider profile'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {isAr ? 'هويتك المهنية للمساعدة على الطريق.' : 'Your professional roadside identity.'}
        </p>
      </div>

      <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2 text-xs`}>
        <div className="flex items-center gap-2.5">
          <AvatarBadge name={fullName} />
          <div>
            <p className={`font-bold ${colors.text}`}>{fullName}</p>
            <p className={`text-[10px] ${colors.secondaryText}`}>
              {ratingCount > 0
                ? `${rating} ★ (${ratingCount}) · 👍 ${recommendPercent}% · ${pluralCount(completedJobs, 'completed job', 'completed jobs', 'مهمة مكتملة', 'مهام مكتملة', 'مهمة مكتملة', isAr)}`
                : `${isAr ? 'بدون تقييمات بعد' : 'No reviews yet'} · ${pluralCount(completedJobs, 'completed job', 'completed jobs', 'مهمة مكتملة', 'مهام مكتملة', 'مهمة مكتملة', isAr)}`}
            </p>
          </div>
        </div>
        <StatusBadge
          status={kycStatus}
          text={kycStatus === 'Approved' ? (isAr ? 'ميكانيكي معتمد' : 'Verified Mechanic') : providerLabel(kycStatus, isAr)}
        />
        <div className={`flex justify-between pt-1.5 border-t ${colors.border}`}>
          <span className={colors.secondaryText}>{isAr ? 'الخبرة' : 'Experience'}</span>
          <span className={`font-bold ${colors.text}`}>
            {plural(years, 'year', isAr)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className={colors.secondaryText}>{isAr ? 'نطاق التغطية' : 'Coverage'}</span>
          <span className={`font-bold ${colors.text}`}>
            {`${area} · ${fmtDistance(radius, lang)}`}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className={`text-xs font-bold ${colors.text}`}>
          {isAr ? 'المستندات والتوثيق' : 'Documents & verification'}
        </p>
        {docs.length === 0 ? (
          <button
            type="button"
            onClick={() => nav.go('SH17')}
            className={`w-full p-2.5 rounded-xl border ${colors.border} ${colors.surface} flex justify-between items-center text-start text-xs`}
          >
            <div>
              <p className={`font-bold ${colors.text}`}>
                {isAr ? 'مستندات التوثيق المهني' : 'Verification documents'}
              </p>
              <p className={`text-[10px] ${colors.secondaryText}`}>
                {providerLabel(kycStatus, isAr)}
              </p>
            </div>
            <ForwardChevron size={14} className={colors.secondaryText} />
          </button>
        ) : (
          docs.map((doc) => (
            <button
              key={doc.id || doc.documentType}
              type="button"
              onClick={() => nav.go('SH17', { id: doc.id })}
              className={`w-full p-2.5 rounded-xl border ${colors.border} ${colors.surface} flex justify-between items-center text-start text-xs`}
            >
              <div>
                <p className={`font-bold ${colors.text}`}>{providerLabel(doc.documentType, isAr)}</p>
                <p className={`text-[10px] ${colors.secondaryText}`}>{providerLabel(doc.status, isAr)}</p>
              </div>
              <ForwardChevron size={14} className={colors.secondaryText} />
            </button>
          ))
        )}
      </div>

      <PrimaryButton onClick={() => nav.go('M14')} testId="screen-primary">
        {isAr ? 'تعديل الملف المهني' : 'Edit Profile'}
      </PrimaryButton>
      <SecondaryButton onClick={() => nav.go('M15')}>
        {isAr ? 'نطاق التغطية والتواجد' : 'Coverage & Availability'}
      </SecondaryButton>
      <SecondaryButton onClick={() => nav.go('SH06')}>
        {isAr ? 'إعدادات التطبيق' : 'App Settings'}
      </SecondaryButton>
      <SecondaryButton onClick={() => nav.go('SH13')}>
        {isAr ? 'تسجيل الخروج' : 'Log Out'}
      </SecondaryButton>
    </MechanicShell>
  );
}

// ==========================================
// M10: Your jobs hub
// ==========================================
export function M10Screen() {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const { user } = useSession();
  const { data: provider } = useProvider();
  const { data: offersData } = useOffers();
  const { data: requestsData } = useRequests();
  const [jobsTab, setJobsTab] = useState('incoming');

  const fullName = getFullName(user, provider, isAr);
  const area = getArea(provider, user, isAr);
  const offers = Array.isArray(offersData) ? offersData : offersData?.items || [];
  const requests = Array.isArray(requestsData) ? requestsData : requestsData?.items || [];

  const activeJobs = requests.filter(
    (r) =>
      r.assignedProviderId &&
      String(r.assignedProviderId) === String(user?.id) &&
      !['Completed', 'Cancelled', 'NoProviders', 'Searching', 'Offered'].includes(String(r.status))
  );
  const completedJobs = requests.filter((r) => r.status === 'Completed');

  return (
    <MechanicShell code="M10">
      <div>
        <h1 className={`text-lg font-bold ${colors.text}`}>
          {isAr ? 'مركز المهام' : 'Your jobs'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {`${fullName} · ${area}`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {[
          { id: 'incoming', label: isAr ? `واردة (${offers.length})` : `Incoming (${offers.length})` },
          { id: 'active', label: isAr ? `نشطة (${activeJobs.length})` : `Active (${activeJobs.length})` },
          { id: 'completed', label: isAr ? `مكتملة (${completedJobs.length})` : `Completed (${completedJobs.length})` }
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            data-testid={`jobs-tab-${t.id}`}
            onClick={() => setJobsTab(t.id)}
            className={`py-1.5 rounded-xl text-[10px] font-bold border ${
              jobsTab === t.id
                ? 'border-[#E51C23] bg-[#E51C23]/10 text-[#E51C23]'
                : `${colors.border} ${colors.surface} ${colors.secondaryText}`
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {jobsTab === 'incoming' && (
        <>
          {offers.length === 0 ? (
            <div className={`p-5 rounded-2xl border ${colors.border} ${colors.surface} text-center text-xs ${colors.secondaryText}`}>
              {isAr ? 'لا توجد عروض واردة حالياً.' : 'No incoming offers right now.'}
            </div>
          ) : (
            offers.map((o) => (
              <div
                key={o.id}
                role="button"
                tabIndex={0}
                data-testid="offer-row"
                onClick={() => nav.go('M03', { id: o.id })}
                className="p-3.5 rounded-2xl border border-[#E51C23]/30 bg-[#E51C23]/5 space-y-1.5 cursor-pointer text-xs"
              >
                <p className={`font-bold ${colors.text}`}>
                  {`${getServiceLabel(o, isAr)} · ${o.requestCode || o.code || ''}`}
                </p>
                <StatusBadge status={o.status || 'Pending'} />
                <div className="flex justify-between pt-1">
                  <span className={colors.secondaryText}>
                    {`${o.customerFirstName || (isAr ? 'عميل' : 'Customer')} · ${o.pickupArea || area}`}
                  </span>
                  <span className={`font-bold ${colors.text}`}>
                    {`${fmtDistance(o.distanceKm, lang)} · ${o.etaMinutes ?? 6} ${isAr ? 'دقائق' : 'min'}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={colors.secondaryText}>
                    {isAr ? 'صافي الربح المقدر' : 'Estimated net earnings'}
                  </span>
                  <span className="font-bold text-emerald-500">
                    {fmtMoney(Math.max(0, (o.priceMinor ?? 0) - 5000), lang)}
                  </span>
                </div>
              </div>
            ))
          )}
          {activeJobs.map((job) => (
            <div
              key={job.id}
              role="button"
              tabIndex={0}
              data-testid="active-job-row"
              onClick={() => nav.go(screenForRequestStatus(job.status), { id: job.id })}
              className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1 cursor-pointer text-xs`}
            >
              <p className={`font-bold ${colors.text}`}>
                {`${isAr ? 'المهمة النشطة' : 'Active job'} · ${job.code || ''}`}
              </p>
              <p className={`text-[11px] ${colors.secondaryText}`}>
                {`${formatLabel(job.status, isAr)} · ${getCustomerName(job, isAr)}`}
              </p>
              <span className="inline-block text-[11px] font-bold text-[#E51C23] pt-1">
                {isAr ? 'متابعة المهمة النشطة ←' : 'Continue Active Job →'}
              </span>
            </div>
          ))}
        </>
      )}

      {jobsTab === 'active' && (
        activeJobs.length === 0 ? (
          <div className={`p-5 rounded-2xl border ${colors.border} ${colors.surface} text-center text-xs ${colors.secondaryText}`}>
            {isAr ? 'لا توجد مهام نشطة حالياً.' : 'No active jobs right now.'}
          </div>
        ) : (
          activeJobs.map((job) => (
            <div
              key={job.id}
              role="button"
              tabIndex={0}
              data-testid="active-job-row"
              onClick={() => nav.go(screenForRequestStatus(job.status), { id: job.id })}
              className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1 cursor-pointer text-xs`}
            >
              <div className="flex justify-between items-center">
                <p className={`font-bold ${colors.text}`}>
                  {`${getServiceLabel(job, isAr)} · ${job.code || ''}`}
                </p>
                <StatusBadge status={job.status} />
              </div>
              <p className={`text-[11px] ${colors.secondaryText}`}>
                {`${getCustomerName(job, isAr)} · ${job.pickupAddress || area}`}
              </p>
              <span className="inline-block text-[11px] font-bold text-[#E51C23] pt-1">
                {isAr ? 'متابعة المهمة النشطة ←' : 'Continue Active Job →'}
              </span>
            </div>
          ))
        )
      )}

      {jobsTab === 'completed' && (
        completedJobs.length === 0 ? (
          <div className={`p-5 rounded-2xl border ${colors.border} ${colors.surface} text-center text-xs ${colors.secondaryText}`}>
            {isAr ? 'لا توجد مهام مكتملة بعد.' : 'No completed jobs yet.'}
          </div>
        ) : (
          completedJobs.map((job) => (
            <div
              key={job.id}
              role="button"
              tabIndex={0}
              data-testid="completed-job-row"
              onClick={() => nav.go('M13', { id: job.id })}
              className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1 cursor-pointer text-xs`}
            >
              <div className="flex justify-between items-center">
                <p className={`font-bold ${colors.text}`}>
                  {`${getServiceLabel(job, isAr)} · ${job.code || ''}`}
                </p>
                <StatusBadge status="Completed" />
              </div>
              <p className={`text-[11px] ${colors.secondaryText}`}>
                {`${getCustomerName(job, isAr)} · ${fmtMoney(job.quoteMinor ?? job.estimateMinor ?? 0, lang)}`}
              </p>
            </div>
          ))
        )
      )}
    </MechanicShell>
  );
}

// ==========================================
// M14: Edit professional profile
// ==========================================
export function M14Screen() {
  const colors = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const qc = useQueryClient();
  const { user, loadMe } = useSession();
  const { data: provider } = useProvider();
  const boot = useBootstrap();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [coverageArea, setCoverageArea] = useState('');
  const [expertise, setExpertise] = useState([]);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const baseOptions = useMemo(() => {
    const raw = (boot.data?.serviceTypes || []).filter((s) => s.kind !== 'Tow');
    if (raw.length > 0) {
      const hasOther = raw.some((s) => s.key === 'other');
      return hasOther
        ? raw.map((s) => ({ id: String(s.id), key: s.key, en: s.nameEn, ar: s.nameAr }))
        : [
            ...raw.map((s) => ({ id: String(s.id), key: s.key, en: s.nameEn, ar: s.nameAr })),
            { id: '00000000-0000-0000-0000-000000000099', key: 'other', en: 'Other', ar: 'أخرى' }
          ];
    }
    return [
      { id: '00000000-0000-0000-0000-000000000001', key: 'mechanic', en: 'Mobile Mechanic', ar: 'ميكانيكا متنقلة' },
      { id: '00000000-0000-0000-0000-000000000002', key: 'battery', en: 'Battery Replacement', ar: 'تبديل بطارية' },
      { id: '00000000-0000-0000-0000-000000000003', key: 'tire', en: 'Tire Change', ar: 'تغيير إطار' },
      { id: '00000000-0000-0000-0000-000000000004', key: 'fuel', en: 'Fuel Delivery', ar: 'توصيل وقود' },
      { id: '00000000-0000-0000-0000-000000000099', key: 'other', en: 'Other', ar: 'أخرى' }
    ];
  }, [boot.data?.serviceTypes]);

  useEffect(() => {
    if (provider || user) {
      setFullName(provider?.fullName || user?.fullName || '');
      setEmail(provider?.email || user?.email || '');
      setPhone(provider?.phone || user?.phone || '');
      if (provider?.yearsExperience !== undefined && provider?.yearsExperience !== null) {
        setYearsExperience(String(provider.yearsExperience));
      }
      setCoverageArea(provider?.coverageArea || user?.areaLabel || '');
    }
  }, [provider, user]);

  useEffect(() => {
    if (!provider?.expertiseJson) return;
    try {
      const parsed = JSON.parse(provider.expertiseJson);
      if (!Array.isArray(parsed)) return;
      const aliasMap = {
        general: 'mechanic',
        diagnostics: 'mechanic',
        engine_repair: 'mechanic',
        battery_jump: 'battery',
        tire_change: 'tire',
        fuel_delivery: 'fuel'
      };
      const mapped = parsed
        .map((item) => {
          const raw = String(item || '').trim();
          if (!raw) return null;
          const byId = baseOptions.find((o) => o.id.toLowerCase() === raw.toLowerCase());
          if (byId) return byId.id;
          const targetKey = aliasMap[raw] || raw;
          const byKey = baseOptions.find((o) => o.key === targetKey);
          if (byKey) return byKey.id;
          return raw;
        })
        .filter(Boolean);
      setExpertise(Array.from(new Set(mapped)));
    } catch {
      // Ignore malformed JSON
    }
  }, [provider?.expertiseJson, baseOptions]);

  const expertiseOptions = useMemo(() => {
    const knownIds = new Set(baseOptions.map((o) => o.id.toLowerCase()));
    const extras = expertise
      .filter((id) => !knownIds.has(String(id).toLowerCase()))
      .map((id) => ({
        id: String(id),
        key: String(id),
        en: providerLabel(id, false),
        ar: providerLabel(id, true)
      }));
    return [...baseOptions, ...extras];
  }, [baseOptions, expertise]);

  const toggleExpertise = (id) => {
    setExpertise((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setError('');
    if (!fullName.trim() || !phone.trim()) {
      setError(isAr ? 'الاسم ورقم الهاتف مطلوبان.' : 'Full name and phone are required.');
      return;
    }
    const rawExp = String(yearsExperience).trim();
    const expNum = Number(rawExp);
    if (rawExp === '' || !Number.isFinite(expNum) || expNum < 0 || expNum > 60) {
      setError(isAr ? 'يرجى إدخال سنوات خبرة صحيحة.' : 'Please enter valid years of experience.');
      return;
    }
    setBusy(true);
    try {
      const radNum = Number(provider?.coverageRadiusKm ?? 10);
      const validGuids = expertise.filter((id) =>
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(String(id))
      );
      await put('/providers/me', {
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        yearsExperience: Math.round(expNum),
        expertise: validGuids,
        coverageRadiusKm: radNum > 0 ? radNum : 10,
        coverageArea: coverageArea.trim() || provider?.coverageArea || null
      });
      qc.invalidateQueries({ queryKey: k.provider });
      await loadMe?.();
      setToast(isAr ? 'تم حفظ التغييرات بنجاح' : 'Profile updated successfully');
      setTimeout(() => nav.go('M09'), 250);
    } catch (err) {
      setError(err?.message || (isAr ? 'تعذر حفظ الملف.' : 'Could not save profile.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <MechanicShell code="M14">
      <div>
        <h1 className={`text-lg font-bold ${colors.text}`}>
          {isAr ? 'تعديل الملف المهني' : 'Edit professional profile'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {`${getFullName(user, provider, isAr)} · ${isAr ? 'ميكانيكي معتمد' : 'Verified mechanic'}`}
        </p>
      </div>

      <div className="space-y-2">
        <div>
          <label htmlFor="m14-fullName" className={`block text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'الاسم الكامل' : 'Full name'}
          </label>
          <input
            id="m14-fullName"
            data-testid="field-fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={`w-full px-3 h-10 rounded-xl border ${colors.border} ${colors.inputBg} text-xs ${colors.text}`}
          />
        </div>
        <div>
          <label htmlFor="m14-email" className={`block text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'البريد الإلكتروني' : 'Email address'}
          </label>
          <input
            id="m14-email"
            type="email"
            data-testid="field-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full px-3 h-10 rounded-xl border ${colors.border} ${colors.inputBg} text-xs ${colors.text}`}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="m14-phone" className={`block text-[10px] ${colors.secondaryText}`}>{isAr ? 'الهاتف' : 'Phone'}</label>
            <input
              id="m14-phone"
              dir="ltr"
              data-testid="field-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={`w-full px-3 h-10 rounded-xl border ${colors.border} ${colors.inputBg} text-xs ${colors.text}`}
            />
          </div>
          <div>
            <label htmlFor="m14-yearsExperience" className={`block text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'سنوات الخبرة' : 'Experience (years)'}
            </label>
            <input
              id="m14-yearsExperience"
              type="number"
              min="0"
              max="60"
              data-testid="field-yearsExperience"
              value={yearsExperience}
              onChange={(e) => setYearsExperience(e.target.value)}
              className={`w-full px-3 h-10 rounded-xl border ${colors.border} ${colors.inputBg} text-xs ${colors.text}`}
            />
          </div>
        </div>
      </div>

      <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} space-y-2 text-xs`}>
        <p className={`font-bold ${colors.text}`}>{isAr ? 'التخصصات' : 'Expertise'}</p>
        <div className="flex flex-wrap gap-1.5">
          {expertiseOptions.map((opt) => {
            const active = expertise.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active}
                data-testid={`expertise-${opt.key}`}
                onClick={() => toggleExpertise(opt.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition inline-flex items-center gap-1 ${
                  active
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-500'
                    : `${colors.border} ${colors.secondaryText}`
                }`}
              >
                {active && <CheckCircle2 size={11} className="shrink-0" />}
                <span>{isAr ? opt.ar : opt.en}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <PrimaryButton onClick={handleSave} disabled={busy} testId="screen-primary">
        {isAr ? 'حفظ التغييرات' : 'Save Changes'}
      </PrimaryButton>
    </MechanicShell>
  );
}

// ==========================================
// M15: Coverage & availability
// ==========================================
export function M15Screen() {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const qc = useQueryClient();
  const { user } = useSession();
  const { data: provider } = useProvider();
  const goOnline = useGoOnline();

  const [coverageArea, setCoverageArea] = useState('');
  const [radius, setRadius] = useState('');
  const [availableOnline, setAvailableOnline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (provider) {
      setCoverageArea(provider.coverageArea || user?.areaLabel || '');
      if (provider.coverageRadiusKm !== undefined && provider.coverageRadiusKm !== null) {
        setRadius(String(provider.coverageRadiusKm));
      }
      setAvailableOnline(Boolean(provider.isOnline));
    } else if (user?.areaLabel) {
      setCoverageArea(user.areaLabel);
    }
  }, [provider, user?.areaLabel]);

  const handleToggleOnline = async () => {
    const next = !availableOnline;
    setAvailableOnline(next);
    try {
      await goOnline.mutateAsync({
        isOnline: next,
        latitude: provider?.latitude ?? null,
        longitude: provider?.longitude ?? null
      });
    } catch {
      // Handled on save if offline/unverified
    }
  };

  const handleSave = async () => {
    setError('');
    const radNum = Number(radius);
    if (!coverageArea.trim()) {
      setError(isAr ? 'يرجى إدخال منطقة التغطية.' : 'Please enter your coverage area.');
      return;
    }
    if (String(radius).trim() === '' || !Number.isFinite(radNum) || radNum < 1 || radNum > 200) {
      setError(isAr ? 'يرجى إدخال نصف قطر تغطية بين ١ و ٢٠٠ كم.' : 'Please enter a coverage radius between 1 and 200 km.');
      return;
    }
    setBusy(true);
    try {
      const expNum = Number(provider?.yearsExperience ?? 0);
      await put('/providers/me', {
        coverageArea: coverageArea.trim(),
        coverageRadiusKm: radNum,
        yearsExperience: expNum >= 0 ? expNum : 0,
        latitude: provider?.latitude ?? null,
        longitude: provider?.longitude ?? null
      });
      qc.invalidateQueries({ queryKey: k.provider });
      nav.go('M09');
    } catch (err) {
      setError(err?.message || (isAr ? 'تعذر حفظ نطاق التغطية.' : 'Could not save coverage.'));
    } finally {
      setBusy(false);
    }
  };

  const radiusNum = Number(radius);
  const radiusLabel = String(radius).trim() !== '' && Number.isFinite(radiusNum) && radiusNum > 0
    ? fmtDistance(radiusNum, lang)
    : null;

  return (
    <MechanicShell code="M15">
      <div>
        <h1 className={`text-lg font-bold ${colors.text}`}>
          {isAr ? 'نطاق التغطية والتواجد' : 'Coverage & availability'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {`${getFullName(user, provider, isAr)} · ${isAr ? 'اعمل بأمان وبشروطك.' : 'Work safely, on your terms.'}`}
        </p>
      </div>

      <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} flex items-center justify-between text-xs`}>
        <div>
          <p className={`font-bold ${colors.text}`}>
            {isAr ? 'متاح لاستقبال طلبات جديدة' : 'Available for new requests'}
          </p>
          <p className={`text-[10px] ${colors.secondaryText}`}>
            {availableOnline
              ? isAr ? 'متصل · يستقبل المهام القريبة' : 'Online · Receiving nearby jobs'
              : isAr ? 'غير متصل حالياً' : 'Currently offline'}
          </p>
        </div>
        <button
          type="button"
          data-testid="toggle-availability"
          onClick={handleToggleOnline}
          className={`w-10 h-5 rounded-full p-0.5 flex items-center transition ${
            availableOnline ? 'bg-emerald-500 justify-end' : 'bg-slate-400 justify-start'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-white shadow" />
        </button>
      </div>

      <MapView
        label={[coverageArea || (isAr ? 'منطقة التغطية' : 'Coverage area'), radiusLabel].filter(Boolean).join(' · ')}
        subtitle={availableOnline ? (isAr ? 'متصل' : 'Online') : (isAr ? 'غير متصل' : 'Offline')}
      />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="m15-coverageArea" className={`block text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'منطقة التغطية' : 'Coverage area'}
          </label>
          <input
            id="m15-coverageArea"
            data-testid="field-coverageArea"
            value={coverageArea}
            onChange={(e) => setCoverageArea(e.target.value)}
            placeholder={isAr ? 'مثال: مدينة نصر، القاهرة' : 'e.g. Nasr City, Cairo'}
            className={`w-full px-3 h-10 rounded-xl border ${colors.border} ${colors.inputBg} text-xs ${colors.text}`}
          />
        </div>
        <div>
          <label htmlFor="m15-radius" className={`block text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'نصف القطر (كم)' : 'Radius (km)'}
          </label>
          <input
            id="m15-radius"
            type="number"
            min="1"
            max="200"
            data-testid="field-coverageRadiusKm"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            placeholder="10"
            className={`w-full px-3 h-10 rounded-xl border ${colors.border} ${colors.inputBg} text-xs ${colors.text}`}
          />
        </div>
      </div>

      <div>
        <input
          type="range"
          min="1"
          max="50"
          aria-label={isAr ? 'نصف القطر' : 'Radius slider'}
          value={Number.isFinite(radiusNum) && radiusNum >= 1 ? Math.min(50, radiusNum) : 10}
          onChange={(e) => setRadius(e.target.value)}
          className="w-full accent-[#E51C23]"
        />
      </div>

      {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}

      <PrimaryButton onClick={handleSave} disabled={busy} testId="screen-primary">
        {isAr ? 'حفظ إعدادات التواجد' : 'Save Availability'}
      </PrimaryButton>
    </MechanicShell>
  );
}

export const MECHANIC_COMPONENTS = {
  M01: M01Screen,
  M02: M02Screen,
  M03: M03Screen,
  M04: M04Screen,
  M05: M05Screen,
  M06: M06Screen,
  M07: M07Screen,
  M08: M08Screen,
  M09: M09Screen,
  M10: M10Screen,
  M11: M11Screen,
  M12: M12Screen,
  M13: M13Screen,
  M14: M14Screen,
  M15: M15Screen
};

export default MECHANIC_COMPONENTS;
