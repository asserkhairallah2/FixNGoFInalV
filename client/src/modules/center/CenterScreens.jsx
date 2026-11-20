import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  BookOpen,
  Wrench,
  Star,
  BarChart3,
  CheckCircle2,
  Clock,
  Phone,
  MapPin,
  Settings,
  Edit3,
  AlertCircle,
  Plus,
  Trash2,
  Users,
  LogOut,
  CreditCard,
  Wallet
} from 'lucide-react';
import { usePrefs, useNav } from '../../app/stores.jsx';
import { get, post, put, del } from '../../api/http.js';
import {
  useBootstrap,
  useBookings,
  useBooking,
  useCenterAdminServices,
  useCenterBays,
  useTechnicians,
  useWorkOrders,
  useReviews
} from '../../api/hooks.js';
import {
  useColors,
  AppTopBar,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  Toast,
  Skeleton,
  ErrorState
} from '../../ui/kit.jsx';
import { providerLabel, plural, pluralCount } from '../auth/providerLabels.js';
import { fmtMoney, fmtNumber, fmtDate, fmtTime, fmtDateTime } from '../../i18n/format.js';
import { WORKSHOP_IMAGE } from '../../assets/images.js';

export const CENTER_MAIN_SCREENS = ['SC01', 'SC02', 'SC04', 'SC08', 'SC09'];

function useCenterProfile() {
  return useQuery({
    queryKey: ['center-admin', 'profile'],
    queryFn: () => get('/center-admin/profile')
  });
}

function useCenterHours() {
  return useQuery({
    queryKey: ['center-admin', 'hours'],
    queryFn: () => get('/center-admin/hours')
  });
}

function useCenterReports() {
  return useQuery({
    queryKey: ['center-admin', 'reports'],
    queryFn: () => get('/center-admin/reports')
  });
}

function trimTimeSpan(ts, fallback = '09:00') {
  if (!ts) return fallback;
  const s = String(ts);
  const parts = s.split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return fallback;
}

function toTimeSpan(hhmm, fallback = '09:00:00') {
  if (!hhmm) return fallback;
  const parts = String(hhmm).split(':');
  if (parts.length === 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`;
  if (parts.length >= 3) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${parts[2].slice(0, 2).padStart(2, '0')}`;
  return fallback;
}

const DAY_NAMES = [
  { dow: 0, en: 'Sunday', ar: 'الأحد', shortEn: 'Sun', shortAr: 'أحد' },
  { dow: 1, en: 'Monday', ar: 'الإثنين', shortEn: 'Mon', shortAr: 'إثنين' },
  { dow: 2, en: 'Tuesday', ar: 'الثلاثاء', shortEn: 'Tue', shortAr: 'ثلاثاء' },
  { dow: 3, en: 'Wednesday', ar: 'الأربعاء', shortEn: 'Wed', shortAr: 'أربعاء' },
  { dow: 4, en: 'Thursday', ar: 'الخميس', shortEn: 'Thu', shortAr: 'خميس' },
  { dow: 5, en: 'Friday', ar: 'الجمعة', shortEn: 'Fri', shortAr: 'جمعة' },
  { dow: 6, en: 'Saturday', ar: 'السبت', shortEn: 'Sat', shortAr: 'سبت' }
];

// ─── SC01: Service Center Overview ────────────────────────────────────────────
export function SC01Screen({ code = 'SC01' }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const ForwardChevron = isAr ? ChevronLeft : ChevronRight;

  const profileQ = useCenterProfile();
  const bookingsQ = useBookings();
  const servicesQ = useCenterAdminServices();
  const workOrdersQ = useWorkOrders();
  const hoursQ = useCenterHours();
  const baysQ = useCenterBays();

  const profile = profileQ.data;
  const bookings = Array.isArray(bookingsQ.data) ? bookingsQ.data : [];
  const services = Array.isArray(servicesQ.data) ? servicesQ.data : [];
  const workOrders = Array.isArray(workOrdersQ.data) ? workOrdersQ.data : [];
  const hours = Array.isArray(hoursQ.data) ? hoursQ.data : [];
  const bays = Array.isArray(baysQ.data) ? baysQ.data : [];

  const activeServicesCount = services.filter((s) => s.isActive !== false).length;
  const pendingBookingsCount = bookings.filter((b) => b.status === 'Pending').length;
  const activeWoCount = workOrders.filter((w) => w.status !== 'Closed').length;

  const cairoShort = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'Africa/Cairo'
  }).format(new Date());
  const todayDow = Math.max(0, DAY_NAMES.findIndex((d) => d.shortEn === cairoShort));
  const todayHours = hours.find((h) => Number(h.dayOfWeek) === todayDow);

  const menuItems = [
    {
      icon: Calendar,
      title: isAr ? 'المواعيد' : 'Appointments',
      meta: isAr
        ? `${fmtNumber(pendingBookingsCount, lang)} قيد الانتظار`
        : `${fmtNumber(pendingBookingsCount, lang)} pending`,
      target: 'SC02'
    },
    {
      icon: Wrench,
      title: isAr ? 'أوامر الشغل' : 'Work Orders',
      meta: isAr
        ? `${fmtNumber(activeWoCount, lang)} قيد التنفيذ`
        : `${fmtNumber(activeWoCount, lang)} in progress`,
      target: 'SC06'
    },
    {
      icon: BookOpen,
      title: isAr ? 'قائمة الخدمات' : 'Service Catalog',
      meta: pluralCount(
        activeServicesCount,
        'active service',
        'active services',
        'خدمة نشطة',
        'خدمات نشطة',
        'خدمة نشطة',
        isAr
      ),
      target: 'SC04'
    },
    {
      icon: Users,
      title: isAr ? 'الحارات والفنيون' : 'Bays & Technicians',
      meta: plural(bays.length, 'bay', isAr),
      target: 'SC17'
    },
    {
      icon: Star,
      title: isAr ? 'تقييمات السائقين' : 'Driver Reviews',
      meta: pluralCount(
        profile?.ratingCount ?? 0,
        'driver review',
        'driver reviews',
        'تقييم سائق',
        'تقييمات سائقين',
        'تقييم سائق',
        isAr
      ),
      target: 'SC07'
    },
    {
      icon: BarChart3,
      title: isAr ? 'التقارير' : 'Reports',
      meta: isAr ? 'الإيرادات والأداء' : 'Revenue & performance',
      target: 'SC08'
    }
  ];

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={!CENTER_MAIN_SCREENS.includes(code)} onBack={() => nav.back()} />
      <div className="p-4 space-y-3.5 flex-1">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {profile?.name || (isAr ? 'مركز الخدمة' : 'Service Center')}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {isAr ? 'نظرة عامة على المركز' : 'Center overview'} · {fmtDate(new Date().toISOString(), lang)}
          </p>
        </div>

        <div className="w-full h-28 rounded-2xl overflow-hidden border border-white/10">
          <img
            src={WORKSHOP_IMAGE}
            alt={profile?.name || 'Service Center'}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
            <p className={`text-base font-extrabold ${colors.text}`}>
              {fmtNumber(bookings.length, lang)}
            </p>
            <p className={`text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'إجمالي الحجوزات' : 'Bookings'}
            </p>
          </div>
          <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
            <p className={`text-base font-extrabold ${colors.text}`}>
              {fmtNumber(activeServicesCount, lang)}
            </p>
            <p className={`text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'خدمات نشطة' : 'Active services'}
            </p>
          </div>
          <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
            <p className={`text-base font-extrabold ${colors.text}`}>
              {profile?.rating ? `${Number(profile.rating).toFixed(1)} ★` : '—'}
            </p>
            <p className={`text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'التقييم' : 'Rating'}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className={`text-xs font-extrabold ${colors.text}`}>
            {isAr ? 'إدارة المركز' : 'Manage your center'}
          </p>
          {menuItems.map((item) => {
            const IconComp = item.icon;
            return (
              <button
                key={item.target}
                onClick={() => nav.go(item.target)}
                data-testid={`menu-${item.target}`}
                className={`w-full p-3 rounded-2xl border ${colors.border} ${colors.surface} flex items-center justify-between text-start`}
              >
                <div className="flex items-center gap-2.5">
                  <IconComp size={16} className="text-red-500" />
                  <span className={`text-xs font-bold ${colors.text}`}>{item.title}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] ${colors.secondaryText}`}>{item.meta}</span>
                  <ForwardChevron size={14} className={colors.secondaryText} />
                </div>
              </button>
            );
          })}
        </div>

        <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} flex items-center justify-between text-[11px]`}>
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-[#E51C23] shrink-0" />
            <span className={`font-semibold ${colors.text}`}>
              {todayHours ? (
                todayHours.isClosed ? (
                  isAr ? 'مغلق اليوم' : 'Closed today'
                ) : (
                  <>
                    {isAr ? 'ساعات العمل اليوم: ' : "Today's hours: "}
                    <span dir="ltr">
                      {trimTimeSpan(todayHours.openTime)}–{trimTimeSpan(todayHours.closeTime)}
                    </span>
                  </>
                )
              ) : isAr ? (
                'ساعات العمل اليومية'
              ) : (
                "Today's working hours"
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => nav.go('SC15')}
            className="text-xs font-bold text-[#E51C23]"
          >
            {isAr ? 'تعديل' : 'Edit'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SC02: Appointments List ──────────────────────────────────────────────────
export function SC02Screen({ code = 'SC02' }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const bookingsQ = useBookings();
  const profileQ = useCenterProfile();

  const [apptFilter, setApptFilter] = useState('All');

  const bookings = Array.isArray(bookingsQ.data) ? bookingsQ.data : [];
  const filtered = useMemo(() => {
    if (apptFilter === 'All') return bookings;
    return bookings.filter((b) => b.status === apptFilter);
  }, [bookings, apptFilter]);

  const tabs = [
    { id: 'Pending', label: providerLabel('Pending', isAr) },
    { id: 'Confirmed', label: providerLabel('Confirmed', isAr) },
    { id: 'InProgress', label: providerLabel('InProgress', isAr) },
    { id: 'Completed', label: providerLabel('Completed', isAr) },
    { id: 'All', label: isAr ? 'الكل' : 'All' }
  ];

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={!CENTER_MAIN_SCREENS.includes(code)} onBack={() => nav.back()} />
      <div className="p-4 space-y-3.5 flex-1">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'المواعيد' : 'Appointments'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {profileQ.data?.name || (isAr ? 'مركز الخدمة' : 'Service Center')} ·{' '}
            {plural(bookings.length, 'booking', isAr)}
          </p>
        </div>

        <div className="grid grid-cols-5 gap-1">
          {tabs.map((tab) => (
            <React.Fragment key={tab.id}>
              <button
                type="button"
                data-testid={`filter-${tab.id}`}
                onClick={() => setApptFilter(tab.id)}
                className={`py-2 px-1 rounded-xl text-[10px] font-bold border truncate ${
                  apptFilter === tab.id
                    ? 'border-[#E51C23] bg-[#E51C23]/15 text-[#E51C23] shadow-sm'
                    : `${colors.border} ${colors.surface} ${colors.secondaryText}`
                }`}
              >
                {tab.label}
              </button>{' '}
            </React.Fragment>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold ${colors.secondaryText}`}>
            {apptFilter === 'All'
              ? (isAr ? 'جميع المواعيد' : 'All appointments')
              : providerLabel(apptFilter, isAr)}
          </span>
          <button
            type="button"
            data-testid="goto-calendar"
            onClick={() => nav.go('SC10')}
            className={`text-xs font-extrabold ${colors.text} flex items-center gap-1`}
          >
            <span>{isAr ? 'التقويم ←' : 'Calendar →'}</span>
          </button>
        </div>

        {bookingsQ.isLoading ? (
          <Skeleton rows={3} />
        ) : bookingsQ.isError ? (
          <ErrorState error={bookingsQ.error} retry={bookingsQ.refetch} />
        ) : filtered.length === 0 ? (
          <div className={`p-6 rounded-2xl border ${colors.border} ${colors.surface} text-center space-y-1`}>
            <p className={`text-xs font-bold ${colors.text}`}>
              {isAr ? 'لا توجد مواعيد في هذا التصنيف' : 'No appointments in this filter'}
            </p>
            <p className={`text-[11px] ${colors.secondaryText}`}>
              {isAr ? 'جرّب اختيار تبويب آخر أو افتح التقويم.' : 'Try selecting another tab or open the calendar.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((bk) => (
              <button
                key={bk.id}
                type="button"
                data-testid="booking-card"
                onClick={() => nav.go('SC03', { id: bk.id })}
                className={`w-full p-3.5 rounded-2xl border ${colors.border} ${colors.surface} text-start space-y-1.5`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-semibold font-mono ${colors.secondaryText}`}>
                    {bk.code}
                  </span>
                  <StatusBadge status={bk.status} />
                </div>
                <p className={`text-xs font-extrabold ${colors.text}`}>
                  {bk.serviceName || (isAr ? 'خدمة صيانة' : 'Maintenance service')}
                </p>
                <p className={`text-[11px] ${colors.secondaryText}`}>
                  {bk.customerName || (isAr ? 'عميل' : 'Customer')}
                  {bk.vehicleLabel ? ` · ${bk.vehicleLabel}` : ''}
                </p>
                <div className="flex items-center justify-between pt-1">
                  <span className={`text-[11px] ${colors.secondaryText}`}>
                    {fmtDateTime(bk.slotStart, lang)}
                  </span>
                  <span className={`text-xs font-extrabold ${colors.text}`}>
                    {fmtMoney(bk.priceMinor, lang)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SC03: Appointment Detail ─────────────────────────────────────────────────
export function SC03Screen({ id, params, code = 'SC03' }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const queryClient = useQueryClient();

  const targetId = id || params?.id;
  const bookingsQ = useBookings();
  const singleQ = useBooking(targetId);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const bookings = Array.isArray(bookingsQ.data) ? bookingsQ.data : [];
  const booking = singleQ.data || bookings.find((x) => String(x.id) === String(targetId)) || bookings[0];

  const initials = useMemo(() => {
    const name = booking?.customerName || 'C';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('');
  }, [booking?.customerName]);

  async function handleAccept() {
    if (!booking?.id) return;
    setError('');
    setBusy(true);
    try {
      await post(`/center-admin/bookings/${booking.id}/confirm`, {});
      await queryClient.invalidateQueries({ queryKey: ['bookings'] });
      await queryClient.invalidateQueries({ queryKey: ['center-admin', 'work-orders'] });
      nav.go('SC11', { id: booking.id });
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر قبول الموعد.' : 'Could not accept appointment.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={!CENTER_MAIN_SCREENS.includes(code)} onBack={() => nav.back('SC02')} />
      <div className="p-4 space-y-3.5 flex-1">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {booking?.status === 'InProgress'
              ? providerLabel('InProgress', isAr)
              : (isAr ? 'تفاصيل الموعد' : 'Appointment detail')}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {booking ? `${booking.code} · ${fmtDateTime(booking.slotStart, lang)}` : '—'}
          </p>
        </div>

        {!booking ? (
          bookingsQ.isLoading || singleQ.isLoading ? (
            <Skeleton rows={3} />
          ) : (
            <div className={`p-5 rounded-2xl border ${colors.border} ${colors.surface} text-xs ${colors.secondaryText}`}>
              {isAr ? 'لا يوجد موعد محدد.' : 'No appointment selected.'}
            </div>
          )
        ) : (
          <>
            <div>
              <StatusBadge status={booking.status} />
            </div>

            <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2.5`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-red-600/15 text-red-500 flex items-center justify-center font-extrabold text-xs">
                    {initials || 'C'}
                  </div>
                  <div>
                    <p className={`text-xs font-extrabold ${colors.text}`}>
                      {booking.customerName || (isAr ? 'عميل' : 'Customer')}
                    </p>
                    {booking.customerPhone && (
                      <a
                        href={`tel:${booking.customerPhone}`}
                        dir="ltr"
                        className={`inline-block text-[11px] ${colors.secondaryText} underline`}
                      >
                        {booking.customerPhone}
                      </a>
                    )}
                  </div>
                </div>
                <CheckCircle2 size={16} className="text-emerald-500" />
              </div>
              {booking.vehicleLabel && (
                <div className="space-y-1 text-xs pt-1 border-t border-slate-500/10">
                  <div className="flex justify-between">
                    <span className={colors.secondaryText}>{isAr ? 'المركبة' : 'Vehicle'}</span>
                    <span className={`font-bold ${colors.text}`}>{booking.vehicleLabel}</span>
                  </div>
                </div>
              )}
            </div>

            <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs`}>
              <p className={`font-extrabold ${colors.text}`}>
                {booking.serviceName || (isAr ? 'خدمة صيانة' : 'Service')}
              </p>
              <div className="flex justify-between">
                <span className={colors.secondaryText}>{isAr ? 'الموعد' : 'Time slot'}</span>
                <span className={`font-bold ${colors.text}`}>
                  {fmtDateTime(booking.slotStart, lang)} – {fmtTime(booking.slotEnd, lang)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={colors.secondaryText}>{isAr ? 'السعر' : 'Price'}</span>
                <span className={`font-bold ${colors.text}`}>
                  {fmtMoney(booking.priceMinor, lang)}
                </span>
              </div>
              {booking.note && (
                <p className={`text-[11px] ${colors.secondaryText} pt-1`}>
                  {isAr ? 'ملاحظة العميل: ' : 'Customer note: '}
                  {booking.note}
                </p>
              )}
            </div>

            {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}

            {booking.status === 'Pending' && (
              <div className="space-y-2">
                <PrimaryButton onClick={handleAccept} disabled={busy} testId="screen-primary">
                  {busy
                    ? (isAr ? 'جارٍ القبول…' : 'Accepting…')
                    : (isAr ? 'قبول الموعد' : 'Accept Appointment')}
                </PrimaryButton>
                <SecondaryButton onClick={() => nav.go('SC16', { id: booking.id })}>
                  {isAr ? 'رفض الموعد' : 'Reject Appointment'}
                </SecondaryButton>
              </div>
            )}

            {booking.status === 'Confirmed' && (
              <div className="space-y-2">
                <PrimaryButton
                  onClick={() => nav.go('SC11', { id: booking.id })}
                  testId="screen-primary"
                >
                  {isAr ? 'فتح الموعد المقبول / بدء الخدمة' : 'Open Accepted Appointment / Start Service'}
                </PrimaryButton>
              </div>
            )}

            {booking.status === 'InProgress' && (
              <div className="space-y-2">
                <PrimaryButton
                  onClick={() => nav.go('SC12', { id: booking.id })}
                  testId="screen-primary"
                >
                  {isAr ? 'إتمام الخدمة والفاتورة' : 'Complete Service & Invoice'}
                </PrimaryButton>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── SC04: Service Catalog ────────────────────────────────────────────────────
export function SC04Screen({ code = 'SC04' }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const queryClient = useQueryClient();
  const servicesQ = useCenterAdminServices();

  const [toast, setToast] = useState('');
  const services = Array.isArray(servicesQ.data) ? servicesQ.data : [];

  async function handleToggle(e, srv) {
    e.stopPropagation();
    if (!srv.isActive && (!srv.priceMinor || srv.priceMinor <= 0)) {
      setToast(
        isAr
          ? 'يرجى تحديد سعر الخدمة أولاً لتفعيلها'
          : 'Set a service price (> 0 EGP) before activating'
      );
      nav.go('SC05', { id: srv.id });
      return;
    }
    try {
      await put(`/center-admin/services/${srv.id}`, {
        name: srv.name,
        description: srv.description || '',
        priceMinor: srv.priceMinor,
        durationMinutes: srv.durationMinutes,
        isActive: !srv.isActive
      });
      await queryClient.invalidateQueries({ queryKey: ['center-admin', 'services'] });
      setToast(
        !srv.isActive
          ? (isAr ? 'تم تفعيل الخدمة' : 'Service activated')
          : (isAr ? 'تم إيقاف الخدمة' : 'Service deactivated')
      );
    } catch {
      // handled silently or via toast
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={!CENTER_MAIN_SCREENS.includes(code)} onBack={() => nav.back()} />
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      <div className="p-4 space-y-3.5 flex-1">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'قائمة الخدمات' : 'Service catalog'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {isAr ? 'حافظ على وضوح وتحديث خدماتك وأسعارك.' : 'Keep your services clear and up to date.'}
          </p>
        </div>

        {servicesQ.isLoading ? (
          <Skeleton rows={3} />
        ) : servicesQ.isError ? (
          <ErrorState error={servicesQ.error} retry={servicesQ.refetch} />
        ) : (
          <div className="space-y-2.5">
            {services.map((srv) => {
              const isActive = srv.isActive !== false;
              const isDraft = !isActive && (!srv.priceMinor || srv.priceMinor <= 0);
              return (
                <div
                  key={srv.id}
                  data-testid="service-card"
                  onClick={() => nav.go('SC05', { id: srv.id })}
                  className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} flex items-center justify-between cursor-pointer`}
                >
                  <div className="space-y-1">
                    <p className={`text-xs font-extrabold ${colors.text}`}>{srv.name}</p>
                    <p className={`text-[11px] ${colors.secondaryText}`}>
                      {fmtNumber(srv.durationMinutes, lang)} {isAr ? 'د' : 'min'} ·{' '}
                      {isDraft
                        ? (isAr ? 'حدد السعر للتفعيل' : 'Set price to activate')
                        : isActive
                        ? (isAr ? 'نشط' : 'Active')
                        : (isAr ? 'غير نشط' : 'Inactive')}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isActive}
                      onClick={(e) => handleToggle(e, srv)}
                      className={`w-9 h-5 rounded-full transition-colors p-0.5 flex items-center ${
                        isActive ? 'bg-emerald-500 justify-end' : 'bg-slate-600 justify-start'
                      }`}
                    >
                      <span className="w-4 h-4 rounded-full bg-white shadow" />
                    </button>
                    <span className={`text-xs font-extrabold ${isDraft ? 'text-[#E51C23]' : colors.text}`}>
                      {isDraft ? (isAr ? 'تحديد السعر' : 'Set price') : fmtMoney(srv.priceMinor, lang)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className={`text-[11px] ${colors.secondaryText}`}>
          {isAr
            ? 'اضغط على أي خدمة لتعديل تفاصيلها وتوافرها.'
            : 'Tap a service to edit its details and availability.'}
        </p>

        <div className="pt-2">
          <PrimaryButton
            onClick={() => nav.go('SC05', { mode: 'create' })}
            testId="screen-primary"
          >
            <Plus size={14} aria-hidden="true" />
            <span>{isAr ? 'إضافة خدمة جديدة' : 'Add New Service'}</span>
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ─── SC05: Edit / Create Service ──────────────────────────────────────────────
export function SC05Screen({ id, params, code = 'SC05' }) {
  const colors = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const queryClient = useQueryClient();

  const servicesQ = useCenterAdminServices();
  const profileQ = useCenterProfile();

  const targetId = id || params?.id;
  const isCreateMode = params?.mode === 'create' || (!targetId && (!servicesQ.data || servicesQ.data.length === 0));
  const services = Array.isArray(servicesQ.data) ? servicesQ.data : [];
  const editingService = useMemo(() => {
    if (params?.mode === 'create') return null;
    if (targetId) return services.find((s) => String(s.id) === String(targetId)) || null;
    return services[0] || null;
  }, [params?.mode, targetId, services]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priceEgp, setPriceEgp] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (params?.mode === 'create') {
      setName('');
      setDescription('');
      setPriceEgp('');
      setDurationMinutes('');
      setIsActive(true);
    } else if (editingService) {
      setName(editingService.name || '');
      setDescription(
        editingService.description === 'Set price & activate in Service Catalog'
          ? ''
          : (editingService.description || '')
      );
      const p = editingService.priceMinor ?? 0;
      setPriceEgp(p > 0 ? String(Math.round(p / 100)) : '');
      const d = editingService.durationMinutes ?? 0;
      setDurationMinutes(d > 0 ? String(d) : '');
      setIsActive(p > 0 ? editingService.isActive !== false : true);
    }
  }, [params?.mode, editingService]);

  async function handleSave(e) {
    if (e) e.preventDefault();
    setError('');
    const trimmedName = name.trim();
    const numPrice = Number(priceEgp);
    const numDuration = Number(durationMinutes);

    if (!trimmedName) {
      setError(isAr ? 'اسم الخدمة مطلوب.' : 'Service name is required.');
      return;
    }
    if (!Number.isFinite(numPrice) || numPrice <= 0) {
      setError(isAr ? 'يرجى إدخال سعر أكبر من صفر.' : 'Price must be greater than 0.');
      return;
    }
    if (!Number.isFinite(numDuration) || numDuration < 5 || numDuration % 5 !== 0) {
      setError(isAr ? 'المدة يجب أن تكون من مضاعفات ٥ دقائق.' : 'Duration must be a multiple of 5 minutes.');
      return;
    }

    setBusy(true);
    try {
      const payload = {
        name: trimmedName,
        description: description.trim(),
        priceMinor: Math.round(numPrice * 100),
        durationMinutes: numDuration,
        isActive
      };
      if (editingService?.id && !isCreateMode) {
        await put(`/center-admin/services/${editingService.id}`, payload);
      } else {
        await post('/center-admin/services', payload);
      }
      await queryClient.invalidateQueries({ queryKey: ['center-admin', 'services'] });
      setToast(isAr ? 'تم حفظ الخدمة بنجاح' : 'Service saved successfully');
      nav.go('SC04');
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر حفظ الخدمة.' : 'Could not save service.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!editingService?.id) return;
    setError('');
    setBusy(true);
    try {
      await del(`/center-admin/services/${editingService.id}`);
      await queryClient.invalidateQueries({ queryKey: ['center-admin', 'services'] });
      nav.go('SC04');
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر حذف الخدمة.' : 'Could not delete service.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={!CENTER_MAIN_SCREENS.includes(code)} onBack={() => nav.back('SC04')} />
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      <form onSubmit={handleSave} className="p-4 space-y-3.5 flex-1">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {editingService && !isCreateMode
              ? (isAr ? 'تعديل الخدمة' : 'Edit service')
              : (isAr ? 'إضافة خدمة جديدة' : 'Create service')}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {profileQ.data?.name || (isAr ? 'مركز الخدمة' : 'Service Center')} ·{' '}
            {isAr ? 'قائمة الخدمات' : 'Service catalog'}
          </p>
        </div>

        <div className="space-y-1.5">
          <label className={`text-[11px] font-semibold ${colors.secondaryText}`}>
            {isAr ? 'اسم الخدمة' : 'Service name'}
          </label>
          <div className={`px-3 h-11 rounded-xl border ${colors.border} ${colors.surface} flex justify-between items-center`}>
            <input
              data-testid="field-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isAr ? 'أدخل اسم الخدمة' : 'Enter service name'}
              className={`bg-transparent text-xs font-bold w-full focus:outline-none ${colors.text}`}
              required
            />
            <Edit3 size={14} className={colors.secondaryText} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={`text-[11px] font-semibold ${colors.secondaryText}`}>
            {isAr ? 'الوصف' : 'Description'}
          </label>
          <textarea
            data-testid="field-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={isAr ? 'وصف مختصر للخدمة' : 'Short service description'}
            className={`w-full p-3 rounded-xl border ${colors.border} ${colors.surface} text-xs ${colors.text} focus:outline-none`}
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1.5">
            <label className={`text-[11px] font-semibold ${colors.secondaryText}`}>
              {isAr ? 'السعر · ج.م' : 'Price · EGP'}
            </label>
            <div className={`px-3 h-11 rounded-xl border ${colors.border} ${colors.surface} flex justify-between items-center`}>
              <input
                data-testid="field-price"
                type="number"
                min="1"
                step="1"
                placeholder="0"
                value={priceEgp}
                onChange={(e) => setPriceEgp(e.target.value)}
                className={`bg-transparent text-xs font-bold w-full focus:outline-none ${colors.text}`}
                required
              />
              <span className={`text-[10px] ${colors.secondaryText}`}>{isAr ? 'ج.م' : 'EGP'}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className={`text-[11px] font-semibold ${colors.secondaryText}`}>
              {isAr ? 'المدة · دقائق' : 'Duration · mins'}
            </label>
            <div className={`px-3 h-11 rounded-xl border ${colors.border} ${colors.surface} flex justify-between items-center`}>
              <input
                data-testid="field-duration"
                type="number"
                min="5"
                step="5"
                placeholder={isAr ? 'مثال: ٤٥' : 'e.g. 45'}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className={`bg-transparent text-xs font-bold w-full focus:outline-none ${colors.text}`}
                required
              />
              <Clock size={14} className={colors.secondaryText} />
            </div>
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} flex items-center justify-between`}>
          <div>
            <p className={`text-xs font-extrabold ${colors.text}`}>
              {isAr ? 'خدمة نشطة' : 'Active service'}
            </p>
            <p className={`text-[11px] ${colors.secondaryText}`}>
              {isAr
                ? 'مرئية لمالكي السيارات ومتاحة للحجز.'
                : 'Visible to car owners and available for bookings.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            onClick={() => setIsActive((v) => !v)}
            className={`w-10 h-5 rounded-full transition-colors p-0.5 flex items-center ${
              isActive ? 'bg-emerald-500 justify-end' : 'bg-slate-600 justify-start'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-white shadow" />
          </button>
        </div>

        {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}

        <div className="space-y-2 pt-1">
          <PrimaryButton type="submit" disabled={busy} testId="screen-primary">
            {busy ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'حفظ الخدمة' : 'Save Service')}
          </PrimaryButton>
          {editingService && !isCreateMode && (
            <SecondaryButton onClick={handleDelete} disabled={busy}>
              <Trash2 size={14} className="text-rose-500" />
              <span>{isAr ? 'حذف الخدمة' : 'Delete Service'}</span>
            </SecondaryButton>
          )}
        </div>
      </form>
    </div>
  );
}

// ─── SC06: Work Orders ────────────────────────────────────────────────────────
export function SC06Screen({ code = 'SC06' }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const ForwardChevron = isAr ? ChevronLeft : ChevronRight;

  const workOrdersQ = useWorkOrders();
  const baysQ = useCenterBays();
  const techsQ = useTechnicians();

  const [woFilter, setWoFilter] = useState('All');

  const workOrders = Array.isArray(workOrdersQ.data) ? workOrdersQ.data : [];
  const bays = Array.isArray(baysQ.data) ? baysQ.data : [];
  const techs = Array.isArray(techsQ.data) ? techsQ.data : [];

  const bayMap = useMemo(
    () => Object.fromEntries(bays.map((b) => [String(b.id), b.name])),
    [bays]
  );
  const techMap = useMemo(
    () => Object.fromEntries(techs.map((t) => [String(t.id), t.name])),
    [techs]
  );

  const activeRepairs = workOrders.filter((w) => w.status !== 'Closed');
  const occupiedBaysCount = new Set(activeRepairs.map((w) => w.bayId).filter(Boolean)).size;
  const availableBaysCount = Math.max(0, bays.length - occupiedBaysCount);

  const filtered = useMemo(() => {
    if (woFilter === 'All') return workOrders;
    if (woFilter === 'InProgress') {
      return workOrders.filter((w) => w.status === 'InProgress' || w.status === 'Assigned');
    }
    return workOrders.filter((w) => w.status === woFilter);
  }, [workOrders, woFilter]);

  const tabs = [
    { id: 'InProgress', label: providerLabel('InProgress', isAr) },
    { id: 'ReadyForReview', label: providerLabel('ReadyForReview', isAr) },
    { id: 'All', label: isAr ? 'الكل' : 'All' }
  ];

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={!CENTER_MAIN_SCREENS.includes(code)} onBack={() => nav.back('SC01')} />
      <div className="p-4 space-y-3.5 flex-1">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'أوامر الشغل' : 'Work orders'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {`${pluralCount(activeRepairs.length, 'active repair', 'active repairs', 'إصلاح نشط', 'إصلاحات نشطة', 'إصلاح نشط', isAr)} · ${plural(availableBaysCount, 'bay', isAr)} ${isAr ? 'متاحة' : 'available'}`}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {tabs.map((tab) => (
            <React.Fragment key={tab.id}>
              <button
                type="button"
                data-testid={`filter-${tab.id}`}
                onClick={() => setWoFilter(tab.id)}
                className={`py-2 px-1.5 rounded-xl text-[11px] font-bold border truncate ${
                  woFilter === tab.id
                    ? 'border-[#E51C23] bg-[#E51C23]/15 text-[#E51C23]'
                    : `${colors.border} ${colors.surface} ${colors.secondaryText}`
                }`}
              >
                {tab.label}
              </button>{' '}
            </React.Fragment>
          ))}
        </div>

        {workOrdersQ.isLoading ? (
          <Skeleton rows={2} />
        ) : workOrdersQ.isError ? (
          <ErrorState error={workOrdersQ.error} retry={workOrdersQ.refetch} />
        ) : filtered.length === 0 ? (
          <div className={`p-5 rounded-2xl border ${colors.border} ${colors.surface} text-center text-xs ${colors.secondaryText}`}>
            {isAr ? 'لا توجد أوامر شغل حالياً.' : 'No work orders found.'}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((wo) => {
              const bayName = wo.bayName || (wo.bayId && bayMap[String(wo.bayId)]) || (isAr ? 'غير معينة' : 'Unassigned bay');
              const techName = wo.technicianName || (wo.technicianId && techMap[String(wo.technicianId)]) || (isAr ? 'غير معين' : 'Unassigned');
              const elapsedMins = wo.startedAt
                ? Math.max(1, Math.round((Date.now() - new Date(wo.startedAt).getTime()) / 60000))
                : 0;
              return (
                <button
                  key={wo.id}
                  type="button"
                  data-testid="work-order-card"
                  onClick={() => nav.go('SC14', { id: wo.id })}
                  className={`w-full p-3.5 rounded-2xl border ${colors.border} ${colors.surface} text-start space-y-1.5`}
                >
                  <div className="flex justify-between items-center text-[11px]">
                    <span className={`font-mono ${colors.secondaryText}`}>
                      {wo.code}
                      {wo.customerName ? ` · ${wo.customerName}` : ''}
                    </span>
                    <span className={`font-extrabold ${colors.text}`}>{bayName}</span>
                  </div>
                  <p className={`text-xs font-extrabold ${colors.text}`}>
                    {wo.serviceName || wo.bookingCode || (isAr ? 'صيانة مركبة' : 'Vehicle service')}
                  </p>
                  <div>
                    <StatusBadge status={wo.status} />
                  </div>
                  <div className="flex justify-between text-xs pt-1">
                    <span className={colors.secondaryText}>
                      {isAr ? 'الفني المعين' : 'Assigned mechanic'}
                    </span>
                    <span className={`font-bold ${colors.text}`}>{techName}</span>
                  </div>
                  {wo.notes && (
                    <p className={`text-[11px] ${colors.secondaryText}`}>
                      {isAr ? 'ملاحظات الميكانيكي: ' : 'Mechanic notes: '}
                      {wo.notes}
                    </p>
                  )}
                  {wo.startedAt && (
                    <div className="flex justify-between text-[11px] pt-1">
                      <span className={colors.secondaryText}>
                        {isAr ? 'بدأ ' : 'Started '}
                        {fmtTime(wo.startedAt, lang)}
                      </span>
                      <span className={`font-bold ${colors.text}`}>
                        {isAr
                          ? `مضى ${fmtNumber(elapsedMins, lang)} د`
                          : `${fmtNumber(elapsedMins, lang)} min elapsed`}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="space-y-1.5 pt-1">
          <p className={`text-[11px] font-semibold ${colors.secondaryText}`}>
            {isAr ? 'تعيين أمر شغل جديد' : 'Assign a new work order'}
          </p>
          <button
            type="button"
            data-testid="screen-primary"
            onClick={() => nav.go('SC13')}
            className={`w-full p-3 rounded-2xl border ${colors.border} ${colors.surface} flex justify-between items-center text-xs font-bold ${colors.text}`}
          >
            <span>{isAr ? 'تعيين أمر شغل جديد' : 'Assign New Work Order'}</span>
            <ForwardChevron size={15} className={colors.secondaryText} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SC07: Driver Reviews ─────────────────────────────────────────────────────
export function SC07Screen({ code = 'SC07' }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();

  const profileQ = useCenterProfile();
  const centerId = profileQ.data?.id;
  const reviewsQ = useReviews('center', centerId);

  const [reviewFilter, setReviewFilter] = useState('All');

  const reviews = Array.isArray(reviewsQ.data) ? reviewsQ.data : [];
  const filtered = useMemo(() => {
    if (reviewFilter === '5 stars') return reviews.filter((r) => Number(r.stars) === 5);
    if (reviewFilter === 'With comments') return reviews.filter((r) => r.text && r.text.trim().length > 0);
    return reviews;
  }, [reviews, reviewFilter]);

  const avgRating = useMemo(() => {
    if (profileQ.data?.rating) return Number(profileQ.data.rating).toFixed(1);
    if (!reviews.length) return '0.0';
    const sum = reviews.reduce((acc, r) => acc + Number(r.stars ?? 0), 0);
    return (sum / reviews.length).toFixed(1);
  }, [profileQ.data?.rating, reviews]);

  const totalCount = profileQ.data?.ratingCount ?? reviews.length;
  const recommendPercent = useMemo(() => {
    if (totalCount === 0 && !reviews.length) return null;
    if (profileQ.data?.recommendPercent !== undefined && totalCount > 0) return profileQ.data.recommendPercent;
    if (!reviews.length) return null;
    return Math.round((reviews.filter((r) => r.recommend !== false).length / reviews.length) * 100);
  }, [profileQ.data?.recommendPercent, reviews, totalCount]);

  const tabs = [
    { id: 'All', label: isAr ? 'كل التقييمات' : 'All' },
    { id: '5 stars', label: isAr ? '٥ نجوم' : '5 stars' },
    { id: 'With comments', label: isAr ? 'بتعليقات' : 'With comments' }
  ];

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={!CENTER_MAIN_SCREENS.includes(code)} onBack={() => nav.back('SC01')} />
      <div className="p-4 space-y-3.5 flex-1">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'تقييمات السائقين' : 'Driver reviews'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {profileQ.data?.name || (isAr ? 'مركز الخدمة' : 'Service Center')} ·{' '}
            {isAr ? 'موثوق من مجتمعك' : 'Trusted by your community'}
          </p>
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1`}>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-extrabold ${colors.text}`}>
              {totalCount > 0 ? avgRating : '—'}
            </span>
            <span className="text-amber-400 text-xs">★★★★★</span>
            <span className={`text-xs ${colors.secondaryText}`}>
              {plural(totalCount, 'review', isAr)}
            </span>
          </div>
          <p className={`text-[11px] ${colors.secondaryText}`}>
            {recommendPercent !== null
              ? `${fmtNumber(recommendPercent, lang)}% ${isAr ? 'من السائقين يوصون بمركزك' : 'of drivers recommend your center'}`
              : (isAr ? 'لا توجد تقييمات بعد' : 'No reviews yet')}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {tabs.map((tab) => (
            <React.Fragment key={tab.id}>
              <button
                type="button"
                data-testid={`filter-${tab.id}`}
                onClick={() => setReviewFilter(tab.id)}
                className={`py-2 px-1.5 rounded-xl text-[10px] font-bold border ${
                  reviewFilter === tab.id
                    ? 'border-[#E51C23] bg-[#E51C23]/15 text-[#E51C23]'
                    : `${colors.border} ${colors.surface} ${colors.secondaryText}`
                }`}
              >
                {tab.label}
              </button>{' '}
            </React.Fragment>
          ))}
        </div>

        {reviewsQ.isLoading ? (
          <Skeleton rows={3} />
        ) : filtered.length === 0 ? (
          <div className={`p-5 rounded-2xl border ${colors.border} ${colors.surface} text-center text-xs ${colors.secondaryText}`}>
            {isAr ? 'لا توجد تقييمات مطابقة بعد.' : 'No matching reviews yet.'}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((rev) => {
              const starsCount = Math.min(5, Math.max(1, Number(rev.stars ?? 5)));
              const starStr = '★'.repeat(starsCount) + '☆'.repeat(5 - starsCount);
              return (
                <div
                  key={rev.id}
                  data-testid="review-card"
                  className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1`}
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className={`font-bold ${colors.secondaryText}`}>
                      {rev.authorName || (isAr ? 'سائق موثّق' : 'Verified driver')}
                    </span>
                    <span className={`text-[11px] font-semibold ${colors.text}`}>
                      {fmtDate(rev.createdAt, lang)}
                    </span>
                  </div>
                  <p className="text-amber-400 text-xs">{starStr}</p>
                  {rev.text && <p className={`text-xs ${colors.text}`}>{rev.text}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SC08: Center Reports ─────────────────────────────────────────────────────
export function SC08Screen({ code = 'SC08' }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();

  const reportsQ = useCenterReports();
  const bookingsQ = useBookings();
  const servicesQ = useCenterAdminServices();
  const profileQ = useCenterProfile();

  const [reportPeriod, setReportPeriod] = useState('week');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const bookings = Array.isArray(bookingsQ.data) ? bookingsQ.data : [];
  const services = Array.isArray(servicesQ.data) ? servicesQ.data : [];
  const report = reportsQ.data || {};

  const filteredBookings = useMemo(() => {
    const now = new Date();
    return bookings.filter((b) => {
      if (!b.slotStart) return true;
      const dt = new Date(b.slotStart);
      if (reportPeriod === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 86400000);
        return dt >= weekAgo;
      }
      if (reportPeriod === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 86400000);
        return dt >= monthAgo;
      }
      if (reportPeriod === 'custom') {
        if (fromDate && dt < new Date(fromDate)) return false;
        if (toDate && dt > new Date(`${toDate}T23:59:59`)) return false;
      }
      return true;
    });
  }, [bookings, reportPeriod, fromDate, toDate]);

  const totalBookings = report.total ?? (filteredBookings.length || bookings.length);
  const completedBookings =
    report.completed ??
    filteredBookings.filter((b) => b.status === 'Completed').length;
  const computedRevenueMinor = filteredBookings
    .filter((b) => b.status === 'Completed' || b.status === 'Confirmed' || b.status === 'InProgress')
    .reduce((acc, b) => acc + Number(b.priceMinor ?? 0), 0);
  const revenueMinor = report.revenueMinor && report.revenueMinor > 0 ? report.revenueMinor : computedRevenueMinor;

  const topServices = useMemo(() => {
    const countsByService = {};
    const sourceBookings = filteredBookings.length > 0 ? filteredBookings : bookings;
    for (const b of sourceBookings) {
      const label = b.serviceName || services.find((s) => String(s.id) === String(b.serviceId))?.name || (isAr ? 'خدمة' : 'Service');
      countsByService[label] = (countsByService[label] ?? 0) + 1;
    }
    for (const s of services) {
      if (countsByService[s.name] === undefined) {
        countsByService[s.name] = 0;
      }
    }
    const entries = Object.entries(countsByService)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
    const max = Math.max(1, ...entries.map((e) => e.count));
    return entries.map((e) => ({
      ...e,
      heightPx: Math.max(18, Math.round((e.count / max) * 76)),
      sharePct: totalBookings > 0 ? Math.round((e.count / Math.max(1, sourceBookings.length)) * 100) : 0
    }));
  }, [filteredBookings, bookings, services, isAr, totalBookings]);

  const completionPct = totalBookings > 0 ? Math.round((completedBookings / totalBookings) * 100) : null;

  const tabs = [
    { id: 'week', label: isAr ? 'هذا الأسبوع' : 'This week' },
    { id: 'month', label: isAr ? 'هذا الشهر' : 'This month' },
    { id: 'custom', label: isAr ? 'مخصص' : 'Custom' }
  ];

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={!CENTER_MAIN_SCREENS.includes(code)} onBack={() => nav.back()} />
      <div className="p-4 space-y-3.5 flex-1">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'تقارير المركز' : 'Center reports'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {isAr ? 'افهم مؤشرات نمو وأداء مركزك.' : 'Understand what drives your business.'}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {tabs.map((tab) => (
            <React.Fragment key={tab.id}>
              <button
                type="button"
                data-testid={`period-${tab.id}`}
                onClick={() => setReportPeriod(tab.id)}
                className={`py-2 px-2 rounded-xl text-[11px] font-bold border ${
                  reportPeriod === tab.id
                    ? 'border-[#E51C23] bg-[#E51C23]/15 text-[#E51C23]'
                    : `${colors.border} ${colors.surface} ${colors.secondaryText}`
                }`}
              >
                {tab.label}
              </button>{' '}
            </React.Fragment>
          ))}
        </div>

        {reportPeriod === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={`px-3 h-9 rounded-xl border ${colors.border} ${colors.surface} text-xs ${colors.text}`}
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className={`px-3 h-9 rounded-xl border ${colors.border} ${colors.surface} text-xs ${colors.text}`}
            />
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
            <p className={`text-sm font-extrabold ${colors.text}`}>
              {fmtNumber(totalBookings, lang)}
            </p>
            <p className={`text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'إجمالي الحجوزات' : 'Total bookings'}
            </p>
          </div>
          <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
            <p className={`text-sm font-extrabold ${colors.text}`}>
              {fmtNumber(completedBookings, lang)}
            </p>
            <p className={`text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'الحجوزات المكتملة' : 'Completed bookings'}
            </p>
          </div>
          <div className={`p-2.5 rounded-xl border ${colors.border} ${colors.surface}`}>
            <p className={`text-sm font-extrabold ${colors.text}`}>
              {fmtMoney(revenueMinor, lang)}
            </p>
            <p className={`text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'الإيرادات' : 'Revenue'}
            </p>
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-3`}>
          <div className="flex justify-between items-center text-xs">
            <span className={colors.secondaryText}>
              {isAr ? 'متوسط التقييم' : 'Average rating'}
            </span>
            <span className="font-extrabold text-emerald-500">
              {profileQ.data?.rating ? `${Number(profileQ.data.rating).toFixed(1)} ★` : '—'}
            </span>
          </div>
          <p className={`text-xs font-extrabold ${colors.text}`}>
            {isAr ? 'أعلى الخدمات طلباً' : 'Top services'}
          </p>
          <div className="grid grid-cols-4 gap-3 items-end h-28 pt-4 px-2">
            {topServices.map((bar, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-red-500">
                  {fmtNumber(bar.count, lang)}
                </span>
                <div
                  style={{ height: `${bar.heightPx}px` }}
                  className="w-7 bg-red-600 rounded-t-md transition-all"
                />
                <span className={`text-[10px] truncate max-w-full ${colors.secondaryText}`}>
                  {bar.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs`}>
          {topServices[0] && (
            <div className="flex justify-between">
              <span className={colors.secondaryText}>{topServices[0].label}</span>
              <span className={`font-bold ${colors.text}`}>
                {fmtNumber(topServices[0].sharePct, lang)}%{' '}
                {isAr ? 'من الحجوزات' : 'of bookings'}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className={colors.secondaryText}>
              {isAr ? 'معدل الإتمام' : 'Completion rate'}
            </span>
            <span className={`font-bold ${colors.text}`}>
              {completionPct !== null ? `${fmtNumber(completionPct, lang)}%` : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SC09: Center Profile ─────────────────────────────────────────────────────
export function SC09Screen({ code = 'SC09' }) {
  const colors = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const queryClient = useQueryClient();
  const ForwardChevron = isAr ? ChevronLeft : ChevronRight;

  const profileQ = useCenterProfile();
  const hoursQ = useCenterHours();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profileQ.data) {
      setName(profileQ.data.name || '');
      setPhone(profileQ.data.phone || '');
      setAddress(profileQ.data.address || '');
      setDescription(profileQ.data.description || '');
    }
  }, [profileQ.data]);

  const hoursList = Array.isArray(hoursQ.data) ? hoursQ.data : [];
  const weekPreview = useMemo(() => {
    return DAY_NAMES.map((d) => {
      const found = hoursList.find((h) => Number(h.dayOfWeek) === d.dow);
      return {
        label: isAr ? d.shortAr : d.shortEn,
        isClosed: found ? !!found.isClosed : d.dow === 5,
        open: trimTimeSpan(found?.openTime, '09:00'),
        close: trimTimeSpan(found?.closeTime, '20:00'),
        special: found?.isSpecial || d.dow === 5
      };
    });
  }, [hoursList, isAr]);

  async function handleSave(e) {
    if (e) e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await put('/center-admin/profile', {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        description: description.trim(),
        latitude: profileQ.data?.latitude ?? 30.0444,
        longitude: profileQ.data?.longitude ?? 31.2357
      });
      await queryClient.invalidateQueries({ queryKey: ['center-admin', 'profile'] });
      await queryClient.invalidateQueries({ queryKey: ['centers'] });
      setToast(isAr ? 'تم حفظ ملف المركز بنجاح' : 'Center profile saved');
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر حفظ التغييرات.' : 'Could not save profile.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={!CENTER_MAIN_SCREENS.includes(code)} onBack={() => nav.back()} />
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      <form onSubmit={handleSave} className="p-4 space-y-3 flex-1">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'ملف المركز' : 'Center profile'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {isAr ? 'بياناتك العامة وساعات العمل.' : 'Your public details and working hours.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className={`text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'اسم المركز' : 'Center name'}
            </label>
            <div className={`px-2.5 h-10 rounded-xl border ${colors.border} ${colors.surface} flex justify-between items-center`}>
              <input
                data-testid="field-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`bg-transparent text-xs font-bold w-full focus:outline-none ${colors.text}`}
                required
              />
              <Edit3 size={12} className={colors.secondaryText} />
            </div>
          </div>
          <div className="space-y-1">
            <label className={`text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'الهاتف' : 'Phone'}
            </label>
            <div className={`px-2.5 h-10 rounded-xl border ${colors.border} ${colors.surface} flex justify-between items-center`}>
              <input
                data-testid="field-phone"
                type="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`bg-transparent text-xs font-bold w-full focus:outline-none ${colors.text}`}
              />
              <Phone size={12} className={colors.secondaryText} />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'الوصف' : 'Description'}
          </label>
          <div className={`px-2.5 h-10 rounded-xl border ${colors.border} ${colors.surface} flex justify-between items-center`}>
            <input
              data-testid="field-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`bg-transparent text-xs w-full focus:outline-none ${colors.text}`}
            />
            <Edit3 size={12} className={colors.secondaryText} />
          </div>
        </div>

        <div className="space-y-1">
          <label className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'العنوان' : 'Address'}
          </label>
          <div className={`px-2.5 h-10 rounded-xl border ${colors.border} ${colors.surface} flex justify-between items-center`}>
            <input
              data-testid="field-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={`bg-transparent text-xs w-full focus:outline-none ${colors.text}`}
              required
            />
            <MapPin size={12} className={colors.secondaryText} />
          </div>
        </div>

        <button
          type="button"
          data-testid="goto-hours"
          onClick={() => nav.go('SC15')}
          className={`w-full p-3 rounded-2xl border ${colors.border} ${colors.surface} text-start space-y-2`}
        >
          <p className={`text-xs font-extrabold ${colors.text}`}>
            {isAr ? 'ساعات العمل · اضغط للتعديل' : 'Working hours · Tap to edit'}
          </p>
          <div className="grid grid-cols-7 gap-1 text-center text-[9px]">
            {weekPreview.map((day, idx) => (
              <div
                key={idx}
                className={`p-1 rounded-lg ${
                  day.isClosed ? 'bg-amber-500/15 text-amber-500' : colors.text
                }`}
              >
                <p className={`font-bold ${colors.secondaryText}`}>{day.label}</p>
                {day.isClosed ? (
                  <p className="font-semibold">{isAr ? 'مغلق' : 'Closed'}</p>
                ) : (
                  <>
                    <p className="font-semibold">{day.open}</p>
                    <p className="font-semibold">{day.close}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        </button>

        <button
          type="button"
          data-testid="goto-bays"
          onClick={() => nav.go('SC17')}
          className={`w-full p-3 rounded-2xl border ${colors.border} ${colors.surface} flex items-center justify-between`}
        >
          <div className="flex items-center gap-2.5">
            <Wrench size={16} className="text-red-500" />
            <span className={`text-xs font-extrabold ${colors.text}`}>
              {isAr ? 'الحارات والفنيون' : 'Bays & Technicians'}
            </span>
          </div>
          <ForwardChevron size={14} className={colors.secondaryText} />
        </button>

        <button
          type="button"
          data-testid="goto-banks"
          onClick={() => nav.go('SH14')}
          className={`w-full p-3 rounded-2xl border ${colors.border} ${colors.surface} flex items-center justify-between`}
        >
          <div className="flex items-center gap-2.5">
            <CreditCard size={16} className="text-red-500" />
            <span className={`text-xs font-extrabold ${colors.text}`}>
              {isAr ? 'الحسابات البنكية والتحويلات' : 'Bank Accounts & Payouts'}
            </span>
          </div>
          <ForwardChevron size={14} className={colors.secondaryText} />
        </button>

        <button
          type="button"
          data-testid="goto-reports"
          onClick={() => nav.go('SC08')}
          className={`w-full p-3 rounded-2xl border ${colors.border} ${colors.surface} flex items-center justify-between`}
        >
          <div className="flex items-center gap-2.5">
            <Wallet size={16} className="text-red-500" />
            <span className={`text-xs font-extrabold ${colors.text}`}>
              {isAr ? 'الإيرادات والتقارير المالية' : 'Revenue & Financial Reports'}
            </span>
          </div>
          <ForwardChevron size={14} className={colors.secondaryText} />
        </button>

        <button
          type="button"
          data-testid="goto-settings"
          onClick={() => nav.go('SH06')}
          className={`w-full p-3 rounded-2xl border ${colors.border} ${colors.surface} flex items-center justify-between`}
        >
          <div className="flex items-center gap-2.5">
            <Settings size={16} className="text-red-500" />
            <span className={`text-xs font-extrabold ${colors.text}`}>
              {isAr ? 'إعدادات التطبيق' : 'App settings'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'اللغة والمظهر والتفضيلات' : 'Language, theme, and preferences'}
            </span>
            <ForwardChevron size={14} className={colors.secondaryText} />
          </div>
        </button>

        <button
          type="button"
          data-testid="goto-logout"
          onClick={() => nav.go('SH13')}
          className={`w-full p-3 rounded-2xl border ${colors.border} ${colors.surface} flex items-center justify-between`}
        >
          <div className="flex items-center gap-2.5">
            <LogOut size={16} className="text-rose-500" />
            <span className="text-xs font-extrabold text-rose-500">
              {isAr ? 'تسجيل الخروج' : 'Log out'}
            </span>
          </div>
          <ForwardChevron size={14} className={colors.secondaryText} />
        </button>

        {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}

        <PrimaryButton type="submit" disabled={busy} testId="screen-primary">
          {busy ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'حفظ التغييرات' : 'Save Changes')}
        </PrimaryButton>
      </form>
    </div>
  );
}

// ─── SC10: Appointment Calendar ───────────────────────────────────────────────
export function SC10Screen({ code = 'SC10' }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const ForwardChevron = isAr ? ChevronLeft : ChevronRight;

  const bookingsQ = useBookings();
  const profileQ = useCenterProfile();
  const hoursQ = useCenterHours();

  const bookings = Array.isArray(bookingsQ.data) ? bookingsQ.data : [];
  const hours = Array.isArray(hoursQ.data) ? hoursQ.data : [];

  const days = useMemo(() => {
    const list = [];
    const seen = new Set();
    const base = new Date();
    base.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const d = new Date(base.getTime() + i * 86400000);
      const iso = d.toISOString().slice(0, 10);
      seen.add(iso);
      const dow = DAY_NAMES.find((x) => x.dow === d.getDay());
      list.push({
        iso,
        date: d,
        shortLabel: `${isAr ? dow.shortAr : dow.shortEn} ${d.getDate()}`,
        fullLabel: fmtDate(d.toISOString(), lang)
      });
    }
    for (const b of bookings) {
      if (!b.slotStart) continue;
      const iso = new Date(b.slotStart).toISOString().slice(0, 10);
      if (!seen.has(iso) && list.length < 10) {
        seen.add(iso);
        const d = new Date(b.slotStart);
        const dow = DAY_NAMES.find((x) => x.dow === d.getDay());
        list.push({
          iso,
          date: d,
          shortLabel: `${isAr ? dow.shortAr : dow.shortEn} ${d.getDate()}`,
          fullLabel: fmtDate(d.toISOString(), lang)
        });
      }
    }
    return list;
  }, [bookings, isAr, lang]);

  const [selectedIso, setSelectedIso] = useState('');

  useEffect(() => {
    if (!selectedIso && days.length > 0) {
      const withBooking = days.find((d) =>
        bookings.some((b) => b.slotStart && new Date(b.slotStart).toISOString().slice(0, 10) === d.iso)
      );
      setSelectedIso((withBooking || days[0]).iso);
    }
  }, [days, bookings, selectedIso]);

  const activeDay = days.find((d) => d.iso === selectedIso) || days[0];

  const dayBookings = useMemo(() => {
    if (!activeDay) return [];
    return bookings.filter(
      (b) => b.slotStart && new Date(b.slotStart).toISOString().slice(0, 10) === activeDay.iso
    );
  }, [bookings, activeDay]);

  const activeDayHours = useMemo(() => {
    if (!activeDay) return null;
    const dow = activeDay.date.getDay();
    return hours.find((h) => Number(h.dayOfWeek) === dow) || null;
  }, [activeDay, hours]);
  const isClosedDay = activeDayHours ? Boolean(activeDayHours.isClosed) : activeDay?.date.getDay() === 5;
  const standardHours = isClosedDay ? [] : ['09:00–10:00', '11:00–12:00', '14:00–15:00'];

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={!CENTER_MAIN_SCREENS.includes(code)} onBack={() => nav.back('SC02')} />
      <div className="p-4 space-y-3.5 flex-1">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'تقويم المواعيد' : 'Appointment calendar'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {profileQ.data?.name || (isAr ? 'مركز الخدمة' : 'Service Center')} ·{' '}
            {isAr ? 'الجدول اليومي' : 'Daily schedule'}
          </p>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {days.slice(0, 7).map((d) => (
            <button
              key={d.iso}
              type="button"
              data-testid={`cal-day-${d.iso}`}
              onClick={() => setSelectedIso(d.iso)}
              className={`py-2 rounded-xl text-[11px] font-bold border ${
                activeDay?.iso === d.iso
                  ? 'border-[#E51C23] bg-[#E51C23]/15 text-[#E51C23]'
                  : `${colors.border} ${colors.surface} ${colors.secondaryText}`
              }`}
            >
              {d.shortLabel}
            </button>
          ))}
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2.5`}>
          <p className={`text-xs font-extrabold ${colors.text}`}>
            {activeDay?.fullLabel}
          </p>

          {isClosedDay ? (
            <p className={`text-xs font-semibold ${colors.secondaryText}`}>
              {isAr ? 'مغلق في هذا اليوم' : 'Closed on this day'}
            </p>
          ) : (
            standardHours.map((slotRange, idx) => (
              <div
                key={slotRange}
                className={`flex justify-between text-xs py-1 ${idx > 0 ? 'border-t border-slate-500/10' : ''}`}
              >
                <span className={colors.secondaryText} dir="ltr">{slotRange}</span>
                <span className="font-bold text-emerald-500">
                  {isAr ? 'متاح' : 'Available'}
                </span>
              </div>
            ))
          )}

          {dayBookings.map((b) => (
            <button
              key={b.id}
              type="button"
              data-testid="calendar-booked-slot"
              onClick={() =>
                nav.go(b.status === 'Confirmed' || b.status === 'InProgress' ? 'SC11' : 'SC03', { id: b.id })
              }
              className="w-full flex items-center justify-between text-start py-1.5 border-t border-slate-500/10"
            >
              <div>
                <p className="text-xs font-extrabold text-red-500">
                  {fmtTime(b.slotStart, lang)} ·{' '}
                  {b.serviceName || (isAr ? 'خدمة صيانة' : 'Service')}
                </p>
                <p className={`text-[10px] ${colors.secondaryText}`}>
                  {b.code} · {b.customerName || (isAr ? 'عميل' : 'Customer')} ·{' '}
                  {fmtNumber(b.durationMinutes ?? 45, lang)} {isAr ? 'د' : 'min'} · {providerLabel(b.status, isAr)}
                </p>
              </div>
              <ForwardChevron size={14} className="text-red-500" />
            </button>
          ))}
        </div>

        <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} text-[11px] ${colors.secondaryText}`}>
          <p className={`font-bold ${colors.text}`}>
            {`${pluralCount(dayBookings.length, 'appointment', 'appointments', 'موعد', 'مواعيد', 'موعد', isAr)} · ${
              isClosedDay
                ? (isAr ? 'مغلق' : 'Closed')
                : pluralCount(standardHours.length, 'open slot', 'open slots', 'فترة متاحة', 'فترات متاحة', 'فترة متاحة', isAr)
            }`}
          </p>
          <p>
            {isAr
              ? 'اضغط على أي حجز لإدارته. تعكس الفترات المتاحة مدة الخدمة وسعة الحارات.'
              : 'Tap a booking to manage it. Available slots reflect service duration and bay capacity.'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── SC11: Accepted Appointment ───────────────────────────────────────────────
export function SC11Screen({ id, params, code = 'SC11' }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const queryClient = useQueryClient();
  const ForwardChevron = isAr ? ChevronLeft : ChevronRight;

  const targetId = id || params?.id;
  const bookingsQ = useBookings();
  const singleQ = useBooking(targetId);

  const bookings = Array.isArray(bookingsQ.data) ? bookingsQ.data : [];
  const booking =
    singleQ.data ||
    bookings.find((x) => String(x.id) === String(targetId)) ||
    bookings.find((x) => x.status === 'Confirmed') ||
    bookings[0];

  const [checks, setChecks] = useState([false, false]);
  const [startedNow, setStartedNow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isInProgress = booking?.status === 'InProgress' || startedNow;

  const checklistLabels = [
    isAr ? 'تم تسجيل وصول العميل والمركبة' : 'Customer and vehicle checked in',
    isAr ? 'تم تأكيد نطاق الخدمة والسعر' : 'Service scope and price confirmed'
  ];

  const toggleCheck = (idx) => {
    setChecks((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  };

  async function handleStartService() {
    if (!booking?.id) return;
    if (isInProgress) {
      nav.go('SC12', { id: booking.id });
      return;
    }
    setError('');
    setBusy(true);
    try {
      await post(`/center-admin/bookings/${booking.id}/start`, {});
      setStartedNow(true);
      await queryClient.invalidateQueries({ queryKey: ['bookings'] });
      await queryClient.invalidateQueries({ queryKey: ['center-admin', 'work-orders'] });
      await singleQ.refetch?.();
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر بدء الخدمة.' : 'Could not start service.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={!CENTER_MAIN_SCREENS.includes(code)} onBack={() => nav.back('SC03')} />
      <div className="p-4 space-y-3.5 flex-1">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isInProgress
              ? providerLabel('InProgress', isAr)
              : booking?.status === 'Completed'
              ? providerLabel('Completed', isAr)
              : (isAr ? 'موعد مقبول' : 'Accepted appointment')}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {booking ? `${booking.code} · ${fmtDate(booking.slotStart, lang)}` : '—'}
          </p>
        </div>

        {booking && (
          <>
            <div>
              <StatusBadge status={isInProgress ? 'InProgress' : booking.status} />
            </div>

            <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs`}>
              <p className={`font-extrabold ${colors.text}`}>
                {booking.customerName || (isAr ? 'عميل' : 'Customer')}
              </p>
              {booking.vehicleLabel && (
                <p className={`text-[11px] ${colors.secondaryText}`}>{booking.vehicleLabel}</p>
              )}
              {booking.customerPhone && (
                <div className="flex justify-between pt-1">
                  <span className={colors.secondaryText}>
                    {isAr ? 'هاتف العميل' : 'Customer phone'}
                  </span>
                  <a
                    href={`tel:${booking.customerPhone}`}
                    dir="ltr"
                    className={`font-bold ${colors.text}`}
                  >
                    {booking.customerPhone}
                  </a>
                </div>
              )}
              <div className="flex justify-between">
                <span className={colors.secondaryText}>{isAr ? 'الخدمة' : 'Service'}</span>
                <span className={`font-bold ${colors.text}`}>
                  {booking.serviceName || (isAr ? 'خدمة صيانة' : 'Service')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={colors.secondaryText}>{isAr ? 'الفترة' : 'Slot'}</span>
                <span className={`font-bold ${colors.text}`}>
                  {fmtTime(booking.slotStart, lang)}–{fmtTime(booking.slotEnd, lang)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={colors.secondaryText}>{isAr ? 'السعر' : 'Price'}</span>
                <span className={`font-bold ${colors.text}`}>
                  {fmtMoney(booking.priceMinor, lang)}
                </span>
              </div>
            </div>

            <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2 text-xs`}>
              <p className={`font-extrabold ${colors.text}`}>
                {isAr ? 'قبل البدء' : 'Before starting'}
              </p>
              {checklistLabels.map((label, idx) => (
                <button
                  key={idx}
                  type="button"
                  data-testid={`checkin-check-${idx}`}
                  onClick={() => toggleCheck(idx)}
                  className="w-full flex items-center gap-2 text-start"
                >
                  <CheckCircle2
                    size={14}
                    className={checks[idx] ? 'text-emerald-500' : colors.secondaryText}
                  />
                  <span className={colors.text}>{label}</span>
                </button>
              ))}
              {booking.note && (
                <p className={`text-[11px] ${colors.secondaryText} pt-1`}>
                  {isAr ? 'ملاحظة العميل: ' : 'Customer note: '}
                  {booking.note}
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={!isInProgress}
              onClick={() => isInProgress && nav.go('SC12', { id: booking.id })}
              className={`w-full p-3 rounded-2xl border ${colors.border} ${colors.surface} flex justify-between items-center text-start ${!isInProgress ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div>
                <p className={`text-xs font-extrabold ${colors.text}`}>
                  {isAr ? 'إتمام الخدمة' : 'Complete Service'}
                </p>
                <p className={`text-[10px] ${colors.secondaryText}`}>
                  {isInProgress
                    ? (isAr ? 'الخدمة جارية الآن — اضغط لإصدار الفاتورة' : 'Service is in progress — tap to complete & invoice')
                    : (isAr ? 'متاح بعد بدء الخدمة' : 'Available after service starts')}
                </p>
              </div>
              <ForwardChevron size={15} className={colors.secondaryText} />
            </button>

            {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}

            <div className="space-y-2">
              <PrimaryButton onClick={handleStartService} disabled={busy} testId="screen-primary">
                {busy
                  ? (isAr ? 'جارٍ البدء…' : 'Starting…')
                  : isInProgress
                  ? (isAr ? 'المتابعة لإتمام الخدمة والفاتورة' : 'Proceed to Complete Service & Invoice')
                  : (isAr ? 'بدء الخدمة' : 'Start Service')}
              </PrimaryButton>
              <SecondaryButton onClick={() => nav.go('SC06', { id: booking.id })}>
                {isAr ? 'عرض أوامر الشغل' : 'View Work Orders'}
              </SecondaryButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── SC12: Complete Service & Invoice ─────────────────────────────────────────
export function SC12Screen({ id, params, code = 'SC12' }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const queryClient = useQueryClient();

  const targetId = id || params?.id;
  const bookingsQ = useBookings();
  const singleQ = useBooking(targetId);

  const bookings = Array.isArray(bookingsQ.data) ? bookingsQ.data : [];
  const booking =
    singleQ.data ||
    bookings.find((x) => String(x.id) === String(targetId)) ||
    bookings.find((x) => x.status === 'InProgress' || x.status === 'Confirmed') ||
    bookings[0];

  const [checks, setChecks] = useState([false, false, false, false]);
  const [extraDescription, setExtraDescription] = useState('');
  const [extraAmountEgp, setExtraAmountEgp] = useState('');
  const [notes, setNotes] = useState('');
  const [completed, setCompleted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const completionChecks = [
    isAr ? 'تم تنفيذ الخدمة المطلوبة بالكامل' : 'Requested service completed in full',
    isAr ? 'تم فحص مستويات السوائل والتسريبات' : 'Fluid levels and leaks checked',
    isAr ? 'تم فحص ضغط الإطارات كما طُلب' : 'Tire pressure checked as requested',
    isAr ? 'المركبة جاهزة لاستلام العميل' : 'Vehicle ready for customer collection'
  ];

  const parsedExtraEgp = Number(extraAmountEgp);
  const extraMinor = Math.max(0, Math.round((Number.isFinite(parsedExtraEgp) ? parsedExtraEgp : 0) * 100));
  const baseMinor = booking?.basePriceMinor ?? booking?.priceMinor ?? 0;
  const totalMinor = baseMinor + extraMinor;

  async function handleComplete(e) {
    if (e) e.preventDefault();
    if (!booking?.id) return;
    setError('');
    setBusy(true);
    try {
      if (booking.status === 'Confirmed') {
        await post(`/center-admin/bookings/${booking.id}/start`, {}).catch(() => {});
      }
      await post(`/center-admin/bookings/${booking.id}/complete`, {
        extraDescription: extraDescription.trim() || null,
        extraMinor,
        notes: notes.trim() || null
      });
      await queryClient.invalidateQueries({ queryKey: ['bookings'] });
      await queryClient.invalidateQueries({ queryKey: ['center-admin', 'work-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['center-admin', 'reports'] });
      setCompleted(true);
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر إتمام الخدمة.' : 'Could not complete service.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={!CENTER_MAIN_SCREENS.includes(code)} onBack={() => nav.back('SC11')} />
      <div className="p-4 space-y-3.5 flex-1">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'إتمام الخدمة والفاتورة' : 'Complete service & invoice'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {booking ? `${booking.code} · ${fmtDate(booking.slotStart, lang)}` : '—'}
          </p>
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2 text-xs`}>
          <p className={`font-extrabold ${colors.text}`}>
            {isAr ? 'فحوصات الإتمام' : 'Completion checks'}
          </p>
          {completionChecks.map((chk, idx) => (
            <button
              key={idx}
              type="button"
              data-testid={`completion-check-${idx}`}
              onClick={() => setChecks((prev) => prev.map((v, i) => (i === idx ? !v : v)))}
              className="w-full flex items-center gap-2 text-start"
            >
              <CheckCircle2
                size={14}
                className={checks[idx] ? 'text-emerald-500' : colors.secondaryText}
              />
              <span className={colors.text}>{chk}</span>
            </button>
          ))}
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2 text-xs`}>
          <p className={`font-extrabold ${colors.text}`}>
            {isAr ? 'فاتورة الخدمة' : 'Service invoice'}
          </p>
          <div className="flex justify-between">
            <span className={colors.secondaryText}>{isAr ? 'العميل' : 'Customer'}</span>
            <span className={`font-bold ${colors.text}`}>
              {booking?.customerName || (isAr ? 'عميل' : 'Customer')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={colors.secondaryText}>
              {booking?.serviceName || (isAr ? 'الخدمة الأساسية' : 'Base service')}
            </span>
            <span className={`font-bold ${colors.text}`}>
              {fmtMoney(baseMinor, lang)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <input
              data-testid="field-extraDescription"
              type="text"
              value={extraDescription}
              onChange={(e) => setExtraDescription(e.target.value)}
              placeholder={isAr ? 'بند إضافي (اختياري)' : 'Extra item (optional)'}
              className={`px-2.5 h-9 rounded-xl border ${colors.border} ${colors.inputBg} text-xs ${colors.text}`}
            />
            <input
              data-testid="field-extraAmount"
              type="number"
              min="0"
              value={extraAmountEgp}
              onChange={(e) => setExtraAmountEgp(e.target.value)}
              placeholder={isAr ? 'المبلغ (ج.م)' : 'Amount (EGP)'}
              className={`px-2.5 h-9 rounded-xl border ${colors.border} ${colors.inputBg} text-xs ${colors.text}`}
            />
          </div>
          <div className="flex justify-between pt-2 border-t border-slate-500/10">
            <span className={colors.secondaryText}>
              {isAr ? 'الإجمالي المستحق بالمركز' : 'Total due at center'}
            </span>
            <span className={`font-extrabold ${colors.text}`} data-testid="invoice-total">
              {fmtMoney(totalMinor, lang)}
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <label className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'ملاحظات الإتمام' : 'Completion notes'}
          </label>
          <textarea
            data-testid="field-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              isAr
                ? 'تم إتمام الخدمة وفحص المركبة بالكامل.'
                : 'Service completed and vehicle inspected.'
            }
            className={`w-full p-3 rounded-xl border ${colors.border} ${colors.surface} text-xs ${colors.text}`}
          />
        </div>

        {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}

        {completed && (
          <div
            data-testid="completion-banner"
            className="p-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-[11px] space-y-1"
          >
            <p className="font-bold text-emerald-500">
              {isAr ? 'اكتملت الخدمة · تم إشعار العميل' : 'Service completed · Customer notified'}
            </p>
            <p className={colors.secondaryText}>
              {isAr
                ? `تم إصدار الفاتورة بقيمة ${fmtMoney(totalMinor, lang)}.`
                : `Invoice issued for ${fmtMoney(totalMinor, lang)}.`}
            </p>
          </div>
        )}

        {!completed && (
          <PrimaryButton onClick={handleComplete} disabled={busy} testId="screen-primary">
            {busy
              ? (isAr ? 'جارٍ الإصدار…' : 'Completing…')
              : (isAr ? 'إصدار الفاتورة وإتمام الخدمة' : 'Issue Invoice & Complete')}
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}

// ─── SC13: Assign Work Order ──────────────────────────────────────────────────
export function SC13Screen({ id, params, code = 'SC13' }) {
  const colors = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const queryClient = useQueryClient();

  const workOrdersQ = useWorkOrders();
  const bookingsQ = useBookings();
  const baysQ = useCenterBays();
  const techsQ = useTechnicians();

  const workOrders = Array.isArray(workOrdersQ.data) ? workOrdersQ.data : [];
  const bookings = Array.isArray(bookingsQ.data) ? bookingsQ.data : [];
  const bays = Array.isArray(baysQ.data) ? baysQ.data : [];
  const techs = Array.isArray(techsQ.data) ? techsQ.data : [];

  const [woId, setWoId] = useState(id || params?.id || '');
  const [bayId, setBayId] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [notes, setNotes] = useState('');
  const [assigned, setAssigned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!woId && workOrders.length > 0) setWoId(workOrders[0].id);
  }, [woId, workOrders]);

  useEffect(() => {
    if (!bayId && bays.length > 0) setBayId(bays[0].id);
  }, [bayId, bays]);

  useEffect(() => {
    if (!technicianId && techs.length > 0) setTechnicianId(techs[0].id);
  }, [technicianId, techs]);

  const selectedWo = workOrders.find((w) => String(w.id) === String(woId)) || workOrders[0];
  const linkedBooking = bookings.find((b) => String(b.id) === String(selectedWo?.bookingId));

  async function handleAssign(e) {
    if (e) e.preventDefault();
    const targetWoId = selectedWo?.id || woId;
    if (!targetWoId) {
      setError(isAr ? 'لا يوجد أمر شغل للتعيين.' : 'No work order available to assign.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await post(`/center-admin/work-orders/${targetWoId}/assign`, {
        bayId: bayId || null,
        technicianId: technicianId || null,
        notes: notes.trim() || null
      });
      await queryClient.invalidateQueries({ queryKey: ['center-admin', 'work-orders'] });
      setAssigned(true);
      nav.go('SC14', { id: targetWoId });
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر تعيين أمر الشغل.' : 'Could not assign work order.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={!CENTER_MAIN_SCREENS.includes(code)} onBack={() => nav.back('SC06')} />
      <form onSubmit={handleAssign} className="p-4 space-y-3.5 flex-1">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'تعيين أمر شغل' : 'Assign a work order'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {isAr ? 'اختر أمر الشغل والحارة والفني المتاح.' : 'Select work order, bay and technician.'}
          </p>
        </div>

        <div className="space-y-1">
          <label className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'أمر الشغل / الحجز' : 'Work order / Booking'}
          </label>
          <select
            data-testid="field-workOrderId"
            value={woId}
            onChange={(e) => setWoId(e.target.value)}
            className={`w-full px-3 h-11 rounded-xl border ${colors.border} ${colors.surface} text-xs font-bold ${colors.text}`}
          >
            {workOrders.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} {w.bookingCode ? `· ${w.bookingCode}` : ''} {w.serviceName ? `· ${w.serviceName}` : ''}
              </option>
            ))}
          </select>
        </div>

        {linkedBooking && (
          <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1 text-xs`}>
            <p className={`font-extrabold ${colors.text}`}>
              {linkedBooking.customerName || (isAr ? 'عميل' : 'Customer')}
            </p>
            <p className={`text-[11px] ${colors.secondaryText}`}>
              {linkedBooking.serviceName}
            </p>
            <div className="flex justify-between pt-1">
              <span className={colors.secondaryText}>{isAr ? 'حالة الحجز' : 'Booking status'}</span>
              <StatusBadge status={linkedBooking.status} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className={`text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'الحارة المتاحة' : 'Available bay'}
            </label>
            <select
              data-testid="field-bayId"
              value={bayId}
              onChange={(e) => setBayId(e.target.value)}
              className={`w-full px-3 h-11 rounded-xl border ${colors.border} ${colors.surface} text-xs font-bold ${colors.text}`}
            >
              {bays.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={`text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'الفني' : 'Technician'}
            </label>
            <select
              data-testid="field-technicianId"
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value)}
              className={`w-full px-3 h-11 rounded-xl border ${colors.border} ${colors.surface} text-xs font-bold ${colors.text}`}
            >
              {techs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'ملاحظات أمر الشغل' : 'Work order notes'}
          </label>
          <textarea
            data-testid="field-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={isAr ? 'أدخل ملاحظات الفحص أو الصيانة…' : 'Enter diagnostic or repair notes…'}
            className={`w-full p-3 rounded-xl border ${colors.border} ${colors.surface} text-xs ${colors.text}`}
          />
        </div>

        {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}

        {assigned && (
          <div
            data-testid="assigned-banner"
            className="p-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-[11px] space-y-0.5"
          >
            <p className="font-bold text-emerald-500">
              {isAr ? 'تم تعيين أمر الشغل' : 'Work order assigned'}
            </p>
          </div>
        )}

        <PrimaryButton type="submit" disabled={busy} testId="screen-primary">
          {busy
            ? (isAr ? 'جارٍ التعيين…' : 'Assigning…')
            : (isAr ? 'تعيين أمر الشغل' : 'Assign Work Order')}
        </PrimaryButton>
      </form>
    </div>
  );
}

// ─── SC14: Work Order Details ─────────────────────────────────────────────────
export function SC14Screen({ id, params, code = 'SC14' }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const queryClient = useQueryClient();

  const targetId = id || params?.id;
  const workOrdersQ = useWorkOrders();
  const baysQ = useCenterBays();
  const techsQ = useTechnicians();

  const workOrders = Array.isArray(workOrdersQ.data) ? workOrdersQ.data : [];
  const bays = Array.isArray(baysQ.data) ? baysQ.data : [];
  const techs = Array.isArray(techsQ.data) ? techsQ.data : [];

  const wo =
    workOrders.find((w) => String(w.id) === String(targetId)) ||
    workOrders[0];

  const [checks, setChecks] = useState([false, false, false]);
  const [supervisorReviewed, setSupervisorReviewed] = useState(false);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (wo) {
      setNotes(wo.notes || '');
      setSupervisorReviewed(!!wo.supervisorReviewed);
    }
  }, [wo]);

  const bayName =
    wo?.bayName ||
    bays.find((b) => String(b.id) === String(wo?.bayId))?.name ||
    (isAr ? 'غير معينة' : 'Unassigned');
  const techName =
    wo?.technicianName ||
    techs.find((t) => String(t.id) === String(wo?.technicianId))?.name ||
    (isAr ? 'غير معين' : 'Unassigned');

  const diagLabels = [
    isAr ? 'اكتمل الفحص البصري المبدئي' : 'Initial visual inspection completed',
    isAr ? 'تم فحص الأجزاء الميكانيكية' : 'Mechanical components inspected',
    isAr ? 'تم تسجيل مسح الأعطال بالكمبيوتر' : 'Diagnostic fault scan recorded'
  ];

  async function handleAdvance() {
    if (!wo?.id) return;
    setError('');
    setBusy(true);
    try {
      await post(`/center-admin/work-orders/${wo.id}/advance`, {
        notes: notes.trim() || null,
        supervisorReviewed
      });
      await queryClient.invalidateQueries({ queryKey: ['center-admin', 'work-orders'] });
      nav.go('SC06');
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر تحديث أمر الشغل.' : 'Could not advance work order.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={!CENTER_MAIN_SCREENS.includes(code)} onBack={() => nav.back('SC06')} />
      <div className="p-4 space-y-3.5 flex-1">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'تفاصيل أمر الشغل' : 'Work order details'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {wo ? `${wo.code}${wo.customerName ? ` · ${wo.customerName}` : ''}` : '—'}
          </p>
        </div>

        {wo && (
          <>
            <div>
              <StatusBadge status={wo.status} />
            </div>

            <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs`}>
              <p className={`font-extrabold ${colors.text}`}>
                {wo.serviceName || wo.bookingCode || (isAr ? 'خدمة صيانة' : 'Service')}
              </p>
              <div className="flex justify-between">
                <span className={colors.secondaryText}>
                  {isAr ? 'الفني المعين' : 'Assigned mechanic'}
                </span>
                <span className={`font-bold ${colors.text}`}>{techName}</span>
              </div>
              <div className="flex justify-between">
                <span className={colors.secondaryText}>
                  {isAr ? 'حارة الخدمة' : 'Service bay'}
                </span>
                <span className={`font-bold ${colors.text}`}>{bayName}</span>
              </div>
              {wo.startedAt && (
                <div className="flex justify-between">
                  <span className={colors.secondaryText}>{isAr ? 'بدأ' : 'Started'}</span>
                  <span className={`font-bold ${colors.text}`}>
                    {fmtDateTime(wo.startedAt, lang)}
                  </span>
                </div>
              )}
            </div>

            <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2 text-xs`}>
              <p className={`font-extrabold ${colors.text}`}>
                {isAr ? 'قائمة الفحص التشخيصي' : 'Diagnostics checklist'}
              </p>
              {diagLabels.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  data-testid={`diag-check-${idx}`}
                  onClick={() => setChecks((prev) => prev.map((v, i) => (i === idx ? !v : v)))}
                  className="w-full flex items-center gap-2 text-start"
                >
                  <CheckCircle2
                    size={14}
                    className={checks[idx] ? 'text-emerald-500' : colors.secondaryText}
                  />
                  <span className={colors.text}>{item}</span>
                </button>
              ))}
              <button
                type="button"
                data-testid="toggle-supervisor"
                onClick={() => setSupervisorReviewed((v) => !v)}
                className="w-full flex items-center gap-2 text-start"
              >
                <CheckCircle2
                  size={14}
                  className={supervisorReviewed ? 'text-emerald-500' : colors.secondaryText}
                />
                <span className={colors.text}>
                  {isAr ? 'تمت مراجعة النتائج بواسطة المشرف' : 'Findings reviewed by supervisor'}
                </span>
              </button>
            </div>

            <div className="space-y-1">
              <label className={`text-[10px] ${colors.secondaryText}`}>
                {isAr ? 'ملاحظات الميكانيكي' : 'Mechanic notes'}
              </label>
              <textarea
                data-testid="field-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`w-full p-3 rounded-xl border ${colors.border} ${colors.surface} text-xs ${colors.text}`}
              />
            </div>

            {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}

            {wo.status !== 'Closed' && (
              <PrimaryButton onClick={handleAdvance} disabled={busy} testId="screen-primary">
                {busy
                  ? (isAr ? 'جارٍ التحديث…' : 'Updating…')
                  : (isAr ? 'تحديد كجاهز للمراجعة' : 'Advance / Mark Ready for Review')}
              </PrimaryButton>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── SC15: Edit Working Hours ─────────────────────────────────────────────────
export function SC15Screen({ code = 'SC15' }) {
  const colors = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const queryClient = useQueryClient();

  const hoursQ = useCenterHours();
  const profileQ = useCenterProfile();

  const [days, setDays] = useState(() =>
    DAY_NAMES.map((d) => ({
      dayOfWeek: d.dow,
      isClosed: d.dow === 5,
      openTime: '09:00',
      closeTime: '20:00',
      isSpecial: false
    }))
  );
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (Array.isArray(hoursQ.data) && hoursQ.data.length > 0) {
      setDays(
        DAY_NAMES.map((d) => {
          const found = hoursQ.data.find((h) => Number(h.dayOfWeek) === d.dow);
          return {
            dayOfWeek: d.dow,
            isClosed: found ? !!found.isClosed : d.dow === 5,
            openTime: trimTimeSpan(found?.openTime, '09:00'),
            closeTime: trimTimeSpan(found?.closeTime, '20:00'),
            isSpecial: found ? !!found.isSpecial : false
          };
        })
      );
    }
  }, [hoursQ.data]);

  const updateDay = (dow, patch) => {
    setDays((prev) =>
      prev.map((item) => (item.dayOfWeek === dow ? { ...item, ...patch } : item))
    );
  };

  async function handleSave(e) {
    if (e) e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = days.map((d) => ({
        dayOfWeek: d.dayOfWeek,
        isClosed: !!d.isClosed,
        openTime: toTimeSpan(d.openTime, '09:00:00'),
        closeTime: toTimeSpan(d.closeTime, '20:00:00'),
        isSpecial: !!d.isSpecial
      }));
      await put('/center-admin/hours', payload);
      await queryClient.invalidateQueries({ queryKey: ['center-admin', 'hours'] });
      setToast(isAr ? 'تم حفظ ساعات العمل' : 'Working hours saved');
      nav.go('SC09');
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر حفظ ساعات العمل.' : 'Could not save working hours.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={!CENTER_MAIN_SCREENS.includes(code)} onBack={() => nav.back('SC09')} />
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      <form onSubmit={handleSave} className="p-4 space-y-3.5 flex-1">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'تعديل ساعات العمل' : 'Edit working hours'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {profileQ.data?.name || (isAr ? 'مركز الخدمة' : 'Service Center')} ·{' '}
            {isAr ? 'التوافر الأسبوعي' : 'Weekly availability'}
          </p>
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2.5 text-xs`}>
          <p className={`font-extrabold ${colors.text}`}>
            {isAr ? 'الجدول الأسبوعي' : 'Weekly schedule'}
          </p>
          {days.map((d) => {
            const meta = DAY_NAMES.find((x) => x.dow === d.dayOfWeek);
            return (
              <div
                key={d.dayOfWeek}
                className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-500/10 last:border-0"
              >
                <span className={`font-bold w-20 ${colors.text}`}>
                  {isAr ? meta?.ar : meta?.en}
                </span>
                {!d.isClosed ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      data-testid={`open-${d.dayOfWeek}`}
                      type="time"
                      value={d.openTime}
                      onChange={(e) => updateDay(d.dayOfWeek, { openTime: e.target.value })}
                      className={`px-2 py-1 rounded-lg border ${colors.border} ${colors.inputBg} text-[11px] ${colors.text}`}
                    />
                    <span className={colors.secondaryText}>–</span>
                    <input
                      data-testid={`close-${d.dayOfWeek}`}
                      type="time"
                      value={d.closeTime}
                      onChange={(e) => updateDay(d.dayOfWeek, { closeTime: e.target.value })}
                      className={`px-2 py-1 rounded-lg border ${colors.border} ${colors.inputBg} text-[11px] ${colors.text}`}
                    />
                  </div>
                ) : (
                  <span className={`text-[11px] ${colors.secondaryText}`}>
                    {isAr ? 'مغلق' : 'Closed'}
                  </span>
                )}
                <button
                  type="button"
                  role="switch"
                  aria-checked={!d.isClosed}
                  data-testid={`toggle-day-${d.dayOfWeek}`}
                  onClick={() => updateDay(d.dayOfWeek, { isClosed: !d.isClosed })}
                  className={`w-9 h-5 rounded-full transition-colors p-0.5 flex items-center ${
                    !d.isClosed ? 'bg-emerald-500 justify-end' : 'bg-slate-600 justify-start'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow" />
                </button>
              </div>
            );
          })}
        </div>

        {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}

        <PrimaryButton type="submit" disabled={busy} testId="screen-primary">
          {busy
            ? (isAr ? 'جارٍ الحفظ…' : 'Saving…')
            : (isAr ? 'حفظ ساعات العمل' : 'Save Working Hours')}
        </PrimaryButton>
      </form>
    </div>
  );
}

// ─── SC16: Reject Appointment ─────────────────────────────────────────────────
export function SC16Screen({ id, params, code = 'SC16' }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const queryClient = useQueryClient();

  const targetId = id || params?.id;
  const bookingsQ = useBookings();
  const singleQ = useBooking(targetId);
  const bootstrapQ = useBootstrap();

  const bookings = Array.isArray(bookingsQ.data) ? bookingsQ.data : [];
  const booking =
    singleQ.data ||
    bookings.find((x) => String(x.id) === String(targetId)) ||
    bookings.find((x) => x.status === 'Pending') ||
    bookings[0];

  const rejectReasons = useMemo(() => {
    const raw = bootstrapQ.data?.rejectReasons;
    if (Array.isArray(raw) && raw.length > 0) return raw;
    return [
      { key: 'no_bay', labelEn: 'No bay available at requested time', labelAr: 'لا توجد حارة متاحة في الوقت المطلوب' },
      { key: 'fully_booked', labelEn: 'Center is fully booked', labelAr: 'المركز محجوز بالكامل' },
      { key: 'outside_hours', labelEn: 'Outside working hours', labelAr: 'خارج ساعات العمل' }
    ];
  }, [bootstrapQ.data?.rejectReasons]);

  const [reasonKey, setReasonKey] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!reasonKey && rejectReasons.length > 0) {
      setReasonKey(rejectReasons[0].labelEn || rejectReasons[0].key);
    }
  }, [reasonKey, rejectReasons]);

  async function handleReject(e) {
    if (e) e.preventDefault();
    if (!booking?.id) return;
    setError('');
    setBusy(true);
    try {
      const combinedReason = [reasonKey, message.trim()].filter(Boolean).join(' — ');
      await post(`/center-admin/bookings/${booking.id}/reject`, {
        reason: combinedReason || 'Unavailable'
      });
      await queryClient.invalidateQueries({ queryKey: ['bookings'] });
      nav.go('SC02');
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر رفض الموعد.' : 'Could not reject appointment.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={!CENTER_MAIN_SCREENS.includes(code)} onBack={() => nav.back('SC03')} />
      <form onSubmit={handleReject} className="p-4 space-y-3.5 flex-1">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'رفض الموعد؟' : 'Reject appointment?'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {booking ? `${booking.code} · ${isAr ? 'طلب قيد الانتظار' : 'Pending request'}` : '—'}
          </p>
        </div>

        {booking && (
          <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs`}>
            <p className={`font-extrabold ${colors.text}`}>
              {booking.serviceName || (isAr ? 'خدمة صيانة' : 'Service')}
            </p>
            <p className={`text-[11px] ${colors.secondaryText}`}>
              {booking.customerName || (isAr ? 'عميل' : 'Customer')}
            </p>
            <div className="flex justify-between pt-1">
              <span className={colors.secondaryText}>
                {isAr ? 'الفترة المطلوبة' : 'Requested slot'}
              </span>
              <span className={`font-bold ${colors.text}`}>
                {fmtDateTime(booking.slotStart, lang)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className={colors.secondaryText}>
                {isAr ? 'سعر الخدمة' : 'Service price'}
              </span>
              <span className={`font-bold ${colors.text}`}>
                {fmtMoney(booking.priceMinor, lang)}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'سبب الرفض · مطلوب' : 'Rejection reason · Required'}
          </label>
          <select
            data-testid="field-reason"
            value={reasonKey}
            onChange={(e) => setReasonKey(e.target.value)}
            className={`w-full px-3 h-11 rounded-xl border ${colors.border} ${colors.surface} text-xs font-bold ${colors.text}`}
          >
            {rejectReasons.map((r) => (
              <option key={r.id || r.key} value={isAr ? r.labelAr : r.labelEn}>
                {isAr ? r.labelAr : r.labelEn}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'رسالة للعميل' : 'Message to customer'}
          </label>
          <textarea
            data-testid="field-message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              isAr
                ? 'يرجى اختيار فترة أخرى وسنسعد بخدمتك.'
                : 'Please choose another slot and we will be happy to help.'
            }
            className={`w-full p-3 rounded-xl border ${colors.border} ${colors.surface} text-xs ${colors.text}`}
          />
        </div>

        {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}

        <div className="space-y-2 pt-1">
          <PrimaryButton type="submit" disabled={busy} testId="screen-primary">
            {busy
              ? (isAr ? 'جارٍ الرفض…' : 'Rejecting…')
              : (isAr ? 'تأكيد الرفض وإبلاغ العميل' : 'Confirm Rejection')}
          </PrimaryButton>
          <SecondaryButton onClick={() => nav.go('SC03', booking ? { id: booking.id } : {})}>
            {isAr ? 'الإبقاء على الموعد' : 'Keep Appointment'}
          </SecondaryButton>
        </div>
      </form>
    </div>
  );
}

// ─── SC17: Bays & Technicians ─────────────────────────────────────────────────
export function SC17Screen({ code = 'SC17' }) {
  const colors = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const queryClient = useQueryClient();

  const baysQ = useCenterBays();
  const techsQ = useTechnicians();

  const [bayName, setBayName] = useState('');
  const [techName, setTechName] = useState('');
  const [techPhone, setTechPhone] = useState('');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [busyBay, setBusyBay] = useState(false);
  const [busyTech, setBusyTech] = useState(false);

  const bays = Array.isArray(baysQ.data) ? baysQ.data : [];
  const techs = Array.isArray(techsQ.data) ? techsQ.data : [];

  async function handleAddBay(e) {
    if (e) e.preventDefault();
    if (!bayName.trim()) return;
    setError('');
    setBusyBay(true);
    try {
      await post('/center-admin/bays', { name: bayName.trim() });
      setBayName('');
      await queryClient.invalidateQueries({ queryKey: ['center-admin', 'bays'] });
      setToast(isAr ? 'تمت إضافة الحارة' : 'Bay added');
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر إضافة الحارة.' : 'Could not add bay.'));
    } finally {
      setBusyBay(false);
    }
  }

  async function handleAddTech(e) {
    if (e) e.preventDefault();
    if (!techName.trim()) return;
    setError('');
    setBusyTech(true);
    try {
      await post('/center-admin/technicians', {
        name: techName.trim(),
        phone: techPhone.trim()
      });
      setTechName('');
      setTechPhone('');
      await queryClient.invalidateQueries({ queryKey: ['center-admin', 'technicians'] });
      setToast(isAr ? 'تمت إضافة الفني' : 'Technician added');
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر إضافة الفني.' : 'Could not add technician.'));
    } finally {
      setBusyTech(false);
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={!CENTER_MAIN_SCREENS.includes(code)} onBack={() => nav.back('SC09')} />
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      <div className="p-4 space-y-4 flex-1">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'الحارات والفنيون' : 'Bays & technicians'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {isAr ? 'إدارة حارات الصيانة وفريق الفنيين.' : 'Manage your service bays and technician team.'}
          </p>
        </div>

        {/* Bays section */}
        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2.5`}>
          <p className={`text-xs font-extrabold ${colors.text}`}>
            {isAr ? 'حارات الخدمة' : 'Service bays'} ({bays.length})
          </p>
          <div className="space-y-1.5">
            {bays.map((b) => (
              <div
                key={b.id}
                data-testid="bay-item"
                className={`p-2.5 rounded-xl border ${colors.border} flex items-center justify-between text-xs`}
              >
                <span className={`font-bold ${colors.text}`}>{b.name}</span>
                <StatusBadge status="Active" />
              </div>
            ))}
          </div>
          <form onSubmit={handleAddBay} className="flex gap-2 pt-1">
            <input
              data-testid="field-bayName"
              type="text"
              value={bayName}
              onChange={(e) => setBayName(e.target.value)}
              placeholder={isAr ? 'اسم الحارة الجديدة' : 'New bay name'}
              className={`flex-1 px-3 h-10 rounded-xl border ${colors.border} ${colors.inputBg} text-xs ${colors.text}`}
            />
            <button
              type="submit"
              data-testid="add-bay-btn"
              disabled={busyBay}
              className="px-3.5 h-10 rounded-xl bg-[#E51C23] text-white text-xs font-bold flex items-center gap-1"
            >
              <Plus size={14} />
              <span>{isAr ? 'إضافة' : 'Add'}</span>
            </button>
          </form>
        </div>

        {/* Technicians section */}
        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2.5`}>
          <p className={`text-xs font-extrabold ${colors.text}`}>
            {isAr ? 'الفنيون' : 'Technicians'} ({techs.length})
          </p>
          <div className="space-y-1.5">
            {techs.map((t) => (
              <div
                key={t.id}
                data-testid="tech-item"
                className={`p-2.5 rounded-xl border ${colors.border} flex items-center justify-between text-xs`}
              >
                <div>
                  <p className={`font-bold ${colors.text}`}>{t.name}</p>
                  {t.phone && <p className={`text-[10px] ${colors.secondaryText}`} dir="ltr">{t.phone}</p>}
                </div>
                <StatusBadge status="Active" />
              </div>
            ))}
          </div>
          <form onSubmit={handleAddTech} className="space-y-2 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <input
                data-testid="field-techName"
                type="text"
                value={techName}
                onChange={(e) => setTechName(e.target.value)}
                placeholder={isAr ? 'اسم الفني' : 'Technician name'}
                className={`px-3 h-10 rounded-xl border ${colors.border} ${colors.inputBg} text-xs ${colors.text}`}
              />
              <input
                data-testid="field-techPhone"
                type="tel"
                dir="ltr"
                value={techPhone}
                onChange={(e) => setTechPhone(e.target.value)}
                placeholder={isAr ? 'رقم الهاتف' : 'Phone number'}
                className={`px-3 h-10 rounded-xl border ${colors.border} ${colors.inputBg} text-xs ${colors.text}`}
              />
            </div>
            <PrimaryButton type="submit" disabled={busyTech} testId="screen-primary">
              <Plus size={14} />
              <span>{isAr ? 'إضافة فني' : 'Add Technician'}</span>
            </PrimaryButton>
          </form>
        </div>

        {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
      </div>
    </div>
  );
}

export const CENTER_COMPONENTS = {
  SC01: SC01Screen,
  SC02: SC02Screen,
  SC03: SC03Screen,
  SC04: SC04Screen,
  SC05: SC05Screen,
  SC06: SC06Screen,
  SC07: SC07Screen,
  SC08: SC08Screen,
  SC09: SC09Screen,
  SC10: SC10Screen,
  SC11: SC11Screen,
  SC12: SC12Screen,
  SC13: SC13Screen,
  SC14: SC14Screen,
  SC15: SC15Screen,
  SC16: SC16Screen,
  SC17: SC17Screen
};

export default CENTER_COMPONENTS;
