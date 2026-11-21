import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  MapPin,
  Phone,
  ChevronLeft,
  ChevronRight,
  Upload,
  MessageSquare,
  Check,
  Car,
  User,
  AlertTriangle,
  Receipt
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { usePrefs, useNav, useSession } from '../../app/stores.jsx';
import { post, put, fileUrl, uploadFile } from '../../api/http.js';
import {
  k,
  useCenters,
  useProvider,
  useOffers,
  useRequests,
  useRequest,
  useTimeline,
  useEarnings,
  useWallet,
  useKyc,
  useProviderHistory,
  useGoOnline,
  useAcceptOffer,
  useDeclineOffer,
  useAdvanceStatus,
  useInvoiceForRequest
} from '../../api/hooks.js';
import {
  AppTopBar,
  Avatar,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  MapView,
  Toast,
  useColors,
  formatLabel
} from '../../ui/kit.jsx';
import { providerLabel, plural } from '../auth/providerLabels.js';
import {
  fmtMoney,
  fmtNumber,
  fmtDate,
  fmtTime,
  fmtDateTime,
  fmtDistance,
  toUtcDate
} from '../../i18n/format.js';
import { NIGHT_CAR_IMAGE } from '../../assets/images.js';

const MAIN_CODES = ['T01', 'T02', 'T09', 'T10', 'T11', 'T12'];

const FLATBED_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 320" width="800" height="320">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="800" height="320" fill="url(#bg)"/>
  <rect x="0" y="245" width="800" height="75" fill="#090d16"/>
  <line x1="0" y1="245" x2="800" y2="245" stroke="#E51C23" stroke-width="3"/>
  <g transform="translate(110, 105)">
    <rect x="0" y="95" width="380" height="16" rx="4" fill="#64748b"/>
    <path d="M25 90 L65 55 L250 55 L285 90 Z" fill="#334155" stroke="#94a3b8" stroke-width="2"/>
    <circle cx="85" cy="92" r="16" fill="#0f172a" stroke="#cbd5e1" stroke-width="3"/>
    <circle cx="235" cy="92" r="16" fill="#0f172a" stroke="#cbd5e1" stroke-width="3"/>
    <path d="M385 30 L495 30 L535 72 L535 112 L385 112 Z" fill="#E51C23"/>
    <path d="M405 42 L485 42 L515 72 L405 72 Z" fill="#0f172a"/>
    <rect x="415" y="16" width="36" height="10" rx="4" fill="#fbbf24"/>
    <circle cx="110" cy="120" r="24" fill="#090a0f" stroke="#94a3b8" stroke-width="5"/>
    <circle cx="310" cy="120" r="24" fill="#090a0f" stroke="#94a3b8" stroke-width="5"/>
    <circle cx="475" cy="120" r="24" fill="#090a0f" stroke="#94a3b8" stroke-width="5"/>
  </g>
</svg>`)}`;

function CaptainShell({ code, children }) {
  const colors = useColors();
  const nav = useNav();
  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={!MAIN_CODES.includes(code)} onBack={() => nav.back()} />
      <div className="flex-1 p-4 space-y-3.5">{children}</div>
    </div>
  );
}

function AvatarBadge({ name, className = 'w-10 h-10' }) {
  const initials = (name || 'C')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return (
    <div
      className={`${className} rounded-xl bg-[#E51C23]/15 border border-[#E51C23]/30 text-[#E51C23] font-extrabold text-xs flex items-center justify-center shrink-0`}
    >
      {initials || <User size={16} />}
    </div>
  );
}

function formatCountdown(expiresAt) {
  const exp = toUtcDate(expiresAt);
  if (!exp) return '05:00';
  const rawDiff = Math.max(0, Math.floor((exp.getTime() - Date.now()) / 1000));
  const diffSec = Math.min(rawDiff, 600);
  const mins = String(Math.floor(diffSec / 60)).padStart(2, '0');
  const secs = String(diffSec % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

function computeTowBreakdown(totalMinor) {
  const total = Math.max(0, Number(totalMinor ?? 0));
  if (total === 0) {
    return { baseMinor: 0, distanceMinor: 0, feeMinor: 0, totalMinor: 0 };
  }
  const feeMinor = total >= 5000 ? 5000 : Math.round(total * 0.08);
  const net = Math.max(0, total - feeMinor);
  const capped = Math.min(net, 45000);
  const baseMinor = capped > 0 ? capped : Math.round(net * 0.75);
  const distanceMinor = Math.max(0, net - baseMinor);
  return { baseMinor, distanceMinor, feeMinor, totalMinor: total };
}

function fmtOptionalDistance(km, lang) {
  const n = Number(km);
  if (km === null || km === undefined || !Number.isFinite(n) || n <= 0) return '—';
  return fmtDistance(n, lang);
}

function computeTripMinutes(req) {
  const start = toUtcDate(req?.acceptedAt);
  const end = toUtcDate(req?.completedAt);
  if (!start || !end || end.getTime() < start.getTime()) return null;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
}

function useActiveTowRequest(id) {
  const reqQuery = useRequest(id);
  const listQuery = useRequests();
  const list = Array.isArray(listQuery.data) ? listQuery.data : [];
  const resolved = useMemo(() => {
    if (id && reqQuery.data) return reqQuery.data;
    if (id && list.length > 0) {
      const found = list.find((r) => String(r.id) === String(id));
      if (found) return found;
    }
    const active = list.find(
      (r) => !['Completed', 'Cancelled', 'NoProviders'].includes(String(r.status))
    );
    return active || list[0] || null;
  }, [id, reqQuery.data, list]);
  return { req: resolved, isLoading: reqQuery.isLoading && listQuery.isLoading, refetch: reqQuery.refetch };
}

function screenForRequestStatus(status) {
  switch (String(status)) {
    case 'Accepted':
      return 'T04';
    case 'EnRoute':
      return 'T05';
    case 'Arrived':
    case 'QuotePending':
    case 'QuoteApproved':
      return 'T06';
    case 'Working':
      return 'T07';
    case 'AwaitingPayment':
      return 'T14';
    case 'Completed':
      return 'T13';
    default:
      return 'T04';
  }
}

// ==========================================
// T01: Captain dashboard (OFF duty)
// ==========================================
export function T01Screen() {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const { user } = useSession();
  const providerQ = useProvider();
  const requestsQ = useRequests();
  const earningsQ = useEarnings();
  const goOnline = useGoOnline();
  const [error, setError] = useState('');

  const provider = providerQ.data;
  const earnings = earningsQ.data;
  const requests = Array.isArray(requestsQ.data) ? requestsQ.data : [];

  if (provider?.isOnline) {
    return <T02Screen />;
  }

  const displayName = provider?.fullName || user?.fullName || (isAr ? 'الكابتن' : 'Captain');
  const firstName = displayName.split(' ')[0] || displayName;
  const truckMake = provider?.truckMake || (provider?.truckType ? providerLabel(provider.truckType, isAr) : (isAr ? 'ونش سطحة' : 'Flatbed Tow Truck'));
  const truckPlate = provider?.truckPlate || '—';
  const capacityText = provider?.truckCapacityTonnes != null ? `${provider.truckCapacityTonnes}t` : '—';
  const rating = Number(provider?.rating ?? earnings?.rating ?? 0).toFixed(1);

  const todayIso = new Date().toISOString().slice(0, 10);
  const todayTrips = requests.filter(
    (r) => r.status === 'Completed' && String(r.createdAt || '').slice(0, 10) === todayIso
  );
  const todayCount = todayTrips.length;
  const todayMinor = todayTrips.reduce((acc, r) => acc + (r.quoteMinor ?? r.estimateMinor ?? 0), 0);

  const handleGoOnline = async () => {
    setError('');
    try {
      await goOnline.mutateAsync({
        isOnline: true,
        latitude: provider?.latitude ?? 30.0444,
        longitude: provider?.longitude ?? 31.2357
      });
      nav.go('T02');
    } catch (err) {
      setError(err?.message || (isAr ? 'تعذر بدء الخدمة.' : 'Could not go on duty.'));
    }
  };

  return (
    <CaptainShell code="T01">
      <div>
        <h1 className={`text-lg font-extrabold ${colors.text}`}>
          {isAr ? 'لوحة الكابتن' : 'Captain dashboard'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {isAr
            ? `أهلاً يا ${firstName}. ونشك، وجدولك الخاص.`
            : `Hello, ${firstName}. Your truck, your schedule.`}
        </p>
      </div>

      <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} flex items-center justify-between`}>
        <div>
          <p className={`text-xs font-bold ${colors.text}`}>
            {isAr ? 'أنت خارج الخدمة' : "You're OFF duty"}
          </p>
          <p className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'اتصل عندما تكون مستعداً لاستقبال الطلبات.' : "Go online when you're ready for dispatch."}
          </p>
        </div>
        <button
          type="button"
          onClick={handleGoOnline}
          disabled={goOnline.isPending}
          aria-label={isAr ? 'بدء الخدمة' : 'Go Online'}
          className="w-10 h-5 rounded-full bg-slate-300 p-0.5 flex items-center justify-start"
        >
          <span className="w-4 h-4 rounded-full bg-white shadow" />
        </button>
      </div>

      <div className={`rounded-2xl border ${colors.border} ${colors.surface} overflow-hidden text-xs`}>
        <img src={FLATBED_SVG} alt="Flatbed" className="w-full h-28 object-cover" />
        <div className="p-3 space-y-1">
          <p className={`font-bold ${colors.text}`}>{truckMake}</p>
          <div className="flex justify-between">
            <span className={colors.secondaryText}>{isAr ? 'لوحة الونش' : 'Truck plate'}</span>
            <span className={`font-bold ${colors.text}`} dir="ltr">{truckPlate}</span>
          </div>
          <div className="flex justify-between">
            <span className={colors.secondaryText}>{isAr ? 'الحمولة' : 'Capacity'}</span>
            <span className={`font-bold ${colors.text}`} dir="ltr">
              {capacityText}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
          <p className={`text-sm font-extrabold ${colors.text}`}>{fmtNumber(todayCount, lang)}</p>
          <p className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'رحلات اليوم' : "Today's trips"}
          </p>
        </div>
        <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
          <p className={`text-sm font-extrabold ${colors.text}`}>{rating}</p>
          <p className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'التقييم' : 'Rating'}
          </p>
        </div>
        <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
          <p className={`text-sm font-extrabold ${colors.text}`}>{fmtMoney(todayMinor, lang)}</p>
          <p className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'أرباح اليوم' : 'Today'}
          </p>
        </div>
      </div>

      {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}

      {(provider?.kycStatus || user?.kycStatus) && (provider?.kycStatus || user?.kycStatus) !== 'Approved' && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-amber-600 dark:text-amber-400">
              {isAr ? 'بانتظار اعتماد التوثيق' : 'Verification required to go on duty'}
            </span>
            <StatusBadge status={provider?.kycStatus || user?.kycStatus} />
          </div>
          <p className={`text-[11px] ${colors.secondaryText}`}>
            {isAr
              ? 'يجب اعتماد أوراق الونش من الإدارة قبل استقبال طلبات السحب الحية.'
              : 'Admin verification approval is required before receiving live tow requests.'}
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

      <PrimaryButton onClick={handleGoOnline} disabled={goOnline.isPending} testId="screen-primary">
        {isAr ? 'بدء الخدمة (متاح الآن)' : 'Go Online'}
      </PrimaryButton>
    </CaptainShell>
  );
}

// ==========================================
// T02: Captain dashboard (ON duty)
// ==========================================
export function T02Screen() {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const { user } = useSession();
  const providerQ = useProvider();
  const offersQ = useOffers();
  const requestsQ = useRequests();
  const earningsQ = useEarnings();
  const goOnline = useGoOnline();
  const [error, setError] = useState('');
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const provider = providerQ.data;
  const earnings = earningsQ.data;
  const offers = Array.isArray(offersQ.data) ? offersQ.data : [];
  const requests = Array.isArray(requestsQ.data) ? requestsQ.data : [];

  const displayName = provider?.fullName || user?.fullName || (isAr ? 'الكابتن' : 'Captain');
  const truckMake = provider?.truckMake || (provider?.truckType ? providerLabel(provider.truckType, isAr) : (isAr ? 'ونش سطحة' : 'Flatbed Tow Truck'));
  const truckPlate = provider?.truckPlate || '—';
  const capacityText = provider?.truckCapacityTonnes != null ? `${provider.truckCapacityTonnes}t` : null;
  const rating = Number(provider?.rating ?? earnings?.rating ?? 0).toFixed(1);
  const completedCount = earnings?.completedJobs ?? provider?.completedJobs ?? 0;
  const availableMinor = earnings?.availableMinor ?? 0;

  const pendingOffers = offers.filter((o) => !o.status || o.status === 'Pending');
  const liveOffer = pendingOffers[0] || offers[0] || null;
  const extraOffers = pendingOffers.slice(1, 5);
  const activeTrip = requests.find(
    (r) =>
      r.assignedProviderId &&
      String(r.assignedProviderId) === String(user?.id) &&
      !['Completed', 'Cancelled', 'NoProviders', 'Searching', 'Offered'].includes(String(r.status))
  );

  const handleGoOffline = async () => {
    setError('');
    try {
      await goOnline.mutateAsync({
        isOnline: false,
        latitude: provider?.latitude ?? 30.0444,
        longitude: provider?.longitude ?? 31.2357
      });
      nav.go('T01');
    } catch (err) {
      setError(err?.message || (isAr ? 'تعذر إيقاف الخدمة.' : 'Could not go off duty.'));
    }
  };

  return (
    <CaptainShell code="T02">
      <div>
        <h1 className={`text-lg font-extrabold ${colors.text}`}>
          {isAr ? 'لوحة الكابتن' : 'Captain dashboard'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {`${displayName} · ${truckMake} (${[truckPlate, capacityText].filter(Boolean).join(' · ')})`}
        </p>
      </div>

      <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} flex items-center justify-between`}>
        <div className="space-y-1">
          <p className={`text-xs font-bold ${colors.text}`}>
            {isAr ? 'أنت في الخدمة' : "You're ON duty"}
          </p>
          <StatusBadge status="Online" text={isAr ? 'متصل · جاهز لاستقبال الطلبات' : 'Online · Ready for dispatch'} />
        </div>
        <button
          type="button"
          onClick={handleGoOffline}
          disabled={goOnline.isPending}
          aria-label={isAr ? 'إيقاف الخدمة' : 'Go Off Duty'}
          className="w-10 h-5 rounded-full bg-emerald-500 p-0.5 flex items-center justify-end"
        >
          <span className="w-4 h-4 rounded-full bg-white shadow" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
          <p className={`text-sm font-extrabold ${colors.text}`}>{fmtNumber(completedCount, lang)}</p>
          <p className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'رحلات مكتملة' : 'Completed trips'}
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
            {isAr ? 'الرصيد المتاح' : 'Balance'}
          </p>
        </div>
      </div>

      {liveOffer ? (
        <>
          <div
            onClick={() => nav.go('T03', { id: liveOffer.id })}
            className="p-3.5 rounded-2xl border border-[#E51C23]/40 bg-[#E51C23]/10 space-y-1.5 cursor-pointer text-xs"
            data-testid="live-offer-card"
          >
            <div className="flex justify-between text-[10px] font-bold text-[#E51C23]">
              <span>{`${isAr ? 'طلب سحب جديد' : 'New tow request'}${liveOffer.requestCode ? ` · ${liveOffer.requestCode}` : ''}`}</span>
              <span dir="ltr">{formatCountdown(liveOffer.expiresAt)}</span>
            </div>
            <p className={`font-bold ${colors.text}`}>
              {[liveOffer.vehicleMake, liveOffer.vehicleModel].filter(Boolean).join(' ') || (isAr ? 'ونش سطحة' : 'Flatbed Tow')}
            </p>
            <p className={`text-[11px] ${colors.secondaryText}`}>
              {`${liveOffer.pickupArea || '—'} → ${liveOffer.destinationAddress || (isAr ? 'وجهة التسليم' : 'Drop-off destination')} · ${fmtOptionalDistance(liveOffer.tripDistanceKm || liveOffer.distanceKm, lang)}`}
            </p>
            <div className={`flex justify-between pt-1 border-t ${colors.border} font-extrabold`}>
              <span className={colors.secondaryText}>{isAr ? 'عرض الرحلة' : 'Trip offer'}</span>
              <span className="text-[#E51C23]">{fmtMoney(liveOffer.priceMinor, lang)} →</span>
            </div>
          </div>
          {extraOffers.length > 0 && (
            <div className="space-y-1.5">
              <p className={`text-[11px] font-bold ${colors.secondaryText}`}>
                {isAr ? `طلبات سحب أخرى (${extraOffers.length})` : `More open tow requests (${extraOffers.length})`}
              </p>
              {extraOffers.map((item) => (
                <div
                  key={item.id}
                  onClick={() => nav.go('T03', { id: item.id })}
                  className={`p-3 rounded-2xl border border-[#E51C23]/30 ${colors.surface} flex items-center justify-between cursor-pointer text-xs`}
                >
                  <div>
                    <p className={`font-bold ${colors.text}`}>
                      {`${[item.vehicleMake, item.vehicleModel].filter(Boolean).join(' ') || (isAr ? 'ونش سطحة' : 'Flatbed Tow')}${item.requestCode ? ` · ${item.requestCode}` : ''}`}
                    </p>
                    <p className={`text-[11px] ${colors.secondaryText}`}>
                      {`${item.pickupArea || '—'} · ${fmtOptionalDistance(item.distanceKm, lang)}`}
                    </p>
                  </div>
                  <span className="font-extrabold text-[#E51C23] shrink-0">{fmtMoney(item.priceMinor, lang)} →</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : activeTrip ? (
        <div
          onClick={() => nav.go(screenForRequestStatus(activeTrip.status), { id: activeTrip.id })}
          className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 cursor-pointer text-xs`}
          data-testid="active-trip-card"
        >
          <div className="flex justify-between items-center">
            <span className={`font-bold ${colors.text}`}>
              {isAr ? `الرحلة النشطة · ${activeTrip.code}` : `Active trip · ${activeTrip.code}`}
            </span>
            <StatusBadge status={activeTrip.status} />
          </div>
          <p className={`text-[11px] ${colors.secondaryText}`}>
            {`${activeTrip.pickupAddress || '—'} → ${activeTrip.destinationAddress || (isAr ? 'الوجهة' : 'Destination')}`}
          </p>
          <span className="inline-block text-[11px] font-bold text-[#E51C23]">
            {isAr ? 'متابعة الرحلة النشطة ←' : 'Continue Active Trip →'}
          </span>
        </div>
      ) : (
        <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} flex items-center justify-between text-xs`}>
          <div>
            <p className={`font-bold ${colors.text}`}>
              {isAr ? 'بانتظار طلبات السحب القريبة مباشرة' : 'Listening live for nearby tow requests'}
            </p>
            <p className={`text-[11px] ${colors.secondaryText}`}>
              {isAr ? 'تظهر أي طلبات سحب جديدة هنا تلقائياً فور إرسالها.' : 'New customer tow requests appear here automatically in real time.'}
            </p>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        </div>
      )}

      <MapView
        label={provider?.coverageArea || provider?.areaLabel || (isAr ? 'منطقة التغطية' : 'Dispatch coverage zone')}
        subtitle={liveOffer?.requestCode || activeTrip?.code || truckPlate}
      />

      {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}

      <SecondaryButton onClick={handleGoOffline} disabled={goOnline.isPending} testId="screen-primary">
        {isAr ? 'إيقاف الخدمة' : 'Go Off Duty'}
      </SecondaryButton>
    </CaptainShell>
  );
}

// ==========================================
// T03: Incoming tow request
// ==========================================
export function T03Screen({ id }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const offersQ = useOffers();
  const acceptM = useAcceptOffer();
  const declineM = useDeclineOffer();
  const [error, setError] = useState('');
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const offers = Array.isArray(offersQ.data) ? offersQ.data : [];
  const offer = useMemo(() => {
    if (id) {
      const matched = offers.find((o) => String(o.id) === String(id) || String(o.requestId) === String(id));
      if (matched) return matched;
    }
    return offers[0] || null;
  }, [id, offers]);

  const handleAccept = async () => {
    setError('');
    if (!offer) {
      nav.go('T04');
      return;
    }
    try {
      const accepted = await acceptM.mutateAsync(offer.id);
      nav.go('T04', { id: accepted?.requestId || offer.requestId });
    } catch (err) {
      setError(err?.message || (isAr ? 'تعذر قبول العرض.' : 'Could not accept offer.'));
    }
  };

  const handleDecline = async () => {
    setError('');
    if (!offer) {
      nav.go('T02');
      return;
    }
    try {
      await declineM.mutateAsync({ id: offer.id, reason: 'declined_by_captain' });
      nav.go('T02');
    } catch (err) {
      setError(err?.message || (isAr ? 'تعذر رفض العرض.' : 'Could not decline offer.'));
    }
  };

  const vehicleLabel = offer
    ? [
        offer.vehicleMake,
        offer.vehicleModel,
        offer.vehicleYear ? `(${offer.vehicleYear}${offer.vehicleColor ? ` · ${offer.vehicleColor}` : ''})` : offer.vehicleColor
      ]
        .filter(Boolean)
        .join(' ')
    : isAr
    ? 'مركبة العميل'
    : 'Customer vehicle';

  const pickupDistText = fmtOptionalDistance(offer?.distanceKm, lang);
  const towRouteKm =
    offer?.tripDistanceKm != null && Number(offer.tripDistanceKm) > 0
      ? offer.tripDistanceKm
      : null;
  const towRouteText = fmtOptionalDistance(towRouteKm, lang);

  return (
    <CaptainShell code="T03">
      <div>
        <div className="flex items-center justify-between gap-2">
          <h1 className={`text-lg font-bold ${colors.text}`}>
            {isAr ? 'طلب سحب وارد' : 'Incoming tow request'}
          </h1>
          {offer?.isP0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-600 text-white">
              <AlertTriangle size={11} />
              {isAr ? 'طوارئ P0' : 'P0 Emergency'}
            </span>
          )}
        </div>
        <p className={`text-xs ${colors.secondaryText}`}>
          {[offer?.requestCode, offer?.customerFirstName].filter(Boolean).join(' · ') || (isAr ? 'طلب سحب نشط' : 'Active tow offer')}
        </p>
        <div className="pt-1">
          <StatusBadge
            status="Pending"
            text={
              isAr
                ? `الرد خلال ${formatCountdown(offer?.expiresAt)}`
                : `Respond in ${formatCountdown(offer?.expiresAt)}`
            }
          />
        </div>
      </div>

      <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2 text-xs`}>
        <div>
          <p className={`text-[10px] uppercase ${colors.secondaryText}`}>
            {`${isAr ? 'نقطة الالتقاء' : 'PICKUP'} · ${pickupDistText}${
              offer?.etaMinutes ? ` (${fmtNumber(offer.etaMinutes, lang)} ${isAr ? 'دقائق' : 'min'})` : ''
            }`}
          </p>
          <p className={`font-bold ${colors.text}`}>
            {offer?.pickupArea || (isAr ? 'موقع العميل' : 'Customer pickup area')}
          </p>
        </div>
        <div className={`pt-2 border-t ${colors.border}`}>
          <p className={`text-[10px] uppercase ${colors.secondaryText}`}>
            {`${isAr ? 'الوجهة · مسافة السحب' : 'DESTINATION · TOW ROUTE'} · ${towRouteText}`}
          </p>
          <p className={`font-bold ${colors.text}`}>
            {offer?.destinationAddress || (isAr ? 'وجهة التسليم' : 'Drop-off destination')}
          </p>
        </div>
      </div>

      <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} flex justify-between items-center text-xs`}>
        <span className={`font-bold ${colors.text}`}>{vehicleLabel}</span>
        <span className={`text-[10px] ${colors.secondaryText}`}>
          {isAr ? 'تظهر اللوحة بعد القبول' : 'Plate shown after accept'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
          <p className={`text-xs font-extrabold ${colors.text}`}>
            {pickupDistText}
          </p>
          <p className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'إلى الالتقاء' : 'To pickup'}
          </p>
        </div>
        <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
          <p className={`text-xs font-extrabold ${colors.text}`}>
            {towRouteText}
          </p>
          <p className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'مسافة السحب' : 'Tow route'}
          </p>
        </div>
        <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
          <p className="text-xs font-extrabold text-emerald-500">
            {fmtMoney(offer?.priceMinor ?? 0, lang)}
          </p>
          <p className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'التكلفة' : 'Price'}
          </p>
        </div>
      </div>

      {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}

      <PrimaryButton
        onClick={handleAccept}
        disabled={acceptM.isPending}
        testId="screen-primary"
      >
        {isAr
          ? `قبول طلب السحب · ${fmtMoney(offer?.priceMinor ?? 0, lang)}`
          : `Accept Tow · ${fmtMoney(offer?.priceMinor ?? 0, lang)}`}
      </PrimaryButton>
      <SecondaryButton onClick={handleDecline} disabled={declineM.isPending}>
        {isAr ? 'رفض' : 'Decline'}
      </SecondaryButton>
    </CaptainShell>
  );
}

// ==========================================
// T04: Tow request details
// ==========================================
export function T04Screen({ id }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const { req } = useActiveTowRequest(id);
  const advanceM = useAdvanceStatus();
  const [error, setError] = useState('');

  const photoId = req?.photoFileIds?.[0];
  const photoSrc = photoId ? fileUrl(photoId) : NIGHT_CAR_IMAGE;
  const fareMinor = req?.quoteMinor ?? req?.estimateMinor ?? 0;

  const handleStartNavigation = async () => {
    setError('');
    if (!req?.id) {
      nav.go('T05');
      return;
    }
    try {
      if (req.status === 'Accepted') {
        await advanceM.mutateAsync({ id: req.id, status: 'EnRoute' });
      }
      nav.go('T05', { id: req.id });
    } catch (err) {
      setError(err?.message || (isAr ? 'تعذر تحديث الحالة.' : 'Could not update status.'));
    }
  };

  return (
    <CaptainShell code="T04">
      <div>
        <h1 className={`text-lg font-bold ${colors.text}`}>
          {isAr ? 'تفاصيل طلب السحب' : 'Tow request details'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {`${req?.code || '—'} · ${isAr ? 'ونش سطحة' : 'Flatbed Tow'}`}
        </p>
      </div>

      <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs`}>
        <div className="flex items-center gap-2.5">
          <AvatarBadge name={req?.customerName} />
          <div>
            <p className={`font-bold ${colors.text}`}>
              {req?.customerName || (isAr ? 'العميل' : 'Customer')}
            </p>
            <p className={`text-[10px] ${colors.secondaryText}`}>
              {[req?.vehicleMake, req?.vehicleModel, req?.vehicleYear, req?.vehicleColor]
                .filter(Boolean)
                .join(' · ') || (isAr ? 'مركبة العميل' : 'Customer vehicle')}
            </p>
          </div>
        </div>
        <div className={`flex justify-between pt-1.5 border-t ${colors.border}`}>
          <span className={colors.secondaryText}>{isAr ? 'لوحة المركبة' : 'Vehicle plate'}</span>
          <span className={`font-bold ${colors.text}`} dir="ltr">
            {req?.vehiclePlate || '—'}
          </span>
        </div>
      </div>

      <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} space-y-2 text-xs`}>
        <img src={photoSrc} alt="Vehicle problem" className="w-full h-24 rounded-xl object-cover" />
        {(req?.note || req?.problem) && (
          <p className={`text-[11px] ${colors.secondaryText}`}>
            {`"${req.note || req.problem}"`}
          </p>
        )}
        <div className="space-y-1 pt-1">
          <div className="flex justify-between">
            <span className={colors.secondaryText}>{isAr ? 'نقطة الالتقاء' : 'Pickup'}</span>
            <span className={`font-bold ${colors.text}`}>{req?.pickupAddress || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className={colors.secondaryText}>{isAr ? 'الوجهة' : 'Destination'}</span>
            <span className={`font-bold ${colors.text}`}>
              {req?.destinationAddress || (isAr ? 'وجهة التسليم' : 'Drop-off destination')}
            </span>
          </div>
        </div>
        <div className={`flex justify-between pt-1 border-t ${colors.border}`}>
          <span className={colors.secondaryText}>{isAr ? 'التكلفة التقديرية' : 'Estimated fare'}</span>
          <span className={`font-extrabold ${colors.text}`}>{fmtMoney(fareMinor, lang)}</span>
        </div>
      </div>

      {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}

      <PrimaryButton
        onClick={handleStartNavigation}
        disabled={advanceM.isPending}
        testId="screen-primary"
      >
        {isAr ? 'بدء الملاحة إلى نقطة الالتقاء' : 'Start Navigation to Pickup'}
      </PrimaryButton>
    </CaptainShell>
  );
}

// ==========================================
// T05: Heading to pickup · step 3/7
// ==========================================
export function T05Screen({ id }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const { req } = useActiveTowRequest(id);
  const offersQ = useOffers();
  const providerQ = useProvider();
  const advanceM = useAdvanceStatus();
  const [error, setError] = useState('');

  const step = 3;
  const customerPhone = req?.customerPhone || '';
  const offers = Array.isArray(offersQ.data) ? offersQ.data : [];
  const matchedOffer = useMemo(
    () => (req?.id ? offers.find((o) => String(o.requestId) === String(req.id)) : offers[0]) || null,
    [offers, req?.id]
  );
  const pickupKm = req?.pickupDistanceKm ?? matchedOffer?.distanceKm ?? null;
  const pickupDistLabel =
    pickupKm != null && Number(pickupKm) > 0
      ? `${fmtDistance(pickupKm, lang)} · ${isAr ? 'إلى نقطة الالتقاء' : 'to pickup'}`
      : isAr
      ? 'في الطريق إلى نقطة الالتقاء'
      : 'Heading to pickup';

  const mapMarkers = useMemo(() => {
    const m = [];
    if (req?.pickupLatitude != null && req?.pickupLongitude != null) {
      m.push({ lat: req.pickupLatitude, lng: req.pickupLongitude });
    }
    const pLat = req?.providerLatitude ?? providerQ.data?.latitude;
    const pLng = req?.providerLongitude ?? providerQ.data?.longitude;
    if (pLat != null && pLng != null) {
      m.push({ lat: pLat, lng: pLng });
    }
    return m;
  }, [
    req?.pickupLatitude,
    req?.pickupLongitude,
    req?.providerLatitude,
    req?.providerLongitude,
    providerQ.data?.latitude,
    providerQ.data?.longitude
  ]);

  const handleArrived = async () => {
    setError('');
    if (!req?.id) {
      nav.go('T06');
      return;
    }
    try {
      if (req.status === 'Accepted') {
        await advanceM.mutateAsync({ id: req.id, status: 'EnRoute' });
      }
      if (req.status === 'Accepted' || req.status === 'EnRoute') {
        await advanceM.mutateAsync({ id: req.id, status: 'Arrived' });
      }
      nav.go('T06', { id: req.id });
    } catch (err) {
      setError(err?.message || (isAr ? 'تعذر تحديث الحالة.' : 'Could not update status.'));
    }
  };

  return (
    <CaptainShell code="T05">
      <div>
        <h1 className={`text-lg font-bold ${colors.text}`}>
          {isAr ? 'في الطريق لنقطة الالتقاء' : 'Heading to pickup'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {[req?.code, req?.pickupAddress].filter(Boolean).join(' · ')}
        </p>
      </div>

      <MapView
        label={pickupDistLabel}
        subtitle={req?.pickupAddress || ''}
        markers={mapMarkers}
      />

      <div className="space-y-1">
        <div className="flex justify-between text-[11px]">
          <span className={colors.secondaryText}>{isAr ? 'خطوة ٣ من ٧' : 'Step 3 of 7'}</span>
          <span className={`font-bold ${colors.text}`}>{isAr ? 'في الطريق' : 'En route'}</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-slate-500/20 overflow-hidden">
          <div className="h-full bg-[#E51C23] rounded-full" style={{ width: `${(step / 7) * 100}%` }} />
        </div>
      </div>

      <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs`}>
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <AvatarBadge name={req?.customerName} />
            <div>
              <p className={`font-bold ${colors.text}`}>
                {req?.customerName || (isAr ? 'العميل' : 'Customer')}
              </p>
              <p className={`text-[10px] ${colors.secondaryText}`}>
                {[req?.vehicleMake, req?.vehicleModel, req?.vehiclePlate].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          {customerPhone && (
            <a
              href={`tel:${customerPhone}`}
              className="px-3 py-1.5 rounded-xl bg-[#E51C23]/15 text-[#E51C23] font-bold text-[11px] inline-flex items-center gap-1"
            >
              <Phone size={12} />
              {isAr ? 'اتصال' : 'Call'}
            </a>
          )}
        </div>
        {customerPhone && (
          <div className={`flex justify-between pt-1.5 border-t ${colors.border}`}>
            <span className={colors.secondaryText}>{isAr ? 'هاتف العميل' : 'Customer phone'}</span>
            <span className={`font-bold ${colors.text}`} dir="ltr">{customerPhone}</span>
          </div>
        )}
      </div>

      {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}

      <PrimaryButton
        onClick={handleArrived}
        disabled={advanceM.isPending}
        testId="screen-primary"
      >
        {isAr ? 'وصلت إلى العميل' : 'Arrived at Customer'}
      </PrimaryButton>
      <SecondaryButton onClick={() => nav.go('SH01', { requestId: req?.id, id: req?.id })}>
        <MessageSquare size={14} />
        {isAr ? 'محادثة مع العميل' : 'Chat with Customer'}
      </SecondaryButton>
    </CaptainShell>
  );
}

// ==========================================
// T06: Load the vehicle safely · step 4/7
// ==========================================
export function T06Screen({ id }) {
  const colors = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const qc = useQueryClient();
  const { req, refetch } = useActiveTowRequest(id);
  const advanceM = useAdvanceStatus();

  const [checks, setChecks] = useState([false, false, false, false]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const step = 4;
  const items = [
    isAr ? 'تم التأكد من العميل والمركبة' : 'Customer & vehicle confirmed',
    isAr ? 'تم تحرير فرامل اليد' : 'Parking brake released',
    isAr ? 'تم ربط العجلات الأربع بإحكام' : 'All four wheels securely strapped',
    isAr ? 'تم فحص أضواء الأمان والمنحدرات' : 'Safety lights and ramps checked'
  ];

  const toggleItem = (idx) => {
    setChecks((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !req?.id) return;
    setError('');
    setUploading(true);
    try {
      const uploaded = await uploadFile(file, 'condition');
      await post(`/requests/${req.id}/photos`, { fileId: uploaded.id });
      await qc.invalidateQueries({ queryKey: k.requests });
      await refetch?.();
    } catch (err) {
      setError(err?.message || (isAr ? 'تعذر رفع الصورة.' : 'Could not upload photo.'));
    } finally {
      setUploading(false);
    }
  };

  const handleVehicleLoaded = async () => {
    setError('');
    if (!req?.id) {
      nav.go('T07');
      return;
    }
    try {
      if (req.status === 'Accepted') {
        await advanceM.mutateAsync({ id: req.id, status: 'EnRoute' });
        await advanceM.mutateAsync({ id: req.id, status: 'Arrived' });
      } else if (req.status === 'EnRoute') {
        await advanceM.mutateAsync({ id: req.id, status: 'Arrived' });
      }
      if (['Accepted', 'EnRoute', 'Arrived', 'QuoteApproved'].includes(String(req.status))) {
        await advanceM.mutateAsync({ id: req.id, status: 'Working' });
      }
      nav.go('T07', { id: req.id });
    } catch (err) {
      setError(err?.message || (isAr ? 'تعذر تأكيد التحميل.' : 'Could not advance status.'));
    }
  };

  const photoId = req?.photoFileIds?.[0];
  const photoSrc = photoId ? fileUrl(photoId) : FLATBED_SVG;

  return (
    <CaptainShell code="T06">
      <div>
        <h1 className={`text-lg font-bold ${colors.text}`}>
          {isAr ? 'تحميل المركبة بأمان' : 'Load the vehicle safely'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {[req?.code, req?.vehicleMake, req?.vehicleModel, req?.vehiclePlate].filter(Boolean).join(' · ')}
        </p>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[11px]">
          <span className={colors.secondaryText}>{isAr ? 'خطوة ٤ من ٧' : 'Step 4 of 7'}</span>
          <span className={`font-bold ${colors.text}`}>{isAr ? 'وصل للموقع' : 'Arrived'}</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-slate-500/20 overflow-hidden">
          <div className="h-full bg-[#E51C23] rounded-full" style={{ width: `${(step / 7) * 100}%` }} />
        </div>
      </div>

      <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2 text-xs`}>
        <p className={`font-bold ${colors.text}`}>
          {isAr ? 'قائمة التحقق من التحميل' : 'Loading checklist'}
        </p>
        {items.map((label, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => toggleItem(idx)}
            data-testid={`loading-check-${idx}`}
            className="w-full flex items-center gap-2 text-start"
          >
            <span
              className={`w-4 h-4 rounded flex items-center justify-center border ${
                checks[idx]
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : `${colors.border} ${colors.secondaryText}`
              }`}
            >
              {checks[idx] && <Check size={11} />}
            </span>
            <span className={checks[idx] ? 'text-emerald-500 font-semibold' : colors.text}>
              {label}
            </span>
          </button>
        ))}
      </div>

      <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} space-y-2 text-xs`}>
        <p className={`font-bold ${colors.text}`}>
          {isAr ? 'صور حالة المركبة' : 'Vehicle condition photos'}
        </p>
        <img src={photoSrc} alt="Condition" className="w-full h-20 rounded-xl object-cover" />
        <label
          className={`w-full min-h-[44px] rounded-2xl border ${colors.border} ${colors.surface} ${colors.text} font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer hover:opacity-90`}
        >
          <Upload size={14} />
          <span>
            {uploading
              ? isAr
                ? 'جاري الرفع…'
                : 'Uploading…'
              : isAr
              ? 'رفع صورة'
              : 'Upload Photo'}
          </span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handlePhotoUpload}
            data-testid="field-conditionPhoto"
          />
        </label>
      </div>

      {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}

      <PrimaryButton
        onClick={handleVehicleLoaded}
        disabled={advanceM.isPending}
        testId="screen-primary"
      >
        {isAr ? 'تأكيد تحميل المركبة' : 'Vehicle Loaded'}
      </PrimaryButton>
    </CaptainShell>
  );
}

// ==========================================
// T07: On the way to drop-off · step 5/7
// ==========================================
export function T07Screen({ id }) {
  const colors = useColors();
  const { isAr, lang, t } = usePrefs();
  const nav = useNav();
  const { req } = useActiveTowRequest(id);
  const centersQ = useCenters();
  const advanceM = useAdvanceStatus();
  const [error, setError] = useState('');

  const step = 5;
  const centers = Array.isArray(centersQ.data) ? centersQ.data : [];
  const destLower = String(req?.destinationAddress || '').trim().toLowerCase();
  const isCenterDestination = Boolean(
    destLower &&
      centers.some((c) => c.name && destLower.includes(String(c.name).trim().toLowerCase()))
  );

  const routeMarkers = useMemo(() => {
    const m = [];
    if (req?.destinationLatitude != null && req?.destinationLongitude != null) {
      m.push({ lat: req.destinationLatitude, lng: req.destinationLongitude });
    }
    if (req?.pickupLatitude != null && req?.pickupLongitude != null) {
      m.push({ lat: req.pickupLatitude, lng: req.pickupLongitude });
    }
    return m;
  }, [req?.destinationLatitude, req?.destinationLongitude, req?.pickupLatitude, req?.pickupLongitude]);

  const handleArrivedAtDestination = async () => {
    setError('');
    if (!req?.id) {
      nav.go('T14');
      return;
    }
    try {
      if (req.status === 'Arrived' || req.status === 'QuoteApproved') {
        await advanceM.mutateAsync({ id: req.id, status: 'Working' });
      }
      if (['Arrived', 'QuoteApproved', 'Working'].includes(String(req.status))) {
        await advanceM.mutateAsync({ id: req.id, status: 'AwaitingPayment' });
      }
      nav.go('T14', { id: req.id });
    } catch (err) {
      setError(err?.message || (isAr ? 'تعذر تحديث الحالة.' : 'Could not update status.'));
    }
  };

  return (
    <CaptainShell code="T07">
      <div>
        <h1 className={`text-lg font-bold ${colors.text}`}>
          {isCenterDestination
            ? t('On the way to service center', 'في الطريق إلى مركز الخدمة')
            : t('On the way to drop-off', 'في الطريق إلى وجهة التسليم')}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {`${req?.code || '—'} · ${isAr ? 'المركبة محملة بأمان' : 'Vehicle securely loaded'}`}
        </p>
      </div>

      <MapView
        label={fmtOptionalDistance(req?.distanceKm, lang)}
        subtitle={req?.destinationAddress || (isAr ? 'وجهة التسليم' : 'Drop-off destination')}
        markers={routeMarkers}
      />

      <div className="space-y-1">
        <div className="flex justify-between text-[11px]">
          <span className={colors.secondaryText}>{isAr ? 'خطوة ٥ من ٧' : 'Step 5 of 7'}</span>
          <span className={`font-bold ${colors.text}`}>{providerLabel('Working', isAr)}</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-slate-500/20 overflow-hidden">
          <div className="h-full bg-[#E51C23] rounded-full" style={{ width: `${(step / 7) * 100}%` }} />
        </div>
      </div>

      <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2 text-xs`}>
        <div>
          <p className={`text-[10px] uppercase ${colors.secondaryText}`}>
            {isAr ? 'نقطة الالتقاء' : 'PICKUP'}
          </p>
          <p className={`font-bold ${colors.text}`}>{req?.pickupAddress || '—'}</p>
        </div>
        <div className={`pt-2 border-t ${colors.border}`}>
          <p className={`text-[10px] uppercase ${colors.secondaryText}`}>
            {`${isAr ? 'الوجهة' : 'DESTINATION'} · ${fmtOptionalDistance(req?.distanceKm, lang)}`}
          </p>
          <p className={`font-bold ${colors.text}`}>
            {req?.destinationAddress || (isAr ? 'وجهة التسليم' : 'Drop-off destination')}
          </p>
        </div>
      </div>

      {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}

      <PrimaryButton
        onClick={handleArrivedAtDestination}
        disabled={advanceM.isPending}
        testId="screen-primary"
      >
        {isAr ? 'وصلت إلى وجهة التسليم' : 'Arrived at Drop-off'}
      </PrimaryButton>
    </CaptainShell>
  );
}

// ==========================================
// T08: Another journey rescued (Journey complete)
// ==========================================
export function T08Screen({ id }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const { req } = useActiveTowRequest(id);
  const providerQ = useProvider();
  const invoiceQ = useInvoiceForRequest(req?.id);

  const totalMinor = invoiceQ.data?.totalMinor ?? req?.quoteMinor ?? req?.estimateMinor ?? 0;
  const breakdown = computeTowBreakdown(totalMinor);
  const liveRating = Number(req?.providerRating ?? providerQ.data?.rating ?? 0);
  const ratingText = liveRating > 0 ? `${liveRating.toFixed(1)} ★` : isAr ? 'لم يقيّم بعد' : 'Not rated yet';
  const durationMins = computeTripMinutes(req);

  return (
    <CaptainShell code="T08">
      <div>
        <h1 className={`text-lg font-bold ${colors.text}`}>
          {isAr ? 'تم إنقاذ رحلة أخرى بنجاح' : 'Another journey rescued'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {`${req?.code || '—'} · ${
            req?.destinationAddress
              ? isAr
                ? `تم التسليم إلى ${req.destinationAddress}`
                : `Delivered to ${req.destinationAddress}`
              : isAr
              ? 'تم التسليم بنجاح'
              : 'Delivered safely'
          }`}
        </p>
        <div className="pt-1">
          <StatusBadge status="Completed" text={isAr ? 'مكتمل · تم تأكيد التكلفة' : 'Completed · Cost confirmed'} />
        </div>
      </div>

      <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} flex items-center gap-2.5 text-xs`}>
        <AvatarBadge name={req?.customerName} />
        <div>
          <p className={`font-bold ${colors.text}`}>
            {req?.customerName || (isAr ? 'العميل' : 'Customer')}
          </p>
          <p className={`text-[10px] ${colors.secondaryText}`}>
            {[req?.vehicleMake, req?.vehicleModel, req?.vehiclePlate].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
          <p className={`text-xs font-extrabold ${colors.text}`}>
            {fmtOptionalDistance(req?.distanceKm, lang)}
          </p>
          <p className={`text-[10px] ${colors.secondaryText}`}>{isAr ? 'المسافة' : 'Distance'}</p>
        </div>
        <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
          <p className={`text-xs font-extrabold ${colors.text}`}>
            {durationMins != null ? `${fmtNumber(durationMins, lang)} ${isAr ? 'دقيقة' : 'min'}` : '—'}
          </p>
          <p className={`text-[10px] ${colors.secondaryText}`}>{isAr ? 'المدة' : 'Duration'}</p>
        </div>
        <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
          <p className={`text-xs font-extrabold ${colors.text}`}>{ratingText}</p>
          <p className={`text-[10px] ${colors.secondaryText}`}>{isAr ? 'تقييمك' : 'Your rating'}</p>
        </div>
      </div>

      <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} space-y-1 text-xs`}>
        <div className="flex justify-between">
          <span className={colors.secondaryText}>{isAr ? 'التكلفة الأساسية' : 'Base fare'}</span>
          <span className={colors.text}>{fmtMoney(breakdown.baseMinor, lang)}</span>
        </div>
        <div className="flex justify-between">
          <span className={colors.secondaryText}>
            {`${isAr ? 'المسافة' : 'Distance'} · ${fmtOptionalDistance(req?.distanceKm, lang)}`}
          </span>
          <span className={colors.text}>{fmtMoney(breakdown.distanceMinor, lang)}</span>
        </div>
        <div className="flex justify-between">
          <span className={colors.secondaryText}>{isAr ? 'رسوم الخدمة' : 'Service fee'}</span>
          <span className={colors.text}>{fmtMoney(breakdown.feeMinor, lang)}</span>
        </div>
        <div className={`flex justify-between pt-1.5 border-t ${colors.border} font-extrabold`}>
          <span className={colors.text}>{isAr ? 'الإجمالي' : 'Total'}</span>
          <span className="text-emerald-500">{fmtMoney(breakdown.totalMinor, lang)}</span>
        </div>
      </div>

      <SecondaryButton onClick={() => nav.go('T11')}>
        {isAr ? 'مركز الرحلات' : 'Trips Hub'}
      </SecondaryButton>
    </CaptainShell>
  );
}

// ==========================================
// T09: Your earnings
// ==========================================
export function T09Screen() {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const { user } = useSession();
  const providerQ = useProvider();
  const earningsQ = useEarnings();
  const walletQ = useWallet();
  const [period, setPeriod] = useState('week');

  const provider = providerQ.data;
  const earnings = earningsQ.data;
  const wallet = walletQ.data;
  const allEntries = Array.isArray(wallet?.entries) ? wallet.entries : [];

  const filteredEntries = useMemo(() => {
    const now = Date.now();
    if (period === 'week') {
      return allEntries.filter((e) => now - new Date(e.at).getTime() <= 7 * 86400_000);
    }
    if (period === 'month') {
      return allEntries.filter((e) => now - new Date(e.at).getTime() <= 30 * 86400_000);
    }
    return allEntries;
  }, [allEntries, period]);

  const availableMinor = earnings?.availableMinor ?? wallet?.balanceMinor ?? 0;
  const completedJobs = earnings?.completedJobs ?? provider?.completedJobs ?? 0;
  const rating = Number(earnings?.rating ?? provider?.rating ?? 0).toFixed(1);
  const periodSumMinor = filteredEntries.reduce((sum, e) => sum + (e.amountMinor ?? 0), 0);

  return (
    <CaptainShell code="T09">
      <div>
        <h1 className={`text-lg font-bold ${colors.text}`}>
          {isAr ? 'أرباحك' : 'Your earnings'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {`${provider?.fullName || user?.fullName || (isAr ? 'الكابتن' : 'Captain')} · ${
            isAr ? 'تم التحديث الآن' : 'Updated just now'
          }`}
        </p>
      </div>

      <div className="flex gap-1.5">
        {[
          { id: 'week', en: 'This week', ar: 'هذا الأسبوع' },
          { id: 'month', en: 'This month', ar: 'هذا الشهر' },
          { id: 'all', en: 'All time', ar: 'كل الأوقات' }
        ].map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            data-testid={`period-${p.id}`}
            className={`px-3 py-1 rounded-full text-[11px] font-bold border transition ${
              period === p.id
                ? 'border-[#E51C23] bg-[#E51C23]/15 text-[#E51C23]'
                : `${colors.border} ${colors.surface} ${colors.secondaryText}`
            }`}
          >
            {isAr ? p.ar : p.en}
          </button>
        ))}
      </div>

      <div className="p-4 rounded-2xl border border-[#E51C23]/40 bg-[#E51C23]/10 space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-[#E51C23] font-bold">
          {isAr ? 'الرصيد المتاح' : 'AVAILABLE BALANCE'}
        </p>
        <p className={`text-2xl font-extrabold ${colors.text}`} data-testid="wallet-balance">
          {fmtMoney(availableMinor, lang)}
        </p>
        <div className="flex justify-between text-[11px]">
          <span className={colors.secondaryText}>
            {period === 'week'
              ? isAr
                ? 'هذا الأسبوع'
                : 'This week'
              : period === 'month'
              ? isAr
                ? 'هذا الشهر'
                : 'This month'
              : isAr
              ? 'الإجمالي'
              : 'All time'}
          </span>
          <span className="text-emerald-500 font-bold">{fmtMoney(periodSumMinor, lang)}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
          <p className={`text-sm font-extrabold ${colors.text}`}>{fmtNumber(completedJobs, lang)}</p>
          <p className={`text-[10px] ${colors.secondaryText}`}>{isAr ? 'مهام مكتملة' : 'Completed jobs'}</p>
        </div>
        <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
          <p className={`text-sm font-extrabold ${colors.text}`}>
            {fmtMoney(earnings?.lifetimeMinor ?? availableMinor, lang)}
          </p>
          <p className={`text-[10px] ${colors.secondaryText}`}>{isAr ? 'الإجمالي' : 'Lifetime'}</p>
        </div>
        <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
          <p className={`text-sm font-extrabold ${colors.text}`}>{rating}</p>
          <p className={`text-[10px] ${colors.secondaryText}`}>{isAr ? 'التقييم' : 'Rating'}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className={`text-xs font-bold ${colors.text}`}>
          {isAr ? 'حركات المحفظة' : 'Daily earnings & ledger'}
        </p>
        {filteredEntries.length === 0 ? (
          <div className={`p-4 rounded-2xl border ${colors.border} ${colors.surface} text-center text-xs ${colors.secondaryText}`}>
            {isAr ? 'لا توجد حركات مسجلة في هذه الفترة.' : 'No ledger entries in this period.'}
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} flex justify-between items-center text-xs`}
            >
              <div>
                <p className={`font-bold ${colors.text}`}>{fmtDate(entry.at, lang)}</p>
                <p className={`text-[10px] ${colors.secondaryText}`}>
                  {`${entry.reference || '—'} · ${entry.type ? providerLabel(entry.type, isAr) : (isAr ? 'إيداع بالمحفظة' : 'Paid to wallet')}`}
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
    </CaptainShell>
  );
}

// ==========================================
// T10: Captain profile
// ==========================================
export function T10Screen() {
  const colors = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const { user } = useSession();
  const providerQ = useProvider();
  const kycQ = useKyc();

  const provider = providerQ.data;
  const kyc = kycQ.data;

  const displayName = provider?.fullName || user?.fullName || (isAr ? 'الكابتن' : 'Captain');
  const rating = Number(provider?.rating ?? 0).toFixed(1);
  const ratingCount = Number(provider?.ratingCount ?? 0);
  const recommendPercent = Number(provider?.recommendPercent ?? 0);
  const trips = provider?.completedJobs ?? 0;
  const truckMake = provider?.truckMake || (provider?.truckType ? providerLabel(provider.truckType, isAr) : (isAr ? 'ونش سطحة' : 'Flatbed Tow Truck'));
  const truckPlate = provider?.truckPlate || '—';
  const kycStatus = provider?.kycStatus || kyc?.status || 'Approved';

  const links = [
    { code: 'T15', icon: '🛻', en: 'Edit Captain & Truck Profile', ar: 'تعديل الملف وبيانات الونش', primary: true },
    { code: 'SH12', icon: '👤', en: 'Edit Account Details', ar: 'تعديل بيانات الحساب' },
    { code: 'SH01', icon: '💬', en: 'Messages & Customer Chats', ar: 'المحادثات مع العملاء' },
    { code: 'T09', icon: '💰', en: 'Wallet & Earnings', ar: 'المحفظة والأرباح' },
    { code: 'T12', icon: '🧾', en: 'Trip History', ar: 'سجل الرحلات' },
    { code: 'SH17', icon: '📄', en: 'Verification Documents (KYC)', ar: 'مستندات الرخصة والونش' },
    { code: 'SH14', icon: '🏦', en: 'Bank Accounts & Payouts', ar: 'الحسابات البنكية والتحويلات' },
    { code: 'SH06', icon: '🌐', en: 'App Settings (Language & Theme)', ar: 'إعدادات التطبيق (اللغة والمظهر)' },
    { code: 'SH10', icon: '⚙️', en: 'Notification Preferences', ar: 'تفضيلات الإشعارات' },
    { code: 'SH02', icon: '🔒', en: 'Change Password', ar: 'تغيير كلمة المرور' },
    { code: 'AD13', icon: '🛡️', en: 'Two-Factor Authentication (2FA)', ar: 'المصادقة الثنائية (2FA)' },
    { code: 'AD14', icon: '📱', en: 'Active Devices & Sessions', ar: 'الأجهزة والجلسات النشطة' },
    { code: 'SH07', icon: '🎧', en: 'Help & Support Center', ar: 'مركز المساعدة والدعم' },
    { code: 'SH05', icon: '📜', en: 'Terms of Service & Privacy Policy', ar: 'الشروط وسياسة الخصوصية' },
    { code: 'SH11', icon: 'ℹ️', en: 'About FixNGo', ar: 'عن منصة فيكس آند جو' },
    { code: 'SH21', icon: '🗑️', en: 'Request Account Deletion', ar: 'طلب حذف الحساب', danger: true },
    { code: 'SH13', icon: '🚪', en: 'Sign Out', ar: 'تسجيل الخروج', danger: true },
  ];

  return (
    <CaptainShell code="T10">
      <div>
        <h1 className={`text-lg font-extrabold ${colors.text}`}>
          {isAr ? 'الملف الشخصي والإعدادات' : 'Profile & Settings'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {isAr ? 'هويتك المهنية لخدمات السحب والإنقاذ وإعدادات الحساب.' : 'Your verified towing profile & account settings.'}
        </p>
      </div>

      <div className={`p-4 rounded-2xl border ${colors.border} ${colors.surface} space-y-3`}>
        <div className="flex items-start gap-3">
          <div className="shrink-0">
            <Avatar name={displayName} size={52} />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <div className={`text-base font-extrabold truncate ${colors.text}`}>{displayName}</div>
              <StatusBadge
                status={kycStatus}
                text={kycStatus === 'Approved' ? (isAr ? 'كابتن ونش معتمد' : 'Verified Captain') : undefined}
              />
            </div>
            <div className={`text-xs truncate text-start ${colors.secondaryText}`} dir="ltr">
              {user?.email || provider?.email || ''}
            </div>
            <div className={`text-xs truncate text-start ${colors.secondaryText}`} dir="ltr">
              {provider?.phone || user?.phone || ''}
            </div>
          </div>
        </div>

        <div className={`grid grid-cols-3 gap-2 pt-2 border-t ${colors.border} text-center text-xs`}>
          <div>
            <div className={`font-extrabold ${colors.text}`}>
              {ratingCount > 0 ? `⭐ ${rating}` : '—'}
            </div>
            <div className={`text-[10px] ${colors.secondaryText}`}>
              {ratingCount > 0 ? `${ratingCount} · 👍 ${recommendPercent}%` : (isAr ? 'التقييم' : 'Rating')}
            </div>
          </div>
          <div>
            <div className={`font-extrabold ${colors.text}`}>{trips}</div>
            <div className={`text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'رحلات مكتملة' : 'Trips Done'}
            </div>
          </div>
          <div>
            <div className={`font-extrabold truncate ${colors.text}`} dir="ltr">
              {truckPlate}
            </div>
            <div className={`text-[10px] truncate ${colors.secondaryText}`}>
              {truckMake}
            </div>
          </div>
        </div>
      </div>

      <div className={`rounded-2xl border ${colors.border} ${colors.surface} overflow-hidden`}>
        {links.map((item, idx) => (
          <button
            key={item.code}
            type="button"
            data-testid={item.primary ? 'screen-primary' : undefined}
            onClick={() => nav.go(item.code)}
            className={`w-full px-4 py-3 text-start flex items-center justify-between text-xs font-bold transition-all ${
              item.danger ? 'text-rose-500' : colors.text
            } ${idx < links.length - 1 ? `border-b ${colors.border}` : ''}`}
          >
            <span className="flex items-center gap-2.5">
              <span className="text-base">{item.icon}</span>
              <span>{isAr ? item.ar : item.en}</span>
            </span>
            <span className={colors.secondaryText}>{isAr ? '‹' : '›'}</span>
          </button>
        ))}
      </div>
    </CaptainShell>
  );
}

// ==========================================
// T11: Your trips hub
// ==========================================
export function T11Screen() {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const { user } = useSession();
  const providerQ = useProvider();
  const offersQ = useOffers();
  const requestsQ = useRequests();

  const provider = providerQ.data;
  const offers = Array.isArray(offersQ.data) ? offersQ.data : [];
  const requests = Array.isArray(requestsQ.data) ? requestsQ.data : [];

  const pendingOffers = offers.filter((o) => o.status === 'Pending');
  const offerRequestIds = new Set(pendingOffers.map((o) => String(o.requestId)));

  // Active or recent trips that are NOT already in pendingOffers
  const trips = requests.filter((r) => !offerRequestIds.has(String(r.id)));
  const activeTrips = trips.filter(
    (r) =>
      r.assignedProviderId &&
      String(r.assignedProviderId) === String(user?.id) &&
      !['Completed', 'Cancelled', 'NoProviders', 'Searching', 'Offered'].includes(String(r.status))
  );
  const recentTrips = trips.filter((r) =>
    ['Completed', 'Cancelled'].includes(String(r.status))
  );

  const displayName = provider?.fullName || user?.fullName || (isAr ? 'الكابتن' : 'Captain');
  const truckPlate = provider?.truckPlate || '—';

  return (
    <CaptainShell code="T11">
      <div>
        <h1 className={`text-lg font-bold ${colors.text}`}>
          {isAr ? 'مركز الرحلات' : 'Your trips'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {`${displayName} · ${truckPlate}`}
        </p>
      </div>

      {pendingOffers.map((offer) => (
        <div
          key={offer.id}
          onClick={() => nav.go('T03', { id: offer.id })}
          className="p-3.5 rounded-2xl border border-[#E51C23]/30 bg-[#E51C23]/5 space-y-1.5 cursor-pointer text-xs"
          data-testid="hub-offer-card"
        >
          <p className={`font-bold ${colors.text}`}>
            {[offer.vehicleMake, offer.vehicleModel].filter(Boolean).join(' ') || (isAr ? 'ونش سطحة' : 'Flatbed Tow')}
          </p>
          <StatusBadge
            status="Pending"
            text={
              isAr
                ? `وارد · الرد خلال ${formatCountdown(offer.expiresAt)}`
                : `Incoming · Respond in ${formatCountdown(offer.expiresAt)}`
            }
          />
          <div className="flex justify-between pt-1">
            <span className={colors.secondaryText}>{isAr ? 'نقطة الالتقاء' : 'Pickup'}</span>
            <span className={`font-bold ${colors.text}`}>{offer.pickupArea || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className={colors.secondaryText}>{isAr ? 'الوجهة' : 'Destination'}</span>
            <span className={`font-bold ${colors.text}`}>
              {offer.destinationAddress || (isAr ? 'وجهة التسليم' : 'Drop-off destination')}
            </span>
          </div>
          <div className="flex justify-between font-extrabold text-[#E51C23]">
            <span>{`${isAr ? 'عرض الرحلة' : 'Trip offer'} · ${fmtOptionalDistance(offer.tripDistanceKm || offer.distanceKm, lang)}`}</span>
            <span>{fmtMoney(offer.priceMinor, lang)}</span>
          </div>
        </div>
      ))}

      <MapView
        label={
          activeTrips[0]?.pickupAddress ||
          pendingOffers[0]?.pickupArea ||
          provider?.coverageArea ||
          (isAr ? 'منطقة التغطية' : 'Dispatch area')
        }
        subtitle={activeTrips[0]?.code || pendingOffers[0]?.requestCode || truckPlate}
      />

      {activeTrips.map((trip) => (
        <div
          key={trip.id}
          onClick={() => nav.go(screenForRequestStatus(trip.status), { id: trip.id })}
          className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1 cursor-pointer text-xs`}
          data-testid="hub-active-card"
        >
          <div className="flex justify-between items-center">
            <p className={`font-bold ${colors.text}`}>
              {isAr ? `الرحلة النشطة · ${trip.code}` : `Active trip · ${trip.code}`}
            </p>
            <StatusBadge status={trip.status} />
          </div>
          <p className={`text-[11px] ${colors.secondaryText}`}>
            {`${trip.pickupAddress || '—'} → ${trip.destinationAddress || (isAr ? 'وجهة التسليم' : 'Drop-off destination')}`}
          </p>
          <span className="inline-block text-[11px] font-bold text-[#E51C23] pt-1">
            {isAr ? 'متابعة الرحلة النشطة ←' : 'Continue Active Trip →'}
          </span>
        </div>
      ))}

      {pendingOffers.length === 0 && activeTrips.length === 0 && (
        <div className={`p-4 rounded-2xl border ${colors.border} ${colors.surface} text-center space-y-2 text-xs`}>
          <p className={`font-bold ${colors.text}`}>
            {isAr ? 'لا توجد رحلات نشطة حالياً' : 'No active trips right now'}
          </p>
          <p className={colors.secondaryText}>
            {recentTrips.length > 0
              ? isAr
                ? `لديك ${plural(recentTrips.length, 'trip', true)} في السجل.`
                : `You have ${plural(recentTrips.length, 'trip', false)} in history.`
              : isAr
              ? 'ابقَ متصلاً لاستقبال طلبات السحب القريبة.'
              : 'Stay online to receive nearby tow requests.'}
          </p>
        </div>
      )}

      <PrimaryButton
        onClick={() =>
          activeTrips[0]
            ? nav.go(screenForRequestStatus(activeTrips[0].status), { id: activeTrips[0].id })
            : pendingOffers[0]
            ? nav.go('T03', { id: pendingOffers[0].id })
            : nav.go('T12')
        }
        testId="screen-primary"
      >
        {activeTrips[0]
          ? isAr
            ? 'متابعة الرحلة النشطة'
            : 'Continue Active Trip'
          : pendingOffers[0]
          ? isAr
            ? 'عرض الطلب الوارد'
            : 'View Incoming Offer'
          : isAr
          ? 'عرض سجل الرحلات'
          : 'View Trip History'}
      </PrimaryButton>
    </CaptainShell>
  );
}

// ==========================================
// T12: Trip history
// ==========================================
export function T12Screen() {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const historyQ = useProviderHistory();
  const [filter, setFilter] = useState('All');

  const rawList = Array.isArray(historyQ.data) ? historyQ.data : [];
  const filtered = useMemo(() => {
    if (filter === 'Completed') return rawList.filter((r) => r.status === 'Completed');
    if (filter === 'Cancelled') return rawList.filter((r) => r.status === 'Cancelled');
    return rawList;
  }, [rawList, filter]);

  return (
    <CaptainShell code="T12">
      <div>
        <h1 className={`text-lg font-bold ${colors.text}`}>
          {isAr ? 'سجل الرحلات' : 'Trip history'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {isAr ? 'كل رحلة ساعدت في إنقاذها.' : "Every journey you've helped rescue."}
        </p>
      </div>

      <div className="flex gap-1.5">
        {[
          { id: 'All', en: 'All', ar: 'الكل' },
          { id: 'Completed', en: 'Completed', ar: 'المكتملة' },
          { id: 'Cancelled', en: 'Cancelled', ar: 'الملغاة' }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            data-testid={`filter-${tab.id.toLowerCase()}`}
            className={`px-3 py-1 rounded-full text-[11px] font-bold border transition ${
              filter === tab.id
                ? 'border-[#E51C23] bg-[#E51C23]/15 text-[#E51C23]'
                : `${colors.border} ${colors.surface} ${colors.secondaryText}`
            }`}
          >
            {isAr ? tab.ar : tab.en}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className={`p-6 rounded-2xl border ${colors.border} ${colors.surface} text-center text-xs ${colors.secondaryText}`}>
          {isAr ? 'لا توجد رحلات مطابقة للفلتر.' : 'No trips match this filter.'}
        </div>
      ) : (
        filtered.map((r) => {
          const isCancelled = r.status === 'Cancelled';
          const amtMinor = isCancelled ? 0 : r.quoteMinor ?? r.estimateMinor ?? 0;
          const customerVehicle = [r.customerName, r.vehicleMake, r.vehicleModel]
            .filter(Boolean)
            .join(' · ') || r.pickupAddress || '—';
          return (
            <div
              key={r.id}
              onClick={() => nav.go('T13', { id: r.id })}
              data-testid="data-row"
              className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1 cursor-pointer text-xs`}
            >
              <div className="flex justify-between">
                <span className={`font-bold ${colors.text}`}>
                  {`${r.code} · ${isAr ? 'ونش سطحة' : 'Flatbed Tow'}`}
                </span>
                <span className={`font-extrabold ${colors.text}`}>{fmtMoney(amtMinor, lang)}</span>
              </div>
              <div className="flex items-center justify-between">
                <StatusBadge status={isCancelled ? 'Cancelled' : r.status} />
                <span className={`text-[10px] ${colors.secondaryText}`}>
                  {fmtDateTime(r.createdAt, lang)}
                </span>
              </div>
              <div className="flex justify-between pt-1">
                <span className={`text-[11px] ${colors.secondaryText}`}>{customerVehicle}</span>
                <span className="text-[11px] font-bold text-[#E51C23]">
                  {isAr ? 'عرض الرحلة ←' : 'View Trip →'}
                </span>
              </div>
            </div>
          );
        })
      )}
    </CaptainShell>
  );
}

// ==========================================
// T13: Trip details & receipt
// ==========================================
export function T13Screen({ id }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const { req } = useActiveTowRequest(id);
  const timelineQ = useTimeline(req?.id);
  const invoiceQ = useInvoiceForRequest(req?.id);
  const [showReceipt, setShowReceipt] = useState(false);

  const events = Array.isArray(timelineQ.data) ? timelineQ.data : [];
  const totalMinor =
    req?.status === 'Cancelled'
      ? 0
      : invoiceQ.data?.totalMinor ?? req?.quoteMinor ?? req?.estimateMinor ?? 0;
  const breakdown = computeTowBreakdown(totalMinor);

  const sevenStages = useMemo(() => {
    const findTime = (statuses) => {
      const ev = events.find((e) => statuses.includes(String(e.status)));
      return ev?.at ? fmtTime(ev.at, lang) : '—';
    };
    return [
      { label: isAr ? 'تم الطلب' : 'Requested', time: findTime(['Searching']) },
      { label: isAr ? 'تم التعيين' : 'Matched', time: findTime(['Offered', 'Accepted']) },
      { label: isAr ? 'في الطريق' : 'En route', time: findTime(['EnRoute']) },
      { label: isAr ? 'وصل للموقع' : 'Arrived', time: findTime(['Arrived']) },
      { label: isAr ? 'جاري النقل' : 'Working', time: findTime(['Working', 'QuoteApproved']) },
      { label: isAr ? 'الدفع' : 'Payment', time: findTime(['AwaitingPayment']) },
      {
        label: req?.status === 'Cancelled' ? (isAr ? 'ملغي' : 'Cancelled') : isAr ? 'مكتمل' : 'Completed',
        time: findTime(['Completed', 'Cancelled'])
      }
    ];
  }, [events, isAr, lang, req?.status]);

  return (
    <CaptainShell code="T13">
      <div>
        <div className="flex items-center justify-between">
          <h1 className={`text-lg font-bold ${colors.text}`}>
            {isAr ? 'تفاصيل الرحلة والإيصال' : 'Trip details'}
          </h1>
          {req?.status && <StatusBadge status={req.status} />}
        </div>
        <p className={`text-xs ${colors.secondaryText}`}>
          {`${req?.code || '—'} · ${fmtDate(req?.createdAt, lang)}`}
        </p>
      </div>

      <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} space-y-1 text-xs`}>
        <p className={`font-bold ${colors.text}`}>
          {[req?.customerName, req?.vehicleMake, req?.vehicleModel].filter(Boolean).join(' · ') || (isAr ? 'تفاصيل المركبة' : 'Vehicle details')}
        </p>
        <p className={`text-[11px] ${colors.secondaryText}`}>
          {`${req?.pickupAddress || '—'} → ${req?.destinationAddress || (isAr ? 'وجهة التسليم' : 'Destination')}`}
        </p>
        <div className="flex justify-between pt-1">
          <span className={colors.secondaryText}>
            {isAr ? 'المسافة والمدة' : 'Trip distance & duration'}
          </span>
          <span className={`font-bold ${colors.text}`}>
            {`${fmtOptionalDistance(req?.distanceKm, lang)} · ${
              computeTripMinutes(req) != null
                ? `${fmtNumber(computeTripMinutes(req), lang)} ${isAr ? 'دقيقة' : 'min'}`
                : '—'
            }`}
          </span>
        </div>
      </div>

      <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} space-y-1 text-xs`}>
        <p className={`font-bold ${colors.text}`}>
          {isAr ? 'التسلسل الزمني الكامل' : 'Complete timeline'}
        </p>
        {sevenStages.map((row) => (
          <div key={row.label} className="flex justify-between text-[11px]">
            <span className={colors.text}>• {row.label}</span>
            <span className={colors.secondaryText}>{row.time}</span>
          </div>
        ))}
      </div>

      <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} space-y-1 text-xs`}>
        <p className={`font-bold ${colors.text}`}>{isAr ? 'إيصال النقدية' : 'Cash receipt'}</p>
        <div className="flex justify-between">
          <span className={colors.secondaryText}>
            {isAr ? 'أساسي + مسافة + رسوم' : 'Base + distance + service fee'}
          </span>
          <span className={colors.text}>
            {`${fmtMoney(breakdown.baseMinor, lang)} + ${fmtMoney(breakdown.distanceMinor, lang)} + ${fmtMoney(
              breakdown.feeMinor,
              lang
            )}`}
          </span>
        </div>
        <div className="flex justify-between font-extrabold text-emerald-500">
          <span>{isAr ? 'إجمالي المحصل' : 'Total collected'}</span>
          <span>{fmtMoney(breakdown.totalMinor, lang)}</span>
        </div>
      </div>

      {showReceipt && (
        <div
          className={`p-3.5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 space-y-1.5 text-xs`}
          data-testid="receipt-card"
        >
          <div className="flex items-center justify-between">
            <span className={`font-extrabold ${colors.text} inline-flex items-center gap-1.5`}>
              <Receipt size={14} className="text-emerald-500" />
              {invoiceQ.data?.number || req?.code || (isAr ? 'إيصال رسمي' : 'Official Receipt')}
            </span>
            <StatusBadge status={invoiceQ.data?.status || req?.status || 'Paid'} />
          </div>
          <div className="flex justify-between">
            <span className={colors.secondaryText}>{isAr ? 'طريقة الدفع' : 'Payment method'}</span>
            <span className={`font-bold ${colors.text}`}>
              {providerLabel(invoiceQ.data?.method || req?.paymentMethod || 'Cash', isAr)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={colors.secondaryText}>{isAr ? 'التاريخ' : 'Issued at'}</span>
            <span className={colors.text}>
              {fmtDateTime(invoiceQ.data?.issuedAt || req?.createdAt, lang)}
            </span>
          </div>
          <div className="flex justify-between font-extrabold pt-1 border-t border-emerald-500/30">
            <span className={colors.text}>{isAr ? 'المبلغ الإجمالي' : 'Total amount'}</span>
            <span className="text-emerald-500">{fmtMoney(breakdown.totalMinor, lang)}</span>
          </div>
        </div>
      )}

      <PrimaryButton onClick={() => setShowReceipt((v) => !v)} testId="screen-primary">
        {showReceipt
          ? isAr
            ? 'إخفاء إيصال النقدية'
            : 'Hide Cash Receipt'
          : isAr
          ? 'عرض إيصال النقدية'
          : 'View Cash Receipt'}
      </PrimaryButton>
    </CaptainShell>
  );
}

// ==========================================
// T14: Handover & collect payment
// ==========================================
export function T14Screen({ id }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const qc = useQueryClient();
  const { req } = useActiveTowRequest(id);
  const invoiceQ = useInvoiceForRequest(req?.id);
  const advanceM = useAdvanceStatus();

  const totalMinor = invoiceQ.data?.totalMinor ?? req?.quoteMinor ?? req?.estimateMinor ?? 0;
  const breakdown = computeTowBreakdown(totalMinor);

  const [checks, setChecks] = useState([false, false, false, false]);
  const [collectedAmount, setCollectedAmount] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (totalMinor > 0 && collectedAmount === '') {
      setCollectedAmount(String(totalMinor / 100));
    }
  }, [totalMinor, collectedAmount]);

  const items = [
    isAr ? 'الونش متوقف على أرض مستوية وآمنة' : 'Flatbed parked on safe, level ground',
    isAr ? 'تم إنزال المركبة وشد فرامل اليد' : 'Vehicle unloaded and parking brake set',
    isAr ? 'تم تسليم المركبة والمفتاح بأمان' : 'Vehicle and key handed over safely',
    isAr ? 'أكد العميل / المركز حالة المركبة' : 'Customer / center confirms condition'
  ];

  const toggleItem = (idx) => {
    setChecks((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  };

  const handleFinishTrip = async () => {
    setError('');
    if (!req?.id) {
      nav.go('T08');
      return;
    }
    try {
      if (req.status === 'Working') {
        await advanceM.mutateAsync({ id: req.id, status: 'AwaitingPayment' });
      }
      if (req.status !== 'Completed') {
        await advanceM.mutateAsync({
          id: req.id,
          status: 'Completed',
          note: collectedAmount ? `collected:${collectedAmount}` : 'completed'
        });
      }
      await post(`/payments/invoices/request/${req.id}/ensure`, {}).catch(() => {});
      await Promise.all([
        qc.invalidateQueries({ queryKey: k.earnings }),
        qc.invalidateQueries({ queryKey: k.wallet }),
        qc.invalidateQueries({ queryKey: k.provider }),
        qc.invalidateQueries({ queryKey: k.requests }),
        qc.invalidateQueries({ queryKey: k.providerHistory })
      ]);
      nav.go('T08', { id: req.id });
    } catch (err) {
      setError(err?.message || (isAr ? 'تعذر إنهاء الرحلة.' : 'Could not finish trip.'));
    }
  };

  return (
    <CaptainShell code="T14">
      <div>
        <h1 className={`text-lg font-bold ${colors.text}`}>
          {isAr ? 'تسليم المركبة وتحصيل الدفعة' : 'Handover & collect payment'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {`${req?.code || '—'} · ${
            req?.destinationAddress
              ? isAr
                ? `وصلت إلى ${req.destinationAddress}`
                : `Arrived at ${req.destinationAddress}`
              : isAr
              ? 'وصلت إلى الوجهة'
              : 'Arrived at destination'
          }`}
        </p>
        <div className="pt-1">
          <StatusBadge status="Online" text={isAr ? 'تم الوصول للوجهة' : 'Destination reached'} />
        </div>
      </div>

      <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} space-y-2 text-xs`}>
        <p className={`font-bold ${colors.text}`}>
          {isAr ? 'قائمة التحقق من الإنزال الآمن' : 'Safe unloading checklist'}
        </p>
        {items.map((label, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => toggleItem(idx)}
            data-testid={`unloading-check-${idx}`}
            className="w-full flex items-center gap-2 text-start"
          >
            <span
              className={`w-4 h-4 rounded flex items-center justify-center border ${
                checks[idx]
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : `${colors.border} ${colors.secondaryText}`
              }`}
            >
              {checks[idx] && <Check size={11} />}
            </span>
            <span className={checks[idx] ? 'text-emerald-500 font-semibold' : colors.text}>
              {label}
            </span>
          </button>
        ))}
      </div>

      <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs`}>
        <p className={`font-bold ${colors.text}`}>{isAr ? 'تحصيل النقدية' : 'Collect cash'}</p>
        <div className="flex justify-between">
          <span className={colors.secondaryText}>{isAr ? 'التكلفة الأساسية' : 'Base fare'}</span>
          <span className={colors.text}>{fmtMoney(breakdown.baseMinor, lang)}</span>
        </div>
        <div className="flex justify-between">
          <span className={colors.secondaryText}>
            {`${isAr ? 'المسافة' : 'Distance'} · ${fmtDistance(req?.distanceKm, lang)}`}
          </span>
          <span className={colors.text}>{fmtMoney(breakdown.distanceMinor, lang)}</span>
        </div>
        <div className="flex justify-between">
          <span className={colors.secondaryText}>{isAr ? 'رسوم الخدمة' : 'Service fee'}</span>
          <span className={colors.text}>{fmtMoney(breakdown.feeMinor, lang)}</span>
        </div>
        <div className={`flex justify-between pt-1.5 border-t ${colors.border} font-extrabold`}>
          <span className={colors.text}>{isAr ? 'الإجمالي' : 'Total'}</span>
          <span className="text-[#E51C23]">{fmtMoney(breakdown.totalMinor, lang)}</span>
        </div>
        <div className="pt-2">
          <label className={`block text-[10px] mb-1 ${colors.secondaryText}`}>
            {isAr ? 'المبلغ النقدي المحصل (ج.م)' : 'Collected cash amount (EGP)'}
          </label>
          <input
            type="number"
            step="0.01"
            value={collectedAmount}
            onChange={(e) => setCollectedAmount(e.target.value)}
            data-testid="field-collectedAmount"
            className={`w-full px-3 h-10 rounded-xl border ${colors.border} ${colors.inputBg} text-xs ${colors.text}`}
          />
        </div>
      </div>

      {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}

      <PrimaryButton
        onClick={handleFinishTrip}
        disabled={advanceM.isPending}
        testId="screen-primary"
      >
        {isAr ? 'إنهاء الرحلة' : 'Finish Trip'}
      </PrimaryButton>
    </CaptainShell>
  );
}

// ==========================================
// T15: Edit captain & truck
// ==========================================
export function T15Screen() {
  const colors = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const qc = useQueryClient();
  const { user, loadMe } = useSession();
  const providerQ = useProvider();

  const provider = providerQ.data;

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [truckMake, setTruckMake] = useState('');
  const [truckType, setTruckType] = useState('');
  const [truckPlate, setTruckPlate] = useState('');
  const [truckCapacityTonnes, setTruckCapacityTonnes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (provider || user) {
      setFullName(provider?.fullName || user?.fullName || '');
      setPhone(provider?.phone || user?.phone || '');
      setEmail(provider?.email || user?.email || '');
      setTruckMake(provider?.truckMake || '');
      setTruckType(provider?.truckType || '');
      setTruckPlate(provider?.truckPlate || '');
      if (provider?.truckCapacityTonnes !== undefined && provider?.truckCapacityTonnes !== null) {
        setTruckCapacityTonnes(String(provider.truckCapacityTonnes));
      }
    }
  }, [provider, user]);

  const handleSave = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setError('');
    const capNum = Number(truckCapacityTonnes);
    if (!fullName.trim() || !phone.trim()) {
      setError(isAr ? 'الاسم ورقم الهاتف مطلوبان.' : 'Full name and phone are required.');
      return;
    }
    if (!truckMake.trim() || !truckType) {
      setError(isAr ? 'يرجى إدخال ماركة ونوع الونش.' : 'Please enter truck make and select truck type.');
      return;
    }
    if (String(truckCapacityTonnes).trim() === '' || !Number.isFinite(capNum) || capNum <= 0) {
      setError(isAr ? 'يرجى إدخال حمولة صحيحة بالطن.' : 'Please enter a valid truck capacity in tonnes.');
      return;
    }
    if (!truckPlate.trim()) {
      setError(isAr ? 'يرجى إدخال لوحة الونش.' : 'Please enter your truck plate.');
      return;
    }
    setBusy(true);
    try {
      await put('/providers/me', {
        yearsExperience: provider?.yearsExperience ?? 0,
        coverageRadiusKm: provider?.coverageRadiusKm ?? 10,
        coverageArea: provider?.coverageArea,
        latitude: provider?.latitude,
        longitude: provider?.longitude,
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        truckMake: truckMake.trim(),
        truckType,
        truckPlate: truckPlate.trim(),
        truckCapacityTonnes: capNum
      });
      await qc.invalidateQueries({ queryKey: k.provider });
      await loadMe?.();
      setToast(isAr ? 'تم حفظ التغييرات بنجاح' : 'Changes saved');
      setTimeout(() => nav.go('T10'), 250);
    } catch (err) {
      setError(err?.message || (isAr ? 'تعذر حفظ التغييرات.' : 'Could not save changes.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <CaptainShell code="T15">
      <div>
        <h1 className={`text-lg font-bold ${colors.text}`}>
          {isAr ? 'تعديل بيانات الكابتن والونش' : 'Edit captain & truck'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {`${fullName || (isAr ? 'الكابتن' : 'Captain')} · ${
            isAr ? 'كابتن ونش معتمد' : 'Verified Tow Captain'
          }`}
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        <div className="space-y-2">
          <div>
            <label htmlFor="t15-fullName" className={`block text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'الاسم الكامل' : 'Full name'}
            </label>
            <input
              id="t15-fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              data-testid="field-fullName"
              className={`w-full px-3 h-10 rounded-xl border ${colors.border} ${colors.inputBg} text-xs ${colors.text}`}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="t15-phone" className={`block text-[10px] ${colors.secondaryText}`}>{isAr ? 'الهاتف' : 'Phone'}</label>
              <input
                id="t15-phone"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-testid="field-phone"
                className={`w-full px-3 h-10 rounded-xl border ${colors.border} ${colors.inputBg} text-xs ${colors.text}`}
              />
            </div>
            <div>
              <label htmlFor="t15-email" className={`block text-[10px] ${colors.secondaryText}`}>{isAr ? 'البريد' : 'Email'}</label>
              <input
                id="t15-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="field-email"
                className={`w-full px-3 h-10 rounded-xl border ${colors.border} ${colors.inputBg} text-xs ${colors.text}`}
              />
            </div>
          </div>
        </div>

        <img src={FLATBED_SVG} alt="Flatbed" className="w-full h-20 rounded-2xl object-cover" />

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="t15-truckMake" className={`block text-[10px] ${colors.secondaryText}`}>
                {isAr ? 'ماركة الونش' : 'Truck make'}
              </label>
              <input
                id="t15-truckMake"
                value={truckMake}
                onChange={(e) => setTruckMake(e.target.value)}
                data-testid="field-truckMake"
                className={`w-full px-3 h-10 rounded-xl border ${colors.border} ${colors.inputBg} text-xs ${colors.text}`}
              />
            </div>
            <div>
              <label htmlFor="t15-truckType" className={`block text-[10px] ${colors.secondaryText}`}>
                {isAr ? 'نوع الونش' : 'Truck type'}
              </label>
              <select
                id="t15-truckType"
                value={truckType}
                onChange={(e) => setTruckType(e.target.value)}
                data-testid="field-truckType"
                className={`w-full px-3 h-10 rounded-xl border ${colors.border} ${colors.inputBg} text-xs ${colors.text}`}
              >
                <option value="">{isAr ? 'اختر نوع الونش...' : 'Select truck type...'}</option>
                <option value="Flatbed">{isAr ? 'سطحة' : 'Flatbed'}</option>
                <option value="WheelLift">{isAr ? 'رفع عجلات' : 'Wheel Lift'}</option>
                <option value="Hook">{isAr ? 'خطاف وسلسلة' : 'Hook & Chain'}</option>
                <option value="Carry">{isAr ? 'ونش حمّال' : 'Self-Loader / Carry'}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="t15-truckPlate" className={`block text-[10px] ${colors.secondaryText}`}>
                {isAr ? 'لوحة الونش' : 'Truck plate'}
              </label>
              <input
                id="t15-truckPlate"
                dir="ltr"
                value={truckPlate}
                onChange={(e) => setTruckPlate(e.target.value)}
                data-testid="field-truckPlate"
                className={`w-full px-3 h-10 rounded-xl border ${colors.border} ${colors.inputBg} text-xs ${colors.text}`}
              />
            </div>
            <div>
              <label htmlFor="t15-truckCapacityTonnes" className={`block text-[10px] ${colors.secondaryText}`}>
                {isAr ? 'الحمولة (طن)' : 'Capacity (tonnes)'}
              </label>
              <input
                id="t15-truckCapacityTonnes"
                type="number"
                step="0.5"
                min="0.5"
                max="50"
                value={truckCapacityTonnes}
                onChange={(e) => setTruckCapacityTonnes(e.target.value)}
                data-testid="field-truckCapacityTonnes"
                className={`w-full px-3 h-10 rounded-xl border ${colors.border} ${colors.inputBg} text-xs ${colors.text}`}
              />
            </div>
          </div>
        </div>

        {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
        {toast && <Toast message={toast} onClose={() => setToast('')} />}

        <PrimaryButton type="submit" disabled={busy} testId="screen-primary">
          {isAr ? 'حفظ التغييرات' : 'Save Changes'}
        </PrimaryButton>
      </form>
    </CaptainShell>
  );
}

export const CAPTAIN_COMPONENTS = {
  T01: T01Screen,
  T02: T02Screen,
  T03: T03Screen,
  T04: T04Screen,
  T05: T05Screen,
  T06: T06Screen,
  T07: T07Screen,
  T08: T08Screen,
  T09: T09Screen,
  T10: T10Screen,
  T11: T11Screen,
  T12: T12Screen,
  T13: T13Screen,
  T14: T14Screen,
  T15: T15Screen
};

export default CAPTAIN_COMPONENTS;
