import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  usePrefs, useNav, useSession,
  AppTopBar, Card, SectionHeader, StatusBadge, Chip, PrimaryButton, SecondaryButton,
  InputField, SelectField, ToggleSwitch, EmptyState, Banner, Divider, Avatar,
  StarRating, MapView, Skeleton, egp, formatLabel, pluralCount, FormValidationProvider
} from '../../ui/kit.jsx';
import { validateEgyptPhoneField } from '../../ui/validation.js';

function useColors() {
  const { isDark } = usePrefs();
  return isDark
    ? {
        bg: '#090A0D', surface: '#12141A', surface2: '#1A1D26', border: '#262936',
        text: '#FFFFFF', text2: '#94A3B8', text3: '#64748B',
        accent: '#E51C23', accentBg: 'rgba(229, 28, 35, 0.14)',
        danger: '#F43F5E', dangerBg: 'rgba(244, 63, 94, 0.14)',
        success: '#10B981', successBg: 'rgba(16, 185, 129, 0.14)',
        info: '#38BDF8', infoBg: 'rgba(56, 189, 248, 0.14)',
      }
    : {
        bg: '#F8FAFC', surface: '#FFFFFF', surface2: '#F1F5F9', border: '#E2E8F0',
        text: '#0F172A', text2: '#475569', text3: '#64748B',
        accent: '#E51C23', accentBg: 'rgba(229, 28, 35, 0.10)',
        danger: '#E11D48', dangerBg: 'rgba(225, 29, 72, 0.1)',
        success: '#059669', successBg: 'rgba(16, 185, 129, 0.12)',
        info: '#0284C7', infoBg: 'rgba(2, 132, 199, 0.12)',
      };
}
import {
  useCenters, useCenter, useCenterServices, useAvailability,
  useBookings, useBooking, useCreateBooking, useVehicles,
  useRequests, useReviews, useNotifications, useMarkRead, k
} from '../../api/hooks.js';
import { post, put } from '../../api/http.js';
import { fmtDate, fmtTime12, fmtDateTime } from '../../i18n/format.js';
import { resolveDeepLink } from '../../app/stores.jsx';

function getUpcomingDays(count = 7, isAr = false) {
  const days = [];
  const base = new Date();
  const isoFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  for (let i = 0; i < count; i++) {
    const d = new Date(base.getTime() + i * 86400000);
    const iso = isoFmt.format(d);
    const weekday = new Date(`${iso}T12:00:00Z`).getUTCDay();
    const label = i === 0
      ? (isAr ? 'اليوم' : 'Today')
      : i === 1
      ? (isAr ? 'غداً' : 'Tomorrow')
      : d.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Africa/Cairo' });
    days.push({ iso, label, weekday });
  }
  return days;
}

function localizeNotificationText(n, isAr) {
  if (!isAr || !n) return { title: n?.title || '', body: n?.body || '' };
  let title = String(n.title || '');
  let body = String(n.body || '');
  const titleMap = {
    'Request update': 'تحديث حالة الطلب',
    'Request cancelled': 'تم إلغاء الطلب',
    'New service offer': 'عرض خدمة جديد',
    'Offer accepted': 'تم قبول العرض',
    'Offer declined': 'تم الاعتذار عن العرض',
    'Estimate submitted': 'تم إرسال عرض السعر',
    'Quote submitted': 'تم إرسال عرض السعر',
    'Estimate approved': 'تم اعتماد عرض السعر',
    'Quote approved': 'تم اعتماد عرض السعر',
    'Booking confirmed': 'تم تأكيد الحجز',
    'Booking completed': 'اكتمل موعد الصيانة',
    'Booking cancelled': 'تم إلغاء الحجز',
    'Payment received': 'تم استلام الدفعة',
    'Support reply': 'رد جديد من الدعم الفني',
    'KYC status update': 'تحديث حالة التوثيق',
    'New message': 'رسالة جديدة',
  };
  if (titleMap[title]) title = titleMap[title];
  body = body
    .replace(/^Request\s+([A-Z0-9-]+)\s+was cancelled\.?$/i, 'تم إلغاء الطلب $1.')
    .replace(/^([A-Z0-9-]+):\s*(\w+)$/, (_, code, st) => `${code}: ${formatLabel(st, true)}`);
  return { title, body };
}

function formatSlotTime(isoStr, isAr = false) {
  return fmtTime12(isoStr, isAr ? 'ar' : 'en');
}

function isFutureSlot(isoStr) {
  if (!isoStr) return false;
  const ts = new Date(isoStr).getTime();
  return Number.isFinite(ts) && ts > Date.now() + 60_000;
}

function matchesCenterCategory(center, cat) {
  const svcs = Array.isArray(center?.services) ? center.services : [];
  const hay = `${svcs.join(' ')} ${center?.description ?? ''}`.toLowerCase();
  if (cat === 'periodic') return /periodic|oil|filter|inspection/.test(hay);
  if (cat === 'diagnostics') return /diagnostic|obd|ac\b|cooling|battery|charging/.test(hay);
  if (cat === 'brakes') return /brake|alignment|tire|suspension|wheel/.test(hay);
  return true;
}

function weightedCenterScore(center) {
  const count = Number(center?.ratingCount ?? 0);
  const rating = Number(center?.rating ?? 0);
  if (count <= 0) return 0;
  // Bayesian weighted rating (m = 4 prior weight, C = 4.2 baseline) + recommendation bonus
  const bayes = (count / (count + 4)) * rating + (4 / (count + 4)) * 4.2;
  const recBonus = Number(center?.recommendPercent ?? 0) / 1000;
  return bayes + recBonus;
}

// ---------------------------------------------------------------------------
// C17 — SERVICE CENTERS DIRECTORY
// ---------------------------------------------------------------------------
export function C17() {
  const { t, isAr } = usePrefs();
  const { go, back } = useNav();
  const c = useColors();
  const { data: centers = [], isLoading } = useCenters();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const searched = useMemo(() => {
    if (!search.trim()) return [...centers];
    const q = search.trim().toLowerCase();
    return centers.filter((x) => {
      const svcs = Array.isArray(x.services) ? x.services.join(' ') : '';
      return (
        String(x.name ?? '').toLowerCase().includes(q) ||
        String(x.address ?? '').toLowerCase().includes(q) ||
        String(x.description ?? '').toLowerCase().includes(q) ||
        svcs.toLowerCase().includes(q)
      );
    });
  }, [centers, search]);

  const counts = useMemo(() => ({
    all: searched.length,
    top: searched.filter((x) => Number(x.ratingCount ?? 0) > 0 && Number(x.rating ?? 0) >= 4.5).length,
    periodic: searched.filter((x) => matchesCenterCategory(x, 'periodic')).length,
    diagnostics: searched.filter((x) => matchesCenterCategory(x, 'diagnostics')).length,
    brakes: searched.filter((x) => matchesCenterCategory(x, 'brakes')).length,
    price: searched.filter((x) => x.startingPriceMinor != null).length,
  }), [searched]);

  const filtered = useMemo(() => {
    let list = [...searched];
    if (filter === 'top') {
      return list
        .filter((x) => Number(x.ratingCount ?? 0) > 0 && Number(x.rating ?? 0) >= 4.5)
        .sort((a, b) =>
          Number(b.rating ?? 0) - Number(a.rating ?? 0) ||
          Number(b.ratingCount ?? 0) - Number(a.ratingCount ?? 0) ||
          Number(b.recommendPercent ?? 0) - Number(a.recommendPercent ?? 0)
        );
    }
    if (filter === 'periodic' || filter === 'diagnostics' || filter === 'brakes') {
      return list
        .filter((x) => matchesCenterCategory(x, filter))
        .sort((a, b) => weightedCenterScore(b) - weightedCenterScore(a));
    }
    if (filter === 'price') {
      return list.sort((a, b) =>
        Number(a.startingPriceMinor ?? 9999999) - Number(b.startingPriceMinor ?? 9999999) ||
        weightedCenterScore(b) - weightedCenterScore(a)
      );
    }
    return list;
  }, [searched, filter]);

  const filterTabs = [
    { id: 'all', en: `All Centers (${counts.all})`, ar: `جميع المراكز (${counts.all})` },
    { id: 'top', en: `Top Rated ⭐ (${counts.top})`, ar: `الأعلى تقييماً ⭐ (${counts.top})` },
    { id: 'periodic', en: `Periodic Maintenance (${counts.periodic})`, ar: `صيانة دورية (${counts.periodic})` },
    { id: 'diagnostics', en: `Diagnostics & AC (${counts.diagnostics})`, ar: `فحص كمبيوتر وتكييف (${counts.diagnostics})` },
    { id: 'brakes', en: `Brakes & Alignment (${counts.brakes})`, ar: `فرامل وزوايا (${counts.brakes})` },
    { id: 'price', en: 'Lowest Price', ar: 'الأقل سعراً' },
  ];

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar
        title={t('Verified Service Centers', 'مراكز الخدمة المعتمدة')}
        onBack={back}
        right={
          <button
            type="button"
            onClick={() => go('C37')}
            className="text-xs font-bold px-2.5 py-1.5 rounded-xl"
            style={{ backgroundColor: c.surface2, color: c.accent }}
          >
            {t('My Bookings', 'حجوزاتي')}
          </button>
        }
      />
      <div className="px-4 pt-3 space-y-3">
        <InputField
          placeholder={t('Search center, district, or service (e.g. Nasr City, Oil, AC)...', 'ابحث باسم المركز أو المنطقة أو الخدمة (مثل مدينة نصر، زيت، تكييف)...')}
          value={search}
          onChange={setSearch}
        />

        <div className="flex items-center gap-1.5 flex-wrap pb-0.5">
          {filterTabs.map((tab) => (
            <Chip key={tab.id} active={filter === tab.id} onClick={() => setFilter(tab.id)}>
              {t(tab.en, tab.ar)}
            </Chip>
          ))}
        </div>

        {!isLoading && filtered.length === 0 ? (
          <EmptyState
            icon="🏢"
            title={t('No Matching Service Centers', 'لا توجد مراكز خدمة مطابقة')}
            subtitle={t('Try switching category filters or clearing your search keywords.', 'جرب تغيير الفلتر أو مسح كلمة البحث لعرض المراكز المتاحة.')}
          />
        ) : (
          filtered.map((center) => {
            const revCount = Number(center.ratingCount ?? 0);
            const ratingVal = Number(center.rating ?? 0);
            const recPct = Number(center.recommendPercent ?? 0);
            const svcs = Array.isArray(center.services) ? center.services : [];

            return (
              <Card key={center.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-extrabold truncate" style={{ color: c.text }}>{center.name}</div>
                      {center.startingPriceMinor != null && (
                        <span className="text-[11px] font-extrabold shrink-0 px-2 py-0.5 rounded-lg" style={{ backgroundColor: c.accentBg, color: c.accent }}>
                          {t('From', 'يبدأ من')} {egp(center.startingPriceMinor, isAr)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: c.text2 }}>📍 {center.address}</div>

                    {revCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => go('C40', { centerId: center.id })}
                        className="flex items-center flex-wrap gap-1.5 mt-1.5 text-xs text-start hover:opacity-85"
                        style={{ color: c.text2 }}
                      >
                        <StarRating value={ratingVal} size={12} />
                        <span className="font-extrabold" style={{ color: c.accent }}>
                          {ratingVal.toFixed(1)}
                        </span>
                        <span className="underline">
                          ({pluralCount(revCount, 'review', 'reviews', 'تقييم', 'تقييمات', 'تقييماً', isAr)})
                        </span>
                        <span>• 👍 {recPct}%</span>
                      </button>
                    ) : (
                      <div className="text-[11px] font-medium mt-1.5" style={{ color: c.text3 }}>
                        {t('New workshop · No verified reviews yet', 'مركز جديد · لا توجد تقييمات موثقة بعد')}
                      </div>
                    )}
                  </div>
                </div>

                {center.description && (
                  <p className="text-xs mt-2 line-clamp-2" style={{ color: c.text2 }}>
                    {center.description}
                  </p>
                )}

                {svcs.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {svcs.slice(0, 3).map((svcName) => (
                      <span
                        key={svcName}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: c.surface2, color: c.text2 }}
                      >
                        {svcName}
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <SecondaryButton onClick={() => go('C18', { id: center.id, centerId: center.id })}>
                    {t('View Services', 'عرض الخدمات')}
                  </SecondaryButton>
                  <PrimaryButton onClick={() => go('C19', { centerId: center.id })}>
                    {t('Book Slot', 'حجز موعد')}
                  </PrimaryButton>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C18 — SERVICE CENTER DETAILS & CATALOGUE
// ---------------------------------------------------------------------------
export function C18({ params }) {
  const { t, isAr } = usePrefs();
  const { go, back } = useNav();
  const c = useColors();
  const { data: centers = [] } = useCenters();
  const centerId = params?.id || params?.centerId || centers[0]?.id;
  const { data: centerDetail } = useCenter(centerId);
  const { data: services = [] } = useCenterServices(centerId);

  const center = centerDetail || centers.find((x) => x.id === centerId) || centers[0] || null;

  const defaultLat = 30.0444;
  const defaultLon = 31.2357;

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar title={center?.name || t('Service Center Details', 'تفاصيل مركز الخدمة')} onBack={back} />
      <div className="px-4 pt-3 space-y-3">
        <MapView
          height={150}
          markers={[{ lat: center?.latitude ?? defaultLat, lng: center?.longitude ?? defaultLon, label: center?.name || 'Center' }]}
        />

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-extrabold" style={{ color: c.text }}>
                {center?.name || t('Service Center', 'مركز الخدمة')}
              </h2>
              <div className="text-xs mt-0.5" style={{ color: c.text2 }}>
                📍 {center?.address || '—'}
              </div>
              <div className="flex items-center flex-wrap gap-2.5 mt-2 text-xs">
                {Number(center?.ratingCount ?? 0) > 0 ? (
                  <>
                    <StarRating value={Number(center?.rating ?? 0)} size={13} />
                    <span className="font-bold" style={{ color: c.accent }}>
                      {Number(center?.rating ?? 0).toFixed(1)} ({center?.ratingCount ?? 0}) • 👍 {center?.recommendPercent ?? 0}%
                    </span>
                  </>
                ) : (
                  <span style={{ color: c.text3 }}>
                    {t('No verified reviews yet', 'لا توجد تقييمات بعد')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => go('C40', { centerId: center?.id })}
                  className="font-bold underline"
                  style={{ color: c.info }}
                >
                  {t('Read Customer Reviews →', 'قراءة تقييمات العملاء ←')}
                </button>
              </div>
            </div>
            {center?.phone && (
              <a
                href={`tel:${center.phone}`}
                className="px-3 py-2 rounded-xl text-xs font-bold"
                style={{ backgroundColor: c.successBg, color: c.success }}
              >
                📞 {t('Call', 'اتصال')}
              </a>
            )}
          </div>
        </Card>

        <SectionHeader
          title={t('Available Maintenance Packages', 'باقات وخدمات الصيانة المتاحة')}
          subtitle={t('Select a service to pick an available bay time slot', 'اختر الخدمة لتحديد موعد متاح في المركز')}
        />

        <div className="space-y-2.5">
          {services.map((svc) => (
            <Card key={svc.id}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold" style={{ color: c.text }}>{svc.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: c.text2 }}>
                    ⏱ {svc.durationMinutes} {t('mins', 'دقيقة')}
                    {svc.description ? ` • ${svc.description}` : ''}
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-sm font-extrabold" style={{ color: c.accent }}>
                    {egp(svc.priceMinor, isAr)}
                  </div>
                  <button
                    type="button"
                    onClick={() => go('C19', { centerId: center?.id, serviceId: svc.id })}
                    className="mt-1 px-3 py-1 rounded-lg text-xs font-bold text-white"
                    style={{ backgroundColor: c.accent }}
                  >
                    {t('Book Slot', 'احجز موعداً')}
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <PrimaryButton onClick={() => go('C19', { centerId: center?.id, serviceId: services[0]?.id })}>
          {t('Choose Day & Time Slot →', 'اختيار اليوم والموعد المتاح ←')}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C19 — SLOT-BASED SERVICE CENTER BOOKING (DAY CHIPS + AVAILABILITY SLOTS)
// ---------------------------------------------------------------------------
export function C19({ params }) {
  const { t, isAr } = usePrefs();
  const { go, back } = useNav();
  const c = useColors();
  const { data: centers = [] } = useCenters();
  const centerId = params?.centerId || params?.id || centers[0]?.id;
  const { data: center } = useCenter(centerId);
  const { data: services = [] } = useCenterServices(centerId);
  const { data: vehicles = [] } = useVehicles();
  const createBookingMut = useCreateBooking();

  const days = useMemo(() => getUpcomingDays(7, isAr), [isAr]);
  const defaultOpenDay = useMemo(
    () => days.find((d, idx) => idx >= 1 && d.weekday !== 5)?.iso || days[0]?.iso || '',
    [days]
  );
  const [selectedServiceId, setSelectedServiceId] = useState(params?.serviceId || services[0]?.id || '');
  const [selectedDay, setSelectedDay] = useState(defaultOpenDay);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [vehicleId, setVehicleId] = useState(vehicles.find((v) => v.isPrimary)?.id || vehicles[0]?.id || '');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!selectedServiceId && services[0]?.id) setSelectedServiceId(services[0].id);
  }, [services, selectedServiceId]);

  useEffect(() => {
    if (!vehicleId && vehicles[0]?.id) setVehicleId(vehicles[0].id);
  }, [vehicles, vehicleId]);

  const { data: rawSlots = [], isLoading: slotsLoading } = useAvailability(centerId, selectedServiceId, selectedDay);
  const slots = useMemo(
    () => (Array.isArray(rawSlots) ? rawSlots.filter((s) => isFutureSlot(s.slotStart)) : []),
    [rawSlots]
  );
  const isTodaySelected = selectedDay === days[0]?.iso;

  useEffect(() => {
    const firstAvail = slots.find((s) => s.available);
    setSelectedSlot(firstAvail ? firstAvail.slotStart : '');
  }, [slots]);

  const chosenService = services.find((s) => s.id === selectedServiceId) || services[0] || null;
  const hasAvailableSlot = slots.some((s) => s.available);

  const handleConfirmBooking = async () => {
    setErr('');
    if (!centerId || !chosenService?.id || !selectedSlot) {
      setErr(t('Please select a service and available time slot.', 'يرجى اختيار الخدمة والموعد المتاح.'));
      return;
    }
    if (!isFutureSlot(selectedSlot)) {
      setErr(t('Cannot book a date or time slot that has already passed. Please choose an upcoming time.', 'لا يمكن اختيار يوم أو موعد قد مضى. يرجى اختيار موعد قادم.'));
      return;
    }
    try {
      const created = await createBookingMut.mutateAsync({
        centerId,
        serviceId: chosenService.id,
        slotStart: selectedSlot,
        vehicleId: vehicleId || null,
        note: note.trim() || null,
      });
      go('C36', { id: created.id });
    } catch (ex) {
      if (ex?.code === 'booking.past_slot') {
        setErr(t('Cannot book a date or time slot that has already passed.', 'لا يمكن حجز يوم أو موعد قد مضى بالفعل.'));
      } else {
        setErr(ex.message || t('Could not create booking for this slot', 'تعذر تأكيد الحجز لهذا الموعد'));
      }
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar title={t('Book Service Appointment', 'حجز موعد مركز الخدمة')} onBack={back} />
      <div className="px-4 pt-4 space-y-4">
        {err && <Banner tone="danger" title={err} />}

        {/* Service Selection */}
        <Card>
          <div className="text-xs font-bold mb-1" style={{ color: c.text2 }}>
            {center?.name || t('Selected Service Center', 'مركز الخدمة المختار')}
          </div>
          <SelectField
            label={t('Maintenance Service', 'نوع الصيانة المطلوبة')}
            value={selectedServiceId}
            onChange={setSelectedServiceId}
            testId="field-serviceId"
            options={services.map((s) => ({
              value: s.id,
              label: `${s.name} — ${egp(s.priceMinor, isAr)} (${s.durationMinutes} ${t('min', 'دقيقة')})`,
            }))}
          />
          {vehicles.length > 0 && (
            <SelectField
              label={t('Vehicle', 'السيارة')}
              value={vehicleId}
              onChange={setVehicleId}
              testId="field-vehicleId"
              options={vehicles.map((v) => ({
                value: v.id,
                label: `${v.make} ${v.model} (${v.plate})`,
              }))}
            />
          )}
        </Card>

        {/* Day Chips */}
        <Card>
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: c.text3 }}>
            {t('1. Select Day', '١. اختر اليوم')}
          </div>
          <div className="flex flex-wrap items-center gap-1.5" data-testid="booking-day-picker">
            {days.map((d) => (
              <Chip
                key={d.iso}
                active={selectedDay === d.iso}
                onClick={() => setSelectedDay(d.iso)}
              >
                <span data-day-iso={d.iso} data-day-weekday={d.weekday}>{d.label}</span>
              </Chip>
            ))}
          </div>

          <div className="text-xs font-bold uppercase tracking-wider mt-4 mb-2" style={{ color: c.text3 }}>
            {t('2. Select Available Time Slot', '٢. اختر الساعة المتاحة')}
          </div>
          <div data-testid="booking-slot-picker">
            {slotsLoading ? (
              <Skeleton rows={2} />
            ) : slots.length === 0 || !hasAvailableSlot ? (
              <div
                data-testid="closed-day-state"
                className="rounded-xl p-4 text-center text-xs font-semibold border"
                style={{ backgroundColor: c.surface2, borderColor: c.border, color: c.text2 }}
              >
                {slots.length === 0
                  ? (isTodaySelected
                      ? t('Today’s remaining time slots have already passed — please pick Tomorrow or an upcoming day', 'انتهت المواعيد المتبقية لهذا اليوم — يرجى اختيار الغد أو يوم قادم')
                      : t('Closed on this day — no available slots', 'المركز مغلق في هذا اليوم — لا توجد مواعيد متاحة'))
                  : t('All slots are fully booked on this day', 'جميع المواعيد محجوزة في هذا اليوم')}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot) => {
                  const isSelected = selectedSlot === slot.slotStart;
                  return (
                    <button
                      key={slot.slotStart}
                      type="button"
                      disabled={!slot.available}
                      onClick={() => setSelectedSlot(slot.slotStart)}
                      className="py-2.5 px-2 rounded-xl text-xs font-bold transition-all text-center"
                      style={{
                        backgroundColor: !slot.available
                          ? c.surface2
                          : isSelected
                          ? c.accent
                          : c.surface,
                        color: !slot.available
                          ? c.text3
                          : isSelected
                          ? '#FFFFFF'
                          : c.text,
                        border: `1.5px solid ${isSelected ? c.accent : c.border}`,
                        opacity: slot.available ? 1 : 0.45,
                      }}
                    >
                      {formatSlotTime(slot.slotStart, isAr)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <InputField
            label={t('Notes for Service Advisor (Optional)', 'ملاحظات لمهندس الاستقبال (اختياري)')}
            value={note}
            onChange={setNote}
            placeholder={t('E.g. Please check front brake pads and AC filter...', 'مثال: يرجى فحص تيل الفرامل الأمامي وفلتر التكييف...')}
          />
        </Card>

        <PrimaryButton testId="screen-primary" onClick={handleConfirmBooking} disabled={createBookingMut.isPending || !selectedSlot}>
          {createBookingMut.isPending
            ? t('Confirming Slot...', 'جارٍ تأكيد الموعد...')
            : `${t('Confirm Booking', 'تأكيد الحجز')} ${chosenService ? `(${egp(chosenService.priceMinor, isAr)})` : ''}`}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C36 (BOOKING CONFIRMATION) & C37 (BOOKING DETAILS)
// ---------------------------------------------------------------------------
export function C36({ params }) {
  const { t, isAr } = usePrefs();
  const { go, back } = useNav();
  const c = useColors();
  const { data: bookings = [] } = useBookings();
  const targetId = params?.id || bookings[0]?.id;
  const { data: detail } = useBooking(targetId);
  const booking = detail || bookings.find((b) => b.id === targetId) || bookings[0] || null;

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar showBack={true} onBack={() => back('C19')} />
      <div className="flex-1 flex flex-col justify-center px-4 pt-4">
        <Card className="text-center py-6">
        <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-3xl" style={{ backgroundColor: c.successBg, color: c.success }}>
          📅
        </div>
        <h2 className="text-lg font-extrabold" style={{ color: c.text }}>
          {t('Appointment Slot Reserved!', 'تم حجز الموعد بنجاح!')}
        </h2>
        <p className="text-xs mt-1" style={{ color: c.text2 }}>
          {booking?.code ? `${t('Booking Reference:', 'رقم الحجز:')} ${booking.code}` : t('Your service bay reservation has been sent to the center.', 'تم إرسال حجزك إلى مركز الخدمة.')}
        </p>

        {booking && (
          <div className="mt-4 p-3 rounded-xl text-start text-xs space-y-1.5" style={{ backgroundColor: c.surface2 }}>
            <div className="flex justify-between">
              <span style={{ color: c.text2 }}>{t('Center', 'المركز')}</span>
              <span className="font-bold" style={{ color: c.text }}>{booking.centerName || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: c.text2 }}>{t('Service', 'الخدمة')}</span>
              <span className="font-bold" style={{ color: c.text }}>{booking.serviceName || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: c.text2 }}>{t('Scheduled Slot', 'الموعد')}</span>
              <span className="font-bold" style={{ color: c.text }}>
                {fmtDateTime(booking.slotStart, isAr ? 'ar' : 'en')} ({formatSlotTime(booking.slotStart, isAr)})
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: c.text2 }}>{t('Estimated Price', 'التكلفة')}</span>
              <span className="font-extrabold" style={{ color: c.accent }}>{egp(booking.priceMinor, isAr)}</span>
            </div>
          </div>
        )}

        <div className="mt-5 space-y-2">
          <PrimaryButton onClick={() => go('C38', { id: booking?.id })}>
            {t('View Booking Details', 'عرض تفاصيل الحجز')}
          </PrimaryButton>
          <SecondaryButton onClick={() => go('C37')}>
            {t('All My Bookings', 'جميع حجوزاتي')}
          </SecondaryButton>
        </div>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C37 — MY APPOINTMENTS LIST
// ---------------------------------------------------------------------------
export function C37() {
  const { t, isAr } = usePrefs();
  const { go, back } = useNav();
  const c = useColors();
  const { data: bookings = [] } = useBookings();
  const [tab, setTab] = useState('upcoming');

  const filtered = bookings.filter((b) => {
    if (tab === 'completed') return b.status === 'Completed';
    if (tab === 'cancelled') return ['Cancelled', 'Rejected', 'Expired'].includes(b.status);
    return ['Pending', 'Confirmed', 'InProgress'].includes(b.status);
  });

  const displayList = filtered;

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar
        title={t('My Center Bookings', 'حجوزات مراكز الخدمة')}
        onBack={back}
        right={
          <button
            type="button"
            onClick={() => go('C17')}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-white"
            style={{ backgroundColor: c.accent }}
          >
            {t('+ Book New', '+ حجز جديد')}
          </button>
        }
      />
      <div className="px-4 pt-3 space-y-3">
        <div className="flex items-center gap-2">
          {[
            { id: 'upcoming', en: 'Upcoming', ar: 'القادمة' },
            { id: 'completed', en: 'Completed', ar: 'المكتملة' },
            { id: 'cancelled', en: 'Cancelled', ar: 'الملغاة' },
          ].map((item) => (
            <Chip key={item.id} active={tab === item.id} onClick={() => setTab(item.id)}>
              {t(item.en, item.ar)}
            </Chip>
          ))}
        </div>

        {displayList.length === 0 ? (
          <EmptyState
            icon="📅"
            title={t('No Center Bookings Yet', 'لا توجد حجوزات في مراكز الخدمة')}
            subtitle={t('Schedule periodic maintenance, oil change or AC inspection at a verified workshop.', 'احجز صيانة دورية أو تغيير زيت أو فحص تكييف في مركز خدمة معتمد.')}
            action={<PrimaryButton onClick={() => go('C17')}>{t('Find a Service Center', 'ابحث عن مركز خدمة')}</PrimaryButton>}
          />
        ) : (
          displayList.map((b) => (
            <Card key={b.id} onClick={() => go('C38', { id: b.id })}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-xs font-bold" style={{ color: c.text2 }}>{b.code}</span>
                <StatusBadge status={b.status} />
              </div>
              <div className="text-sm font-extrabold" style={{ color: c.text }}>
                {b.centerName || '—'}
              </div>
              <div className="text-xs mt-0.5" style={{ color: c.text2 }}>
                {b.serviceName || '—'} • {fmtDateTime(b.slotStart, isAr ? 'ar' : 'en')}
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t text-xs" style={{ borderColor: c.border }}>
                <span className="font-extrabold" style={{ color: c.accent }}>{egp(b.priceMinor, isAr)}</span>
                <span className="font-bold" style={{ color: c.info }}>{t('Manage →', 'إدارة ←')}</span>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C38 — APPOINTMENT DETAILS
// ---------------------------------------------------------------------------
export function C38({ params }) {
  const { t, isAr } = usePrefs();
  const { go, back } = useNav();
  const c = useColors();
  const { data: bookings = [], refetch: refetchList } = useBookings();
  const targetId = params?.id || bookings[0]?.id;
  const { data: detail, refetch: refetchDetail } = useBooking(targetId);

  useEffect(() => {
    refetchList?.();
    if (targetId) refetchDetail?.();
  }, [targetId]);

  const booking = detail || bookings.find((b) => b.id === targetId) || bookings[0] || null;

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar title={t('Booking Details', 'تفاصيل الحجز')} onBack={back} />
      <div className="px-4 pt-4 space-y-4">
        {booking ? (
          <>
            <Card>
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-sm font-extrabold" style={{ color: c.text }}>{booking.code}</span>
                <div className="flex items-center gap-1.5">
                  {(booking.status === 'Completed' || booking.invoiceStatus) && (
                    <span data-testid="booking-payment-status">
                      <StatusBadge status={booking.invoiceStatus || 'Paid'} />
                    </span>
                  )}
                  <StatusBadge status={booking.status} />
                </div>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span style={{ color: c.text2 }}>{t('Service Center', 'مركز الخدمة')}</span>
                  <span className="font-bold" style={{ color: c.text }}>{booking.centerName || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: c.text2 }}>{t('Package', 'الخدمة')}</span>
                  <span className="font-bold" style={{ color: c.text }}>{booking.serviceName || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: c.text2 }}>{t('Appointment Slot', 'الموعد المحدد')}</span>
                  <span className="font-bold" style={{ color: c.text }}>
                    {fmtDateTime(booking.slotStart, isAr ? 'ar' : 'en')} ({formatSlotTime(booking.slotStart, isAr)})
                  </span>
                </div>
                {booking.vehicleLabel && (
                  <div className="flex justify-between">
                    <span style={{ color: c.text2 }}>{t('Vehicle', 'السيارة')}</span>
                    <span className="font-bold" style={{ color: c.text }}>{booking.vehicleLabel}</span>
                  </div>
                )}
                {booking.note && (
                  <div className="flex justify-between">
                    <span style={{ color: c.text2 }}>{t('Notes', 'ملاحظات')}</span>
                    <span className="font-semibold text-end max-w-[180px]" style={{ color: c.text }}>{booking.note}</span>
                  </div>
                )}
                <Divider className="my-2" />
                {booking.extraMinor > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span style={{ color: c.text2 }}>{booking.serviceName || t('Base Package', 'الباقة الأساسية')}</span>
                      <span className="font-semibold" style={{ color: c.text }}>{egp(booking.basePriceMinor ?? (booking.priceMinor - booking.extraMinor), isAr)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: c.text2 }}>{booking.extraDescription || t('Additional parts / labor', 'قطع غيار أو أعمال إضافية')}</span>
                      <span className="font-semibold" style={{ color: c.text }}>{egp(booking.extraMinor, isAr)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-sm font-extrabold">
                  <span style={{ color: c.text }}>{booking.status === 'Completed' ? t('Total Settled', 'الإجمالي المسدد') : t('Package Fare', 'سعر الباقة')}</span>
                  <span style={{ color: c.accent }}>{egp(booking.priceMinor, isAr)}</span>
                </div>
              </div>
            </Card>

            <div className="space-y-2">
              {['Pending', 'Confirmed'].includes(booking.status) && (
                <>
                  <PrimaryButton onClick={() => go('C39', { id: booking.id, centerId: booking.centerId, serviceId: booking.serviceId })}>
                    {t('Reschedule Time Slot', 'تعديل موعد الحجز')}
                  </PrimaryButton>
                  <SecondaryButton onClick={() => go('C43', { id: booking.id })}>
                    {t('Cancel Booking', 'إلغاء الحجز')}
                  </SecondaryButton>
                </>
              )}
              <SecondaryButton onClick={() => go('SH01', { bookingId: booking.id })}>
                {t('Message Service Center 💬', 'مراسلة مركز الخدمة 💬')}
              </SecondaryButton>
              {booking.status === 'Completed' && (
                <PrimaryButton onClick={() => go('C40', { centerId: booking.centerId, bookingId: booking.id })}>
                  {t('Rate & Review Service Center ⭐', 'تقييم مركز الخدمة ⭐')}
                </PrimaryButton>
              )}
            </div>
          </>
        ) : (
          <EmptyState
            icon="📅"
            title={t('No Booking Selected', 'لم يتم تحديد حجز')}
            action={<PrimaryButton onClick={() => go('C17')}>{t('Browse Service Centers', 'تصفح مراكز الخدمة')}</PrimaryButton>}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C39 (RESCHEDULE BOOKING) & C43 (CANCEL BOOKING) & C40 (CENTER REVIEWS)
// ---------------------------------------------------------------------------
export function C39({ params }) {
  const { t, isAr } = usePrefs();
  const { go, back } = useNav();
  const c = useColors();
  const qc = useQueryClient();
  const { data: bookings = [] } = useBookings();
  const booking = bookings.find((b) => b.id === params?.id) || bookings[0] || null;

  const days = useMemo(() => getUpcomingDays(7, isAr), [isAr]);
  const defaultOpenDay = useMemo(
    () => days.find((d, idx) => idx >= 1 && d.weekday !== 5)?.iso || days[0]?.iso || '',
    [days]
  );
  const [selectedDay, setSelectedDay] = useState(defaultOpenDay);
  const centerId = params?.centerId || booking?.centerId;
  const serviceId = params?.serviceId || booking?.serviceId;
  const { data: rawSlots = [], isLoading: slotsLoading } = useAvailability(centerId, serviceId, selectedDay);
  const slots = useMemo(
    () => (Array.isArray(rawSlots) ? rawSlots.filter((s) => isFutureSlot(s.slotStart)) : []),
    [rawSlots]
  );
  const isTodaySelected = selectedDay === days[0]?.iso;

  const [selectedSlot, setSelectedSlot] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const first = slots.find((s) => s.available);
    setSelectedSlot(first ? first.slotStart : '');
  }, [slots]);

  const handleReschedule = async () => {
    setErr('');
    if (!booking?.id || !selectedSlot) return;
    if (!isFutureSlot(selectedSlot)) {
      setErr(t('Cannot select a date or time slot that has already passed.', 'لا يمكن اختيار يوم أو موعد قد مضى بالفعل.'));
      return;
    }
    setSaving(true);
    try {
      await post(`/centers/bookings/${booking.id}/reschedule`, { slotStart: selectedSlot });
      qc.invalidateQueries({ queryKey: k.bookings });
      go('C38', { id: booking.id });
    } catch (ex) {
      if (ex?.code === 'booking.past_slot') {
        setErr(t('Cannot select a date or time slot that has already passed.', 'لا يمكن اختيار يوم أو موعد قد مضى بالفعل.'));
      } else {
        setErr(ex.message || t('Could not reschedule booking', 'تعذر تعديل موعد الحجز'));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar title={t('Reschedule Appointment', 'تعديل موعد الحجز')} onBack={back} />
      <div className="px-4 pt-4 space-y-4">
        {err && <Banner tone="danger" title={err} />}
        <Card>
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: c.text3 }}>
            {t('Pick New Date', 'اختر اليوم الجديد')}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {days.map((d) => (
              <Chip key={d.iso} active={selectedDay === d.iso} onClick={() => setSelectedDay(d.iso)}>
                {d.label}
              </Chip>
            ))}
          </div>

          <div className="text-xs font-bold uppercase tracking-wider mt-4 mb-2" style={{ color: c.text3 }}>
            {t('Pick New Time Slot', 'اختر الساعة الجديدة')}
          </div>
          {slotsLoading ? (
            <Skeleton rows={2} />
          ) : slots.length === 0 || !slots.some((s) => s.available) ? (
            <div className="rounded-xl p-4 text-center text-xs font-semibold border" style={{ backgroundColor: c.surface2, borderColor: c.border, color: c.text2 }}>
              {isTodaySelected && slots.length === 0
                ? t('Today’s remaining time slots have already passed — please pick Tomorrow or an upcoming day', 'انتهت المواعيد المتبقية لهذا اليوم — يرجى اختيار الغد أو يوم قادم')
                : t('Closed on this day — no available slots', 'المركز مغلق في هذا اليوم — لا توجد مواعيد متاحة')}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) => {
                const active = selectedSlot === slot.slotStart;
                return (
                  <button
                    key={slot.slotStart}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => setSelectedSlot(slot.slotStart)}
                    className="py-2.5 px-2 rounded-xl text-xs font-bold"
                    style={{
                      backgroundColor: active ? c.accent : c.surface,
                      color: active ? '#FFFFFF' : c.text,
                      border: `1.5px solid ${active ? c.accent : c.border}`,
                      opacity: slot.available ? 1 : 0.45,
                    }}
                  >
                    {formatSlotTime(slot.slotStart, isAr)}
                  </button>
                );
              })}
            </div>
          )}
        </Card>
        <PrimaryButton onClick={handleReschedule} disabled={saving || !selectedSlot}>
          {saving ? t('Updating Slot...', 'جارٍ تحديث الموعد...') : t('Confirm New Time Slot', 'تأكيد الموعد الجديد')}
        </PrimaryButton>
      </div>
    </div>
  );
}

export function C43({ params }) {
  const { t } = usePrefs();
  const { go, back } = useNav();
  const c = useColors();
  const qc = useQueryClient();
  const { data: bookings = [] } = useBookings();
  const booking = bookings.find((b) => b.id === params?.id) || bookings[0] || null;
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleCancel = async () => {
    setErr('');
    if (!reason) {
      setErr(t('Please select a cancellation reason.', 'يرجى اختيار سبب الإلغاء.'));
      return;
    }
    if (!booking?.id) {
      go('C37');
      return;
    }
    setSaving(true);
    try {
      await post(`/centers/bookings/${booking.id}/cancel`, { reason });
      qc.invalidateQueries({ queryKey: k.bookings });
      go('C37');
    } catch (ex) {
      setErr(ex.message || t('Could not cancel booking', 'تعذر إلغاء الحجز'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar title={t('Cancel Center Booking', 'إلغاء حجز مركز الخدمة')} onBack={back} />
      <div className="px-4 pt-4 space-y-4">
        {err && <Banner tone="danger" title={err} />}
        <Card>
          <div className="text-sm font-bold mb-2" style={{ color: c.text }}>
            {booking?.centerName || t('Service Center Appointment', 'موعد مركز الخدمة')} {booking?.code ? `(${booking.code})` : ''}
          </div>
          <SelectField
            label={t('Reason for Cancellation', 'سبب الإلغاء')}
            value={reason}
            onChange={setReason}
            testId="field-cancelReason"
            options={[
              { value: '', label: t('Select a reason...', 'اختر سبب الإلغاء...') },
              { value: 'Schedule conflict', label: t('Schedule conflict', 'تعارض في المواعيد') },
              { value: 'Booked wrong date/service', label: t('Booked wrong date or service', 'تم حجز موعد أو خدمة بالخطأ') },
              { value: 'Problem already resolved', label: t('Vehicle issue already resolved', 'تم إصلاح السيارة بالفعل') },
            ]}
          />
        </Card>
        <PrimaryButton tone="danger" testId="screen-primary" onClick={handleCancel} disabled={saving || !reason}>
          {saving ? t('Cancelling...', 'جارٍ الإلغاء...') : t('Confirm Booking Cancellation', 'تأكيد إلغاء الحجز')}
        </PrimaryButton>
      </div>
    </div>
  );
}

export function C40({ params }) {
  const { t, isAr } = usePrefs();
  const { back } = useNav();
  const c = useColors();
  const qc = useQueryClient();
  const { data: centers = [] } = useCenters();
  const { data: bookings = [] } = useBookings();
  const centerId = params?.centerId || params?.id || centers[0]?.id;
  const center = centers.find((x) => x.id === centerId) || null;
  const bookingId = params?.bookingId
    || bookings.find((b) => b.centerId === centerId && b.status === 'Completed')?.id
    || bookings.find((b) => b.centerId === centerId)?.id
    || bookings[0]?.id;
  const { data: reviews = [] } = useReviews('center', centerId);

  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const [recommend, setRecommend] = useState(false);
  const [starFilter, setStarFilter] = useState('all');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [starsErr, setStarsErr] = useState('');

  const stats = useMemo(() => {
    const count = reviews.length;
    if (count === 0) return { avg: 0, count: 0, recPct: 0, buckets: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
    const buckets = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;
    let recCount = 0;
    for (const r of reviews) {
      const s = Math.min(5, Math.max(1, Number(r.stars ?? 5)));
      buckets[s] = (buckets[s] ?? 0) + 1;
      sum += s;
      if (r.recommend) recCount += 1;
    }
    return {
      avg: sum / count,
      count,
      recPct: Math.round((100 * recCount) / count),
      buckets,
    };
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    if (starFilter === 'positive') return reviews.filter((r) => Number(r.stars ?? 0) >= 4);
    if (starFilter === 'critical') return reviews.filter((r) => Number(r.stars ?? 0) <= 3);
    return reviews;
  }, [reviews, starFilter]);

  const handlePostReview = async () => {
    setErr('');
    setStarsErr('');
    if (stars < 1) {
      const msg = t('Please select a star rating (1–5).', 'يرجى اختيار تقييم بالنجوم (من ١ إلى ٥).');
      setStarsErr(msg);
      setErr(msg);
      return;
    }
    if (!bookingId) {
      setErr(t('Only customers with a completed workshop visit can submit a review.', 'يمكن فقط للعملاء الذين أتموا زيارة صيانة مكتملة إضافة تقييم.'));
      return;
    }
    if (centerId && bookingId) {
      try {
        await post(`/reviews/center/${centerId}?bookingId=${bookingId}`, {
          stars,
          text: text.trim() || null,
          recommend,
        });
        qc.invalidateQueries({ queryKey: k.reviews('center', centerId) });
        qc.invalidateQueries({ queryKey: k.centers });
        qc.invalidateQueries({ queryKey: ['centers', centerId] });
        setSent(true);
      } catch (ex) {
        setErr(ex.message || t('Could not submit review', 'تعذر إرسال التقييم'));
      }
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar title={center?.name || t('Service Center Reviews', 'تقييمات مركز الخدمة')} onBack={back} />
      <div className="px-4 pt-4 space-y-4">
        {/* Aggregate Rating & Distribution Card */}
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-2xl font-black" style={{ color: c.text }}>
                {stats.count > 0 ? stats.avg.toFixed(1) : '—'}
              </div>
              <StarRating value={stats.avg} size={15} />
              <div className="text-[11px]" style={{ color: c.text2 }}>
                {stats.count > 0
                  ? `${pluralCount(stats.count, 'review', 'reviews', 'تقييم', 'تقييمات', 'تقييماً', isAr)} • 👍 ${stats.recPct}%`
                  : t('No verified reviews yet', 'لا توجد تقييمات موثقة بعد')}
              </div>
            </div>
            {stats.count > 0 && (
              <div className="flex-1 max-w-[180px] space-y-1">
                {[5, 4, 3, 2, 1].map((s) => {
                  const pct = Math.round(((stats.buckets[s] ?? 0) / stats.count) * 100);
                  return (
                    <div key={s} className="flex items-center gap-1.5 text-[10px]" style={{ color: c.text2 }}>
                      <span className="w-3 font-bold">{s}★</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: c.surface2 }}>
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-6 text-end">{stats.buckets[s] ?? 0}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        {err && <Banner tone="danger" title={err} />}
        <Card>
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: c.text3 }}>
            {t('Rate Your Workshop Visit', 'قيّم زيارتك لمركز الخدمة')}
          </div>
          <div
            className={`my-2 p-2 rounded-xl border transition ${starsErr ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-500/5' : 'border-transparent'}`}
            data-testid="star-rating-picker"
          >
            <StarRating
              value={stars}
              onChange={(val) => {
                setStars(val);
                if (starsErr) setStarsErr('');
              }}
              size={28}
            />
            {starsErr && <p className="text-[11px] font-semibold text-rose-500 mt-1">{starsErr}</p>}
          </div>
          <InputField
            label={t('Your Review (Optional)', 'تعليقك (اختياري)')}
            value={text}
            onChange={setText}
            testId="field-reviewText"
            placeholder={t('Genuine parts, transparent diagnostics...', 'قطع غيار أصلية وفحص دقيق...')}
          />
          <div className="flex items-center justify-between pt-1 pb-3">
            <span className="text-xs font-semibold" style={{ color: c.text }}>
              {t('Would you recommend this workshop?', 'هل توصي بمركز الخدمة هذا؟')}
            </span>
            <ToggleSwitch checked={recommend} onChange={setRecommend} testId="toggle-recommend" />
          </div>
          {sent && <Banner tone="success" title={t('Thank you! Your review has been recorded.', 'شكراً لك! تم تسجيل تقييمك.')} />}
          <PrimaryButton testId="screen-primary" onClick={handlePostReview} disabled={stars < 1}>
            {t('Submit Workshop Review', 'إرسال تقييم المركز')}
          </PrimaryButton>
        </Card>

        <div className="flex items-center justify-between gap-2">
          <SectionHeader title={t(`Verified Customer Reviews (${filteredReviews.length})`, `تقييمات العملاء الموثقة (${filteredReviews.length})`)} />
        </div>
        {reviews.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'all', en: `All (${reviews.length})`, ar: `الكل (${reviews.length})` },
              { id: 'positive', en: '4★ & 5★', ar: '٤ و٥ نجوم' },
              { id: 'critical', en: '3★ & below', ar: '٣ نجوم فأقل' },
            ].map((chip) => (
              <Chip key={chip.id} active={starFilter === chip.id} onClick={() => setStarFilter(chip.id)}>
                {t(chip.en, chip.ar)}
              </Chip>
            ))}
          </div>
        )}

        {filteredReviews.map((r) => (
          <Card key={r.id}>
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar name={r.authorName || 'Customer'} size={30} />
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate" style={{ color: c.text }}>
                    {r.authorName || t('Verified Customer', 'عميل موثق')}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StarRating value={r.stars} size={12} />
                    {r.recommend && (
                      <span className="text-[10px] font-bold" style={{ color: c.success }}>
                        ✓ {t('Recommends', 'يوصي بالمركز')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <span className="text-[10px] shrink-0" style={{ color: c.text3 }}>
                {new Date(r.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB')}
              </span>
            </div>
            {r.contextLabel && (
              <div className="text-[10px] font-semibold mb-1" style={{ color: c.accent }}>
                🔧 {r.contextLabel}
              </div>
            )}
            {r.text ? (
              <p className="text-xs" style={{ color: c.text }}>{r.text}</p>
            ) : (
              <p className="text-xs italic" style={{ color: c.text3 }}>{t('Rated without written comment.', 'تقييم بدون تعليق نصي.')}</p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C20 — REQUEST & TRIP HISTORY
// ---------------------------------------------------------------------------
export function C20() {
  const { t, isAr } = usePrefs();
  const { go, back } = useNav();
  const c = useColors();
  const { data: requests = [] } = useRequests();
  const [filter, setFilter] = useState('all');

  const filtered = requests.filter((r) => {
    if (filter === 'completed') return r.status === 'Completed';
    if (filter === 'cancelled') return r.status === 'Cancelled';
    if (filter === 'active') return !['Completed', 'Cancelled'].includes(r.status);
    return true;
  });

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar title={t('Roadside Request History', 'سجل طلبات الطريق')} onBack={back} />
      <div className="px-4 pt-3 space-y-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'all', en: 'All Requests', ar: 'كل الطلبات' },
            { id: 'active', en: 'In Progress', ar: 'الجارية' },
            { id: 'completed', en: 'Completed', ar: 'المكتملة' },
            { id: 'cancelled', en: 'Cancelled', ar: 'الملغاة' },
          ].map((tab) => (
            <Chip key={tab.id} active={filter === tab.id} onClick={() => setFilter(tab.id)}>
              {t(tab.en, tab.ar)}
            </Chip>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon="🧾"
            title={t('No Requests in This View', 'لا توجد طلبات في هذا القسم')}
            subtitle={t('Your roadside tow and mobile mechanic dispatches appear here.', 'تظهر هنا جميع طلبات الونش والميكانيكي المتنقل.')}
            action={<PrimaryButton onClick={() => go('C06')}>{t('New Roadside Request', 'طلب مساعدة جديد')}</PrimaryButton>}
          />
        ) : (
          filtered.map((r) => (
            <Card
              key={r.id}
              onClick={() => go('C21', { id: r.id })}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-extrabold" style={{ color: c.text }}>{r.code}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: c.surface2, color: c.text2 }}>
                    {formatLabel(r.kind, isAr)}
                  </span>
                </div>
                <StatusBadge status={r.status} />
              </div>

              <div className="text-xs font-semibold" style={{ color: c.text }}>
                📍 {r.pickupAddress}
              </div>
              {r.vehicleMake && (
                <div className="text-[11px] mt-0.5" style={{ color: c.text2 }}>
                  🚗 {r.vehicleMake} {r.vehicleModel} ({r.vehiclePlate})
                </div>
              )}

              <div className="flex items-center justify-between mt-2.5 pt-2 border-t text-xs" style={{ borderColor: c.border }}>
                <span style={{ color: c.text3 }}>
                  {fmtDateTime(r.createdAt, isAr ? 'ar' : 'en')}
                </span>
                <span className="font-extrabold" style={{ color: c.accent }}>
                  {egp(r.quoteMinor ?? r.estimateMinor ?? 0, isAr)}
                </span>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C21 (TRIP DETAIL), C22 (NOTIFICATIONS), C23 (PROFILE & SETTINGS HUB)
// ---------------------------------------------------------------------------
export function C21({ params }) {
  const { t, isAr } = usePrefs();
  const { go, back } = useNav();
  const c = useColors();
  const { data: requests = [] } = useRequests();
  const req = requests.find((r) => r.id === params?.id) || requests[0] || null;
  const defaultPickLat = 30.0276;
  const defaultPickLon = 31.4913;

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar title={t('Trip Details', 'تفاصيل الرحلة والطلب')} onBack={back} />
      <div className="px-4 pt-4 space-y-4">
        <MapView
          height={160}
          markers={[{ lat: req?.pickupLatitude ?? defaultPickLat, lng: req?.pickupLongitude ?? defaultPickLon, label: req?.code || 'Trip' }]}
        />

        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-sm font-extrabold" style={{ color: c.text }}>{req?.code || '—'}</span>
            <StatusBadge status={req?.status || 'Completed'} />
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span style={{ color: c.text2 }}>{t('Service Kind', 'نوع الخدمة')}</span>
              <span className="font-bold" style={{ color: c.text }}>{formatLabel(req?.kind || 'Tow', isAr)}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: c.text2 }}>{t('Pickup Location', 'موقع الالتقاط')}</span>
              <span className="font-bold text-end max-w-[190px]" style={{ color: c.text }}>
                {req?.pickupAddress || '—'}
              </span>
            </div>
            {req?.destinationAddress && (
              <div className="flex justify-between">
                <span style={{ color: c.text2 }}>{t('Destination', 'الوجهة')}</span>
                <span className="font-bold text-end max-w-[190px]" style={{ color: c.text }}>{req.destinationAddress}</span>
              </div>
            )}
            {req?.providerName && (
              <div className="flex justify-between">
                <span style={{ color: c.text2 }}>{t('Assigned Specialist', 'مقدم الخدمة')}</span>
                <span className="font-bold" style={{ color: c.text }}>{req.providerName}</span>
              </div>
            )}
            <Divider className="my-2" />
            <div className="flex justify-between text-sm font-extrabold">
              <span style={{ color: c.text }}>{t('Total Amount', 'إجمالي التكلفة')}</span>
              <span style={{ color: c.accent }}>{egp(req?.quoteMinor ?? req?.estimateMinor ?? 0, isAr)}</span>
            </div>
          </div>
        </Card>

        <div className="space-y-2">
          <PrimaryButton onClick={() => go('C15', { id: req?.id })}>
            {t('View Digital Invoice & Receipt', 'عرض الفاتورة والإيصال الرقمي')}
          </PrimaryButton>
          <SecondaryButton onClick={() => go('C42', { id: req?.id })}>
            {t('View Status Timeline', 'عرض السجل الزمني للطلب')}
          </SecondaryButton>
          <SecondaryButton onClick={() => go('SH01', { requestId: req?.id })}>
            {t('Open Trip Chat', 'فتح محادثة الطلب')}
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}

export function C22() {
  const { t, isAr } = usePrefs();
  const { go, back } = useNav();
  const { user } = useSession();
  const c = useColors();
  const qc = useQueryClient();
  const { data: notifications = [] } = useNotifications();
  const markReadMut = useMarkRead();

  const handleMarkAll = async () => {
    await post('/notifications/read-all', {});
    qc.invalidateQueries({ queryKey: k.notifications });
    qc.invalidateQueries({ queryKey: k.unread });
  };

  const handleOpenNotification = (n) => {
    if (!n.isRead) markReadMut.mutate([n.id]);
    if (n.deepLink) {
      const resolved = resolveDeepLink(n.deepLink, user?.role);
      if (resolved?.code) go(resolved.code, resolved.params);
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar
        title={t('Notifications', 'الإشعارات')}
        onBack={back}
        right={
          notifications.some((n) => !n.isRead) && (
            <button
              type="button"
              onClick={handleMarkAll}
              className="text-xs font-bold"
              style={{ color: c.accent }}
            >
              {t('Mark All Read', 'تحديد الكل كمقروء')}
            </button>
          )
        }
      />
      <div className="px-4 pt-3 space-y-2.5">
        {notifications.length === 0 ? (
          <EmptyState
            icon="🔔"
            title={t('All Caught Up!', 'لا توجد إشعارات جديدة')}
            subtitle={t('Real-time updates on offers, provider arrival, quotes and bookings appear here.', 'تظهر هنا التحديثات الفورية للعروض ووصول مقدم الخدمة والفواتير.')}
          />
        ) : (
          notifications.map((n) => {
            const loc = localizeNotificationText(n, isAr);
            return (
              <Card
                key={n.id}
                onClick={() => handleOpenNotification(n)}
                style={{
                  borderLeft: !n.isRead && !isAr ? `4px solid ${c.accent}` : undefined,
                  borderRight: !n.isRead && isAr ? `4px solid ${c.accent}` : undefined,
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold" style={{ color: c.text }}>{loc.title}</span>
                  <span className="text-[10px]" style={{ color: c.text3 }}>
                    {formatSlotTime(n.createdAt, isAr)}
                  </span>
                </div>
                <p className="text-xs" style={{ color: c.text2 }}>{loc.body}</p>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

export function C23() {
  const { t, isAr } = usePrefs();
  const { go } = useNav();
  const { user } = useSession();
  const c = useColors();

  const links = [
    { code: 'SH12', icon: '👤', en: 'Edit Account Details', ar: 'تعديل بيانات الحساب' },
    { code: 'SH01', icon: '💬', en: 'Messages & Active Chats', ar: 'المحادثات والرسائل النشطة' },
    { code: 'C04', icon: '🚗', en: 'My Vehicles', ar: 'مركباتي المحفوظة' },
    { code: 'C34', icon: '💳', en: 'Saved Payment Methods', ar: 'وسائل الدفع المحفوظة' },
    { code: 'C37', icon: '📅', en: 'My Service Center Bookings', ar: 'حجوزات مراكز الخدمة' },
    { code: 'C20', icon: '🧾', en: 'Roadside Request History', ar: 'سجل طلبات الطريق' },
    { code: 'C22', icon: '🔔', en: 'Notifications Inbox', ar: 'صندوق الإشعارات' },
    { code: 'SH06', icon: '🌐', en: 'App Settings (Language & Theme)', ar: 'إعدادات التطبيق (اللغة والمظهر)' },
    { code: 'SH10', icon: '⚙️', en: 'Notification Preferences', ar: 'تفضيلات الإشعارات' },
    { code: 'SH02', icon: '🔒', en: 'Change Password', ar: 'تغيير كلمة المرور' },
    { code: 'AD13', icon: '🛡️', en: 'Two-Factor Authentication (2FA)', ar: 'المصادقة الثنائية (2FA)' },
    { code: 'AD14', icon: '📱', en: 'Active Devices & Sessions', ar: 'الأجهزة والجلسات النشطة' },
    { code: 'SH07', icon: '🎧', en: 'Help & Support Center', ar: 'مركز المساعدة والدعم' },
    { code: 'SH05', icon: '📜', en: 'Terms of Service & Privacy Policy', ar: 'الشروط وسياسة الخصوصية' },
    { code: 'SH11', icon: 'ℹ️', en: 'About FixNGo', ar: 'عن منصة فيكس آند جو' },
    { code: 'SH21', icon: '🗑️', en: 'Request Account Deletion', ar: 'طلب حذف الحساب' },
    { code: 'SH13', icon: '🚪', en: 'Sign Out', ar: 'تسجيل الخروج' },
  ];

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar title={t('Profile & Settings', 'الملف الشخصي والإعدادات')} />
      <div className="px-4 pt-4 space-y-4">
        <Card>
          <div className="flex items-start gap-3">
            <div className="shrink-0">
              <Avatar name={user?.fullName || t('Car Owner', 'مالك السيارة')} size={52} />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-base font-extrabold truncate" style={{ color: c.text }}>
                  {user?.fullName || t('Car Owner', 'مالك السيارة')}
                </div>
                <StatusBadge status={user?.status || 'Active'} />
              </div>
              <div className="text-xs truncate text-start" dir="ltr" style={{ color: c.text2 }}>{user?.email || ''}</div>
              <div className="text-xs truncate text-start" dir="ltr" style={{ color: c.text3 }}>{user?.phone || ''}</div>
            </div>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          {links.map((item, idx) => (
            <button
              key={item.code}
              type="button"
              onClick={() => go(item.code)}
              className="w-full px-4 py-3 text-start flex items-center justify-between text-xs font-bold transition-all"
              style={{
                color: item.code === 'SH21' || item.code === 'SH13' ? c.danger : c.text,
                borderBottom: idx < links.length - 1 ? `1px solid ${c.border}` : 'none',
              }}
            >
              <span className="flex items-center gap-2.5">
                <span className="text-base">{item.icon}</span>
                <span>{t(item.en, item.ar)}</span>
              </span>
              <span style={{ color: c.text3 }}>{isAr ? '‹' : '›'}</span>
            </button>
          ))}
        </Card>
      </div>
    </div>
  );
}
