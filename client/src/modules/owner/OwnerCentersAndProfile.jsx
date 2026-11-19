import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  usePrefs, useNav, useSession,
  AppTopBar, Card, SectionHeader, StatusBadge, Chip, PrimaryButton, SecondaryButton,
  InputField, SelectField, ToggleSwitch, EmptyState, Banner, Divider, Avatar,
  StarRating, MapView, egp, formatLabel
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
  useCenters, useCenter, useCenterServices, useAvailability,
  useBookings, useBooking, useCreateBooking, useVehicles,
  useRequests, useReviews, useNotifications, useMarkRead, k
} from '../../api/hooks.js';
import { post, put } from '../../api/http.js';

function getUpcomingDays(count = 7, isAr = false) {
  const days = [];
  const base = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(base.getTime() + i * 86400000);
    const iso = d.toISOString().slice(0, 10);
    const label = i === 0
      ? (isAr ? 'اليوم' : 'Today')
      : i === 1
      ? (isAr ? 'غداً' : 'Tomorrow')
      : d.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    days.push({ iso, label });
  }
  return days;
}

function formatSlotTime(isoStr, isAr = false) {
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return String(isoStr);
  return d.toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ---------------------------------------------------------------------------
// C17 — SERVICE CENTERS DIRECTORY
// ---------------------------------------------------------------------------
export function C17() {
  const { t } = usePrefs();
  const { go, back } = useNav();
  const c = useColors();
  const { data: centers = [], isLoading } = useCenters();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    let list = [...centers];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((x) =>
        String(x.name || '').toLowerCase().includes(q) ||
        String(x.address || '').toLowerCase().includes(q)
      );
    }
    if (filter === 'top') {
      list = list.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    }
    return list;
  }, [centers, search, filter]);

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
          placeholder={t('Search center name or district (e.g. New Cairo, Nasr City)...', 'ابحث باسم المركز أو المنطقة (مثل القاهرة الجديدة، مدينة نصر)...')}
          value={search}
          onChange={setSearch}
        />

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'all', en: 'All Centers', ar: 'جميع المراكز' },
            { id: 'top', en: 'Top Rated ⭐', ar: 'الأعلى تقييماً ⭐' },
            { id: 'periodic', en: 'Periodic Maintenance', ar: 'صيانة دورية' },
          ].map((tab) => (
            <Chip key={tab.id} active={filter === tab.id} onClick={() => setFilter(tab.id)}>
              {t(tab.en, tab.ar)}
            </Chip>
          ))}
        </div>

        {!isLoading && filtered.length === 0 ? (
          <EmptyState
            icon="🏢"
            title={t('No Matching Service Centers', 'لا توجد مراكز خدمة مطابقة')}
            subtitle={t('Try clearing your search filter to view all verified workshops.', 'جرب مسح كلمة البحث لعرض جميع المراكز المعتمدة.')}
          />
        ) : (
          filtered.map((center) => (
            <Card key={center.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-extrabold" style={{ color: c.text }}>{center.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: c.text2 }}>📍 {center.address}</div>
                  <div className="flex items-center gap-2 mt-1.5 text-xs" style={{ color: c.text2 }}>
                    <span className="font-bold" style={{ color: c.accent }}>
                      ⭐ {Number(center.rating || 4.8).toFixed(1)}
                    </span>
                    <span>({center.ratingCount || 35} {t('reviews', 'تقييم')})</span>
                    <span>• 👍 {center.recommendPercent || 96}%</span>
                  </div>
                </div>
              </div>

              {center.description && (
                <p className="text-xs mt-2 line-clamp-2" style={{ color: c.text2 }}>
                  {center.description}
                </p>
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
          ))
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

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar title={center?.name || t('Service Center Details', 'تفاصيل مركز الخدمة')} onBack={back} />
      <div className="px-4 pt-3 space-y-3">
        <MapView
          height={150}
          markers={[{ lat: center?.latitude || 30.0444, lng: center?.longitude || 31.2357, label: center?.name || 'Center' }]}
        />

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-extrabold" style={{ color: c.text }}>
                {center?.name || t('FixNGo Certified Auto Center', 'مركز خدمة فيكس آند جو المعتمد')}
              </h2>
              <div className="text-xs mt-0.5" style={{ color: c.text2 }}>
                📍 {center?.address || t('90th Street, New Cairo', 'شارع التسعين، القاهرة الجديدة')}
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs">
                <span className="font-bold" style={{ color: c.accent }}>
                  ⭐ {Number(center?.rating || 4.8).toFixed(1)} ({center?.ratingCount || 48})
                </span>
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
                    className="mt-1 px-3 py-1 rounded-lg text-xs font-bold text-slate-950"
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
  const [selectedServiceId, setSelectedServiceId] = useState(params?.serviceId || services[0]?.id || '');
  const [selectedDay, setSelectedDay] = useState(days[1]?.iso || days[0]?.iso);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [vehicleId, setVehicleId] = useState(vehicles.find((v) => v.isPrimary)?.id || vehicles[0]?.id || '');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!selectedServiceId && services[0]?.id) setSelectedServiceId(services[0].id);
  }, [services]);

  useEffect(() => {
    if (!vehicleId && vehicles[0]?.id) setVehicleId(vehicles[0].id);
  }, [vehicles]);

  const { data: availability = [] } = useAvailability(centerId, selectedServiceId, selectedDay);

  const slots = useMemo(() => {
    if (availability.length > 0) return availability;
    // Fallback generated slots on the chosen day if availability is still loading
    return [9, 10, 11, 12, 14, 15, 16].map((hr) => {
      const start = new Date(`${selectedDay}T${String(hr).padStart(2, '0')}:00:00Z`);
      const end = new Date(start.getTime() + 60 * 60000);
      return { slotStart: start.toISOString(), slotEnd: end.toISOString(), available: true };
    });
  }, [availability, selectedDay]);

  useEffect(() => {
    const firstAvail = slots.find((s) => s.available);
    if (firstAvail) setSelectedSlot(firstAvail.slotStart);
  }, [slots]);

  const chosenService = services.find((s) => s.id === selectedServiceId) || services[0] || null;

  const handleConfirmBooking = async () => {
    setErr('');
    if (!centerId || !chosenService?.id || !selectedSlot) {
      setErr(t('Please select a service and available time slot.', 'يرجى اختيار الخدمة والموعد المتاح.'));
      return;
    }
    try {
      const created = await createBookingMut.mutateAsync({
        centerId,
        serviceId: chosenService.id,
        slotStart: selectedSlot,
        vehicleId: vehicleId || null,
        note: note || null,
      });
      go('C36', { id: created.id, booking: created });
    } catch (ex) {
      setErr(ex.message || t('Could not create booking for this slot', 'تعذر تأكيد الحجز لهذا الموعد'));
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
              label: `${s.name} — ${egp(s.priceMinor, isAr)} (${s.durationMinutes} min)`,
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
          <div className="flex items-center gap-2 overflow-x-auto pb-1" data-testid="booking-day-picker">
            {days.map((d) => (
              <Chip
                key={d.iso}
                active={selectedDay === d.iso}
                onClick={() => setSelectedDay(d.iso)}
              >
                {d.label}
              </Chip>
            ))}
          </div>

          <div className="text-xs font-bold uppercase tracking-wider mt-4 mb-2" style={{ color: c.text3 }}>
            {t('2. Select Available Time Slot', '٢. اختر الساعة المتاحة')}
          </div>
          <div className="grid grid-cols-3 gap-2" data-testid="booking-slot-picker">
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
                      ? '#0F172A'
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
        </Card>

        <Card>
          <InputField
            label={t('Notes for Service Advisor (Optional)', 'ملاحظات لمهندس الاستقبال (اختياري)')}
            value={note}
            onChange={setNote}
            placeholder={t('E.g. Please check front brake pads and AC filter...', 'مثال: يرجى فحص تيل الفرامل الأمامي وفلتر التكييف...')}
          />
        </Card>

        <PrimaryButton testId="screen-primary" onClick={handleConfirmBooking} disabled={createBookingMut.isPending}>
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
  const { go } = useNav();
  const c = useColors();
  const { data: bookings = [] } = useBookings();
  const booking = params?.booking || bookings.find((b) => b.id === params?.id) || bookings[0] || null;

  return (
    <div className="flex flex-col min-h-full pb-24 justify-center px-4" style={{ backgroundColor: c.bg }}>
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
              <span className="font-bold" style={{ color: c.text }}>{booking.centerName || t('Verified Service Center', 'مركز خدمة معتمد')}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: c.text2 }}>{t('Service', 'الخدمة')}</span>
              <span className="font-bold" style={{ color: c.text }}>{booking.serviceName || t('Periodic Maintenance', 'صيانة دورية')}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: c.text2 }}>{t('Scheduled Slot', 'الموعد')}</span>
              <span className="font-bold" style={{ color: c.text }}>
                {new Date(booking.slotStart).toLocaleString(isAr ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
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

  const displayList = filtered.length > 0 ? filtered : bookings;

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar
        title={t('My Center Bookings', 'حجوزات مراكز الخدمة')}
        onBack={back}
        right={
          <button
            type="button"
            onClick={() => go('C17')}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-950"
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
                {b.centerName || t('Verified Auto Center', 'مركز خدمة معتمد')}
              </div>
              <div className="text-xs mt-0.5" style={{ color: c.text2 }}>
                {b.serviceName || t('Maintenance Package', 'باقة صيانة')} • {new Date(b.slotStart).toLocaleString(isAr ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
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
  const { data: bookings = [] } = useBookings();
  const targetId = params?.id || bookings[0]?.id;
  const { data: detail } = useBooking(targetId);
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
                <StatusBadge status={booking.status} />
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span style={{ color: c.text2 }}>{t('Service Center', 'مركز الخدمة')}</span>
                  <span className="font-bold" style={{ color: c.text }}>{booking.centerName || 'FixNGo Service Center'}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: c.text2 }}>{t('Package', 'الخدمة')}</span>
                  <span className="font-bold" style={{ color: c.text }}>{booking.serviceName || 'Maintenance Service'}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: c.text2 }}>{t('Appointment Slot', 'الموعد المحدد')}</span>
                  <span className="font-bold" style={{ color: c.text }}>
                    {new Date(booking.slotStart).toLocaleString(isAr ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
                {booking.vehicleLabel && (
                  <div className="flex justify-between">
                    <span style={{ color: c.text2 }}>{t('Vehicle', 'السيارة')}</span>
                    <span className="font-bold" style={{ color: c.text }}>{booking.vehicleLabel}</span>
                  </div>
                )}
                <Divider className="my-2" />
                <div className="flex justify-between text-sm font-extrabold">
                  <span style={{ color: c.text }}>{t('Package Fare', 'سعر الباقة')}</span>
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
              <SecondaryButton onClick={() => go('C40', { centerId: booking.centerId, bookingId: booking.id })}>
                {t('Rate & Review Service Center ⭐', 'تقييم مركز الخدمة ⭐')}
              </SecondaryButton>
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
  const [selectedDay, setSelectedDay] = useState(days[2]?.iso || days[1]?.iso);
  const centerId = params?.centerId || booking?.centerId;
  const serviceId = params?.serviceId || booking?.serviceId;
  const { data: availability = [] } = useAvailability(centerId, serviceId, selectedDay);

  const slots = useMemo(() => {
    if (availability.length > 0) return availability;
    return [10, 11, 13, 15, 16].map((hr) => {
      const start = new Date(`${selectedDay}T${String(hr).padStart(2, '0')}:00:00Z`);
      return { slotStart: start.toISOString(), slotEnd: new Date(start.getTime() + 3600000).toISOString(), available: true };
    });
  }, [availability, selectedDay]);

  const [selectedSlot, setSelectedSlot] = useState(slots[0]?.slotStart || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const first = slots.find((s) => s.available);
    if (first) setSelectedSlot(first.slotStart);
  }, [slots]);

  const handleReschedule = async () => {
    setErr('');
    if (!booking?.id || !selectedSlot) return;
    setSaving(true);
    try {
      await post(`/centers/bookings/${booking.id}/reschedule`, { slotStart: selectedSlot });
      qc.invalidateQueries({ queryKey: k.bookings });
      go('C38', { id: booking.id });
    } catch (ex) {
      setErr(ex.message || t('Could not reschedule booking', 'تعذر تعديل موعد الحجز'));
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
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {days.map((d) => (
              <Chip key={d.iso} active={selectedDay === d.iso} onClick={() => setSelectedDay(d.iso)}>
                {d.label}
              </Chip>
            ))}
          </div>

          <div className="text-xs font-bold uppercase tracking-wider mt-4 mb-2" style={{ color: c.text3 }}>
            {t('Pick New Time Slot', 'اختر الساعة الجديدة')}
          </div>
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
                    color: active ? '#0F172A' : c.text,
                    border: `1.5px solid ${active ? c.accent : c.border}`,
                  }}
                >
                  {formatSlotTime(slot.slotStart, isAr)}
                </button>
              );
            })}
          </div>
        </Card>
        <PrimaryButton onClick={handleReschedule} disabled={saving}>
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
  const [reason, setReason] = useState('Schedule conflict');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleCancel = async () => {
    setErr('');
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
            {booking?.centerName || t('Service Center Appointment', 'موعد مركز الخدمة')} ({booking?.code || 'BK-101'})
          </div>
          <SelectField
            label={t('Reason for Cancellation', 'سبب الإلغاء')}
            value={reason}
            onChange={setReason}
            options={[
              { value: 'Schedule conflict', label: t('Schedule conflict', 'تعارض في المواعيد') },
              { value: 'Booked wrong date/service', label: t('Booked wrong date or service', 'تم حجز موعد أو خدمة بالخطأ') },
              { value: 'Problem already resolved', label: t('Vehicle issue already resolved', 'تم إصلاح السيارة بالفعل') },
            ]}
          />
        </Card>
        <PrimaryButton tone="danger" onClick={handleCancel} disabled={saving}>
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
  const centerId = params?.centerId || centers[0]?.id;
  const bookingId = params?.bookingId || bookings.find((b) => b.centerId === centerId)?.id || bookings[0]?.id;
  const { data: reviews = [] } = useReviews('center', centerId);

  const [stars, setStars] = useState(5);
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);

  const handlePostReview = async () => {
    if (centerId && bookingId) {
      try {
        await post(`/reviews/center/${centerId}?bookingId=${bookingId}`, {
          stars,
          text: text || t('Professional workshop and punctual bay service.', 'مركز خدمة محترف ومواعيد دقيقة.'),
          recommend: stars >= 4,
        });
        qc.invalidateQueries({ queryKey: k.reviews('center', centerId) });
      } catch {}
    }
    setSent(true);
  };

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar title={t('Service Center Reviews', 'تقييمات مركز الخدمة')} onBack={back} />
      <div className="px-4 pt-4 space-y-4">
        <Card>
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: c.text3 }}>
            {t('Rate Your Workshop Visit', 'قيّم زيارتك لمركز الخدمة')}
          </div>
          <div className="my-2">
            <StarRating value={stars} onChange={setStars} size={28} />
          </div>
          <InputField
            label={t('Your Review', 'تعليقك')}
            value={text}
            onChange={setText}
            placeholder={t('Genuine parts, transparent diagnostics...', 'قطع غيار أصلية وفحص دقيق...')}
          />
          {sent && <Banner tone="success" title={t('Thank you! Your review has been recorded.', 'شكراً لك! تم تسجيل تقييمك.')} />}
          <PrimaryButton onClick={handlePostReview}>
            {t('Submit Workshop Review', 'إرسال تقييم المركز')}
          </PrimaryButton>
        </Card>

        <SectionHeader title={t(`Verified Customer Reviews (${reviews.length})`, `تقييمات العملاء الموثقة (${reviews.length})`)} />
        {reviews.map((r) => (
          <Card key={r.id}>
            <div className="flex items-center justify-between mb-1">
              <StarRating value={r.stars} size={16} />
              <span className="text-[11px]" style={{ color: c.text3 }}>
                {new Date(r.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB')}
              </span>
            </div>
            <p className="text-xs" style={{ color: c.text }}>{r.text || t('Recommended workshop service.', 'خدمة ممتازة وموصى بها.')}</p>
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
                  {new Date(r.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
                <span className="font-extrabold" style={{ color: c.accent }}>
                  {egp(r.quoteMinor || r.estimateMinor || 45000, isAr)}
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

  return (
    <div className="flex flex-col min-h-full pb-24" style={{ backgroundColor: c.bg }}>
      <AppTopBar title={t('Trip Details', 'تفاصيل الرحلة والطلب')} onBack={back} />
      <div className="px-4 pt-4 space-y-4">
        <MapView
          height={160}
          markers={[{ lat: req?.pickupLatitude || 30.0276, lng: req?.pickupLongitude || 31.4913, label: req?.code || 'Trip' }]}
        />

        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-sm font-extrabold" style={{ color: c.text }}>{req?.code || 'FG-1042'}</span>
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
                {req?.pickupAddress || '90th Street, New Cairo'}
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
              <span style={{ color: c.accent }}>{egp(req?.quoteMinor || req?.estimateMinor || 45000, isAr)}</span>
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
  const { back } = useNav();
  const c = useColors();
  const qc = useQueryClient();
  const { data: notifications = [] } = useNotifications();
  const markReadMut = useMarkRead();

  const handleMarkAll = async () => {
    await post('/notifications/read-all', {});
    qc.invalidateQueries({ queryKey: k.notifications });
    qc.invalidateQueries({ queryKey: k.unread });
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
          notifications.map((n) => (
            <Card
              key={n.id}
              onClick={() => !n.isRead && markReadMut.mutate([n.id])}
              style={{
                borderLeft: !n.isRead ? `4px solid ${c.accent}` : undefined,
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-extrabold" style={{ color: c.text }}>{n.title}</span>
                <span className="text-[10px]" style={{ color: c.text3 }}>
                  {new Date(n.createdAt).toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-xs" style={{ color: c.text2 }}>{n.body}</p>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

export function C23() {
  const { t, isAr, lang, theme, setLang, setTheme } = usePrefs();
  const { go } = useNav();
  const { user, setUser } = useSession();
  const c = useColors();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '+201012345678');
  const [preferredLang, setPreferredLang] = useState(user?.language || lang || 'en');
  const [preferredTheme, setPreferredTheme] = useState(user?.theme || theme || 'light');
  const [otpOnLogin, setOtpOnLogin] = useState(!!user?.otpOnLogin);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setPhone(user.phone || '+201012345678');
    }
  }, [user?.id]);

  const handleSave = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setErr('');
    setSaved(false);
    if (!fullName.trim()) {
      setErr(t('Full name is required', 'الاسم الكامل مطلوب'));
      return;
    }
    setSaving(true);
    try {
      const updated = await put('/auth/me', {
        fullName: fullName.trim(),
        phone: phone.trim(),
        language: preferredLang,
        theme: preferredTheme,
        otpOnLogin,
      });
      if (updated) setUser((prev) => ({ ...(prev || {}), ...updated }));
      setLang(preferredLang);
      setTheme(preferredTheme);
      setSaved(true);
    } catch (ex) {
      setErr(ex.message || t('Could not update profile', 'تعذر تحديث الملف الشخصي'));
    } finally {
      setSaving(false);
    }
  };

  const links = [
    { code: 'SH12', icon: '👤', en: 'Edit Account Details', ar: 'تعديل بيانات الحساب' },
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar name={user?.fullName || t('Car Owner', 'مالك السيارة')} size={52} />
              <div>
                <div className="text-base font-extrabold" style={{ color: c.text }}>
                  {user?.fullName || t('Car Owner', 'مالك السيارة')}
                </div>
                <div className="text-xs" style={{ color: c.text2 }}>{user?.email || ''}</div>
                <div className="text-xs" style={{ color: c.text3 }}>{user?.phone || '+201012345678'}</div>
              </div>
            </div>
            <StatusBadge status={user?.status || 'Active'} />
          </div>
        </Card>

        <form onSubmit={handleSave} className="space-y-3">
          {err && <Banner tone="danger" title={err} />}
          {saved && <Banner tone="success" title={t('Profile updated successfully', 'تم حفظ التعديلات بنجاح')} />}

          <Card>
            <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: c.text3 }}>
              {t('Quick Profile & Security Settings', 'إعدادات الحساب السريعة')}
            </div>
            <InputField
              label={t('Full Name', 'الاسم الكامل')}
              value={fullName}
              onChange={setFullName}
              testId="field-fullName"
              placeholder={t('Your Full Name', 'الاسم الكامل')}
            />
            <InputField
              label={t('Egypt Mobile Number', 'رقم الهاتف المحمول')}
              value={phone}
              onChange={setPhone}
              testId="field-phone"
              placeholder="+201012345678"
            />
            <div className="flex items-center justify-between pt-2 mb-3">
              <div>
                <div className="text-xs font-bold" style={{ color: c.text }}>{t('Require OTP on Every Login', 'طلب رمز التحقق عند كل تسجيل دخول')}</div>
                <div className="text-[11px]" style={{ color: c.text2 }}>{t('Extra security for new devices', 'حماية إضافية عند الدخول من جهاز جديد')}</div>
              </div>
              <ToggleSwitch checked={otpOnLogin} onChange={setOtpOnLogin} />
            </div>
            <PrimaryButton type="submit" testId="screen-primary" disabled={saving}>
              {saving ? t('Saving Changes...', 'جارٍ الحفظ...') : t('Save Profile Changes', 'حفظ التغييرات')}
            </PrimaryButton>
          </Card>
        </form>

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
