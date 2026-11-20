// Shared UI kit — stable top-level components moved out of the legacy App().
// Visual design kept 1:1; all content comes from props/context, never mock data.
import React, { useState } from 'react';
import {
  ChevronLeft, ChevronRight, AlertTriangle, Phone, Navigation, Check,
  MapPin, Star, Loader2, AlertCircle, RefreshCw, X, Upload, ShieldCheck
} from 'lucide-react';
import { usePrefs, useNav, useSession, useNavigate } from '../app/stores.jsx';
import { fmtMoney } from '../i18n/format.js';

export { usePrefs, useNav, useSession, useNavigate };

export function egp(minor, isAr = false) {
  return fmtMoney(Number(minor ?? 0), isAr ? 'ar' : 'en');
}

// ---- Brand ----
export function ShieldLogo({ size = 40 }) {
  return (
    <div style={{ width: size, height: size }} className="relative flex items-center justify-center shrink-0 select-none" aria-label="FixNGo">
      <svg viewBox="0 0 120 130" className="w-full h-full drop-shadow-sm">
        <path d="M60 4 L112 24 C112 68 98 102 60 126 C22 102 8 68 8 24 L60 4 Z" fill="#141416" />
        <path d="M60 13 L103 30 C103 66 91 95 60 116 C29 95 17 66 17 30 L60 13 Z" fill="#141416" stroke="#FF0000" strokeWidth="6.5" strokeLinejoin="round" />
        <path d="M32 52 L39 36 C41 33 45 32 60 32 C75 32 79 33 81 36 L88 52 L93 54 C95 55 96 57 96 60 L96 69 C96 71 94 72 91 72 L83 72 C81 72 80 70 80 67 L78 65 L42 65 L40 67 C40 70 39 72 37 72 L29 72 C26 72 24 71 24 69 L24 60 C24 57 25 55 27 54 L32 52 Z" fill="#FFFFFF" />
        <rect x="24" y="45" width="7" height="4.5" rx="2" fill="#FFFFFF" />
        <rect x="89" y="45" width="7" height="4.5" rx="2" fill="#FFFFFF" />
        <path d="M42 37 L37 49 L83 49 L78 37 C73 36 47 36 42 37 Z" fill="#141416" />
        <path d="M28 55 L42 58 L39 62 L28 59 Z" fill="#141416" />
        <path d="M92 55 L78 58 L81 62 L92 59 Z" fill="#141416" />
        <path d="M45 59 L75 59 L71 63 L49 63 Z" fill="#141416" />
        <path d="M54 89 L54 113 L66 113 L66 89 C73 86 77 79 75 71 C74 66 70 63 66 62 L66 74 C66 77 63 79 60 79 C57 79 54 77 54 74 L54 62 C50 63 46 66 45 71 C43 79 47 86 54 89 Z" fill="#FF0000" />
      </svg>
    </div>
  );
}

export function BrandLockup({ iconSize = 30, textSize = 'text-base' }) {
  const { isDark } = usePrefs();
  return (
    <span className="inline-flex items-center gap-2 select-none" dir="ltr">
      <ShieldLogo size={iconSize} />
      <span className={`font-black italic tracking-tight ${textSize} ${isDark ? 'text-white' : 'text-[#111318]'}`}>
        Fix<span className="text-[#FF0000]">N</span>Go
      </span>
    </span>
  );
}

// ---- Theme colours (identical values to the prototype) ----
export function useColors() {
  const { isDark } = usePrefs();
  return isDark
    ? { bg: 'bg-[#090A0D]', surface: 'bg-[#12141A]', elevated: 'bg-[#1A1D26]', border: 'border-[#262936]',
        text: 'text-[#FFFFFF]', secondaryText: 'text-[#8E95A5]', inputBg: 'bg-[#14171F]' }
    : { bg: 'bg-[#F8FAFC]', surface: 'bg-[#FFFFFF]', elevated: 'bg-[#F1F5F9]', border: 'border-[#E2E8F0]',
        text: 'text-[#0F172A]', secondaryText: 'text-[#64748B]', inputBg: 'bg-[#F8FAFC]' };
}

export function AppTopBar({ showBack, onBack, title, right }) {
  const c = useColors(); const { isAr } = usePrefs();
  const nav = useNav();
  const canBack = showBack !== undefined ? Boolean(showBack) : Boolean(onBack);
  return (
    <div className={`w-full px-4 py-2.5 border-b ${c.border} ${c.bg} sticky top-0 z-30`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {canBack && (
            <button type="button" onClick={onBack || (() => nav.back())} className={`p-1.5 rounded-xl ${c.elevated} ${c.text} hover:opacity-80 transition shrink-0`} title={isAr ? 'رجوع' : 'Back'} aria-label="Back">
              {isAr ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          )}
          <BrandLockup />
        </div>
        {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
      </div>
      {title && (
        <div className={`mt-1.5 text-xs font-extrabold ${c.text} truncate`}>
          {title}
        </div>
      )}
    </div>
  );
}

export function PrimaryButton({ children, onClick, className = '', disabled, type = 'button', testId }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} data-testid={testId}
      className={`w-full min-h-[50px] rounded-2xl bg-[#E51C23] hover:bg-[#c9161d] active:scale-[0.99] disabled:opacity-55 text-white font-semibold text-xs tracking-wide transition flex items-center justify-center gap-2 shadow-md shadow-[#E51C23]/20 ${className}`}>
      {children}
    </button>
  );
}
export function SecondaryButton({ children, onClick, className = '', disabled }) {
  const c = useColors();
  return (
    <button onClick={onClick} disabled={disabled}
      className={`w-full min-h-[50px] rounded-2xl border ${c.border} ${c.surface} ${c.text} hover:opacity-90 disabled:opacity-55 font-semibold text-xs transition flex items-center justify-center gap-2 ${className}`}>
      {children}
    </button>
  );
}

const BADGE_STYLES = {
  Completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Online: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Accepted: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Confirmed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  QuoteApproved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Paid: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Succeeded: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Verified: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Resolved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Answered: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Closed: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  Pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Searching: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Offered: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  QuotePending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  AwaitingPayment: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Submitted: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  UnderReview: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  ChangesNeeded: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  PendingVerification: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Requested: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Processing: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  Sent: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  EnRoute: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  Arrived: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  Assigned: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  InProgress: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  ReadyForReview: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  Working: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  Open: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  AwaitingSupport: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Escalated: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  Disputed: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  Unpaid: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  Issued: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Rejected: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  Declined: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  Expired: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  NoProviders: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  Suspended: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  DeletionRequested: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  Failed: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  Cancelled: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
};
const EN_STATUS = {
  Completed: 'Completed', Online: 'Online', Offline: 'Offline', Active: 'Active',
  Accepted: 'Accepted', Confirmed: 'Confirmed', QuoteApproved: 'Estimate approved',
  QuotePending: 'Estimate pending', AwaitingPayment: 'Awaiting payment',
  Paid: 'Paid', Succeeded: 'Succeeded', Approved: 'Approved', Verified: 'Verified',
  Pending: 'Pending', Searching: 'Searching', Offered: 'Offer sent',
  Submitted: 'Submitted', UnderReview: 'Under review', ChangesNeeded: 'Changes needed',
  PendingVerification: 'Pending verification', EnRoute: 'En route', Arrived: 'Arrived',
  Working: 'In progress', InProgress: 'In progress', Assigned: 'Assigned',
  ReadyForReview: 'Ready for review', Closed: 'Closed', Disputed: 'Disputed',
  Unpaid: 'Unpaid', Issued: 'Issued', Rejected: 'Rejected', Declined: 'Declined',
  Expired: 'Expired', NoProviders: 'No providers nearby', Suspended: 'Suspended',
  DeletionRequested: 'Deletion requested', Failed: 'Failed', Cancelled: 'Cancelled',
  Requested: 'Requested', Processing: 'Processing', Sent: 'Sent to bank',
  Open: 'Open', AwaitingSupport: 'Awaiting support', Answered: 'Answered',
  Escalated: 'Escalated', Resolved: 'Resolved', None: 'Not submitted',
  CarOwner: 'Car Owner', Mechanic: 'Mobile Mechanic', TowCaptain: 'Tow Captain',
  ServiceCenter: 'Service Center', Admin: 'Admin',
  Tow: 'Flatbed Tow', Normal: 'Standard', P0: 'Priority P0',
  NationalId: 'National ID', DrivingLicense: 'Driving License',
  TruckRegistration: 'Truck Registration', ProfessionalCertificate: 'Professional Certificate',
  CommercialLicense: 'Commercial License', TaxId: 'Tax ID Card', CenterPhoto: 'Facility Photo',
  'settings.update': 'Updated pricing & platform settings',
  'user.suspend': 'Suspended user account', 'user.restore': 'Restored user account',
  'kyc.approve': 'Approved KYC application', 'kyc.reject': 'Rejected KYC application',
  flatbed_tow: 'Flatbed Tow', wheel_lift: 'Wheel Lift Tow', wheel_lift_tow: 'Wheel Lift Tow',
  mechanic: 'Mobile Mechanic', battery: 'Battery Jump',
  battery_jump: 'Battery Jump', tire: 'Tire Change', tire_change: 'Tire Change',
  fuel: 'Fuel Delivery', fuel_delivery: 'Fuel Delivery', lockout: 'Car Unlock', other: 'Other Issue',
  Flatbed: 'Flatbed', WheelLift: 'Wheel Lift', Hook: 'Hook & Chain', HookAndChain: 'Hook & Chain', Integrated: 'Integrated',
  JobEarning: 'Job earning', Earning: 'Earning', Withdrawal: 'Withdrawal', Payout: 'Payout',
  Commission: 'Platform fee', Refund: 'Refund', Adjustment: 'Adjustment', Bonus: 'Bonus',
  CashCollected: 'Cash collected', Cash: 'Cash', Card: 'Card', ApplePay: 'Apple Pay', Wallet: 'Wallet',
  sedan: 'Sedan', suv: 'SUV', van: 'Van / Pickup', motorcycle: 'Motorcycle', hatchback: 'Hatchback', truck: 'Truck',
  created: 'Request created', 'offer.sent': 'Offer sent to provider', 'offer.accepted': 'Provider accepted offer',
  'offer.declined': 'Provider declined offer', 'offer.expired': 'Offer expired',
  'quote.created': 'Estimate submitted', 'quote.sent': 'Estimate submitted',
  'quote.approved': 'Estimate approved', 'quote.disputed': 'Estimate disputed',
  'payment.cash_confirmed': 'Cash payment confirmed', 'payment.paid': 'Payment settled',
  'radius.expanded': 'Search radius expanded', 'request.cancelled': 'Request cancelled', cancelled: 'Request cancelled',
  'kyc.changes_needed': 'Requested KYC changes', 'kyc.changes': 'Requested KYC changes',
  'payment.reconcile': 'Reconciled cash payment', 'safety.escalate': 'Escalated safety report',
  'safety.dismiss': 'Dismissed safety report', 'review.hide': 'Hidden customer review',
  'review.keep': 'Kept customer review', 'ticket.reply': 'Replied to support ticket'
};
const AR_STATUS = {
  Completed: 'مكتمل', Online: 'متصل', Offline: 'غير متصل', Active: 'نشط',
  Accepted: 'مقبول', Confirmed: 'مؤكد', QuoteApproved: 'تمت الموافقة على التكلفة',
  QuotePending: 'بانتظار الموافقة على التكلفة', AwaitingPayment: 'بانتظار الدفع',
  Paid: 'مدفوع', Succeeded: 'ناجح', Approved: 'معتمد', Verified: 'موثّق',
  Pending: 'قيد الانتظار', Searching: 'جاري البحث', Offered: 'تم إرسال العرض',
  Submitted: 'مُرسل للمراجعة', UnderReview: 'قيد المراجعة', ChangesNeeded: 'مطلوب تعديل',
  PendingVerification: 'بانتظار التفعيل', EnRoute: 'في الطريق', Arrived: 'وصل للموقع',
  Working: 'جاري العمل', InProgress: 'قيد التنفيذ', Assigned: 'معيّن',
  ReadyForReview: 'جاهز للمراجعة', Closed: 'مغلق', Disputed: 'متنازع عليه',
  Unpaid: 'غير مدفوع', Issued: 'صادرة', Rejected: 'مرفوض', Declined: 'مرفوض',
  Expired: 'منتهي', NoProviders: 'لا يوجد مقدمو خدمة', Suspended: 'موقوف',
  DeletionRequested: 'طلب حذف', Failed: 'فشل', Cancelled: 'ملغي',
  Requested: 'مطلوب', Processing: 'قيد المعالجة', Sent: 'أُرسل للبنك',
  Open: 'مفتوح', AwaitingSupport: 'بانتظار الدعم', Answered: 'تم الرد',
  Escalated: 'مُصعّد', Resolved: 'تم الحل', None: 'غير مقدم',
  CarOwner: 'مالك سيارة', Mechanic: 'ميكانيكي متنقل', TowCaptain: 'كابتن ونش',
  ServiceCenter: 'مركز خدمة', Admin: 'مشرف',
  Tow: 'ونش إنقاذ', Normal: 'عادي', P0: 'أولوية قصوى P0',
  NationalId: 'بطاقة الرقم القومي', DrivingLicense: 'رخصة القيادة',
  TruckRegistration: 'رخصة تسيير الونش', ProfessionalCertificate: 'شهادة الخبرة المهنية',
  CommercialLicense: 'السجل التجاري', TaxId: 'البطاقة الضريبية', CenterPhoto: 'صورة المركز',
  'settings.update': 'تحديث إعدادات التسعير والمنصة',
  'user.suspend': 'إيقاف حساب مستخدم', 'user.restore': 'استعادة حساب مستخدم',
  'kyc.approve': 'الموافقة على طلب توثيق', 'kyc.reject': 'رفض طلب توثيق',
  flatbed_tow: 'ونش سطحة', wheel_lift: 'ونش رفع العجلات', wheel_lift_tow: 'ونش رفع العجلات',
  mechanic: 'ميكانيكي متنقل', battery: 'شحن بطارية',
  battery_jump: 'شحن بطارية', tire: 'تغيير إطار', tire_change: 'تغيير إطار',
  fuel: 'توصيل وقود', fuel_delivery: 'توصيل وقود', lockout: 'فتح السيارة', other: 'مشكلة أخرى',
  Flatbed: 'سطحة', WheelLift: 'رفع العجلات', Hook: 'خطاف وسلسلة', HookAndChain: 'خطاف وسلسلة', Integrated: 'ونش متكامل',
  JobEarning: 'أرباح مهمة', Earning: 'أرباح', Withdrawal: 'سحب أرباح', Payout: 'تحويل بنكي',
  Commission: 'رسوم المنصة', Refund: 'استرداد', Adjustment: 'تسوية', Bonus: 'مكافأة',
  CashCollected: 'تم تحصيل النقدية', Cash: 'نقداً', Card: 'بطاقة بنكية', ApplePay: 'آبل باي', Wallet: 'المحفظة',
  sedan: 'سيدان', suv: 'دفع رباعي SUV', van: 'فان / نصف نقل', motorcycle: 'دراجة نارية', hatchback: 'هاتشباك', truck: 'شاحنة',
  created: 'تم إنشاء الطلب', 'offer.sent': 'تم إرسال العرض لمقدم الخدمة', 'offer.accepted': 'قبل مقدم الخدمة العرض',
  'offer.declined': 'اعتذر مقدم الخدمة عن العرض', 'offer.expired': 'انتهت صلاحية العرض',
  'quote.created': 'تم تقديم المقايسة', 'quote.sent': 'تم تقديم المقايسة',
  'quote.approved': 'تم اعتماد المقايسة', 'quote.disputed': 'تم الاعتراض على المقايسة',
  'payment.cash_confirmed': 'تم تأكيد الدفع النقدي', 'payment.paid': 'تم السداد',
  'radius.expanded': 'تم توسيع نطاق البحث', 'request.cancelled': 'تم إلغاء الطلب', cancelled: 'تم إلغاء الطلب',
  'kyc.changes_needed': 'طلب تعديل مستندات التوثيق', 'kyc.changes': 'طلب تعديل مستندات التوثيق',
  'payment.reconcile': 'مطابقة دفعة نقدية', 'safety.escalate': 'تصعيد بلاغ أمان',
  'safety.dismiss': 'حفظ بلاغ أمان', 'review.hide': 'إخفاء تقييم عميل',
  'review.keep': 'الإبقاء على تقييم عميل', 'ticket.reply': 'الرد على تذكرة دعم'
};
export function formatLabel(key, isAr = false) {
  if (key === null || key === undefined) return '—';
  const s = String(key);
  if (isAr && AR_STATUS[s]) return AR_STATUS[s];
  if (!isAr && EN_STATUS[s]) return EN_STATUS[s];
  return s.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
}
export function pluralCount(n, singularEn, pluralEn, oneAr, fewAr, manyAr, isAr = false) {
  const count = Number(n ?? 0);
  if (isAr) {
    const numStr = count.toLocaleString('ar-EG');
    if (count === 1) return `${numStr} ${oneAr}`;
    if (count === 0 || (count >= 2 && count <= 10)) return `${numStr} ${fewAr || oneAr}`;
    return `${numStr} ${manyAr || oneAr}`;
  }
  return `${count} ${count === 1 ? singularEn : (pluralEn || `${singularEn}s`)}`;
}
export function StatusBadge({ status, text }) {
  const { isAr } = usePrefs();
  const key = String(status ?? 'Pending');
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${BADGE_STYLES[key] || BADGE_STYLES.Pending}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {text || formatLabel(key, isAr)}
    </span>
  );
}

// ---- Map (label/subtitle/markers/pin are data-driven; interactive click-to-pin supported) ----
export function MapView({ label, subtitle, mode = 'route', height, markers = [], pin = null, onPick, interactive = false }) {
  const c = useColors(); const { isDark, isAr } = usePrefs();
  const canPick = Boolean(onPick) || interactive;
  // Project Cairo-region coordinates (~29.95..30.15 lat, ~31.10..31.55 lng) onto [16..84]% box.
  const project = (lat, lng, fallbackX, fallbackY) => {
    if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
      return { x: fallbackX, y: fallbackY };
    }
    const x = Math.min(86, Math.max(14, ((lng - 31.10) / 0.45) * 72 + 14));
    const y = Math.min(82, Math.max(18, ((30.14 - lat) / 0.20) * 64 + 18));
    return { x: Math.round(x), y: Math.round(y) };
  };

  const handleMapClick = (e) => {
    if (!onPick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = Math.min(1, Math.max(0, (e.clientX - rect.left) / Math.max(1, rect.width)));
    const yRatio = Math.min(1, Math.max(0, (e.clientY - rect.top) / Math.max(1, rect.height)));
    const lat = Number((30.14 - yRatio * 0.20).toFixed(5));
    const lng = Number((31.10 + xRatio * 0.45).toFixed(5));
    onPick({ lat, lng });
  };

  const pickupCoord = pin || markers[0] || null;
  const providerCoord = markers.length > 1 ? markers[1] : null;
  const destPt = project(pickupCoord?.lat, pickupCoord?.lng ?? pickupCoord?.lon, canPick ? 50 : 78, canPick ? 50 : 74);
  const provPt = providerCoord
    ? project(providerCoord.lat, providerCoord.lng ?? providerCoord.lon, 24, 28)
    : { x: 24, y: 28 };

  return (
    <div
      onClick={canPick ? handleMapClick : undefined}
      role={canPick ? 'button' : undefined}
      tabIndex={canPick ? 0 : undefined}
      aria-label={canPick ? (isAr ? 'اضغط لتحديد الموقع على الخريطة' : 'Click map to set pin location') : undefined}
      style={height ? { height } : undefined}
      className={`relative w-full ${height ? '' : 'h-36'} rounded-2xl overflow-hidden border ${c.border} ${isDark ? 'bg-[#0D1017]' : 'bg-[#F1F5F9]'} ${canPick ? 'cursor-crosshair select-none' : ''}`}
      data-testid="map-view"
    >
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(to right, #64748B 1px, transparent 1px), linear-gradient(to bottom, #64748B 1px, transparent 1px)', backgroundSize: '26px 26px' }} />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="w-28 h-28 rounded-full border border-[#E51C23]/30 bg-[#E51C23]/5 animate-pulse" /></div>
      {!canPick && mode === 'route' && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d={`M ${provPt.x} ${provPt.y} L ${(provPt.x + destPt.x) / 2} ${provPt.y} L ${(provPt.x + destPt.x) / 2} ${destPt.y} L ${destPt.x} ${destPt.y}`} fill="none" stroke="#E51C23" strokeWidth="2.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {!canPick && mode !== 'pin' && (
        <div style={{ left: `${provPt.x}%`, top: `${provPt.y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#E51C23] text-white flex items-center justify-center shadow-lg pointer-events-none"><Navigation size={12} /></div>
      )}
      {mode === 'arrived' ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="px-3 py-1 rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-lg"><Check size={12} /> {isAr ? 'وصل مقدم الخدمة' : 'Provider at pickup'}</div>
        </div>
      ) : (!canPick || pickupCoord) ? (
        <div
          data-testid="map-pin"
          style={{ left: `${destPt.x}%`, top: `${destPt.y}%` }}
          className={`absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full ${canPick ? 'bg-[#E51C23] text-white border-2 border-white' : 'bg-white text-[#090A0D] border-2 border-[#090A0D]'} flex items-center justify-center shadow-lg pointer-events-none`}
        >
          <MapPin size={13} />
        </div>
      ) : null}
      {subtitle && <div className="absolute top-2 left-3 right-3 truncate text-[9px] font-bold uppercase tracking-wider text-slate-400 pointer-events-none">{subtitle}</div>}
      {canPick && !pickupCoord && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="px-3 py-1 rounded-full bg-black/75 text-white text-[10px] font-semibold">
            {isAr ? 'اضغط على الخريطة لتحديد الموقع' : 'Tap anywhere on the map to drop pin'}
          </span>
        </div>
      )}
      {label && <div className="absolute bottom-2 left-3 max-w-[85%] truncate px-2 py-0.5 rounded-lg bg-black/80 text-white text-[10px] font-semibold flex items-center gap-1 pointer-events-none"><Navigation size={10} className="text-[#E51C23] shrink-0" /><span className="truncate">{label}</span></div>}
    </div>
  );
}

export function EmergencySOSBar({ onClick }) {
  const c = useColors(); const { isAr } = usePrefs(); const nav = useNavigate();
  return (
    <div role="button" tabIndex={0} onClick={onClick || (() => nav('SH19'))}
      className="w-full rounded-2xl p-3 border border-[#E51C23]/40 bg-[#E51C23]/10 flex items-center justify-between cursor-pointer">
      <div className="space-y-1 w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5"><AlertTriangle size={13} className="text-[#E51C23]" /><span className={`text-xs font-bold ${c.text}`}>{isAr ? 'طوارئ SOS' : 'Emergency SOS'}</span></div>
          <span className={`text-[10px] ${c.secondaryText}`}>{isAr ? 'خطر فوري؟' : 'Immediate danger?'}</span>
        </div>
        <div className="flex items-center justify-between pt-0.5 text-xs font-semibold">
          <a href="tel:123" onClick={(e) => e.stopPropagation()} className="text-[#E51C23] flex items-center gap-1"><Phone size={11} /> {isAr ? '١٢٣ · الإسعاف' : '123 · Ambulance'}</a>
          <a href="tel:122" onClick={(e) => e.stopPropagation()} className="text-amber-400 flex items-center gap-1">{isAr ? '١٢٢ · النجدة' : '122 · Police'} <Phone size={11} /></a>
        </div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint, error }) {
  const c = useColors();
  return (
    <label className="block space-y-1">
      {label && <span className={`text-[11px] font-medium ${c.secondaryText}`}>{label}</span>}
      {children}
      {hint && !error && <span className={`block text-[10px] ${c.secondaryText}`}>{hint}</span>}
      {error && <span className="block text-[10px] text-rose-500">{error}</span>}
    </label>
  );
}
export function inputClass() { const c = useColors(); return `w-full px-3.5 h-11 rounded-xl border ${c.border} ${c.inputBg} text-xs ${c.text}`; }

export function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={!!checked} onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full p-0.5 transition flex items-center ${checked ? 'bg-[#E51C23] justify-end' : 'bg-slate-300 justify-start'}`}>
      <span className="w-5 h-5 rounded-full bg-white shadow" />{label && <span className="sr-only">{label}</span>}
    </button>
  );
}

export function Chip({ children, active, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition ${active ? 'border-[#E51C23] bg-[#E51C23]/15 text-[#E51C23]' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}>
      {children}
    </button>
  );
}

export function Card({ children, className = '', onClick, style }) {
  const c = useColors();
  return (
    <div
      onClick={onClick}
      style={style}
      className={`rounded-2xl border ${c.border} ${c.surface} p-4 ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export function StarRating({ value = 0, size = 14, onChange }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${value} stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        onChange ? (
          <button
            key={n}
            type="button"
            aria-label={`Rate ${n} stars`}
            data-testid={`star-${n}`}
            onClick={() => onChange(n)}
            className="p-0.5 transition hover:scale-110"
          >
            <Star size={size} className={n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-slate-400'} />
          </button>
        ) : (
          <Star key={n} size={size} className={n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-slate-400'} />
        )
      ))}
    </span>
  );
}

export function SectionHeader({ title, subtitle, action }) {
  const c = useColors();
  return (
    <div className="flex items-center justify-between mb-2">
      <div>
        <h3 className={`text-xs font-extrabold ${c.text}`}>{title}</h3>
        {subtitle && <p className={`text-[11px] ${c.secondaryText}`}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function InputField({ label, value, onChange, type = 'text', placeholder = '', disabled = false, testId }) {
  const c = useColors();
  return (
    <label className="block space-y-1 mb-2.5">
      {label && <span className={`text-[11px] font-medium ${c.secondaryText}`}>{label}</span>}
      <input
        type={type}
        value={value ?? ''}
        disabled={disabled}
        placeholder={placeholder}
        data-testid={testId}
        onChange={(e) => onChange?.(e.target.value)}
        className={`w-full px-3.5 h-11 rounded-xl border ${c.border} ${c.inputBg} text-xs ${c.text} disabled:opacity-60`}
      />
    </label>
  );
}

export function SelectField({ label, value, onChange, options = [], testId }) {
  const c = useColors();
  return (
    <label className="block space-y-1 mb-2.5">
      {label && <span className={`text-[11px] font-medium ${c.secondaryText}`}>{label}</span>}
      <select
        value={value ?? ''}
        data-testid={testId}
        onChange={(e) => onChange?.(e.target.value)}
        className={`w-full px-3.5 h-11 rounded-xl border ${c.border} ${c.inputBg} text-xs ${c.text}`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </label>
  );
}

export const ToggleSwitch = Toggle;

export function Banner({ tone = 'info', title, subtitle }) {
  const tones = {
    info: 'border-sky-500/30 bg-sky-500/10 text-sky-500',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500',
    danger: 'border-rose-500/30 bg-rose-500/10 text-rose-500',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-500',
  };
  return (
    <div className={`rounded-2xl border p-3.5 text-xs ${tones[tone] || tones.info}`} role="status">
      {title && <div className="font-bold">{title}</div>}
      {subtitle && <div className="text-[11px] opacity-90 mt-0.5">{subtitle}</div>}
    </div>
  );
}

export function Divider({ className = 'my-2' }) {
  const c = useColors();
  return <hr className={`border-t ${c.border} ${className}`} />;
}

export function Avatar({ name = 'U', size = 40, className = '' }) {
  const initials = String(name || 'U')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || 'U';
  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-full bg-[#E51C23]/15 text-[#E51C23] border border-[#E51C23]/30 font-extrabold text-xs flex items-center justify-center shrink-0 select-none ${className}`}
    >
      {initials}
    </div>
  );
}

export function BottomSheet({ open, onClose, title, children }) {
  const c = useColors();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-t-3xl border-t ${c.border} ${c.surface} p-5 space-y-3`}
      >
        {title && <div className={`text-sm font-extrabold ${c.text}`}>{title}</div>}
        {children}
      </div>
    </div>
  );
}

// ---- Async states ----
export function Skeleton({ rows = 3 }) {
  return (
    <div className="space-y-3 p-4" data-testid="skeleton" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-14 rounded-2xl bg-slate-200/70 dark:bg-slate-700/50 animate-pulse" />)}
    </div>
  );
}
export function EmptyState({ title, message, subtitle, icon, action }) {
  const c = useColors(); const { isAr } = usePrefs();
  const body = message || subtitle;
  return (
    <div className="flex flex-col items-center justify-center text-center p-10 gap-3" data-testid="empty-state">
      {icon ? <span className="text-3xl">{icon}</span> : <ShieldCheck size={34} className="text-slate-400" />}
      <p className={`font-bold ${c.text}`}>{title || (isAr ? 'لا توجد بيانات بعد' : 'Nothing here yet')}</p>
      {body && <p className={`text-xs ${c.secondaryText}`}>{body}</p>}
      {action}
    </div>
  );
}
export function ErrorState({ error, retry }) {
  const { isAr } = usePrefs();
  return (
    <div className="flex flex-col items-center justify-center text-center p-10 gap-3" data-testid="error-state" role="alert">
      <AlertCircle size={30} className="text-rose-500" />
      <p className="text-sm font-bold text-rose-500">{error?.message || (isAr ? 'حدث خطأ' : 'Something went wrong')}</p>
      {retry && <button onClick={retry} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-400/40 text-rose-500 text-xs font-bold"><RefreshCw size={14} />{isAr ? 'إعادة المحاولة' : 'Retry'}</button>}
    </div>
  );
}
export function LoadingOrError({ query, children }) {
  if (query.isLoading) return <Skeleton />;
  if (query.isError) return <ErrorState error={query.error} retry={query.refetch} />;
  return children;
}

export function Toast({ message, onClose, tone = 'ok' }) {
  const [visible, setVisible] = useState(true);
  if (!visible || !message) return null;
  return (
    <div role="status" className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-lg text-xs font-bold flex items-center gap-2 ${tone === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
      {tone === 'ok' && <Check size={15} />}<span>{message}</span>
      <button onClick={() => { setVisible(false); onClose?.(); }} aria-label="Dismiss"><X size={14} /></button>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel }) {
  if (!open) return null;
  const c = useColors();
  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-6" role="dialog" aria-modal="true">
      <div className={`w-full max-w-sm rounded-2xl border ${c.border} ${c.surface} p-5 space-y-4`}>
        <p className={`font-bold ${c.text}`}>{title}</p>
        <p className={`text-xs ${c.secondaryText}`}>{message}</p>
        <div className="flex gap-2">
          <SecondaryButton onClick={onCancel}>{confirmLabel ? 'Cancel' : 'إلغاء'}</SecondaryButton>
          <PrimaryButton onClick={onConfirm}>{confirmLabel || 'تأكيد'}</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

export function FilePicker({ accept = 'image/*', onFile, label }) {
  const c = useColors(); const { isAr } = usePrefs();
  return (
    <label className={`w-full rounded-2xl border border-dashed ${c.border} ${c.surface} p-5 flex flex-col items-center gap-2 cursor-pointer hover:opacity-80`}>
      <Upload size={20} className="text-[#E51C23]" />
      <span className={`text-xs font-semibold ${c.text}`}>{label || (isAr ? 'اختر ملفاً' : 'Choose a file')}</span>
      <input type="file" accept={accept} className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    </label>
  );
}

export function Page({ children, title, showBack = true, onBack }) {
  const c = useColors();
  return (
    <div className={`min-h-full flex flex-col ${c.bg}`} data-testid="screen">
      <AppTopBar showBack={showBack} onBack={onBack} title={title} />
      <div className="flex-1 pb-6">{children}</div>
    </div>
  );
}
