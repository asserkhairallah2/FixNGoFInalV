import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  usePrefs, useNav, useSession,
  AppTopBar, Card, SectionHeader, StatusBadge, Chip, PrimaryButton, SecondaryButton,
  InputField, SelectField, ToggleSwitch, EmptyState, Banner, Divider, Avatar,
  StarRating, MapView, BottomSheet, Skeleton, egp, formatLabel, pluralCount
} from '../../ui/kit.jsx';

function useColors() {
  const { isDark } = usePrefs();
  return isDark
    ? {
        bg: '#090A0D', surface: '#12141A', surface2: '#1A1D26', border: '#262936',
        text: '#FFFFFF', text2: '#94A3B8', text3: '#64748B',
        accent: '#F59E0B', accentBg: 'rgba(245, 158, 11, 0.14)',
        danger: '#F43F5E', dangerBg: 'rgba(244, 63, 94, 0.14)',
        success: '#10B981', successBg: 'rgba(16, 185, 129, 0.14)',
        info: '#38BDF8', infoBg: 'rgba(56, 189, 248, 0.14)',
      }
    : {
        bg: '#F8FAFC', surface: '#FFFFFF', surface2: '#F1F5F9', border: '#E2E8F0',
        text: '#0F172A', text2: '#475569', text3: '#64748B',
        accent: '#D97706', accentBg: 'rgba(245, 158, 11, 0.14)',
        danger: '#E11D48', dangerBg: 'rgba(225, 29, 72, 0.1)',
        success: '#059669', successBg: 'rgba(16, 185, 129, 0.12)',
        info: '#0284C7', infoBg: 'rgba(2, 132, 199, 0.12)',
      };
}
import {
  useBootstrap, useVehicles, useVehicle, useSaveVehicle, useDeleteVehicle,
  useRequests, useRequest, useTimeline, useCandidates, useQuotes,
  useEstimate, useCreateRequest, useCancelRequest, useSelectProvider,
  useApproveQuote, useDispute, useMethods, useInvoiceForRequest,
  useAddCard, usePay, useConfirmCash, useBookings, useUnreadCount, useSos, k
} from '../../api/hooks.js';
import { post, put, uploadFile, fileUrl } from '../../api/http.js';
import { fmtDateTime } from '../../i18n/format.js';

function useActiveRequest(params) {
  const { flow } = useNav();
  const { data: requests = [], isLoading: listLoading } = useRequests();
  const explicitId = params?.id || params?.requestId || flow?.requestId || null;
  const targetId = explicitId ||
    requests.find((r) => !['Completed', 'Cancelled'].includes(r.status))?.id ||
    requests[0]?.id;
  const single = useRequest(targetId);
  const req = single.data || requests.find((r) => r.id === targetId) || (!explicitId ? requests[0] : null) || null;
  const isLoading = (Boolean(targetId) && single.isLoading && !req) || (!targetId && listLoading);
  return { req, reqId: req?.id || targetId, isLoading, refetch: single.refetch, requests };
}

function luhnCheck(numStr) {
  const digits = String(numStr || '').replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits.charAt(i), 10);
    if (shouldDouble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

// ---------------------------------------------------------------------------
// C01 & C02 — CAR OWNER HOME DASHBOARD (WITH ACTIVE REQUEST BANNER WHEN PRESENT)
// ---------------------------------------------------------------------------
function HomeScreen() {
  const { t, isAr } = usePrefs();
  const { go, flow, updateFlow } = useNav();
  const { user } = useSession();
  const c = useColors();
  const { data: vehicles = [] } = useVehicles();
  const { data: requests = [] } = useRequests();
  const { data: bookings = [] } = useBookings();
  const { data: unread } = useUnreadCount();

  const primaryVehicle = vehicles.find((v) => v.isPrimary) || vehicles[0] || null;
  const activeReq = requests.find((r) => !['Completed', 'Cancelled'].includes(r.status)) || null;
  const nextBooking = bookings.find((b) => ['Pending', 'Confirmed', 'InProgress'].includes(b.status)) || null;
  const firstName = (user?.fullName || t('Driver', 'سائق')).split(' ')[0];
  const unreadCount = unread?.count ?? 0;

  const startWizard = (kind, problemKey) => {
    updateFlow({
      kind,
      problemKey: problemKey || null,
      serviceTypeKey: problemKey || null,
      vehicleId: primaryVehicle?.id || null,
    });
    go('C06', { kind, ...(problemKey ? { problemKey } : {}) });
  };

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      {/* Top Location & Greeting Header */}
      <div className="px-4 pt-3 pb-4" style={{ backgroundColor: c.surface, borderBottom: `1px solid ${c.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => go('C25')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{ backgroundColor: c.surface2, color: c.text, border: `1px solid ${c.border}` }}
          >
            <span style={{ color: c.accent }}>📍</span>
            <span className="truncate max-w-[180px]">
              {flow?.pickupAddress || activeReq?.pickupAddress || t('Set pickup location', 'حدد موقعك الحالي')}
            </span>
            <span style={{ color: c.text3 }}>▾</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => go('C22')}
              aria-label={t('Notifications', 'الإشعارات')}
              className="relative w-9 h-9 rounded-full flex items-center justify-center"
              style={{ backgroundColor: c.surface2, border: `1px solid ${c.border}` }}
            >
              <span>🔔</span>
              {unreadCount > 0 && (
                <span
                  className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                  style={{ backgroundColor: c.danger }}
                >
                  {unreadCount}
                </span>
              )}
            </button>
            <button type="button" onClick={() => go('C23')} aria-label={t('Profile', 'الملف الشخصي')}>
              <Avatar name={user?.fullName || t('Car Owner', 'مالك السيارة')} size={36} />
            </button>
          </div>
        </div>

        <h1 className="text-xl font-bold" style={{ color: c.text }}>
          {t(`Hello, ${firstName} 👋`, `أهلاً، ${firstName} 👋`)}
        </h1>
        <p className="text-xs mt-0.5" style={{ color: c.text2 }}>
          {t('24/7 roadside assistance & car care across Egypt', 'مساعدة على الطريق وعناية بالسيارات على مدار الساعة في مصر')}
        </p>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Active Request Live Banner (only rendered when an active request exists) */}
        {activeReq && (
          <div
            data-testid="active-request-banner"
            className="rounded-2xl p-4 shadow-md transition-all"
            style={{
              background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
              border: `1.5px solid ${c.accent}`,
              color: '#F8FAFC'
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full animate-ping" style={{ backgroundColor: c.accent }} />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: c.accent }}>
                  {t('Active Request', 'طلب نشط')} • {activeReq.code}
                </span>
              </div>
              <StatusBadge status={activeReq.status} />
            </div>
            <div className="text-sm font-bold mb-1">
              {activeReq.providerName
                ? t(`${activeReq.providerName} is assigned`, `تم تعيين ${activeReq.providerName}`)
                : t('Matching nearby verified providers...', 'جارٍ مطابقة مقدمي الخدمة القريبين...')}
            </div>
            <div className="text-xs text-slate-300 mb-3">
              {activeReq.pickupAddress}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => go(activeReq.kind === 'Mechanic' ? 'C12' : 'C11', { id: activeReq.id })}
                className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-slate-950"
                style={{ backgroundColor: c.accent }}
              >
                {t('Track Live →', 'تتبع مباشر ←')}
              </button>
              <button
                type="button"
                onClick={() => go('SH01', { requestId: activeReq.id })}
                className="py-2 px-3 rounded-xl text-xs font-semibold bg-slate-800 text-slate-100 border border-slate-700"
              >
                {t('Chat', 'محادثة')}
              </button>
            </div>
          </div>
        )}

        {/* Primary Vehicle Card */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: c.text3 }}>
              {t('My Active Vehicle', 'سيارتي النشطة')}
            </span>
            <button
              type="button"
              onClick={() => go('C04')}
              className="text-xs font-bold"
              style={{ color: c.accent }}
            >
              {t('Manage Vehicles', 'إدارة المركبات')}
            </button>
          </div>
          {primaryVehicle ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                  style={{ backgroundColor: c.accentBg, color: c.accent }}
                >
                  🚗
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: c.text }}>
                    {primaryVehicle.make} {primaryVehicle.model} ({primaryVehicle.year})
                  </div>
                  <div className="text-xs flex items-center gap-2 mt-0.5" style={{ color: c.text2 }}>
                    <span className="font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600">
                      {primaryVehicle.plate}
                    </span>
                    <span>• {primaryVehicle.color}</span>
                    <span>• {formatLabel(primaryVehicle.fuel, isAr)}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => go('C24', { id: primaryVehicle.id })}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                style={{ backgroundColor: c.surface2, color: c.text2 }}
              >
                {t('Edit', 'تعديل')}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between py-2">
              <div className="text-xs" style={{ color: c.text2 }}>
                {t('No vehicle added yet. Add your car for faster dispatch.', 'لم تتم إضافة سيارة بعد. أضف سيارتك لطلب أسرع.')}
              </div>
              <button
                type="button"
                onClick={() => go('C05')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-950"
                style={{ backgroundColor: c.accent }}
              >
                {t('+ Add Car', '+ أضف سيارة')}
              </button>
            </div>
          )}
        </Card>

        {/* Quick Roadside & Care Services Grid */}
        <div>
          <SectionHeader
            title={t('Roadside & Car Services', 'خدمات الطريق والعناية بالسيارة')}
            subtitle={t('Select what you need right now', 'اختر الخدمة التي تحتاجها الآن')}
          />
          <div className="grid grid-cols-2 gap-3">
            <Card onClick={() => startWizard('Tow', 'flatbed_tow')} className="hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-2" style={{ backgroundColor: c.accentBg }}>
                🛻
              </div>
              <div className="text-sm font-bold" style={{ color: c.text }}>{t('Request a Tow', 'طلب ونش إنقاذ')}</div>
              <div className="text-[11px] mt-0.5" style={{ color: c.text2 }}>{t('Flatbed & wheel-lift tow trucks', 'ونش سطحة أو رفع عجل')}</div>
            </Card>

            <Card onClick={() => startWizard('Mechanic', 'mechanic')} className="hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-2" style={{ backgroundColor: c.infoBg }}>
                🔧
              </div>
              <div className="text-sm font-bold" style={{ color: c.text }}>{t('Mobile Mechanic', 'ميكانيكي متنقل')}</div>
              <div className="text-[11px] mt-0.5" style={{ color: c.text2 }}>{t('On-spot diagnostics & repair', 'فحص وإصلاح فوري في موقعك')}</div>
            </Card>

            <Card onClick={() => go('C17')} className="hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-2" style={{ backgroundColor: c.successBg }}>
                🏢
              </div>
              <div className="text-sm font-bold" style={{ color: c.text }}>{t('Service Centers', 'مراكز الخدمة')}</div>
              <div className="text-[11px] mt-0.5" style={{ color: c.text2 }}>{t('Book scheduled maintenance', 'احجز صيانة دورية في المركز')}</div>
            </Card>

            <Card onClick={() => go('C03')} className="hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-2" style={{ backgroundColor: c.dangerBg }}>
                🚨
              </div>
              <div className="text-sm font-bold" style={{ color: c.danger }}>{t('Emergency SOS', 'طوارئ SOS')}</div>
              <div className="text-[11px] mt-0.5" style={{ color: c.text2 }}>{t('Priority accident & police help', 'استغاثة الحوادث والطوارئ')}</div>
            </Card>
          </div>
        </div>

        {/* Fast Breakdown Shortcuts */}
        <div>
          <div className="text-xs font-bold mb-2" style={{ color: c.text2 }}>
            {t('Quick Breakdown Shortcuts', 'اختصارات الأعطال السريعة')}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { key: 'battery', icon: '🔋', en: 'Battery', ar: 'بطارية', kind: 'Mechanic' },
              { key: 'tire', icon: '🛞', en: 'Flat Tire', ar: 'إطار مثقوب', kind: 'Mechanic' },
              { key: 'fuel', icon: '⛽', en: 'Fuel Delivery', ar: 'توصيل وقود', kind: 'Mechanic' },
              { key: 'accident', icon: '💥', en: 'Accident', ar: 'حادث', kind: 'Tow' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => startWizard(item.kind, item.key)}
                className="p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 text-center transition-all"
                style={{ backgroundColor: c.surface, border: `1px solid ${c.border}` }}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-[11px] font-semibold" style={{ color: c.text }}>{t(item.en, item.ar)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Upcoming Service Center Booking */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold" style={{ color: c.text }}>
              {t('Upcoming Center Appointment', 'موعد مركز الخدمة القادم')}
            </span>
            <button type="button" onClick={() => go('C37')} className="text-xs font-semibold" style={{ color: c.accent }}>
              {t('All Bookings', 'كل الحجوزات')}
            </button>
          </div>
          {nextBooking ? (
            <div
              onClick={() => go('C38', { id: nextBooking.id })}
              className="flex items-center justify-between cursor-pointer"
            >
              <div>
                <div className="text-sm font-bold" style={{ color: c.text }}>
                  {nextBooking.centerName || t('Service Center', 'مركز الخدمة')}
                </div>
                <div className="text-xs" style={{ color: c.text2 }}>
                  {nextBooking.serviceName || t('Periodic Maintenance', 'صيانة دورية')} • {fmtDateTime(nextBooking.slotStart, isAr ? 'ar' : 'en')}
                </div>
              </div>
              <StatusBadge status={nextBooking.status} />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: c.text2 }}>
                {t('No upcoming center bookings', 'لا توجد حجوزات قادمة في مراكز الخدمة')}
              </span>
              <button
                type="button"
                onClick={() => go('C17')}
                className="text-xs font-bold"
                style={{ color: c.accent }}
              >
                {t('Explore Centers →', 'تصفح المراكز ←')}
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export const C01 = () => <HomeScreen />;
export const C02 = () => <HomeScreen />;

// ---------------------------------------------------------------------------
// C03 — EMERGENCY SOS SCREEN
// ---------------------------------------------------------------------------
export function C03({ params }) {
  const { t } = usePrefs();
  const { go, back } = useNav();
  const c = useColors();
  const qc = useQueryClient();
  const { data: sosList = [] } = useSos();
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sentAlert, setSentAlert] = useState(null);

  const triggerSos = async () => {
    setSending(true);
    try {
      const created = await post('/support/sos', {
        latitude: 30.0444,
        longitude: 31.2357,
        note: note.trim() || null
      });
      setSentAlert(created);
      qc.invalidateQueries({ queryKey: k.sos });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar title={t('Emergency SOS', 'استغاثة طوارئ SOS')} onBack={back} />
      <div className="px-4 pt-4 space-y-4">
        <div
          className="rounded-2xl p-5 text-center"
          style={{ backgroundColor: c.dangerBg, border: `1.5px solid ${c.danger}` }}
        >
          <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-3xl text-white shadow-lg" style={{ backgroundColor: c.danger }}>
            🚨
          </div>
          <h2 className="text-lg font-extrabold" style={{ color: c.danger }}>
            {t('Priority Emergency Dispatch', 'إرسال طوارئ ذو أولوية قصوى')}
          </h2>
          <p className="text-xs mt-1" style={{ color: c.text2 }}>
            {t('Shares your live GPS coordinates (30.0444° N, 31.2357° E) with FixNGo Safety Desk & nearby P0 captains.', 'يشارك إحداثيات موقعك المباشرة مع مكتب أمان فيكس آند جو وأقرب كباتن الطوارئ.')}
          </p>
        </div>

        {sentAlert && (
          <Banner
            tone="success"
            title={t('SOS Alert Dispatched', 'تم إرسال بلاغ الطوارئ')}
            subtitle={t('Safety desk notified. Keep your hazard lights on and stay in a safe spot.', 'تم إبلاغ مكتب الأمان. قم بتشغيل أضواء الانتظار وابقَ في مكان آمن.')}
          />
        )}

        <Card>
          <InputField
            label={t('Situation Details (Optional)', 'تفاصيل الحالة (اختياري)')}
            placeholder={t('E.g. Highway collision on Ring Road, need ambulance & flatbed...', 'مثال: تصادم على الطريق الدائري، نحتاج إسعاف وونش...')}
            value={note}
            onChange={setNote}
          />
          <PrimaryButton tone="danger" onClick={triggerSos} disabled={sending}>
            {sending ? t('Sending SOS Alert...', 'جارٍ إرسال الاستغاثة...') : t('Trigger Emergency SOS Now', 'إرسال استغاثة طوارئ الآن')}
          </PrimaryButton>
        </Card>

        <Card>
          <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: c.text3 }}>
            {t('Egypt Direct Emergency Hotlines', 'أرقام الطوارئ المباشرة في مصر')}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <a
              href="tel:123"
              className="p-3 rounded-xl flex flex-col items-center gap-1 text-center font-bold text-xs"
              style={{ backgroundColor: c.surface2, color: c.text, border: `1px solid ${c.border}` }}
            >
              <span className="text-lg">🚑</span>
              <span>{t('Ambulance', 'الإسعاف')}</span>
              <span style={{ color: c.danger }}>123</span>
            </a>
            <a
              href="tel:122"
              className="p-3 rounded-xl flex flex-col items-center gap-1 text-center font-bold text-xs"
              style={{ backgroundColor: c.surface2, color: c.text, border: `1px solid ${c.border}` }}
            >
              <span className="text-lg">🚓</span>
              <span>{t('Police', 'النجدة')}</span>
              <span style={{ color: c.info }}>122</span>
            </a>
            <a
              href="tel:128"
              className="p-3 rounded-xl flex flex-col items-center gap-1 text-center font-bold text-xs"
              style={{ backgroundColor: c.surface2, color: c.text, border: `1px solid ${c.border}` }}
            >
              <span className="text-lg">🚧</span>
              <span>{t('Traffic SOS', 'مرور الطرق')}</span>
              <span style={{ color: c.accent }}>128</span>
            </a>
          </div>
        </Card>

        {sosList.length > 0 && (
          <Card>
            <div className="text-xs font-bold mb-2" style={{ color: c.text2 }}>
              {t('Recent SOS Alerts', 'بلاغات الطوارئ الأخيرة')}
            </div>
            <div className="space-y-2">
              {sosList.slice(0, 3).map((s) => (
                <div key={s.id} className="flex items-center justify-between text-xs py-1.5 border-b last:border-b-0" style={{ borderColor: c.border }}>
                  <span style={{ color: c.text }}>{s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}</span>
                  <StatusBadge status={s.resolved ? 'Resolved' : 'Escalated'} />
                </div>
              ))}
            </div>
          </Card>
        )}

        <SecondaryButton onClick={() => go('C06', { kind: 'Tow', priority: 'P0' })}>
          {t('Request Priority P0 Accident Tow', 'طلب ونش طوارئ للحوادث (أولوية قصوى)')}
        </SecondaryButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C04 — MY VEHICLES LIST
// ---------------------------------------------------------------------------
export function C04() {
  const { t, isAr } = usePrefs();
  const { go, back } = useNav();
  const c = useColors();
  const qc = useQueryClient();
  const { data: vehicles = [], isLoading } = useVehicles();
  const delMutation = useDeleteVehicle();
  const [err, setErr] = useState('');

  const handleSetPrimary = async (v) => {
    setErr('');
    try {
      await post(`/vehicles/${v.id}/primary`, {});
      qc.invalidateQueries({ queryKey: k.vehicles });
    } catch (e) {
      setErr(e.message || t('Could not set primary vehicle', 'تعذر تعيين المركبة الأساسية'));
    }
  };

  const handleDelete = async (v) => {
    setErr('');
    try {
      await delMutation.mutateAsync(v.id);
    } catch (e) {
      setErr(e.message || t('Vehicle cannot be deleted while referenced by an active request.', 'لا يمكن حذف مركبة مرتبطة بطلب خدمة.'));
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar
        title={t('My Vehicles', 'مركباتي')}
        onBack={back}
        right={
          <button
            type="button"
            onClick={() => go('C05')}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-950"
            style={{ backgroundColor: c.accent }}
          >
            {t('+ Add', '+ إضافة')}
          </button>
        }
      />

      <div className="px-4 pt-4 space-y-3">
        {err && <Banner tone="danger" title={err} />}

        {!isLoading && vehicles.length === 0 ? (
          <EmptyState
            icon="🚗"
            title={t('No Vehicles Saved', 'لا توجد مركبات محفوظة')}
            subtitle={t('Add your vehicle make, model, plate and fuel type for rapid roadside dispatch.', 'أضف ماركة وموديل ولوحة ونوع وقود سيارتك لطلب المساعدة بسرعة.')}
            action={<PrimaryButton onClick={() => go('C05')}>{t('Add Your First Vehicle', 'أضف سيارتك الأولى')}</PrimaryButton>}
          />
        ) : (
          vehicles.map((v) => (
            <Card key={v.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: c.accentBg }}>
                    🚘
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: c.text }}>
                        {v.make} {v.model} ({v.year})
                      </span>
                      {v.isPrimary && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: c.accentBg, color: c.accent }}>
                          {t('Primary', 'الأساسية')}
                        </span>
                      )}
                    </div>
                    <div className="text-xs mt-1 flex flex-wrap items-center gap-2" style={{ color: c.text2 }}>
                      <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-500/10">{v.plate}</span>
                      <span>• {v.color}</span>
                      <span>• {formatLabel(v.fuel, isAr)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <Divider className="my-3" />

              <div className="flex items-center justify-between gap-2">
                {!v.isPrimary ? (
                  <button
                    type="button"
                    onClick={() => handleSetPrimary(v)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ backgroundColor: c.surface2, color: c.text }}
                  >
                    {t('Set as Primary', 'تعيين كأساسية')}
                  </button>
                ) : (
                  <span className="text-[11px]" style={{ color: c.text3 }}>{t('Default for roadside requests', 'الافتراضية لطلبات الطريق')}</span>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => go('C24', { id: v.id })}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ backgroundColor: c.surface2, color: c.text }}
                  >
                    {t('Edit', 'تعديل')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(v)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ backgroundColor: c.dangerBg, color: c.danger }}
                  >
                    {t('Delete', 'حذف')}
                  </button>
                </div>
              </div>
            </Card>
          ))
        )}

        <div className="pt-2">
          <PrimaryButton onClick={() => go('C05')}>
            {t('+ Add Another Vehicle', '+ إضافة مركبة أخرى')}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C05 (ADD VEHICLE) & C24 (EDIT VEHICLE) — WITH DROPDOWN FUEL TYPE
// ---------------------------------------------------------------------------
function VehicleFormScreen({ isEdit = false, params }) {
  const { t } = usePrefs();
  const { go, back } = useNav();
  const c = useColors();
  const { data: bootstrap } = useBootstrap();
  const { data: vehicles = [] } = useVehicles();
  const existing = isEdit ? (params?.vehicle || vehicles.find((v) => v.id === params?.id) || null) : null;
  const saveVehicle = useSaveVehicle();

  const makesList = useMemo(() => {
    const raw = bootstrap?.vehicleMakes || bootstrap?.makes || [];
    if (raw.length > 0) return raw;
    return [
      { id: '1', name: 'Toyota', models: [{ id: '11', name: 'Corolla' }, { id: '12', name: 'Yaris' }, { id: '13', name: 'Fortuner' }] },
      { id: '2', name: 'Hyundai', models: [{ id: '21', name: 'Elantra' }, { id: '22', name: 'Tucson' }, { id: '23', name: 'Accent' }] },
      { id: '3', name: 'Kia', models: [{ id: '31', name: 'Sportage' }, { id: '32', name: 'Cerato' }] },
      { id: '4', name: 'Nissan', models: [{ id: '41', name: 'Sunny' }, { id: '42', name: 'Qashqai' }] },
      { id: '5', name: 'Chevrolet', models: [{ id: '51', name: 'Optra' }, { id: '52', name: 'Captiva' }] },
    ];
  }, [bootstrap]);

  const [make, setMake] = useState(existing?.make || '');
  const [model, setModel] = useState(existing?.model || '');
  const [year, setYear] = useState(existing?.year ? String(existing.year) : '');
  const [plate, setPlate] = useState(existing?.plate || '');
  const [color, setColor] = useState(existing?.color || '');
  const [fuel, setFuel] = useState(existing?.fuel || '');
  const [isPrimary, setIsPrimary] = useState(existing ? !!existing.isPrimary : false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (existing) {
      setMake(existing.make || '');
      setModel(existing.model || '');
      setYear(existing.year ? String(existing.year) : '');
      setPlate(existing.plate || '');
      setColor(existing.color || '');
      setFuel(existing.fuel || '');
      setIsPrimary(!!existing.isPrimary);
    }
  }, [existing?.id]);

  const selectedMakeObj = makesList.find((m) => m.name.toLowerCase() === String(make).toLowerCase());
  const modelOptions = [
    { value: '', label: t('Select model...', 'اختر الموديل...') },
    ...(selectedMakeObj?.models?.length
      ? selectedMakeObj.models.map((m) => ({ value: m.name, label: m.name }))
      : model
      ? [{ value: model, label: model }]
      : []),
  ];

  const fuelOptions = [
    { value: '', label: t('Select fuel type...', 'اختر نوع الوقود...') },
    { value: 'Petrol', label: t('Petrol (Benzine)', 'بنزين (Petrol)') },
    { value: 'Diesel', label: t('Diesel (Solar)', 'سولار / ديزل (Diesel)') },
    { value: 'Hybrid', label: t('Hybrid', 'هايبرد / هجين (Hybrid)') },
    { value: 'Electric', label: t('Electric (EV)', 'كهرباء (Electric)') },
    { value: 'Gas', label: t('Natural Gas (CNG)', 'غاز طبيعي (Gas)') },
  ];

  const normalisedPlate = useMemo(
    () => String(plate || '').replace(/[^a-zA-Z0-9\u0600-\u06FF\u0660-\u0669]/g, '').toUpperCase(),
    [plate]
  );

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setErr('');
    const parsedYear = Number(year);
    const maxYear = new Date().getUTCFullYear() + 1;
    if (!make.trim() || !model.trim()) {
      setErr(t('Please select vehicle make and model.', 'يرجى اختيار ماركة وموديل السيارة.'));
      return;
    }
    if (!year || Number.isNaN(parsedYear) || parsedYear < 1950 || parsedYear > maxYear) {
      setErr(t(`Please enter a valid model year (1950–${maxYear}).`, `يرجى إدخال سنة صنع صحيحة (١٩٥٠–${maxYear}).`));
      return;
    }
    if (!color.trim()) {
      setErr(t('Please enter the vehicle color.', 'يرجى إدخال لون السيارة.'));
      return;
    }
    if (!normalisedPlate) {
      setErr(t('Please enter the license plate number.', 'يرجى إدخال رقم لوحة السيارة.'));
      return;
    }
    if (!fuel) {
      setErr(t('Please select the fuel type.', 'يرجى اختيار نوع الوقود.'));
      return;
    }
    try {
      await saveVehicle.mutateAsync({
        id: isEdit ? (existing?.id || params?.id) : undefined,
        make: make.trim(),
        model: model.trim(),
        year: parsedYear,
        plate: plate.trim(),
        color: color.trim(),
        fuel,
        isPrimary,
      });
      go('C04');
    } catch (ex) {
      setErr(ex.message || t('Failed to save vehicle', 'فشل حفظ بيانات المركبة'));
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar
        title={isEdit ? t('Edit Vehicle', 'تعديل المركبة') : t('Add Vehicle', 'إضافة مركبة جديدة')}
        onBack={back}
      />
      <form onSubmit={handleSubmit} className="px-4 pt-4 space-y-3">
        {err && <Banner tone="danger" title={err} />}
        <Card>
          <SelectField
            label={t('Make / Brand', 'ماركة السيارة')}
            value={make}
            testId="field-make"
            onChange={(val) => {
              setMake(val);
              setModel('');
            }}
            options={[
              { value: '', label: t('Select make...', 'اختر الماركة...') },
              ...makesList.map((m) => ({ value: m.name, label: m.name })),
            ]}
          />
          <SelectField
            label={t('Model', 'الموديل')}
            value={model}
            onChange={setModel}
            testId="field-model"
            options={modelOptions}
          />
          <div className="grid grid-cols-2 gap-3">
            <InputField
              label={t('Model Year', 'سنة الصنع')}
              type="number"
              value={year}
              onChange={setYear}
              testId="field-year"
              dir="ltr"
              placeholder="2022"
            />
            <InputField
              label={t('Color', 'اللون')}
              value={color}
              onChange={setColor}
              testId="field-color"
              placeholder={t('E.g. Silver', 'مثال: فضي')}
            />
          </div>
          <InputField
            label={t('License Plate Number', 'رقم اللوحة المعدنية')}
            value={plate}
            onChange={setPlate}
            testId="field-plate"
            dir="ltr"
            placeholder={t('ABC-1234 or أ ب ج ١٢٣٤', 'أ ب ج ١٢٣٤ أو ABC-1234')}
            hint={
              plate.trim() && plate.trim() !== normalisedPlate
                ? t(`Saved normalized as: ${normalisedPlate}`, `سيتم حفظها بصيغة موحدة: ${normalisedPlate}`)
                : undefined
            }
          />
          <SelectField
            label={t('Fuel Type', 'نوع الوقود')}
            value={fuel}
            onChange={setFuel}
            testId="field-fuel"
            options={fuelOptions}
          />
          <div className="flex items-center justify-between pt-2">
            <div>
              <div className="text-sm font-semibold" style={{ color: c.text }}>{t('Set as Primary Vehicle', 'تعيين كمركبة أساسية')}</div>
              <div className="text-xs" style={{ color: c.text2 }}>{t('Pre-selected when requesting roadside help', 'يتم اختيارها تلقائياً عند طلب المساعدة')}</div>
            </div>
            <ToggleSwitch checked={isPrimary} onChange={setIsPrimary} testId="toggle-isPrimary" />
          </div>
        </Card>

        <PrimaryButton type="submit" testId="screen-primary" disabled={saveVehicle.isPending}>
          {saveVehicle.isPending
            ? t('Saving...', 'جارٍ الحفظ...')
            : isEdit ? t('Save Vehicle Changes', 'حفظ التعديلات') : t('Save Vehicle', 'حفظ المركبة')}
        </PrimaryButton>
      </form>
    </div>
  );
}

export const C05 = (props) => <VehicleFormScreen isEdit={false} {...props} />;
export const C24 = (props) => <VehicleFormScreen isEdit={true} {...props} />;

// ---------------------------------------------------------------------------
// C06 — SELECT PROBLEM TYPE (WIZARD STEP 1)
// ---------------------------------------------------------------------------
export function C06({ params }) {
  const { t, isAr } = usePrefs();
  const { go, back, flow, updateFlow } = useNav();
  const c = useColors();
  const { data: bootstrap } = useBootstrap();

  const serviceTypes = bootstrap?.serviceTypes || [];
  const [selectedKey, setSelectedKey] = useState(params?.problemKey || flow?.serviceTypeKey || '');
  const [isP0, setIsP0] = useState(params?.priority === 'P0' || flow?.priority === 'P0');
  const [err, setErr] = useState('');

  const chosenType = serviceTypes.find((s) => s.key === selectedKey || s.id === selectedKey) || null;

  const handleContinue = () => {
    setErr('');
    if (!chosenType) {
      setErr(t('Please select a service or breakdown type first.', 'يرجى اختيار نوع العطل أو الخدمة أولاً.'));
      return;
    }
    const kind = chosenType.kind || (String(selectedKey).includes('tow') ? 'Tow' : 'Mechanic');
    updateFlow({
      serviceTypeId: chosenType.id,
      serviceTypeKey: chosenType.key,
      serviceTypeName: isAr ? (chosenType.nameAr || chosenType.nameEn) : chosenType.nameEn,
      kind,
      priority: isP0 ? 'P0' : 'Normal',
    });
    go(kind === 'Tow' ? 'C07' : 'C26', {
      serviceTypeId: chosenType.id,
      serviceTypeKey: chosenType.key,
      kind,
      priority: isP0 ? 'P0' : 'Normal',
    });
  };

  const iconsByKey = {
    tow: '🛻',
    flatbed: '🛻',
    battery: '🔋',
    tire: '🛞',
    fuel: '⛽',
    engine: '🔧',
    mechanic: '🧰',
    lockout: '🔑',
  };

  const pickIcon = (key, kind) => {
    const kLow = String(key || '').toLowerCase();
    for (const [sub, ic] of Object.entries(iconsByKey)) {
      if (kLow.includes(sub)) return ic;
    }
    return kind === 'Tow' ? '🛻' : '🔧';
  };

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar title={t('What Happened?', 'ما هي المشكلة؟')} onBack={back} />
      <div className="px-4 pt-4 space-y-4">
        {err && <Banner tone="danger" title={err} />}
        <SectionHeader
          title={t('1. Choose Service / Breakdown Type', '١. اختر نوع العطل أو الخدمة')}
          subtitle={t('We match the right equipment and specialist for your situation', 'نقوم بمطابقة المعدات والفني المناسب لحالتك')}
        />

        <div className="grid grid-cols-2 gap-3">
          {serviceTypes.map((st) => {
            const active = st.key === selectedKey || st.id === selectedKey;
            return (
              <button
                key={st.id || st.key}
                type="button"
                data-testid={`service-card-${st.key}`}
                onClick={() => setSelectedKey(st.key)}
                className="p-3.5 rounded-2xl text-start transition-all flex flex-col justify-between"
                style={{
                  backgroundColor: active ? c.accentBg : c.surface,
                  border: `2px solid ${active ? c.accent : c.border}`,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{pickIcon(st.key, st.kind)}</span>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: c.surface2, color: c.text2 }}
                  >
                    {st.kind === 'Tow' ? t('Tow Service', 'خدمة ونش') : t('Roadside', 'مساعدة طريق')}
                  </span>
                </div>
                <div className="text-sm font-bold" style={{ color: c.text }}>
                  {isAr ? st.nameAr : st.nameEn}
                </div>
              </button>
            );
          })}
        </div>

        {/* P0 Accident Escalation Toggle */}
        <Card>
          <div className="flex items-center justify-between">
            <div className="pe-3">
              <div className="text-sm font-bold flex items-center gap-1.5" style={{ color: isP0 ? c.danger : c.text }}>
                <span>🚨</span>
                <span>{t('Accident / Unsafe Highway Location (P0)', 'حادث أو موقع خطر على طريق سريع (أولوية قصوى)')}</span>
              </div>
              <div className="text-xs mt-0.5" style={{ color: c.text2 }}>
                {t('Prioritizes immediate dispatch and alerts FixNGo safety desk', 'يمنح أولوية إرسال فورية وينبه فريق الأمان')}
              </div>
            </div>
            <ToggleSwitch checked={isP0} onChange={setIsP0} />
          </div>
        </Card>

        <PrimaryButton testId="screen-primary" onClick={handleContinue} disabled={!chosenType}>
          {t('Continue to Details →', 'المتابعة للتفاصيل ←')}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C07 (TOW DETAILS) & C26 (MECHANIC DETAILS + DYNAMIC QUESTIONS + PHOTOS)
// ---------------------------------------------------------------------------
function RequestDetailsScreen({ defaultKind = 'Tow', params }) {
  const { t, isAr } = usePrefs();
  const { go, back, flow, updateFlow } = useNav();
  const c = useColors();
  const { data: bootstrap } = useBootstrap();
  const { data: vehicles = [] } = useVehicles();
  const estimateMut = useEstimate();
  const createMut = useCreateRequest();

  const serviceTypes = bootstrap?.serviceTypes || [];
  const chosenType = useMemo(() => {
    if (params?.serviceTypeId) return serviceTypes.find((s) => s.id === params.serviceTypeId) || serviceTypes[0];
    if (flow?.serviceTypeId) return serviceTypes.find((s) => s.id === flow.serviceTypeId) || serviceTypes[0];
    return serviceTypes.find((s) => s.kind === defaultKind) || serviceTypes[0] || null;
  }, [serviceTypes, params?.serviceTypeId, flow?.serviceTypeId, defaultKind]);

  const defaultPickLat = 30.0444;
  const defaultPickLon = 31.2357;
  const defaultDestLat = 30.0595;
  const defaultDestLon = 31.4950;
  const primaryVehicle = vehicles.find((v) => v.isPrimary) || vehicles[0] || null;
  const [vehicleId, setVehicleId] = useState(flow?.vehicleId || primaryVehicle?.id || '');
  const [pickupAddress, setPickupAddress] = useState(flow?.pickupAddress || '');
  const [destAddress, setDestAddress] = useState(flow?.destinationAddress || '');
  const [distanceKm, setDistanceKm] = useState(flow?.distanceKm ? String(flow.distanceKm) : '');
  const [note, setNote] = useState(flow?.note || '');
  const [answers, setAnswers] = useState(flow?.answers || {});
  const [photoIds, setPhotoIds] = useState(flow?.photoFileIds || []);
  const [uploading, setUploading] = useState(false);
  const [estimate, setEstimate] = useState(flow?.estimate || null);
  const [err, setErr] = useState('');

  const isTowKind = (chosenType?.kind || defaultKind) === 'Tow';

  useEffect(() => {
    if (!vehicleId && primaryVehicle?.id) setVehicleId(primaryVehicle.id);
  }, [primaryVehicle?.id, vehicleId]);

  useEffect(() => {
    if (chosenType?.id) {
      const parsedDist = Number(distanceKm);
      if (isTowKind && (!distanceKm || Number.isNaN(parsedDist) || parsedDist <= 0)) {
        setEstimate(null);
        return;
      }
      const dist = isTowKind ? parsedDist : 0;
      estimateMut.mutate(
        { serviceTypeId: chosenType.id, distanceKm: dist },
        { onSuccess: (data) => setEstimate(data) }
      );
    }
  }, [chosenType?.id, distanceKm, isTowKind]);

  const questions = chosenType?.questions || [];

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErr('');
    try {
      const uploaded = await uploadFile(file, 'request');
      if (uploaded?.id) {
        setPhotoIds((prev) => [...prev, uploaded.id]);
      }
    } catch (ex) {
      setErr(ex.message || t('Photo upload failed', 'فشل رفع الصورة'));
    } finally {
      setUploading(false);
    }
  };

  const saveDraftToFlow = () => {
    const escalated = questions.some((q) => q.escalatesToP0WhenYes && answers[q.key] === 'yes');
    const parsedDist = Number(distanceKm);
    const dist = isTowKind ? (parsedDist > 0 ? parsedDist : 0) : 0;
    const draft = {
      vehicleId: vehicleId || primaryVehicle?.id || null,
      serviceTypeId: chosenType?.id,
      serviceTypeKey: chosenType?.key,
      serviceTypeName: isAr ? chosenType?.nameAr : chosenType?.nameEn,
      kind: chosenType?.kind || defaultKind,
      pickupLatitude: flow?.pickupLatitude ?? defaultPickLat,
      pickupLongitude: flow?.pickupLongitude ?? defaultPickLon,
      pickupAddress: pickupAddress.trim(),
      destinationLatitude: isTowKind ? (flow?.destinationLatitude ?? defaultDestLat) : null,
      destinationLongitude: isTowKind ? (flow?.destinationLongitude ?? defaultDestLon) : null,
      destinationAddress: isTowKind ? (destAddress.trim() || null) : null,
      distanceKm: dist,
      problem: isAr ? chosenType?.nameAr : chosenType?.nameEn,
      answers,
      note: note.trim(),
      priority: escalated || flow?.priority === 'P0' ? 'P0' : 'Normal',
      photoFileIds: photoIds,
      estimate,
    };
    updateFlow(draft);
    return draft;
  };

  const validateDetails = () => {
    if (!pickupAddress.trim()) {
      setErr(t('Please enter or pin your pickup location.', 'يرجى إدخال أو تحديد موقع السيارة الحالي.'));
      return false;
    }
    if (isTowKind) {
      if (!destAddress.trim()) {
        setErr(t('Please enter the drop-off destination.', 'يرجى إدخال وجهة التوصيل.'));
        return false;
      }
      if (!distanceKm || Number(distanceKm) <= 0) {
        setErr(t('Please enter the estimated trip distance in km.', 'يرجى إدخال المسافة التقديرية بالكيلومتر.'));
        return false;
      }
    }
    return true;
  };

  const handleReviewEstimate = () => {
    setErr('');
    if (!validateDetails()) return;
    saveDraftToFlow();
    go('C08');
  };

  const handleDirectSubmit = async () => {
    setErr('');
    if (!validateDetails()) return;
    const draft = saveDraftToFlow();
    if (!draft.serviceTypeId) {
      setErr(t('Service types are still loading', 'جارٍ تحميل أنواع الخدمة'));
      return;
    }
    try {
      const created = await createMut.mutateAsync({
        vehicleId: draft.vehicleId || null,
        serviceTypeId: draft.serviceTypeId,
        pickupLatitude: draft.pickupLatitude,
        pickupLongitude: draft.pickupLongitude,
        pickupAddress: draft.pickupAddress,
        destinationLatitude: draft.destinationLatitude,
        destinationLongitude: draft.destinationLongitude,
        destinationAddress: draft.destinationAddress,
        distanceKm: draft.distanceKm,
        problem: draft.problem,
        answersJson: JSON.stringify(draft.answers || {}),
        note: draft.note || null,
        priority: draft.priority || 'Normal',
        photoFileIds: draft.photoFileIds,
        idempotencyKey: crypto.randomUUID(),
      });
      updateFlow({ requestId: created.id });
      go('C09', { id: created.id });
    } catch (ex) {
      setErr(ex.message || t('Could not create request', 'تعذر إنشاء الطلب'));
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar
        title={
          (chosenType?.kind || defaultKind) === 'Tow'
            ? t('Tow Request Details', 'تفاصيل طلب الونش')
            : t('Diagnostic & Problem Details', 'تفاصيل العطل والفحص')
        }
        onBack={back}
      />
      <div className="px-4 pt-4 space-y-3">
        {err && <Banner tone="danger" title={err} />}

        {/* Vehicle Selection */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold" style={{ color: c.text2 }}>{t('Select Vehicle', 'اختر السيارة')}</span>
            <button type="button" onClick={() => go('C05')} className="text-xs font-bold" style={{ color: c.accent }}>
              {t('+ Add New', '+ إضافة سيارة')}
            </button>
          </div>
          {vehicles.length > 0 ? (
            <SelectField
              value={vehicleId}
              onChange={setVehicleId}
              testId="field-vehicleId"
              options={vehicles.map((v) => ({
                value: v.id,
                label: `${v.make} ${v.model} (${v.year}) — ${v.plate}`,
              }))}
            />
          ) : (
            <div className="text-xs" style={{ color: c.text2 }}>
              {t('No saved vehicle — you can still proceed or add a vehicle first.', 'لا توجد مركبة محفوظة — يمكنك المتابعة أو إضافة مركبة.')}
            </div>
          )}
        </Card>

        {/* Pickup & Dropoff Location */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold" style={{ color: c.text2 }}>{t('Location & Route', 'الموقع والمسار')}</span>
            <button
              type="button"
              onClick={() => {
                saveDraftToFlow();
                go('C25');
              }}
              className="text-xs font-bold"
              style={{ color: c.accent }}
            >
              {t('Pin on Map 📍', 'تحديد على الخريطة 📍')}
            </button>
          </div>
          <InputField
            label={t('Pickup Location', 'موقع السيارة الحالي')}
            value={pickupAddress}
            onChange={setPickupAddress}
            testId="field-pickupAddress"
            placeholder={t('Enter street, district or landmark...', 'أدخل اسم الشارع أو المنطقة أو علامة مميزة...')}
          />
          {(chosenType?.kind || defaultKind) === 'Tow' && (
            <>
              <InputField
                label={t('Drop-off Destination', 'وجهة التوصيل (المركز أو المنزل)')}
                value={destAddress}
                onChange={setDestAddress}
                testId="field-destinationAddress"
                placeholder={t('Enter workshop or drop-off address...', 'أدخل عنوان مركز الصيانة أو وجهة التوصيل...')}
              />
              <InputField
                label={t('Estimated Distance (km)', 'المسافة التقديرية (كم)')}
                type="number"
                value={distanceKm}
                onChange={setDistanceKm}
                dir="ltr"
                testId="field-distanceKm"
                placeholder="8.5"
              />
            </>
          )}
        </Card>

        {/* Dynamic Follow-up Questions from ServiceType */}
        {questions.length > 0 && (
          <Card>
            <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: c.text3 }}>
              {t('Quick Diagnostic Questions', 'أسئلة تشخيصية سريعة')}
            </div>
            <div className="space-y-3">
              {questions.map((q) => {
                let choices = null;
                if (q.choicesJson) {
                  try {
                    const parsed = JSON.parse(q.choicesJson);
                    if (Array.isArray(parsed) && parsed.length > 0) choices = parsed;
                  } catch {}
                }
                const isChoice = q.answerType === 'choice' && choices;
                const val = answers[q.key] || '';
                return (
                  <div key={q.id || q.key} className={isChoice ? 'space-y-1.5' : 'flex items-center justify-between gap-2'}>
                    <div className="text-xs font-medium" style={{ color: c.text }}>
                      {isAr ? q.questionAr : q.questionEn}
                    </div>
                    {isChoice ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {choices.map((choice) => (
                          <button
                            key={choice}
                            type="button"
                            onClick={() => setAnswers((prev) => ({ ...prev, [q.key]: choice }))}
                            className="px-3 py-1 rounded-lg text-xs font-bold transition-all"
                            style={{
                              backgroundColor: val === choice ? c.accent : c.surface2,
                              color: val === choice ? '#0F172A' : c.text2,
                            }}
                          >
                            {formatLabel(choice, isAr)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {['yes', 'no'].map((choice) => (
                          <button
                            key={choice}
                            type="button"
                            onClick={() => setAnswers((prev) => ({ ...prev, [q.key]: choice }))}
                            className="px-3 py-1 rounded-lg text-xs font-bold transition-all"
                            style={{
                              backgroundColor: val === choice ? c.accent : c.surface2,
                              color: val === choice ? '#0F172A' : c.text2,
                            }}
                          >
                            {choice === 'yes' ? t('Yes', 'نعم') : t('No', 'لا')}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Photo Attachment & Notes */}
        <Card>
          <InputField
            label={t('Additional Notes for Provider', 'ملاحظات إضافية لمقدم الخدمة')}
            value={note}
            onChange={setNote}
            testId="field-problem"
            placeholder={t('E.g. Car is parked near the main gate, steering wheel locked...', 'مثال: السيارة متوقفة بجوار البوابة الرئيسية...')}
          />

          <div className="mt-2">
            <div className="text-xs font-semibold mb-1.5" style={{ color: c.text2 }}>
              {t('Breakdown Photos (Optional)', 'صور العطل أو السيارة (اختياري)')}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {photoIds.map((fid) => (
                <img
                  key={fid}
                  src={fileUrl(fid)}
                  alt="Uploaded"
                  className="w-14 h-14 rounded-xl object-cover border"
                  style={{ borderColor: c.border }}
                />
              ))}
              <label
                className="px-3 py-2 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                style={{ backgroundColor: c.surface2, color: c.text, border: `1px dashed ${c.border}` }}
              >
                <span>📷</span>
                <span>{uploading ? t('Uploading...', 'جارٍ الرفع...') : t('Upload Photo', 'إرفاق صورة')}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </label>
            </div>
          </div>
        </Card>

        {/* Live Estimate Preview Card */}
        {estimate && (
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold" style={{ color: c.text2 }}>{t('Estimated Price Range', 'التكلفة التقديرية المتوقعة')}</div>
                <div className="text-base font-extrabold mt-0.5" style={{ color: c.accent }}>
                  {egp(estimate.lowMinor, isAr)} – {egp(estimate.highMinor, isAr)}
                </div>
              </div>
              <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold" style={{ backgroundColor: c.surface2, color: c.text2 }}>
                {t('Transparent Fare', 'تسعير شفاف')}
              </span>
            </div>
          </Card>
        )}

        <div className="space-y-2 pt-1">
          <PrimaryButton testId="screen-primary" onClick={handleReviewEstimate}>
            {t('Review Fare & Confirm →', 'مراجعة التسعيرة والتأكيد ←')}
          </PrimaryButton>
          <SecondaryButton onClick={handleDirectSubmit} disabled={createMut.isPending}>
            {createMut.isPending ? t('Dispatching...', 'جارٍ الإرسال...') : t('Dispatch Immediately', 'إرسال الطلب فوراً')}
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}

export const C07 = (props) => <RequestDetailsScreen defaultKind="Tow" {...props} />;
export const C26 = (props) => <RequestDetailsScreen defaultKind="Mechanic" {...props} />;

// ---------------------------------------------------------------------------
// C25 — MAP LOCATION PICKER
// ---------------------------------------------------------------------------
export function C25() {
  const { t, isAr } = usePrefs();
  const { back, flow, updateFlow } = useNav();
  const c = useColors();

  const landmarks = [
    { nameEn: '90th Street, 5th Settlement, New Cairo', nameAr: 'شارع التسعين، التجمع الخامس، القاهرة الجديدة', lat: 30.0276, lon: 31.4913 },
    { nameEn: 'Cairo Festival City Ring Road Exit', nameAr: 'مخرج كايرو فيستيفال سيتي - الطريق الدائري', lat: 30.0289, lon: 31.4071 },
    { nameEn: 'Tahrir Square, Downtown Cairo', nameAr: 'ميدان التحرير، وسط البلد، القاهرة', lat: 30.0444, lon: 31.2357 },
    { nameEn: '26th of July Corridor, Sheikh Zayed', nameAr: 'محور ٢٦ يوليو، الشيخ زايد', lat: 30.0381, lon: 31.0124 },
  ];

  const [pin, setPin] = useState(() =>
    flow?.pickupLatitude && flow?.pickupLongitude
      ? { lat: flow.pickupLatitude, lng: flow.pickupLongitude }
      : null
  );
  const [customAddress, setCustomAddress] = useState(flow?.pickupAddress || '');
  const [err, setErr] = useState('');

  const handleMapPick = ({ lat, lng }) => {
    setPin({ lat, lng });
    if (!customAddress.trim()) {
      setCustomAddress(
        isAr
          ? `موقع محدد على الخريطة (${lat.toFixed(4)}, ${lng.toFixed(4)})`
          : `Pinned Cairo Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`
      );
    }
  };

  const handleConfirm = () => {
    setErr('');
    if (!customAddress.trim() && !pin) {
      setErr(t('Tap the map to drop a pin or enter your pickup address.', 'اضغط على الخريطة لتحديد الموقع أو أدخل العنوان.'));
      return;
    }
    const finalAddr = customAddress.trim() || (pin ? `Pinned Location (${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)})` : '');
    updateFlow({
      pickupAddress: finalAddr,
      pickupLatitude: pin?.lat ?? 30.0444,
      pickupLongitude: pin?.lng ?? 31.2357,
    });
    back();
  };

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar title={t('Confirm Pickup Location', 'تأكيد موقع الالتقاط')} onBack={back} />
      <div className="px-4 pt-4 space-y-4">
        {err && <Banner tone="danger" title={err} />}
        <MapView
          height={210}
          pin={pin}
          onPick={handleMapPick}
          interactive
          label={pin ? `${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}` : undefined}
        />

        <Card>
          <InputField
            label={t('Pickup Street / Address', 'عنوان موقع السيارة')}
            value={customAddress}
            onChange={setCustomAddress}
            testId="field-pickupAddress"
            placeholder={t('Tap map above or type your street & district...', 'اضغط على الخريطة أعلاه أو اكتب اسم الشارع والمنطقة...')}
          />
          <div className="text-xs font-bold mb-2" style={{ color: c.text2 }}>
            {t('Quick Landmarks in Greater Cairo', 'معالم سريعة في القاهرة الكبرى')}
          </div>
          <div className="space-y-2">
            {landmarks.map((lm) => {
              const labelStr = isAr ? lm.nameAr : lm.nameEn;
              const isSelected = customAddress === lm.nameEn || customAddress === lm.nameAr;
              return (
                <button
                  key={lm.nameEn}
                  type="button"
                  onClick={() => {
                    setPin({ lat: lm.lat, lng: lm.lon });
                    setCustomAddress(labelStr);
                  }}
                  className="w-full p-2.5 rounded-xl text-start text-xs font-semibold flex items-center justify-between"
                  style={{
                    backgroundColor: isSelected ? c.accentBg : c.surface2,
                    color: c.text,
                    border: `1px solid ${isSelected ? c.accent : c.border}`,
                  }}
                >
                  <span>📍 {labelStr}</span>
                  <span className="text-[10px] font-mono" dir="ltr" style={{ color: c.text3 }}>{lm.lat.toFixed(3)}, {lm.lon.toFixed(3)}</span>
                </button>
              );
            })}
          </div>
        </Card>

        <PrimaryButton testId="screen-primary" onClick={handleConfirm}>
          {t('Confirm Pin Location', 'تأكيد هذا الموقع')}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C08 — PRICE ESTIMATE & REQUEST CONFIRMATION
// ---------------------------------------------------------------------------
export function C08() {
  const { t, isAr } = usePrefs();
  const { go, back, flow, updateFlow } = useNav();
  const c = useColors();
  const { data: bootstrap } = useBootstrap();
  const { data: vehicles = [] } = useVehicles();
  const estimateMut = useEstimate();
  const createMut = useCreateRequest();
  const [estimate, setEstimate] = useState(flow?.estimate || null);
  const [err, setErr] = useState('');

  const defaultPickLat = 30.0444;
  const defaultPickLon = 31.2357;
  const defaultDestLat = 30.0595;
  const defaultDestLon = 31.4950;
  const serviceTypes = bootstrap?.serviceTypes || [];
  const chosenType = serviceTypes.find((s) => s.id === flow?.serviceTypeId || s.key === flow?.serviceTypeKey) || serviceTypes[0] || null;
  const vehicle = vehicles.find((v) => v.id === flow?.vehicleId) || vehicles.find((v) => v.isPrimary) || vehicles[0] || null;
  const isTowKind = chosenType?.kind === 'Tow';

  useEffect(() => {
    if (!estimate && chosenType?.id) {
      const dist = Number(flow?.distanceKm) > 0 ? Number(flow.distanceKm) : 0;
      estimateMut.mutate(
        { serviceTypeId: chosenType.id, distanceKm: dist },
        { onSuccess: (data) => setEstimate(data) }
      );
    }
  }, [chosenType?.id]);

  const handleConfirmRequest = async () => {
    setErr('');
    if (!chosenType?.id) {
      setErr(t('Service configuration still loading', 'جارٍ تحميل إعدادات الخدمة'));
      return;
    }
    if (!flow?.pickupAddress?.trim()) {
      setErr(t('Please go back and enter your pickup location.', 'يرجى العودة وإدخال موقع الالتقاط.'));
      return;
    }
    try {
      const dist = Number(flow?.distanceKm) > 0 ? Number(flow.distanceKm) : 0;
      const created = await createMut.mutateAsync({
        vehicleId: vehicle?.id || null,
        serviceTypeId: chosenType.id,
        pickupLatitude: flow?.pickupLatitude ?? defaultPickLat,
        pickupLongitude: flow?.pickupLongitude ?? defaultPickLon,
        pickupAddress: flow.pickupAddress.trim(),
        destinationLatitude: isTowKind ? (flow?.destinationLatitude ?? defaultDestLat) : null,
        destinationLongitude: isTowKind ? (flow?.destinationLongitude ?? defaultDestLon) : null,
        destinationAddress: isTowKind ? (flow?.destinationAddress?.trim() || null) : null,
        distanceKm: dist,
        problem: flow?.problem || (isAr ? chosenType.nameAr : chosenType.nameEn),
        answersJson: JSON.stringify(flow?.answers || {}),
        note: flow?.note || null,
        priority: flow?.priority || 'Normal',
        photoFileIds: flow?.photoFileIds || [],
        idempotencyKey: crypto.randomUUID(),
      });
      updateFlow({ requestId: created.id });
      go('C09', { id: created.id });
    } catch (ex) {
      setErr(ex.message || t('Failed to submit request', 'تعذر إرسال الطلب'));
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar title={t('Estimate & Confirmation', 'التسعيرة وتأكيد الطلب')} onBack={back} />
      <div className="px-4 pt-4 space-y-4">
        {err && <Banner tone="danger" title={err} />}

        <Card>
          <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: c.text3 }}>
            {t('Upfront Fare Estimate', 'التكلفة التقديرية المبدئية')}
          </div>
          <div className="text-2xl font-extrabold" style={{ color: c.accent }}>
            {estimate
              ? `${egp(estimate.lowMinor, isAr)} – ${egp(estimate.highMinor, isAr)}`
              : t('Calculating fare...', 'جارٍ حساب التكلفة...')}
          </div>
          <p className="text-xs mt-1" style={{ color: c.text2 }}>
            {t('Includes callout base fare, distance calculation and platform safety guarantee.', 'تشمل رسوم الانتقال الأساسية وحساب المسافة وضمان أمان المنصة.')}
          </p>
        </Card>

        <Card>
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: c.text3 }}>
            {t('Request Summary', 'ملخص الطلب')}
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span style={{ color: c.text2 }}>{t('Service Type', 'نوع الخدمة')}</span>
              <span className="font-bold" style={{ color: c.text }}>
                {chosenType ? (isAr ? chosenType.nameAr : chosenType.nameEn) : t('Roadside Assistance', 'مساعدة على الطريق')}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: c.text2 }}>{t('Vehicle', 'المركبة')}</span>
              <span className="font-bold" style={{ color: c.text }}>
                {vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.plate})` : t('Standard Passenger Car', 'سيارة ملاكي')}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: c.text2 }}>{t('Pickup', 'موقع الالتقاط')}</span>
              <span className="font-bold text-end max-w-[200px]" style={{ color: c.text }}>
                {flow?.pickupAddress || '—'}
              </span>
            </div>
            {flow?.destinationAddress && (
              <div className="flex justify-between">
                <span style={{ color: c.text2 }}>{t('Destination', 'الوجهة')}</span>
                <span className="font-bold text-end max-w-[200px]" style={{ color: c.text }}>
                  {flow.destinationAddress}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span style={{ color: c.text2 }}>{t('Priority', 'الأولوية')}</span>
              <StatusBadge status={flow?.priority || 'Normal'} />
            </div>
          </div>
        </Card>

        <PrimaryButton testId="screen-primary" onClick={handleConfirmRequest} disabled={createMut.isPending}>
          {createMut.isPending ? t('Sending Request...', 'جارٍ إرسال الطلب...') : t('Send Request Now', 'إرسال الطلب الآن')}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C09 (SEARCHING FOR PROVIDER) & C28 (NO PROVIDERS FOUND)
// ---------------------------------------------------------------------------
export function C09({ params }) {
  const { t } = usePrefs();
  const { go, back } = useNav();
  const c = useColors();
  const { req, reqId } = useActiveRequest(params);
  const { data: candidates = [] } = useCandidates(reqId);

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar title={t('Searching Nearby Providers', 'البحث عن مقدمي الخدمة')} onBack={() => back('C08')} />
      <div className="px-4 pt-4 space-y-4">
        <MapView height={200} />

        <Card className="text-center py-5">
          <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl animate-pulse" style={{ backgroundColor: c.accentBg, color: c.accent }}>
            📡
          </div>
          <div className="text-base font-extrabold" style={{ color: c.text }}>
            {t('Scanning Verified Providers Around You...', 'جارٍ البحث عن مقدمي خدمة معتمدين بالقرب منك...')}
          </div>
          <div className="text-xs mt-1" style={{ color: c.text2 }}>
            {req?.code ? `${t('Request', 'طلب')} ${req.code} • ` : ''}
            {t(`${candidates.length} nearby providers matched`, `تم العثور على ${candidates.length} مقدم خدمة قريب`)}
          </div>
        </Card>

        <div className="space-y-2">
          <PrimaryButton
            onClick={() => go(req?.kind === 'Mechanic' ? 'C27' : 'C10', { id: reqId })}
          >
            {t(`View Matched Providers (${candidates.length}) →`, `عرض مقدمي الخدمة المتاحين (${candidates.length}) ←`)}
          </PrimaryButton>
          <SecondaryButton onClick={() => go('C29', { id: reqId })}>
            {t('Cancel Request', 'إلغاء الطلب')}
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}

export function C28({ params }) {
  const { t } = usePrefs();
  const { go, back } = useNav();
  const c = useColors();
  const { reqId } = useActiveRequest(params);
  const [expanded, setExpanded] = useState(false);

  const handleExpandRadius = async () => {
    if (reqId) {
      try {
        await post(`/requests/${reqId}/expand-radius`, {});
      } catch {}
    }
    setExpanded(true);
    go('C10', { id: reqId });
  };

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar title={t('No Providers in Immediate Radius', 'لا يوجد مقدمو خدمة في النطاق القريب')} onBack={back} />
      <div className="px-4 pt-6 space-y-4">
        <EmptyState
          icon="🧭"
          title={t('All Nearby Captains Are Busy', 'جميع الكباتن القريبين مشغولون حالياً')}
          subtitle={t('Expand the search radius to 25 km or schedule a service center visit instead.', 'وسّع نطاق البحث إلى ٢٥ كم أو احجز موعداً في مركز خدمة معتمد.')}
        />
        {expanded && <Banner tone="info" title={t('Search radius expanded to 25 km', 'تم توسيع نطاق البحث إلى ٢٥ كم')} />}
        <PrimaryButton onClick={handleExpandRadius}>
          {t('Expand Search Radius (25 km)', 'توسيع نطاق البحث (٢٥ كم)')}
        </PrimaryButton>
        <SecondaryButton onClick={() => go('C17')}>
          {t('Browse Service Centers Instead', 'تصفح مراكز الخدمة بدلاً من ذلك')}
        </SecondaryButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C10 (TOW OFFERS) & C27 (MECHANIC OFFERS)
// ---------------------------------------------------------------------------
function OffersListScreen({ isMechanic = false, params }) {
  const { t, isAr } = usePrefs();
  const { go, back } = useNav();
  const c = useColors();
  const { req, reqId } = useActiveRequest(params);
  const { data: candidates = [], isLoading } = useCandidates(reqId);
  const selectMut = useSelectProvider(reqId);
  const [sortBy, setSortBy] = useState('recommended');
  const [err, setErr] = useState('');

  const sorted = useMemo(() => {
    const copy = [...candidates];
    if (sortBy === 'fastest') return copy.sort((a, b) => a.etaMinutes - b.etaMinutes);
    if (sortBy === 'lowest') return copy.sort((a, b) => a.priceMinor - b.priceMinor);
    return copy.sort((a, b) => b.score - a.score);
  }, [candidates, sortBy]);

  const handleSelect = async (cand) => {
    setErr('');
    if (!reqId) return;
    try {
      await selectMut.mutateAsync(cand.providerId);
      go(isMechanic || req?.kind === 'Mechanic' ? 'C12' : 'C11', { id: reqId, providerId: cand.providerId });
    } catch (ex) {
      setErr(ex.message || t('Could not dispatch offer', 'تعذر إرسال العرض لمقدم الخدمة'));
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar
        title={isMechanic ? t('Available Mobile Mechanics', 'الميكانيكيون المتاحون') : t('Available Tow Captains', 'كباتن الونش المتاحون')}
        onBack={back}
      />
      <div className="px-4 pt-3 space-y-3">
        {err && <Banner tone="danger" title={err} />}

        {/* Sort Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'recommended', en: 'Recommended', ar: 'الموصى به' },
            { id: 'fastest', en: 'Fastest ETA', ar: 'الأسرع وصولاً' },
            { id: 'lowest', en: 'Lowest Fare', ar: 'الأقل سعراً' },
          ].map((tab) => (
            <Chip
              key={tab.id}
              active={sortBy === tab.id}
              onClick={() => setSortBy(tab.id)}
            >
              {t(tab.en, tab.ar)}
            </Chip>
          ))}
        </div>

        {!isLoading && sorted.length === 0 ? (
          <EmptyState
            icon="🛻"
            title={t('No Providers Available Right Now', 'لا يوجد مقدمو خدمة متاحون حالياً')}
            subtitle={t('Use the Simulator Dock or expand search radius to match online providers.', 'استخدم لوحة المحاكاة أو وسّع نطاق البحث للعثور على مقدمي خدمة متصلين.')}
            action={<PrimaryButton onClick={() => go('C28', { id: reqId })}>{t('Expand Search Radius', 'توسيع نطاق البحث')}</PrimaryButton>}
          />
        ) : (
          sorted.map((cand, idx) => (
            <Card key={cand.providerId}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={cand.name} size={44} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: c.text }}>{cand.name}</span>
                      {idx === 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: c.accentBg, color: c.accent }}>
                          {t('Top Match', 'الأفضل')}
                        </span>
                      )}
                    </div>
                    <div className="text-xs flex items-center gap-2 mt-0.5" style={{ color: c.text2 }}>
                      <span>⭐ {Number(cand.rating ?? 0).toFixed(1)} ({cand.ratingCount ?? 0})</span>
                      <span>• {Number(cand.distanceKm ?? 0).toFixed(1)} km</span>
                      <span>• {cand.etaMinutes} {t('min', 'دقيقة')}</span>
                    </div>
                    {cand.truckMake && (
                      <div className="text-[11px] mt-0.5" style={{ color: c.text3 }}>
                        🛻 {cand.truckMake} • {cand.areaLabel || t('Greater Cairo', 'القاهرة الكبرى')}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-sm font-extrabold" style={{ color: c.accent }}>
                    {egp(cand.priceMinor, isAr)}
                  </div>
                  <div className="text-[10px]" style={{ color: c.text3 }}>
                    {isMechanic ? t('Callout Fee', 'رسوم الفحص') : t('Est. Total', 'الإجمالي التقديري')}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <PrimaryButton testId="screen-primary" onClick={() => handleSelect(cand)} disabled={selectMut.isPending}>
                  {t('Select & Dispatch', 'اختيار وإرسال الطلب')}
                </PrimaryButton>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

export const C10 = (props) => <OffersListScreen isMechanic={false} {...props} />;
export const C27 = (props) => <OffersListScreen isMechanic={true} {...props} />;

// ---------------------------------------------------------------------------
// C11 (LIVE TRACKING TOW), C12 (LIVE TRACKING MECHANIC), C31 (PROVIDER ARRIVED)
// ---------------------------------------------------------------------------
function LiveTrackingScreen({ mode = 'tow', params, code }) {
  const { t, isAr } = usePrefs();
  const { go, back, updateFlow } = useNav();
  const c = useColors();
  const { req, reqId, isLoading } = useActiveRequest(params);
  const { data: invoice } = useInvoiceForRequest(reqId);

  useEffect(() => {
    if (req?.id) {
      updateFlow({ requestId: req.id });
      if (!params?.id) {
        const screenCode = code || (mode === 'arrived' ? 'C31' : mode === 'mechanic' ? 'C12' : 'C11');
        try {
          window.history.replaceState(null, '', `#/${screenCode}?id=${req.id}`);
        } catch {}
      }
    }
  }, [req?.id, params?.id, code, mode, updateFlow]);

  if (isLoading && !req) {
    return (
      <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
        <AppTopBar title={t('Live Tracking', 'التتبع المباشر')} onBack={back} />
        <Skeleton rows={4} />
      </div>
    );
  }

  const defaultStep = mode === 'arrived' ? 4 : 1;
  const step = Math.min(7, Math.max(1, req?.step ?? defaultStep));
  const progressPct = Math.round((step / 7) * 100);
  const providerPhone = req?.providerPhone || '';
  const defaultPickLat = 30.0444;
  const defaultPickLon = 31.2357;
  const statusStr = String(req?.status || (mode === 'arrived' ? 'Arrived' : 'Searching'));
  const isTow = (req?.kind || (mode === 'mechanic' ? 'Mechanic' : 'Tow')) === 'Tow';
  const isPaid = invoice?.status === 'Paid';

  const canReviewQuote = !isTow
    ? ['Arrived', 'QuotePending', 'Disputed'].includes(statusStr) || mode === 'arrived'
    : ['QuotePending', 'Disputed'].includes(statusStr);
  const canPay = !isPaid && ['AwaitingPayment', 'Completed'].includes(statusStr);
  const canViewReceipt = isPaid || statusStr === 'Completed';
  const canCancel = ['Searching', 'Offered', 'Accepted', 'EnRoute'].includes(statusStr);

  const mapMarkers = [
    { lat: req?.pickupLatitude ?? defaultPickLat, lng: req?.pickupLongitude ?? defaultPickLon, label: t('Pickup', 'موقعك') },
    ...(typeof req?.providerLatitude === 'number' && typeof req?.providerLongitude === 'number'
      ? [{ lat: req.providerLatitude, lng: req.providerLongitude, label: req?.providerName || t('Provider', 'مقدم الخدمة') }]
      : []),
  ];

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar
        title={
          mode === 'arrived'
            ? t('Provider Has Arrived', 'وصل مقدم الخدمة')
            : mode === 'mechanic' || req?.kind === 'Mechanic'
            ? t('Mechanic Live Tracking', 'تتبع الميكانيكي المباشر')
            : t('Tow Captain Live Tracking', 'تتبع ونش الإنقاذ المباشر')
        }
        onBack={back}
        right={<span data-testid="tracking-status-badge"><StatusBadge status={statusStr} /></span>}
      />

      <div className="px-4 pt-3 space-y-3">
        <MapView
          height={190}
          mode={statusStr === 'Arrived' || mode === 'arrived' ? 'arrived' : 'route'}
          markers={mapMarkers}
          label={
            typeof req?.pickupDistanceKm === 'number' && ['Accepted', 'EnRoute'].includes(statusStr)
              ? t(`${req.pickupDistanceKm.toFixed(1)} km from your pickup`, `يبعد ${req.pickupDistanceKm.toFixed(1)} كم عن موقعك`)
              : undefined
          }
        />

        {/* 7-Step Progress Tracker */}
        <Card>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-extrabold" data-testid="tracking-status-label" style={{ color: c.text }}>
              {formatLabel(statusStr, isAr)}
            </span>
            <span className="text-xs font-bold" data-testid="tracking-step-label" style={{ color: c.accent }}>
              {t(`Step ${step} of 7`, `خطوة ${step} من ٧`)}
            </span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: c.surface2 }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%`, backgroundColor: c.accent }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px]" style={{ color: c.text2 }}>
            <span data-testid="tracking-request-code" className="font-mono font-bold">{req?.code || '—'}</span>
            <button
              type="button"
              onClick={() => go('C42', { id: reqId })}
              className="font-bold underline"
              style={{ color: c.accent }}
            >
              {t('View Full Timeline →', 'عرض السجل الزمني الكامل ←')}
            </button>
          </div>
        </Card>

        {/* Assigned Provider Card */}
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar name={req?.providerName || t('Provider', 'مقدم خدمة')} size={46} />
              <div>
                <div className="text-sm font-bold" data-testid="tracking-provider-name" style={{ color: c.text }}>
                  {req?.providerName || t('Awaiting provider response...', 'بانتظار رد مقدم الخدمة...')}
                </div>
                <div className="text-xs" style={{ color: c.text2 }}>
                  ⭐ {Number(req?.providerRating ?? 0).toFixed(1)} • {req?.providerTruckMake || formatLabel(req?.kind || 'Tow', isAr)}
                </div>
                {req?.providerTruckPlate && (
                  <div className="text-[11px] font-mono font-bold mt-0.5" dir="ltr" style={{ color: c.accent }}>
                    {req.providerTruckPlate}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {providerPhone && (
                <a
                  href={`tel:${providerPhone}`}
                  aria-label={t('Call Provider', 'اتصال بمقدم الخدمة')}
                  className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1"
                  style={{ backgroundColor: c.successBg, color: c.success }}
                >
                  <span>📞</span>
                  <span>{t('Call', 'اتصال')}</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => go('SH01', { requestId: reqId })}
                className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1"
                style={{ backgroundColor: c.surface2, color: c.text }}
              >
                <span>💬</span>
                <span>{t('Chat', 'محادثة')}</span>
              </button>
            </div>
          </div>
        </Card>

        {/* Next Contextual Actions */}
        <div className="space-y-2">
          {canReviewQuote && (
            <PrimaryButton onClick={() => go('C13', { id: reqId })}>
              {isTow ? t('Review Tow Fare Estimate', 'مراجعة تسعيرة الونش') : t('Review Repair Quote', 'مراجعة عرض السعر')}
            </PrimaryButton>
          )}
          {canPay && (
            <PrimaryButton onClick={() => go('C14', { id: reqId })}>
              {t('Proceed to Payment', 'الانتقال للدفع')}
            </PrimaryButton>
          )}
          {canViewReceipt && !canPay && (
            <PrimaryButton onClick={() => go('C15', { id: reqId })}>
              {t('View Paid Receipt & Rate Trip →', 'عرض الإيصال المسدد وتقييم الرحلة ←')}
            </PrimaryButton>
          )}
          {canCancel && (
            <SecondaryButton onClick={() => go('C29', { id: reqId })}>
              {t('Cancel Request', 'إلغاء الطلب')}
            </SecondaryButton>
          )}
        </div>
      </div>
    </div>
  );
}

export const C11 = (props) => <LiveTrackingScreen mode="tow" {...props} />;
export const C12 = (props) => <LiveTrackingScreen mode="mechanic" {...props} />;
export const C31 = (props) => <LiveTrackingScreen mode="arrived" {...props} />;

// ---------------------------------------------------------------------------
// C13 (REPAIR QUOTE APPROVAL) & C32 (DISPUTE QUOTE / REVISED ESTIMATE)
// ---------------------------------------------------------------------------
export function C13({ params }) {
  const { t, isAr } = usePrefs();
  const { go, back } = useNav();
  const c = useColors();
  const { req, reqId } = useActiveRequest(params);
  const { data: quotes = [] } = useQuotes(reqId);
  const { data: bootstrap } = useBootstrap();
  const approveMut = useApproveQuote(reqId);
  const [err, setErr] = useState('');

  const isTow = req?.kind === 'Tow';
  const estTotal = req?.quoteMinor ?? req?.estimateMinor ?? 0;
  const estFee = estTotal > 0 ? Math.min(estTotal, bootstrap?.pricing?.serviceFeeMinor ?? 0) : 0;
  const estCallout = Math.max(0, estTotal - estFee);
  const latestQuote = quotes[0] || {
    id: null,
    version: 1,
    status: req?.status === 'QuoteApproved' ? 'Approved' : 'Pending',
    calloutMinor: estCallout,
    laborMinor: 0,
    partsMinor: 0,
    serviceFeeMinor: estFee,
    totalMinor: estTotal,
    diagnosis: req?.problem || '',
  };

  const handleApprove = async () => {
    setErr('');
    if (latestQuote.id && reqId && latestQuote.status !== 'Approved') {
      try {
        await approveMut.mutateAsync(latestQuote.id);
      } catch (ex) {
        setErr(ex.message || t('Could not approve estimate', 'تعذر اعتماد التسعيرة'));
        return;
      }
    }
    if (['AwaitingPayment', 'Completed'].includes(req?.status)) {
      go('C14', { id: reqId });
    } else {
      go(isTow ? 'C11' : 'C12', { id: reqId });
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar
        title={isTow ? t('Tow Fare Estimate', 'تفاصيل تسعيرة الونش') : t('On-Site Repair Estimate', 'المقايسة وعرض سعر الإصلاح')}
        onBack={back}
      />
      <div className="px-4 pt-4 space-y-4">
        {err && <Banner tone="danger" title={err} />}

        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: c.text3 }}>
              {t(`Estimate v${latestQuote.version ?? 1}`, `عرض السعر رقم ${latestQuote.version ?? 1}`)}
            </span>
            <StatusBadge status={latestQuote.status || 'Pending'} />
          </div>
          <p className="text-xs mb-3" style={{ color: c.text2 }}>
            {latestQuote.diagnosis ||
              (isTow
                ? t('Itemized tow dispatch and distance fare breakdown.', 'تفاصيل تكلفة الانتقال ومسافة السحب.')
                : t('Provider submitted itemized breakdown for your approval before starting work.', 'قدم الفني تفاصيل التكلفة لاعتمادها قبل بدء الإصلاح.'))}
          </p>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span style={{ color: c.text2 }}>
                {isTow ? t('Base Tow & Dispatch Fare', 'رسوم الانتقال وفتح العداد') : t('Callout & Inspection Fee', 'رسوم الانتقال والفحص')}
              </span>
              <span className="font-semibold" style={{ color: c.text }}>{egp(latestQuote.calloutMinor, isAr)}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: c.text2 }}>
                {isTow ? t('Winching & Distance Adjustment', 'تكلفة الرفع والمسافة الإضافية') : t('Labor Charges', 'مصنعية الإصلاح')}
              </span>
              <span className="font-semibold" style={{ color: c.text }}>{egp(latestQuote.laborMinor, isAr)}</span>
            </div>
            {(!isTow || latestQuote.partsMinor > 0) && (
              <div className="flex justify-between">
                <span style={{ color: c.text2 }}>{t('Spare Parts & Consumables', 'قطع الغيار والمستهلكات')}</span>
                <span className="font-semibold" style={{ color: c.text }}>{egp(latestQuote.partsMinor, isAr)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span style={{ color: c.text2 }}>{t('Platform Service Fee', 'رسوم خدمة المنصة')}</span>
              <span className="font-semibold" style={{ color: c.text }}>{egp(latestQuote.serviceFeeMinor, isAr)}</span>
            </div>
            <Divider className="my-2" />
            <div className="flex justify-between text-sm font-extrabold">
              <span style={{ color: c.text }}>{t('Total to Pay', 'الإجمالي المطلوب')}</span>
              <span style={{ color: c.accent }}>{egp(latestQuote.totalMinor, isAr)}</span>
            </div>
          </div>
        </Card>

        <div className="space-y-2">
          <PrimaryButton testId="screen-primary" onClick={handleApprove} disabled={approveMut.isPending}>
            {approveMut.isPending
              ? t('Approving...', 'جارٍ الاعتماد...')
              : isTow
              ? t('Approve Tow Estimate', 'اعتماد تسعيرة الونش')
              : t('Approve Estimate & Start Repair', 'اعتماد المقايسة وبدء الإصلاح')}
          </PrimaryButton>
          <SecondaryButton onClick={() => go('C32', { id: reqId })}>
            {t('Dispute or Request Revision', 'الاعتراض أو طلب تعديل السعر')}
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}

export function C32({ params }) {
  const { t } = usePrefs();
  const { go, back } = useNav();
  const c = useColors();
  const { req, reqId } = useActiveRequest(params);
  const disputeMut = useDispute(reqId);
  const [reason, setReason] = useState('');
  const [resolution, setResolution] = useState('');
  const [err, setErr] = useState('');
  const isTow = req?.kind === 'Tow';

  const handleSubmit = async () => {
    setErr('');
    if (!reason) {
      setErr(t('Please select a dispute reason.', 'يرجى اختيار سبب الاعتراض.'));
      return;
    }
    if (reqId) {
      try {
        await disputeMut.mutateAsync({ reason, proposedResolution: resolution.trim() || null });
      } catch (ex) {
        setErr(ex.message || t('Could not submit dispute', 'تعذر إرسال الاعتراض'));
        return;
      }
    }
    go('C13', { id: reqId });
  };

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar title={isTow ? t('Dispute Tow Estimate', 'الاعتراض على تسعيرة الونش') : t('Dispute Repair Estimate', 'الاعتراض على عرض السعر')} onBack={back} />
      <div className="px-4 pt-4 space-y-4">
        {err && <Banner tone="danger" title={err} />}
        <Card>
          <SelectField
            label={t('Reason for Dispute', 'سبب الاعتراض')}
            value={reason}
            onChange={setReason}
            testId="field-disputeReason"
            options={[
              { value: '', label: t('Select dispute reason...', 'اختر سبب الاعتراض...') },
              { value: 'Spare parts price higher than expected', label: t('Parts / surcharge higher than expected', 'سعر البنود الإضافية أعلى من المتوقع') },
              { value: 'Labor hours seem excessive', label: t('Service or distance charges seem excessive', 'تكلفة الخدمة أو المسافة مرتفعة') },
              { value: 'Unnecessary repair item included', label: t('Unnecessary item included', 'بند غير ضروري في التسعيرة') },
            ]}
          />
          <InputField
            label={t('Proposed Resolution / Target Price', 'الحل المقترح أو السعر المناسب')}
            value={resolution}
            onChange={setResolution}
            placeholder={t('Describe your concern or expected amount...', 'وضح ملاحظتك أو السعر المتوقع...')}
          />
        </Card>
        <PrimaryButton testId="screen-primary" onClick={handleSubmit} disabled={disputeMut.isPending || !reason}>
          {disputeMut.isPending ? t('Submitting...', 'جارٍ الإرسال...') : t('Submit Dispute to Provider', 'إرسال الاعتراض لمقدم الخدمة')}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C14, C33, C34, C35 — PAYMENT SELECTION, ADD CARD, SAVED METHODS, DECLINED RETRY
// ---------------------------------------------------------------------------
export function C14({ params }) {
  const { t, isAr } = usePrefs();
  const { go, back } = useNav();
  const c = useColors();
  const { req, reqId } = useActiveRequest(params);
  const { data: invoice, refetch: refetchInvoice } = useInvoiceForRequest(reqId);
  const { data: methods = [] } = useMethods();
  const payMut = usePay(invoice?.id);

  const [methodType, setMethodType] = useState('Cash');
  const [selectedCardId, setSelectedCardId] = useState(methods[0]?.id || null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (reqId) refetchInvoice?.();
  }, [reqId]);

  useEffect(() => {
    if (!selectedCardId && methods[0]?.id) setSelectedCardId(methods[0].id);
  }, [methods, selectedCardId]);

  const totalMinor = invoice?.totalMinor ?? req?.quoteMinor ?? req?.estimateMinor ?? 0;
  const isPaid = invoice?.status === 'Paid';

  const handlePayNow = async () => {
    setErr('');
    if (!invoice?.id || isPaid) {
      go('C15', { id: reqId, invoiceId: invoice?.id });
      return;
    }
    try {
      const payment = await payMut.mutateAsync({
        method: methodType,
        paymentMethodId: methodType === 'Card' ? selectedCardId : null,
      });
      if (payment?.status === 'Failed') {
        go('C35', { id: reqId, failureReason: payment.failureReason });
        return;
      }
      go('C15', { id: reqId, invoiceId: invoice.id });
    } catch (ex) {
      if (ex?.status === 409 || /paid|settled/i.test(String(ex?.message || ''))) {
        await refetchInvoice?.();
        go('C15', { id: reqId, invoiceId: invoice.id });
        return;
      }
      setErr(ex.message || t('Payment could not be completed', 'تعذر إتمام عملية الدفع'));
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar title={t('Select Payment Method', 'اختر وسيلة الدفع')} onBack={back} />
      <div className="px-4 pt-4 space-y-4">
        {err && <Banner tone="danger" title={err} />}

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider" style={{ color: c.text3 }}>
                {isPaid ? t('Total Settled', 'الإجمالي المسدد') : t('Amount Due', 'المبلغ المستحق')}
              </div>
              <div className="text-2xl font-extrabold mt-1" style={{ color: c.accent }}>
                {egp(totalMinor, isAr)}
              </div>
            </div>
            <span data-testid="invoice-status">
              <StatusBadge status={isPaid ? 'Paid' : (invoice?.status || 'Unpaid')} />
            </span>
          </div>
          <div className="text-xs mt-1" style={{ color: c.text2 }}>
            {invoice?.number ? `${t('Invoice', 'فاتورة')} ${invoice.number}` : t('Includes VAT & platform protection', 'شامل الضريبة وحماية المنصة')}
          </div>
        </Card>

        {isPaid ? (
          <>
            <Banner
              tone="success"
              title={t('Invoice Already Paid', 'تم سداد هذه الفاتورة بالفعل')}
              subtitle={t('Payment has been settled. Open your digital receipt below.', 'تم تسوية المبلغ بنجاح. يمكنك عرض الإيصال الضريبي أدناه.')}
            />
            <PrimaryButton testId="screen-primary" onClick={() => go('C15', { id: reqId, invoiceId: invoice?.id })}>
              {t('View Paid Receipt →', 'عرض الإيصال المسدد ←')}
            </PrimaryButton>
          </>
        ) : (
          <>
            <Card>
              <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: c.text3 }}>
                {t('Choose How to Pay', 'اختر طريقة السداد')}
              </div>
              <div className="space-y-2">
                {[
                  { id: 'Cash', icon: '💵', titleEn: 'Cash to Provider', titleAr: 'نقداً لمقدم الخدمة (كاش)', subEn: 'Pay directly upon completion', subAr: 'ادفع نقداً بعد انتهاء الخدمة' },
                  { id: 'Card', icon: '💳', titleEn: 'Credit / Debit Card (Meza / Visa / MC)', titleAr: 'بطاقة بنكية (ميزة / فيزا / ماستركارد)', subEn: 'Instant encrypted settlement', subAr: 'سداد إلكتروني فوري ومؤمن' },
                  { id: 'ApplePay', icon: '', titleEn: 'Apple Pay / Digital Wallet', titleAr: 'آبل باي / محفظة رقمية', subEn: 'One-tap biometric checkout', subAr: 'دفع سريع بلمسة واحدة' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMethodType(opt.id)}
                    className="w-full p-3 rounded-xl text-start flex items-center justify-between transition-all"
                    style={{
                      backgroundColor: methodType === opt.id ? c.accentBg : c.surface2,
                      border: `1.5px solid ${methodType === opt.id ? c.accent : c.border}`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{opt.icon}</span>
                      <div>
                        <div className="text-xs font-bold" style={{ color: c.text }}>{t(opt.titleEn, opt.titleAr)}</div>
                        <div className="text-[11px]" style={{ color: c.text2 }}>{t(opt.subEn, opt.subAr)}</div>
                      </div>
                    </div>
                    <span className="text-xs font-bold" style={{ color: methodType === opt.id ? c.accent : c.text3 }}>
                      {methodType === opt.id ? '●' : '○'}
                    </span>
                  </button>
                ))}
              </div>

              {methodType === 'Card' && (
                <div className="mt-3 pt-3 border-t space-y-2" style={{ borderColor: c.border }}>
                  {methods.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedCardId(m.id)}
                      className="w-full p-2.5 rounded-xl flex items-center justify-between text-xs font-semibold"
                      style={{
                        backgroundColor: selectedCardId === m.id ? c.accentBg : c.surface,
                        border: `1px solid ${selectedCardId === m.id ? c.accent : c.border}`,
                        color: c.text,
                      }}
                    >
                      <span>💳 {m.brand || 'Visa'} •••• {m.last4 || '----'}</span>
                      <span dir="ltr">{m.expMonth}/{m.expYear}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => go('C33', { id: reqId })}
                    className="text-xs font-bold"
                    style={{ color: c.accent }}
                  >
                    {t('+ Add New Bank Card', '+ إضافة بطاقة بنكية جديدة')}
                  </button>
                </div>
              )}
            </Card>

            <PrimaryButton testId="screen-primary" onClick={handlePayNow} disabled={payMut.isPending}>
              {payMut.isPending
                ? t('Processing Payment...', 'جارٍ معالجة الدفع...')
                : `${t('Confirm & Pay', 'تأكيد وسداد')} ${egp(totalMinor, isAr)}`}
            </PrimaryButton>
          </>
        )}
      </div>
    </div>
  );
}

export function C33({ params }) {
  const { t } = usePrefs();
  const { go, back } = useNav();
  const c = useColors();
  const addCardMut = useAddCard();
  const [number, setNumber] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [label, setLabel] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [err, setErr] = useState('');

  const handleSaveCard = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setErr('');
    if (!luhnCheck(number)) {
      setErr(t('Please enter a valid 16-digit card number (Luhn check failed).', 'يرجى إدخال رقم بطاقة بنكية صحيح مكون من ١٦ رقماً.'));
      return;
    }
    const parsedMonth = Number(expMonth);
    const parsedYear = Number(expYear);
    const currentYear = new Date().getUTCFullYear();
    if (!expMonth || Number.isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
      setErr(t('Please enter a valid expiry month (1–12).', 'يرجى إدخال شهر انتهاء صحيح (١–١٢).'));
      return;
    }
    if (!expYear || Number.isNaN(parsedYear) || parsedYear < currentYear || parsedYear > currentYear + 20) {
      setErr(t(`Please enter a valid 4-digit expiry year (${currentYear}+).`, `يرجى إدخال سنة انتهاء صحيحة (${currentYear}+).`));
      return;
    }
    try {
      await addCardMut.mutateAsync({
        number: number.replace(/\D/g, ''),
        expMonth: parsedMonth,
        expYear: parsedYear,
        label: label.trim() || null,
        isDefault,
      });
      go('C34', params);
    } catch (ex) {
      setErr(ex.message || t('Could not add card', 'تعذر حفظ البطاقة البنكية'));
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar title={t('Add Payment Card', 'إضافة بطاقة دفع')} onBack={back} />
      <form onSubmit={handleSaveCard} className="px-4 pt-4 space-y-4">
        {err && <Banner tone="danger" title={err} />}
        <Card>
          <InputField
            label={t('Card Number (16 digits)', 'رقم البطاقة (١٦ رقماً)')}
            value={number}
            onChange={setNumber}
            testId="field-Number"
            dir="ltr"
            placeholder="4532 0151 1283 0366"
          />
          <div className="grid grid-cols-2 gap-3">
            <InputField
              label={t('Expiry Month', 'شهر الانتهاء')}
              type="number"
              value={expMonth}
              onChange={setExpMonth}
              testId="field-ExpMonth"
              dir="ltr"
              placeholder="MM"
            />
            <InputField
              label={t('Expiry Year', 'سنة الانتهاء')}
              type="number"
              value={expYear}
              onChange={setExpYear}
              testId="field-ExpYear"
              dir="ltr"
              placeholder="YYYY"
            />
          </div>
          <InputField
            label={t('Card Nickname (Optional)', 'اسم البطاقة المميز (اختياري)')}
            value={label}
            onChange={setLabel}
            testId="field-Label"
            placeholder={t('E.g. Personal Card', 'مثال: بطاقتي الشخصية')}
          />
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-semibold" style={{ color: c.text }}>{t('Set as default payment method', 'تعيين كوسيلة دفع افتراضية')}</span>
            <ToggleSwitch checked={isDefault} onChange={setIsDefault} testId="toggle-isDefault" />
          </div>
        </Card>
        <PrimaryButton type="submit" testId="screen-primary" disabled={addCardMut.isPending}>
          {addCardMut.isPending ? t('Saving Card...', 'جارٍ حفظ البطاقة...') : t('Save Card', 'حفظ البطاقة')}
        </PrimaryButton>
      </form>
    </div>
  );
}

export function C34({ params }) {
  const { t, isAr } = usePrefs();
  const { go, back } = useNav();
  const c = useColors();
  const qc = useQueryClient();
  const hasCheckoutContext = Boolean(params?.id);
  const { req, reqId } = useActiveRequest(hasCheckoutContext ? params : {});
  const { data: invoice, refetch: refetchInvoice } = useInvoiceForRequest(hasCheckoutContext ? reqId : null);
  const { data: methods = [] } = useMethods();
  const payMut = usePay(invoice?.id);
  const [err, setErr] = useState('');

  const totalMinor = invoice?.totalMinor ?? req?.quoteMinor ?? req?.estimateMinor ?? 0;
  const defaultCard = methods.find((m) => m.isDefault) || methods[0] || null;
  const isPaid = invoice?.status === 'Paid';

  const setDefault = async (id) => {
    await post(`/payments/methods/${id}/default`, {});
    qc.invalidateQueries({ queryKey: k.methods });
  };

  const handlePayNow = async () => {
    setErr('');
    if (!invoice?.id || isPaid) {
      go('C15', { id: reqId, invoiceId: invoice?.id });
      return;
    }
    try {
      const payment = await payMut.mutateAsync({
        method: defaultCard ? 'Card' : 'Cash',
        paymentMethodId: defaultCard?.id || null,
      });
      if (payment?.status === 'Failed') {
        go('C35', { id: reqId, failureReason: payment.failureReason });
        return;
      }
      go('C15', { id: reqId, invoiceId: invoice.id });
    } catch (ex) {
      if (ex?.status === 409 || /paid|settled/i.test(String(ex?.message || ''))) {
        await refetchInvoice?.();
        go('C15', { id: reqId, invoiceId: invoice.id });
        return;
      }
      setErr(ex.message || t('Payment could not be completed', 'تعذر إتمام عملية الدفع'));
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar
        title={hasCheckoutContext ? t('Review & Pay', 'المراجعة والدفع') : t('Saved Payment Methods', 'وسائل الدفع المحفوظة')}
        onBack={back}
      />
      <div className="px-4 pt-4 space-y-3">
        {err && <Banner tone="danger" title={err} />}

        {hasCheckoutContext && (
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider" style={{ color: c.text3 }}>
                  {invoice?.number || t('Invoice Summary', 'ملخص الفاتورة')}
                </div>
                <div className="text-xl font-extrabold mt-0.5" style={{ color: c.accent }}>
                  {egp(totalMinor, isAr)}
                </div>
              </div>
              <span data-testid="invoice-status">
                <StatusBadge status={isPaid ? 'Paid' : (invoice?.status || 'Unpaid')} />
              </span>
            </div>
          </Card>
        )}

        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💵</span>
              <div>
                <div className="text-sm font-bold" style={{ color: c.text }}>{t('Cash (EGP)', 'الدفع النقدي (ج.م)')}</div>
                <div className="text-xs" style={{ color: c.text2 }}>{t('Always available for roadside jobs', 'متاح دائماً لخدمات الطريق')}</div>
              </div>
            </div>
            <StatusBadge status="Active" />
          </div>
        </Card>

        {methods.map((m) => (
          <Card key={m.id}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💳</span>
                <div>
                  <div className="text-sm font-bold" style={{ color: c.text }}>
                    {m.label || m.brand || 'Card'} {m.last4 ? `•••• ${m.last4}` : ''}
                  </div>
                  <div className="text-xs" style={{ color: c.text2 }}>
                    {m.expMonth && m.expYear ? `${t('Expires', 'تنتهي')} ${m.expMonth}/${m.expYear}` : formatLabel(m.type, isAr)}
                  </div>
                </div>
              </div>
              {m.isDefault ? (
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: c.accentBg, color: c.accent }}>
                  {t('Default', 'افتراضية')}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setDefault(m.id)}
                  className="text-xs font-semibold"
                  style={{ color: c.accent }}
                >
                  {t('Make Default', 'تعيين كافتراضية')}
                </button>
              )}
            </div>
          </Card>
        ))}

        <div className="space-y-2 pt-1">
          {hasCheckoutContext && isPaid && (
            <PrimaryButton testId="screen-primary" onClick={() => go('C15', { id: reqId, invoiceId: invoice?.id })}>
              {t('View Paid Receipt →', 'عرض الإيصال المسدد ←')}
            </PrimaryButton>
          )}
          {hasCheckoutContext && !isPaid && invoice && (
            <PrimaryButton testId="screen-primary" onClick={handlePayNow} disabled={payMut.isPending}>
              {payMut.isPending
                ? t('Processing Payment...', 'جارٍ معالجة الدفع...')
                : `${t('Pay Now', 'ادفع الآن')} (${egp(totalMinor, isAr)})`}
            </PrimaryButton>
          )}
          <SecondaryButton onClick={() => go('C33', hasCheckoutContext ? { id: reqId } : { from: 'profile' })}>
            {t('+ Add New Card', '+ إضافة بطاقة جديدة')}
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}

export function C35({ params }) {
  const { t } = usePrefs();
  const { go, back } = useNav();
  const c = useColors();

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar title={t('Payment Declined', 'تم رفض عملية الدفع')} onBack={back} />
      <div className="px-4 pt-6 space-y-4">
        <Banner
          tone="danger"
          title={t('Card Authorization Declined', 'تم رفض تفويض البطاقة من البنك')}
          subtitle={params?.failureReason || t('Your bank declined the transaction. You can retry with another card or switch to Cash.', 'رفض البنك المعاملة. يمكنك المحاولة ببطاقة أخرى أو التحويل للدفع النقدي.')}
        />
        <PrimaryButton onClick={() => go('C14', params)}>
          {t('Try Another Payment Method', 'تجربة وسيلة دفع أخرى')}
        </PrimaryButton>
        <SecondaryButton onClick={() => go('C33', params)}>
          {t('Add a Different Card', 'إضافة بطاقة بنكية مختلفة')}
        </SecondaryButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C15 — DIGITAL INVOICE & RECEIPT
// ---------------------------------------------------------------------------
export function C15({ params }) {
  const { t, isAr } = usePrefs();
  const { go, back } = useNav();
  const c = useColors();
  const { req, reqId } = useActiveRequest(params);
  const { data: invoice, refetch } = useInvoiceForRequest(reqId);
  const confirmCashMut = useConfirmCash(invoice?.id);
  const [cashConfirmed, setCashConfirmed] = useState(false);

  useEffect(() => {
    if (reqId) refetch?.();
  }, [reqId]);

  const total = invoice?.totalMinor ?? req?.quoteMinor ?? req?.estimateMinor ?? 0;
  const fee = invoice?.serviceFeeMinor ?? 0;
  const subtotal = invoice?.subtotalMinor ?? Math.max(0, total - fee);
  const isPaid = invoice?.status === 'Paid' || invoice?.customerCashConfirmed || cashConfirmed;

  const handleConfirmCash = async () => {
    if (invoice?.id) {
      try {
        await confirmCashMut.mutateAsync();
        await refetch();
      } catch {}
    }
    setCashConfirmed(true);
  };

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar title={t('Digital Invoice & Receipt', 'الفاتورة والإيصال الرقمي')} onBack={back} />
      <div className="px-4 pt-4 space-y-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider" style={{ color: c.text3 }}>
                {t('Tax Receipt', 'إيصال ضريبي')}
              </div>
              <div className="text-base font-extrabold font-mono" style={{ color: c.text }}>
                {invoice?.number || '—'}
              </div>
            </div>
            <span data-testid="invoice-status">
              <StatusBadge status={isPaid ? 'Paid' : (invoice?.status || 'Unpaid')} />
            </span>
          </div>

          <Divider className="my-3" />

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span style={{ color: c.text2 }}>{t('Request Code', 'رقم الطلب')}</span>
              <span className="font-mono font-bold" style={{ color: c.text }}>{req?.code || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: c.text2 }}>{t('Service Charges', 'تكلفة الخدمة')}</span>
              <span className="font-semibold" style={{ color: c.text }}>{egp(subtotal, isAr)}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: c.text2 }}>{t('Platform Fee & VAT', 'رسوم المنصة والضريبة')}</span>
              <span className="font-semibold" style={{ color: c.text }}>{egp(fee, isAr)}</span>
            </div>
            <Divider className="my-2" />
            <div className="flex justify-between text-sm font-extrabold">
              <span style={{ color: c.text }}>{isPaid ? t('Total Settled', 'الإجمالي المسدد') : t('Total Due', 'الإجمالي المستحق')}</span>
              <span style={{ color: c.accent }}>{egp(total, isAr)}</span>
            </div>
          </div>
        </Card>

        {!isPaid && (
          <SecondaryButton onClick={handleConfirmCash} disabled={confirmCashMut.isPending}>
            {confirmCashMut.isPending ? t('Confirming...', 'جارٍ التأكيد...') : t('Confirm Cash Handed to Provider', 'تأكيد تسليم المبلغ نقداً لمقدم الخدمة')}
          </SecondaryButton>
        )}

        {isPaid && (
          <Banner tone="success" title={t('Payment settled', 'تم سداد الفاتورة بنجاح')} />
        )}

        <PrimaryButton testId="screen-primary" onClick={() => go('C16', { id: reqId, providerId: req?.assignedProviderId })}>
          {t('Rate Your Trip ⭐', 'قيّم رحلتك وتجربتك ⭐')}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C16 (5-STAR RATING OR CANCEL SHEET) & C41 (POST-RATING THANK YOU)
// ---------------------------------------------------------------------------
export function C16({ params }) {
  const { t, isAr } = usePrefs();
  const { go, back } = useNav();
  const c = useColors();
  const qc = useQueryClient();
  const { req, reqId } = useActiveRequest(params);
  const { data: bootstrap } = useBootstrap();
  const cancelMut = useCancelRequest();

  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [recommend, setRecommend] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const isCancelMode = params?.mode === 'cancel';
  const cancelReasons = bootstrap?.cancellationReasons || bootstrap?.cancelReasons || [
    { key: 'changed_mind', labelEn: 'Problem resolved on my own', labelAr: 'تم حل المشكلة بنفسي' },
    { key: 'long_wait', labelEn: 'Wait time was too long', labelAr: 'وقت الانتظار طويل جداً' },
    { key: 'wrong_location', labelEn: 'Entered wrong pickup location', labelAr: 'أدخلت موقع التقاط خاطئ' },
  ];

  const handleRateSubmit = async () => {
    setErr('');
    if (stars < 1) {
      setErr(t('Please select a star rating (1–5).', 'يرجى اختيار تقييم بالنجوم (من ١ إلى ٥).'));
      return;
    }
    setSubmitting(true);
    try {
      const providerId = params?.providerId || req?.assignedProviderId;
      if (providerId && reqId) {
        await post(`/reviews/provider/${providerId}?requestId=${reqId}`, {
          stars,
          text: comment.trim() || null,
          recommend,
        });
        qc.invalidateQueries({ queryKey: k.reviews('provider', providerId) });
      }
      go('C41', { id: reqId, stars });
    } catch (ex) {
      // Even if already reviewed, allow proceeding to C41 thank you screen
      go('C41', { id: reqId, stars });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async () => {
    setErr('');
    if (!cancelReason) {
      setErr(t('Please select a cancellation reason.', 'يرجى اختيار سبب الإلغاء.'));
      return;
    }
    if (!reqId) {
      go('C01');
      return;
    }
    try {
      await cancelMut.mutateAsync({ id: reqId, reasonKey: cancelReason, note: comment.trim() || null });
      go('C01');
    } catch (ex) {
      setErr(ex.message || t('Could not cancel request', 'تعذر إلغاء الطلب'));
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar
        title={isCancelMode ? t('Cancel Roadside Request', 'إلغاء طلب المساعدة') : t('Rate Your Experience', 'قيّم تجربتك')}
        onBack={back}
      />
      <div className="px-4 pt-4 space-y-4">
        {err && <Banner tone="danger" title={err} />}

        {!isCancelMode && (
          <Card className="text-center">
            <Avatar name={req?.providerName || t('Specialist', 'مختص')} size={56} className="mx-auto mb-2" />
            <div className="text-base font-extrabold" style={{ color: c.text }}>
              {t('How was your service today?', 'كيف كانت خدمة الإنقاذ اليوم؟')}
            </div>
            <div className="text-xs mt-0.5 mb-3" style={{ color: c.text2 }}>
              {req?.providerName || t('Assigned Provider', 'مقدم الخدمة')} {req?.code ? `• ${req.code}` : ''}
            </div>

            {/* Interactive 1-5 Star Buttons */}
            <div className="flex justify-center my-3" data-testid="star-rating-picker">
              <StarRating value={stars} onChange={setStars} size={32} />
            </div>
            <div className="text-xs font-bold mb-3" style={{ color: c.accent }}>
              {stars === 0
                ? t('Tap a star to rate', 'اضغط على النجوم للتقييم')
                : stars === 5
                ? t('Excellent (5/5)', 'ممتاز (٥/٥)')
                : `${stars} / 5`}
            </div>

            <InputField
              label={t('Share Your Feedback (Optional)', 'شاركنا رأيك وملاحظاتك (اختياري)')}
              value={comment}
              onChange={setComment}
              testId="field-comment"
              placeholder={t('Fast arrival, professional equipment and polite service...', 'وصول سريع، معدات احترافية وتعامل راقٍ...')}
            />

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-semibold" style={{ color: c.text }}>
                {t('Would you recommend this provider?', 'هل توصي بمقدم الخدمة هذا؟')}
              </span>
              <ToggleSwitch checked={recommend} onChange={setRecommend} testId="toggle-recommend" />
            </div>

            <div className="mt-4">
              <PrimaryButton testId="screen-primary" onClick={handleRateSubmit} disabled={submitting || stars < 1}>
                {submitting
                  ? t('Submitting Review...', 'جارٍ إرسال التقييم...')
                  : stars > 0
                  ? t(`Submit ${stars}-Star Review`, `إرسال تقييم (${stars} نجوم)`)
                  : t('Submit Review', 'إرسال التقييم')}
              </PrimaryButton>
            </div>
          </Card>
        )}

        {isCancelMode && (
          <Card>
            <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: c.text3 }}>
              {t('Cancel Roadside Request', 'إلغاء طلب المساعدة')}
            </div>
            <SelectField
              label={t('Cancellation Reason', 'سبب الإلغاء')}
              value={cancelReason}
              onChange={setCancelReason}
              options={[
                { value: '', label: t('Select a reason...', 'اختر سبب الإلغاء...') },
                ...cancelReasons.map((r) => ({
                  value: r.key,
                  label: isAr ? r.labelAr : r.labelEn,
                })),
              ]}
            />
            <SecondaryButton onClick={handleCancelRequest} disabled={cancelMut.isPending || !cancelReason}>
              {cancelMut.isPending ? t('Cancelling...', 'جارٍ الإلغاء...') : t('Confirm Cancellation', 'تأكيد إلغاء الطلب')}
            </SecondaryButton>
          </Card>
        )}
      </div>
    </div>
  );
}

export function C41({ params }) {
  const { t } = usePrefs();
  const { go, back } = useNav();
  const c = useColors();

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar showBack={true} onBack={() => back('C16')} />
      <div className="flex-1 flex flex-col justify-center px-4 pt-4">
        <Card className="text-center py-8">
          <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-3xl" style={{ backgroundColor: c.successBg, color: c.success }}>
            🎉
          </div>
          <h2 className="text-lg font-extrabold" style={{ color: c.text }}>
            {t('Thank You for Your Feedback!', 'شكراً لك على تقييمك!')}
          </h2>
          <p className="text-xs mt-1 mb-5" style={{ color: c.text2 }}>
            {t('Your review helps keep FixNGo roadside providers safe, reliable and accountable across Egypt.', 'يساعد تقييمك في الحفاظ على جودة وأمان خدمات فيكس آند جو في جميع أنحاء مصر.')}
          </p>
          <PrimaryButton onClick={() => go('C02')}>
            {t('Go to Home', 'الانتقال للرئيسية')}
          </PrimaryButton>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C29 (CANCEL ROADSIDE REQUEST) & C30 (REQUEST CANCELLED CONFIRMATION)
// ---------------------------------------------------------------------------
export function C29({ params }) {
  const { t, isAr } = usePrefs();
  const { go, back } = useNav();
  const c = useColors();
  const { req, reqId } = useActiveRequest(params);
  const { data: bootstrap } = useBootstrap();
  const cancelMut = useCancelRequest();

  const cancelReasons = bootstrap?.cancellationReasons || bootstrap?.cancelReasons || [
    { key: 'changed_mind', labelEn: 'Problem resolved on my own', labelAr: 'تم حل المشكلة بنفسي' },
    { key: 'long_wait', labelEn: 'Wait time was too long', labelAr: 'وقت الانتظار طويل جداً' },
    { key: 'wrong_location', labelEn: 'Entered wrong pickup location', labelAr: 'أدخلت موقع التقاط خاطئ' },
  ];

  const [reasonKey, setReasonKey] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  const handleCancel = async () => {
    setErr('');
    if (!reasonKey) {
      setErr(t('Please select a cancellation reason.', 'يرجى اختيار سبب الإلغاء.'));
      return;
    }
    if (!reqId) {
      go('C30');
      return;
    }
    try {
      await cancelMut.mutateAsync({ id: reqId, reasonKey, note: note.trim() || null });
      go('C30', { id: reqId, code: req?.code });
    } catch (ex) {
      setErr(ex.message || t('Could not cancel request', 'تعذر إلغاء الطلب'));
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar title={t('Cancel Roadside Request?', 'إلغاء طلب المساعدة؟')} onBack={back} />
      <div className="px-4 pt-4 space-y-4">
        {err && <Banner tone="danger" title={err} />}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-sm font-extrabold" style={{ color: c.text }}>{req?.code || '—'}</span>
            <StatusBadge status={req?.status || 'Searching'} />
          </div>
          <SelectField
            label={t('Reason for Cancellation', 'سبب الإلغاء')}
            value={reasonKey}
            onChange={setReasonKey}
            testId="field-reasonKey"
            options={[
              { value: '', label: t('Select a reason...', 'اختر سبب الإلغاء...') },
              ...cancelReasons.map((r) => ({
                value: r.key,
                label: isAr ? r.labelAr : r.labelEn,
              })),
            ]}
          />
          <InputField
            label={t('Additional Note (Optional)', 'ملاحظات إضافية (اختياري)')}
            value={note}
            onChange={setNote}
            placeholder={t('Optional details...', 'تفاصيل إضافية...')}
          />
          <div className="text-xs mt-1" style={{ color: c.text2 }}>
            {t('Cancellation fee: 0 EGP before provider arrival.', 'رسوم الإلغاء: ٠ ج.م قبل وصول مقدم الخدمة.')}
          </div>
        </Card>
        <PrimaryButton tone="danger" testId="screen-primary" onClick={handleCancel} disabled={cancelMut.isPending || !reasonKey}>
          {cancelMut.isPending ? t('Cancelling...', 'جارٍ الإلغاء...') : t('Confirm Request Cancellation', 'تأكيد إلغاء الطلب')}
        </PrimaryButton>
      </div>
    </div>
  );
}

export function C30({ params }) {
  const { t } = usePrefs();
  const { go, back } = useNav();
  const c = useColors();
  const { req } = useActiveRequest(params);

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar showBack={true} onBack={() => back('C29')} />
      <div className="flex-1 flex flex-col justify-center px-4 pt-4">
        <Card className="text-center py-7">
          <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-3xl" style={{ backgroundColor: c.surface2 }}>
            ✋
          </div>
          <h2 className="text-lg font-extrabold" style={{ color: c.text }}>
            {t('Request Cancelled', 'تم إلغاء الطلب')}
          </h2>
          <p className="text-xs mt-1 mb-5" style={{ color: c.text2 }}>
            {t(`Request ${params?.code || req?.code || ''} has been cancelled with 0 EGP fee.`, `تم إلغاء الطلب ${params?.code || req?.code || ''} بدون أي رسوم.`)}
          </p>
          <div className="space-y-2">
            <PrimaryButton onClick={() => go('C02')}>
              {t('Go to Home', 'الانتقال للرئيسية')}
            </PrimaryButton>
            <SecondaryButton onClick={() => go('C20')}>
              {t('View Request History', 'عرض سجل الطلبات')}
            </SecondaryButton>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C42 — REQUEST TIMELINE / STATUS LOG
// ---------------------------------------------------------------------------
export function C42({ params }) {
  const { t, isAr } = usePrefs();
  const { back } = useNav();
  const c = useColors();
  const { req, reqId } = useActiveRequest(params);
  const { data: events = [] } = useTimeline(reqId);

  const list = events.length > 0 ? events : [
    { status: 'Searching', note: t('Request created and broadcast to nearby providers', 'تم إنشاء الطلب وبثه لمقدمي الخدمة القريبين'), at: req?.createdAt || new Date().toISOString() },
    ...(req?.status && req.status !== 'Searching'
      ? [{ status: req.status, note: formatLabel(req.status, isAr), at: new Date().toISOString() }]
      : []),
  ];

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar title={t('Request Status Timeline', 'السجل الزمني لحالة الطلب')} onBack={back} />
      <div className="px-4 pt-4 space-y-3">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-extrabold font-mono" style={{ color: c.text }}>{req?.code || '—'}</span>
            <StatusBadge status={req?.status || 'Searching'} />
          </div>
          <div className="space-y-4">
            {list.map((ev, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full mt-1" style={{ backgroundColor: c.accent }} />
                  {i < list.length - 1 && <div className="w-0.5 h-8 my-1" style={{ backgroundColor: c.border }} />}
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold" style={{ color: c.text }}>
                    {formatLabel(ev.status, isAr)}
                  </div>
                  {ev.note && (
                    <div className="text-[11px]" style={{ color: c.text2 }}>
                      {/^[a-z0-9_.-]+$/i.test(String(ev.note).trim()) ? formatLabel(String(ev.note).trim(), isAr) : ev.note}
                    </div>
                  )}
                  <div className="text-[10px] mt-0.5" style={{ color: c.text3 }}>
                    {fmtDateTime(ev.at, isAr ? 'ar' : 'en')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
