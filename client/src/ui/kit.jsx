// Shared UI kit — stable top-level components moved out of the legacy App().
// Visual design kept 1:1; all content comes from props/context, never mock data.
import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import {
  ChevronLeft, ChevronRight, AlertTriangle, Phone, Navigation, Check,
  MapPin, Star, Loader2, AlertCircle, RefreshCw, X, Upload, ShieldCheck, LocateFixed,
  KeyRound, Smartphone, Lock
} from 'lucide-react';
import { usePrefs, useNav, useSession, useNavigate } from '../app/stores.jsx';
import { get as apiGet, post as apiPost } from '../api/http.js';
import { useUnreadCount, useReviews, useCustomerPublicProfile } from '../api/hooks.js';
import { fmtMoney, fmtDate } from '../i18n/format.js';
import { checkPasswordRules } from './validation.js';

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

const ROLE_PROFILE_SCREEN = {
  CarOwner: 'C23',
  Mechanic: 'M09',
  TowCaptain: 'T10',
  ServiceCenter: 'SC09',
  Admin: 'AD06'
};

export function RoleHeaderActions() {
  const c = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const session = useSession();
  const user = session?.user;
  const unreadQ = useUnreadCount();
  if (!user) return null;
  const unreadCount = Number(unreadQ.data?.count ?? 0);
  const profileScreen = ROLE_PROFILE_SCREEN[user.role] || 'C23';

  return (
    <div className="flex items-center gap-2 shrink-0" data-testid="role-header-actions">
      <button
        type="button"
        data-testid="topbar-notifications"
        onClick={() => nav.go('C22')}
        aria-label={isAr ? 'الإشعارات' : 'Notifications'}
        className={`relative w-9 h-9 rounded-full flex items-center justify-center border ${c.border} ${c.elevated} hover:opacity-85 transition`}
      >
        <span className="text-sm leading-none">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -end-1 min-w-[17px] h-[17px] px-1 rounded-full text-[9.5px] font-extrabold flex items-center justify-center bg-[#E51C23] text-white shadow">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      <button
        type="button"
        data-testid="topbar-profile-avatar"
        onClick={() => nav.go(profileScreen)}
        aria-label={isAr ? 'الملف الشخصي' : 'Profile'}
        className="hover:opacity-90 transition"
      >
        <Avatar name={user.fullName || user.email || 'U'} size={36} />
      </button>
    </div>
  );
}

export function AppTopBar({ showBack, onBack, title, right }) {
  const c = useColors(); const { isAr } = usePrefs();
  const nav = useNav();
  const session = useSession();
  const user = session?.user;
  const canBack = showBack !== undefined ? Boolean(showBack) : Boolean(onBack);
  const effectiveRight = right || (!canBack && user ? <RoleHeaderActions /> : null);
  return (
    <div className={`w-full px-4 py-2.5 border-b ${c.border} ${c.bg} sticky top-0 z-30`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {canBack && (
            <button
              type="button"
              data-testid="topbar-back"
              onClick={() => (onBack ? onBack() : nav.back())}
              className={`p-1.5 rounded-xl ${c.elevated} ${c.text} hover:opacity-80 transition shrink-0`}
              title={isAr ? 'رجوع' : 'Back'}
              aria-label="Back"
            >
              {isAr ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          )}
          <BrandLockup />
        </div>
        {effectiveRight && <div className="flex items-center gap-2 shrink-0">{effectiveRight}</div>}
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
  Completed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/35',
  Online: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/35',
  Active: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/35',
  Accepted: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/35',
  Confirmed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/35',
  QuoteApproved: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/35',
  Paid: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/35',
  Succeeded: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/35',
  Approved: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/35',
  Verified: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/35',
  Resolved: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/35',
  Answered: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/35',
  Closed: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30',
  Pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/35',
  Searching: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/35',
  Offered: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/35',
  QuotePending: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/35',
  AwaitingPayment: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/35',
  Submitted: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/35',
  UnderReview: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/35',
  ChangesNeeded: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/35',
  PendingVerification: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/35',
  Requested: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/35',
  Processing: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/35',
  Sent: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/35',
  EnRoute: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/35',
  Arrived: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/35',
  Assigned: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/35',
  InProgress: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/35',
  ReadyForReview: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/35',
  Working: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/35',
  Open: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/35',
  AwaitingSupport: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/35',
  Escalated: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/35',
  Disputed: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/35',
  Unpaid: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/35',
  Issued: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/35',
  Rejected: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/35',
  Declined: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/35',
  Expired: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/35',
  NoProviders: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/35',
  Suspended: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/35',
  DeletionRequested: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/35',
  Failed: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/35',
  Cancelled: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/35',
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
  Tow: 'Tow Service', Normal: 'Standard', P0: 'Priority P0',
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
  'review.keep': 'Kept customer review', 'ticket.reply': 'Replied to support ticket',
  General: 'General', Payment: 'Payment & receipt', Request: 'Roadside request',
  Booking: 'Center booking', Account: 'Account & profile', Safety: 'Safety & conduct'
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
  'review.keep': 'الإبقاء على تقييم عميل', 'ticket.reply': 'الرد على تذكرة دعم',
  General: 'عام', Payment: 'الدفع والإيصال', Request: 'طلب مساعدة على الطريق',
  Booking: 'حجز مركز خدمة', Account: 'الحساب والملف الشخصي', Safety: 'السلامة والسلوك'
};
export function formatLabel(key, isAr = false) {
  if (key === null || key === undefined) return '—';
  const s = String(key);
  if (isAr && AR_STATUS[s]) return AR_STATUS[s];
  if (!isAr && EN_STATUS[s]) return EN_STATUS[s];
  const radiusMatch = s.match(/^radius\.(\d+)km$/i);
  if (radiusMatch) {
    return isAr ? `تم توسيع نطاق البحث إلى ${radiusMatch[1]} كم` : `Search radius expanded to ${radiusMatch[1]} km`;
  }
  return s.replace(/[._]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
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
    <span className={`inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${BADGE_STYLES[key] || BADGE_STYLES.Pending}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-85 shrink-0" />
      {text || formatLabel(key, isAr)}
    </span>
  );
}

// ---- Google Cloud Maps, Geocoding, Places & Routes Integration ----
let _gmapsPromise = null;

function readServerBootstrapMapsKey() {
  if (typeof document === 'undefined') return '';
  try {
    const el = document.getElementById('fixngo-server-bootstrap');
    if (el?.textContent) {
      const parsed = JSON.parse(el.textContent);
      if (parsed?.googleMapsApiKey) return String(parsed.googleMapsApiKey);
    }
  } catch { /* ignore */ }
  return '';
}

function isLocalLoopbackHost() {
  if (typeof window === 'undefined') return true;
  if (window.__enableGoogleMapsOnLocalhost) return false;
  const h = window.location?.hostname ?? '';
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '';
}

export function loadGoogleMapsSdk() {
  if (typeof window === 'undefined' || isLocalLoopbackHost()) return Promise.resolve(null);
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (_gmapsPromise) return _gmapsPromise;

  const key = readServerBootstrapMapsKey();
  if (!key) return Promise.resolve(null);

  _gmapsPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[data-fixngo-gmaps]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google?.maps ?? null));
      existing.addEventListener('error', () => resolve(null));
      return;
    }
    window.gm_authFailure = () => {
      window.__fixngoMapsAuthFailed = true;
      resolve(null);
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places,geometry&v=weekly`;
    script.async = true;
    script.defer = true;
    script.dataset.fixngoGmaps = '1';
    script.onload = () => resolve(window.google?.maps ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return _gmapsPromise;
}

export async function reverseGeocodeCoords(lat, lng) {
  const gmaps = await loadGoogleMapsSdk();
  if (gmaps?.Geocoder && !window.__fixngoMapsAuthFailed) {
    try {
      const geocoder = new gmaps.Geocoder();
      const resp = await geocoder.geocode({ location: { lat: Number(lat), lng: Number(lng) } });
      const first = resp?.results?.[0];
      if (first?.formatted_address) {
        const sublocality = first.address_components?.find((ac) =>
          ac.types?.includes('sublocality') || ac.types?.includes('neighborhood') || ac.types?.includes('locality')
        )?.long_name;
        return {
          label: sublocality || first.formatted_address.split(',')[0],
          address: first.formatted_address,
          latitude: Number(lat),
          longitude: Number(lng)
        };
      }
    } catch { /* fall through to backend Places API */ }
  }
  try {
    return await apiGet(`/lookups/reverse-geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
  } catch {
    return {
      label: 'Pinned Location',
      address: `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`,
      latitude: Number(lat),
      longitude: Number(lng)
    };
  }
}

export async function searchGeoPlaces(query) {
  const q = String(query ?? '').trim();
  if (q.length < 2) return [];
  try {
    const res = await apiGet(`/lookups/geocode?q=${encodeURIComponent(q)}`);
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

export async function computeDrivingRoute(originLat, originLng, destLat, destLng) {
  try {
    return await apiGet(
      `/lookups/route?originLat=${encodeURIComponent(originLat)}&originLng=${encodeURIComponent(originLng)}&destLat=${encodeURIComponent(destLat)}&destLng=${encodeURIComponent(destLng)}`
    );
  } catch {
    return null;
  }
}

const DARK_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#111827' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#111827' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#334155' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#090d16' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] }
];

// ---- Map (live Google Map on allowed domains + instant interactive fallback) ----
export function MapView({ label, subtitle, mode = 'route', height, markers = [], pin = null, onPick, interactive = false, encodedPolyline = null }) {
  const c = useColors(); const { isDark, isAr } = usePrefs();
  const canPick = Boolean(onPick) || interactive;
  const mapHostRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const mapOverlaysRef = useRef([]);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const [liveMapReady, setLiveMapReady] = useState(false);

  const pickupCoord = pin || markers[0] || null;
  const providerCoord = markers.length > 1 ? markers[1] : null;
  const centerLat = Number(pickupCoord?.lat ?? providerCoord?.lat ?? 30.0444);
  const centerLng = Number(pickupCoord?.lng ?? pickupCoord?.lon ?? providerCoord?.lng ?? providerCoord?.lon ?? 31.2357);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMapsSdk().then((gmaps) => {
      if (cancelled || !gmaps?.Map || !mapHostRef.current || window.__fixngoMapsAuthFailed) return;
      if (!mapInstanceRef.current) {
        const map = new gmaps.Map(mapHostRef.current, {
          center: { lat: Number.isFinite(centerLat) ? centerLat : 30.0444, lng: Number.isFinite(centerLng) ? centerLng : 31.2357 },
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
          styles: isDark ? DARK_MAP_STYLES : []
        });
        map.addListener('click', (ev) => {
          if (!onPickRef.current || !ev?.latLng) return;
          onPickRef.current({
            lat: Number(ev.latLng.lat().toFixed(6)),
            lng: Number(ev.latLng.lng().toFixed(6))
          });
        });
        mapInstanceRef.current = map;
      }
      setLiveMapReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const gmaps = typeof window !== 'undefined' ? window.google?.maps : null;
    if (!liveMapReady || !map || !gmaps) return;
    map.setOptions({ styles: isDark ? DARK_MAP_STYLES : [] });

    mapOverlaysRef.current.forEach((o) => o?.setMap?.(null));
    mapOverlaysRef.current = [];

    const validPickup = pickupCoord && Number.isFinite(Number(pickupCoord.lat)) && Number.isFinite(Number(pickupCoord.lng ?? pickupCoord.lon))
      ? { lat: Number(pickupCoord.lat), lng: Number(pickupCoord.lng ?? pickupCoord.lon) }
      : null;
    const validProvider = providerCoord && Number.isFinite(Number(providerCoord.lat)) && Number.isFinite(Number(providerCoord.lng ?? providerCoord.lon))
      ? { lat: Number(providerCoord.lat), lng: Number(providerCoord.lng ?? providerCoord.lon) }
      : null;

    if (validPickup) {
      const m = new gmaps.Marker({
        position: validPickup,
        map,
        icon: {
          path: gmaps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#E51C23',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2.5
        }
      });
      mapOverlaysRef.current.push(m);
    }

    if (validProvider && !canPick && mode !== 'pin') {
      const pm = new gmaps.Marker({
        position: validProvider,
        map,
        icon: {
          path: gmaps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 5.5,
          fillColor: '#0F172A',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2
        }
      });
      mapOverlaysRef.current.push(pm);
    }

    if (encodedPolyline && gmaps.geometry?.encoding) {
      try {
        const decoded = gmaps.geometry.encoding.decodePath(encodedPolyline);
        const line = new gmaps.Polyline({
          path: decoded,
          geodesic: true,
          strokeColor: '#E51C23',
          strokeOpacity: 0.92,
          strokeWeight: 4,
          map
        });
        mapOverlaysRef.current.push(line);
      } catch { /* ignore invalid polyline */ }
    } else if (validPickup && validProvider && mode === 'route') {
      const line = new gmaps.Polyline({
        path: [validProvider, validPickup],
        geodesic: true,
        strokeColor: '#E51C23',
        strokeOpacity: 0.9,
        strokeWeight: 3.5,
        map
      });
      mapOverlaysRef.current.push(line);
    }

    if (validPickup && validProvider && !canPick) {
      const bounds = new gmaps.LatLngBounds();
      bounds.extend(validPickup);
      bounds.extend(validProvider);
      map.fitBounds(bounds, 28);
    } else if (validPickup) {
      map.panTo(validPickup);
    }
  }, [liveMapReady, isDark, pickupCoord?.lat, pickupCoord?.lng, pickupCoord?.lon, providerCoord?.lat, providerCoord?.lng, providerCoord?.lon, canPick, mode, encodedPolyline]);

  // Project Cairo-region coordinates (~29.95..30.15 lat, ~31.10..31.55 lng) onto [16..84]% box for instant fallback.
  const project = (lat, lng, fallbackX, fallbackY) => {
    if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
      return { x: fallbackX, y: fallbackY };
    }
    const x = Math.min(86, Math.max(14, ((lng - 31.10) / 0.45) * 72 + 14));
    const y = Math.min(82, Math.max(18, ((30.14 - lat) / 0.20) * 64 + 18));
    return { x: Math.round(x), y: Math.round(y) };
  };

  const handleMapClick = (e) => {
    if (!onPick || liveMapReady) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = Math.min(1, Math.max(0, (e.clientX - rect.left) / Math.max(1, rect.width)));
    const yRatio = Math.min(1, Math.max(0, (e.clientY - rect.top) / Math.max(1, rect.height)));
    const lat = Number((30.14 - yRatio * 0.20).toFixed(5));
    const lng = Number((31.10 + xRatio * 0.45).toFixed(5));
    onPick({ lat, lng });
  };

  const destPt = project(pickupCoord?.lat, pickupCoord?.lng ?? pickupCoord?.lon, canPick ? 50 : 78, canPick ? 50 : 74);
  const provPt = providerCoord
    ? project(providerCoord.lat, providerCoord.lng ?? providerCoord.lon, 24, 28)
    : { x: 24, y: 28 };

  return (
    <div
      onClick={canPick && !liveMapReady ? handleMapClick : undefined}
      role={canPick ? 'button' : undefined}
      tabIndex={canPick ? 0 : undefined}
      aria-label={canPick ? (isAr ? 'اضغط لتحديد الموقع على الخريطة' : 'Click map to set pin location') : undefined}
      style={height ? { height } : undefined}
      className={`relative w-full ${height ? '' : 'h-36'} rounded-2xl overflow-hidden border ${c.border} ${isDark ? 'bg-[#0D1017]' : 'bg-[#F1F5F9]'} ${canPick ? 'cursor-crosshair select-none' : ''}`}
      data-testid="map-view"
    >
      <div ref={mapHostRef} className={`absolute inset-0 w-full h-full ${liveMapReady ? 'opacity-100 z-0' : 'opacity-0 pointer-events-none'}`} />
      {!liveMapReady && (
        <>
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
        </>
      )}
      {mode === 'arrived' ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="px-3 py-1 rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-lg"><Check size={12} /> {isAr ? 'وصل مقدم الخدمة' : 'Provider at pickup'}</div>
        </div>
      ) : (!canPick || pickupCoord) ? (
        <div
          data-testid="map-pin"
          style={liveMapReady ? { left: '50%', top: '50%', opacity: 0.01 } : { left: `${destPt.x}%`, top: `${destPt.y}%` }}
          className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full ${canPick ? 'bg-[#E51C23] text-white border-2 border-white' : 'bg-white text-[#090A0D] border-2 border-[#090A0D]'} flex items-center justify-center shadow-lg pointer-events-none`}
        >
          <MapPin size={13} />
        </div>
      ) : null}
      {subtitle && <div className="absolute z-10 top-2 left-3 right-3 truncate text-[9px] font-bold uppercase tracking-wider text-slate-400 pointer-events-none drop-shadow">{subtitle}</div>}
      {canPick && !pickupCoord && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <span className="px-3 py-1 rounded-full bg-black/75 text-white text-[10px] font-semibold">
            {isAr ? 'اضغط على الخريطة لتحديد الموقع' : 'Tap anywhere on the map to drop pin'}
          </span>
        </div>
      )}
      {label && <div className="absolute z-10 bottom-2 left-3 max-w-[85%] truncate px-2 py-0.5 rounded-lg bg-black/80 text-white text-[10px] font-semibold flex items-center gap-1 pointer-events-none"><Navigation size={10} className="text-[#E51C23] shrink-0" /><span className="truncate">{label}</span></div>}
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

const FormValidationContext = createContext(null);

export function FormValidationProvider({ errors = {}, onClearField, children }) {
  return (
    <FormValidationContext.Provider value={{ errors, onClearField }}>
      {children}
    </FormValidationContext.Provider>
  );
}

export function fieldBoxClass(c, hasError, heightClass = 'h-11') {
  return `w-full px-3.5 ${heightClass} rounded-xl border transition text-xs ${c.text} disabled:opacity-60 focus:outline-none ${
    hasError
      ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-500/5'
      : `${c.border} ${c.inputBg} focus:border-[#E51C23]`
  }`;
}

export function PasswordChecklist({ password = '', showInvalid = false }) {
  const { isAr } = usePrefs();
  const c = useColors();
  const rules = checkPasswordRules(password);
  const typed = String(password ?? '').length > 0;

  const items = [
    { key: 'minLen', ok: rules.minLen, en: '8+ chars', ar: '8+ خانات' },
    { key: 'upper', ok: rules.hasUpper, en: 'Uppercase (A-Z)', ar: 'حرف كبير (A-Z)' },
    { key: 'lower', ok: rules.hasLower, en: 'Lowercase (a-z)', ar: 'حرف صغير (a-z)' },
    { key: 'digit', ok: rules.hasDigit, en: 'Number (0-9)', ar: 'رقم (0-9)' },
    { key: 'symbol', ok: rules.hasSymbol, en: 'Symbol (@#$!)', ar: 'رمز (@#$!)' },
  ];

  return (
    <div className={`rounded-xl border ${c.border} ${c.surface} px-3 py-2 space-y-1.5`} data-testid="password-policy-note">
      <p className={`text-[10px] font-semibold ${c.secondaryText}`}>
        {isAr
          ? 'شروط كلمة المرور المطلوبة (مثال: @Dd112233):'
          : 'Password policy (e.g. @Dd112233):'}
      </p>
      <div className="flex flex-wrap gap-1">
        {items.map((it) => {
          const stateClass = it.ok
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : (showInvalid || typed)
              ? (showInvalid
                  ? 'border-rose-500/50 bg-rose-500/10 text-rose-500'
                  : 'border-amber-500/35 bg-amber-500/10 text-amber-600 dark:text-amber-400')
              : `${c.border} ${c.secondaryText}`;
          return (
            <span
              key={it.key}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold border transition ${stateClass}`}
            >
              <span>{it.ok ? '✓' : showInvalid ? '✕' : '•'}</span>
              <span>{isAr ? it.ar : it.en}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function Field({ label, children, hint, error }) {
  const c = useColors();
  return (
    <label className="block space-y-1">
      {label && <span className={`text-[11px] font-medium ${error ? 'text-rose-500 font-semibold' : c.secondaryText}`}>{label}</span>}
      {children}
      {hint && !error && <span className={`block text-[10px] ${c.secondaryText}`}>{hint}</span>}
      {error && <span role="alert" className="block text-[11px] font-semibold text-rose-500">{error}</span>}
    </label>
  );
}
export function inputClass(hasError = false) {
  const c = useColors();
  return fieldBoxClass(c, hasError, 'h-11');
}

export function Toggle({ checked, onChange, label, testId }) {
  return (
    <button type="button" role="switch" data-testid={testId} aria-checked={!!checked} onClick={() => onChange(!checked)}
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

function resolveContextualError(ctx, explicitError, errorKey, name, testId) {
  if (explicitError) return { msg: explicitError, key: errorKey || name || '' };
  if (!ctx?.errors) return { msg: '', key: '' };
  const candidates = [
    errorKey,
    name,
    testId ? String(testId).replace(/^field-/, '') : '',
  ].filter(Boolean);
  for (const k of candidates) {
    if (ctx.errors[k]) return { msg: ctx.errors[k], key: k };
    const lower = k[0].toLowerCase() + k.slice(1);
    if (ctx.errors[lower]) return { msg: ctx.errors[lower], key: lower };
  }
  return { msg: '', key: candidates[0] || '' };
}

export function InputField({
  label, value, onChange, type = 'text', placeholder = '', disabled = false,
  testId, dir, hint, error, errorKey, name
}) {
  const c = useColors();
  const ctx = useContext(FormValidationContext);
  const { msg: resolvedError, key: resolvedKey } = resolveContextualError(ctx, error, errorKey, name, testId);
  const hasError = Boolean(resolvedError);

  return (
    <label className="block space-y-1 mb-2.5">
      {label && (
        <span className={`text-[11px] font-medium ${hasError ? 'text-rose-500 font-semibold' : c.secondaryText}`}>
          {label}
        </span>
      )}
      <input
        type={type}
        name={name}
        value={value ?? ''}
        disabled={disabled}
        placeholder={placeholder}
        data-testid={testId}
        aria-invalid={hasError ? 'true' : undefined}
        dir={dir}
        onChange={(e) => {
          if (hasError && resolvedKey) ctx?.onClearField?.(resolvedKey);
          onChange?.(e.target.value);
        }}
        className={fieldBoxClass(c, hasError, 'h-11')}
      />
      {hint && !hasError && <span className={`block text-[10px] ${c.secondaryText}`}>{hint}</span>}
      {hasError && <span role="alert" className="block text-[11px] font-semibold text-rose-500">{resolvedError}</span>}
    </label>
  );
}

export function SelectField({ label, value, onChange, options = [], testId, error, errorKey, name }) {
  const c = useColors();
  const ctx = useContext(FormValidationContext);
  const { msg: resolvedError, key: resolvedKey } = resolveContextualError(ctx, error, errorKey, name, testId);
  const hasError = Boolean(resolvedError);

  return (
    <label className="block space-y-1 mb-2.5">
      {label && (
        <span className={`text-[11px] font-medium ${hasError ? 'text-rose-500 font-semibold' : c.secondaryText}`}>
          {label}
        </span>
      )}
      <select
        name={name}
        value={value ?? ''}
        data-testid={testId}
        aria-invalid={hasError ? 'true' : undefined}
        onChange={(e) => {
          if (hasError && resolvedKey) ctx?.onClearField?.(resolvedKey);
          onChange?.(e.target.value);
        }}
        className={fieldBoxClass(c, hasError, 'h-11')}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {hasError && <span role="alert" className="block text-[11px] font-semibold text-rose-500">{resolvedError}</span>}
    </label>
  );
}

export function TextareaField({
  label, value, onChange, placeholder = '', rows = 3, disabled = false,
  testId, error, errorKey, name, hint
}) {
  const c = useColors();
  const ctx = useContext(FormValidationContext);
  const { msg: resolvedError, key: resolvedKey } = resolveContextualError(ctx, error, errorKey, name, testId);
  const hasError = Boolean(resolvedError);

  return (
    <label className="block space-y-1 mb-2.5">
      {label && (
        <span className={`text-[11px] font-medium ${hasError ? 'text-rose-500 font-semibold' : c.secondaryText}`}>
          {label}
        </span>
      )}
      <textarea
        name={name}
        rows={rows}
        value={value ?? ''}
        disabled={disabled}
        placeholder={placeholder}
        data-testid={testId}
        aria-invalid={hasError ? 'true' : undefined}
        onChange={(e) => {
          if (hasError && resolvedKey) ctx?.onClearField?.(resolvedKey);
          onChange?.(e.target.value);
        }}
        className={`w-full p-3 rounded-xl border transition text-xs ${c.text} disabled:opacity-60 focus:outline-none ${
          hasError
            ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-500/5'
            : `${c.border} ${c.inputBg} focus:border-[#E51C23]`
        }`}
      />
      {hint && !hasError && <span className={`block text-[10px] ${c.secondaryText}`}>{hint}</span>}
      {hasError && <span role="alert" className="block text-[11px] font-semibold text-rose-500">{resolvedError}</span>}
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
        className={`w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-3xl border-t ${c.border} ${c.surface} p-5 space-y-3`}
      >
        {title && <div className={`text-sm font-extrabold ${c.text}`}>{title}</div>}
        {children}
      </div>
    </div>
  );
}

export function CustomerProfileSheet({
  open,
  customerId,
  fallbackName,
  vehicleSummary,
  onClose,
  onAccept,
  onIgnore,
  busy = false
}) {
  const c = useColors();
  const { isAr, lang } = usePrefs();
  const profQ = useCustomerPublicProfile(open ? customerId : null);
  const prof = profQ.data;
  const name = prof?.fullName || fallbackName || (isAr ? 'مالك السيارة' : 'Car Owner');
  const ratingVal = Number(prof?.rating ?? 5.0);
  const ratingCount = Number(prof?.ratingCount ?? 0);
  const trips = Number(prof?.completedTrips ?? 0);
  const vehicles = Array.isArray(prof?.vehicles) && prof.vehicles.length > 0
    ? prof.vehicles
    : (vehicleSummary ? [vehicleSummary] : []);
  const reviews = Array.isArray(prof?.reviews) ? prof.reviews : [];

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={isAr ? 'ملف العميل وتقييماته' : 'Customer Profile & Rating'}
    >
      <div className="space-y-3" data-testid="customer-profile-sheet">
        <div className={`p-3.5 rounded-2xl border ${c.border} ${c.elevated} flex items-center gap-3`}>
          <Avatar name={name} size={46} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-extrabold truncate ${c.text}`}>{name}</span>
              <StatusBadge status="Verified" text={isAr ? 'عميل موثق' : 'Verified Driver'} />
            </div>
            <p className={`text-[11px] mt-0.5 ${c.secondaryText}`}>
              📍 {prof?.areaLabel || (isAr ? 'القاهرة الكبرى' : 'Greater Cairo')}
              {prof?.memberSince ? ` · ${isAr ? 'عضو منذ' : 'Since'} ${fmtDate(prof.memberSince, lang)}` : ''}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className={`p-2.5 rounded-xl border ${c.border} ${c.elevated}`}>
            <p className="text-sm font-extrabold text-[#E51C23]">⭐ {ratingVal.toFixed(1)}</p>
            <p className={`text-[10px] ${c.secondaryText}`}>
              {ratingCount > 0
                ? `${ratingCount} ${isAr ? 'تقييم' : 'reviews'}`
                : (isAr ? 'عميل ممتاز' : 'Top rating')}
            </p>
          </div>
          <div className={`p-2.5 rounded-xl border ${c.border} ${c.elevated}`}>
            <p className={`text-sm font-extrabold ${c.text}`}>✓ {trips}</p>
            <p className={`text-[10px] ${c.secondaryText}`}>{isAr ? 'طلبات مكتملة' : 'Completed trips'}</p>
          </div>
          <div className={`p-2.5 rounded-xl border ${c.border} ${c.elevated}`}>
            <p className={`text-sm font-extrabold ${c.text}`}>👍 {prof?.recommendPercent ?? 100}%</p>
            <p className={`text-[10px] ${c.secondaryText}`}>{isAr ? 'التزام وموثوقية' : 'Reliability'}</p>
          </div>
        </div>

        {vehicles.length > 0 && (
          <div className={`p-3 rounded-xl border ${c.border} ${c.elevated} space-y-1 text-xs`}>
            <p className={`text-[10px] font-bold uppercase ${c.secondaryText}`}>
              {isAr ? 'المركبة المسجلة' : 'Registered Vehicle'}
            </p>
            <p className={`font-bold ${c.text}`}>🚗 {vehicles[0]}</p>
          </div>
        )}

        <div>
          <p className={`text-xs font-bold mb-1.5 ${c.text}`}>
            {isAr ? 'آراء الفنيين السابقين عن العميل' : 'Previous Specialist Feedback'}
          </p>
          <div className="max-h-40 overflow-y-auto space-y-2">
            {profQ.isLoading && !prof ? (
              <p className={`text-xs ${c.secondaryText}`}>{isAr ? 'جارٍ تحميل التقييمات...' : 'Loading customer reviews...'}</p>
            ) : reviews.length === 0 ? (
              <p className={`text-xs ${c.secondaryText}`}>
                {isAr ? 'سجل نظيف وموثق بدون أي بلاغات سابقة.' : 'Clean verified account with 100% positive standing.'}
              </p>
            ) : (
              reviews.slice(0, 6).map((rv) => (
                <div key={rv.id} className={`p-2.5 rounded-xl border ${c.border} ${c.elevated} space-y-1 text-xs`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-bold ${c.text}`}>{rv.authorName || (isAr ? 'فني معتمد' : 'Verified Specialist')}</span>
                    <StarRating value={rv.stars} size={11} />
                  </div>
                  {rv.text && <p className={`text-[11px] ${c.secondaryText}`}>{rv.text}</p>}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          {onIgnore ? (
            <SecondaryButton onClick={onIgnore} disabled={busy}>
              {isAr ? 'تجاهل الطلب' : 'Ignore'}
            </SecondaryButton>
          ) : (
            <SecondaryButton onClick={onClose}>
              {isAr ? 'إغلاق' : 'Close'}
            </SecondaryButton>
          )}
          {onAccept ? (
            <PrimaryButton onClick={onAccept} disabled={busy} testId="customer-sheet-accept">
              {isAr ? 'قبول الطلب' : 'Accept Request'}
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={onClose}>
              {isAr ? 'تم' : 'Done'}
            </PrimaryButton>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}

export function ProviderReviewsSheet({ open, providerId, provider, onClose }) {
  const c = useColors();
  const { isAr, lang } = usePrefs();
  const reviewsQ = useReviews('provider', open ? providerId : null);
  const reviews = Array.isArray(reviewsQ.data) ? reviewsQ.data : [];
  const ratingVal = Number(provider?.rating ?? 0);
  const ratingCount = Number(provider?.ratingCount ?? reviews.length);
  const recPct = reviews.length > 0
    ? Math.round((reviews.filter((r) => r.recommend !== false).length / reviews.length) * 100)
    : Number(provider?.recommendPercent ?? 0);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={isAr ? 'تقييمات وآراء العملاء عنك' : 'Your Customer Ratings & Reviews'}
    >
      <div className="space-y-3" data-testid="provider-my-reviews-sheet">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className={`p-2.5 rounded-xl border ${c.border} ${c.elevated}`}>
            <p className="text-sm font-extrabold text-[#E51C23]">
              {ratingCount > 0 ? `⭐ ${ratingVal.toFixed(1)}` : '—'}
            </p>
            <p className={`text-[10px] ${c.secondaryText}`}>{isAr ? 'متوسط التقييم' : 'Avg. Rating'}</p>
          </div>
          <div className={`p-2.5 rounded-xl border ${c.border} ${c.elevated}`}>
            <p className={`text-sm font-extrabold ${c.text}`}>{ratingCount}</p>
            <p className={`text-[10px] ${c.secondaryText}`}>{isAr ? 'إجمالي التقييمات' : 'Total Reviews'}</p>
          </div>
          <div className={`p-2.5 rounded-xl border ${c.border} ${c.elevated}`}>
            <p className={`text-sm font-extrabold ${c.text}`}>{ratingCount > 0 ? `👍 ${recPct}%` : '—'}</p>
            <p className={`text-[10px] ${c.secondaryText}`}>{isAr ? 'نسبة التوصية' : 'Recommended'}</p>
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto space-y-2">
          {reviewsQ.isLoading ? (
            <p className={`text-xs ${c.secondaryText}`}>{isAr ? 'جارٍ تحميل تقييمات العملاء...' : 'Loading customer reviews...'}</p>
          ) : reviews.length === 0 ? (
            <div className={`p-4 rounded-2xl border ${c.border} ${c.elevated} text-center text-xs ${c.secondaryText}`}>
              {isAr ? 'لا توجد تقييمات مكتوبة من العملاء حتى الآن.' : 'No customer reviews recorded yet.'}
            </div>
          ) : (
            reviews.map((rv) => (
              <div key={rv.id} className={`p-3 rounded-2xl border ${c.border} ${c.elevated} space-y-1 text-xs`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-bold ${c.text}`}>{rv.authorName || (isAr ? 'عميل موثق' : 'Verified Driver')}</span>
                  <StarRating value={rv.stars} size={12} />
                </div>
                {rv.text && <p className={c.text}>{rv.text}</p>}
                <div className={`flex items-center justify-between text-[10px] ${c.secondaryText}`}>
                  <span>{rv.recommend !== false ? (isAr ? '👍 يوصي بخدمتك' : '👍 Recommends you') : ''}</span>
                  <span>{rv.createdAt ? fmtDate(rv.createdAt, lang) : ''}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <PrimaryButton onClick={onClose}>
          {isAr ? 'إغلاق' : 'Close'}
        </PrimaryButton>
      </div>
    </BottomSheet>
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

// ---- Google-Grade 2-Step Verification (TOTP + Mobile SMS + Recovery Codes) ----
export function TwoFactorChallengeCard({
  availableMethods = [],
  maskedPhone = '',
  defaultMethod = '',
  initialSmsSent = false,
  challengeToken = null,
  stepUpToken = null,
  allowRecovery = true,
  autoSendSms = true,
  listenAutofill = true,
  inline = false,
  selectedMethod: controlledMethod,
  onMethodChange,
  codeValue: controlledCode,
  onCodeChange,
  title = '',
  subtitle = '',
  submitLabel = '',
  busy = false,
  error = '',
  onSubmitCode,
  onCancel
}) {
  const c = useColors();
  const { isAr } = usePrefs();
  const methods = Array.isArray(availableMethods) && availableMethods.length > 0 ? availableMethods : ['totp'];
  const hasTotp = methods.includes('totp');
  const hasSms = methods.includes('sms');
  const resolvedDefault = defaultMethod && methods.includes(defaultMethod) ? defaultMethod : methods[0];

  const [internalMode, setInternalMode] = useState('');
  const [internalCode, setInternalCode] = useState('');
  const [smsSentFlag, setSmsSentFlag] = useState(Boolean(initialSmsSent));
  const [smsDispatchBusy, setSmsDispatchBusy] = useState(false);
  const [smsCooldownTimer, setSmsCooldownTimer] = useState(0);
  const [localError, setLocalError] = useState('');
  const autoDispatchedRef = useRef(false);

  const activeMethod = controlledMethod || internalMode || resolvedDefault || 'totp';
  const codeVal = controlledCode !== undefined ? controlledCode : internalCode;

  const updateMethod = (nextMethod) => {
    setLocalError('');
    if (onMethodChange) onMethodChange(nextMethod);
    else setInternalMode(nextMethod);
    if (onCodeChange) onCodeChange('');
    else setInternalCode('');
  };

  const updateCode = (val) => {
    setLocalError('');
    if (onCodeChange) onCodeChange(val);
    else setInternalCode(val);
  };

  useEffect(() => {
    if (smsCooldownTimer <= 0) return undefined;
    const id = setInterval(() => setSmsCooldownTimer((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [smsCooldownTimer]);

  const sendSmsCode = async (force = false) => {
    if (smsDispatchBusy) return;
    if (!force && smsCooldownTimer > 0) return;
    setSmsDispatchBusy(true);
    setLocalError('');
    try {
      await apiPost('/auth/2fa/send-sms', {
        challengeToken: challengeToken || null,
        stepUpToken: stepUpToken || null
      });
      setSmsSentFlag(true);
      setSmsCooldownTimer(25);
    } catch (err) {
      setLocalError(err?.message || (isAr ? 'تعذر إرسال رسالة التحقق النصية.' : 'Could not send SMS verification code.'));
    } finally {
      setSmsDispatchBusy(false);
    }
  };

  useEffect(() => {
    if (hasSms && activeMethod === 'sms' && !initialSmsSent && autoSendSms && !autoDispatchedRef.current) {
      autoDispatchedRef.current = true;
      sendSmsCode(true);
    }
  }, [hasSms, activeMethod, initialSmsSent, autoSendSms]);

  useEffect(() => {
    if (!listenAutofill) return undefined;
    const onFill = (e) => {
      const digits = String(e.detail ?? '').replace(/\D/g, '').slice(0, 6);
      if (digits) updateCode(digits);
    };
    window.addEventListener('fixngo:otp-autofill', onFill);
    return () => window.removeEventListener('fixngo:otp-autofill', onFill);
  }, [listenAutofill]);

  const handleSelectSms = () => {
    updateMethod('sms');
    if (!smsSentFlag) {
      autoDispatchedRef.current = true;
      sendSmsCode(true);
    }
  };

  const isRecovery = activeMethod === 'recovery';
  const cleanCode = isRecovery
    ? String(codeVal ?? '').trim().toUpperCase()
    : String(codeVal ?? '').replace(/\D/g, '').slice(0, 6);
  const canSubmit = isRecovery ? cleanCode.replace(/[^A-Z0-9]/g, '').length >= 8 : cleanCode.length === 6;

  const handleFormSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!canSubmit || busy) return;
    setLocalError('');
    await onSubmitCode?.({ method: activeMethod, code: cleanCode });
  };

  const bodyContent = (
    <div className="space-y-3" data-testid="two-factor-challenge">
      {(title || subtitle || !inline) && (
        <div className={`p-3.5 rounded-2xl border ${c.border} ${c.surface} space-y-1.5`}>
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-xl bg-[#E51C23]/15 text-[#E51C23] flex items-center justify-center shrink-0">
              <ShieldCheck size={16} />
            </span>
            <div>
              <p className={`text-xs font-extrabold ${c.text}`}>
                {title || (isAr ? 'التحقق بخطوتين (2-Step Verification)' : '2-Step Verification')}
              </p>
              <p className={`text-[11px] ${c.secondaryText}`}>
                {subtitle || (hasTotp && hasSms
                  ? (isAr ? 'اختر وسيلة التحقق المفضلة لديك لإثبات هويتك.' : 'Choose how you want to verify your identity.')
                  : (isAr ? 'أكمل خطوة الأمان الإضافية لحماية حسابك.' : 'Complete this extra security step to protect your account.'))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Method Selector Cards — shows BOTH options clearly when both TOTP & SMS are enabled */}
      <div className={`grid ${hasTotp && hasSms ? 'grid-cols-2' : 'grid-cols-1'} gap-2`} data-testid="2fa-methods-grid">
        {hasTotp && (
          <button
            type="button"
            data-testid="2fa-method-totp"
            onClick={() => updateMethod('totp')}
            className={`p-3 rounded-2xl border text-start transition space-y-1 ${
              activeMethod === 'totp'
                ? 'border-[#E51C23] bg-[#E51C23]/10 ring-1 ring-[#E51C23]/30'
                : `${c.border} ${c.surface} hover:opacity-90`
            }`}
          >
            <div className="flex items-center justify-between gap-1.5">
              <KeyRound size={15} className={activeMethod === 'totp' ? 'text-[#E51C23]' : c.secondaryText} />
              {activeMethod === 'totp' && (
                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-[#E51C23] text-white">
                  {isAr ? 'محدد' : 'Active'}
                </span>
              )}
            </div>
            <p className={`text-xs font-extrabold ${c.text}`}>
              {isAr ? 'تطبيق المصادقة' : 'Authenticator App'}
            </p>
            <p className={`text-[10px] leading-snug ${c.secondaryText}`}>
              {isAr ? 'رمز متغير من ٦ أرقام (Google Authenticator)' : '6-digit rolling code (Google Authenticator)'}
            </p>
          </button>
        )}

        {hasSms && (
          <button
            type="button"
            data-testid="2fa-method-sms"
            onClick={handleSelectSms}
            className={`p-3 rounded-2xl border text-start transition space-y-1 ${
              activeMethod === 'sms'
                ? 'border-[#E51C23] bg-[#E51C23]/10 ring-1 ring-[#E51C23]/30'
                : `${c.border} ${c.surface} hover:opacity-90`
            }`}
          >
            <div className="flex items-center justify-between gap-1.5">
              <Smartphone size={15} className={activeMethod === 'sms' ? 'text-[#E51C23]' : c.secondaryText} />
              {activeMethod === 'sms' && (
                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-[#E51C23] text-white">
                  {isAr ? 'محدد' : 'Active'}
                </span>
              )}
            </div>
            <p className={`text-xs font-extrabold ${c.text}`}>
              {isAr ? 'رسالة للهاتف (SMS)' : 'Mobile SMS Code'}
            </p>
            <p className={`text-[10px] leading-snug ${c.secondaryText}`} dir="ltr">
              {maskedPhone || (isAr ? 'الرقم المسجل' : 'Registered phone')}
            </p>
          </button>
        )}
      </div>

      {activeMethod === 'sms' && (
        <div className={`p-2.5 rounded-xl border ${c.border} ${c.elevated} flex items-center justify-between gap-2 text-[11px]`}>
          <span className={smsSentFlag ? 'text-emerald-500 font-semibold' : c.secondaryText}>
            {smsSentFlag
              ? (isAr
                  ? `✓ تم إرسال رمز SMS إلى ${maskedPhone || 'هاتفك'} (متاح في Simulator)`
                  : `✓ SMS code sent to ${maskedPhone || 'your phone'} (check Simulator)`)
              : (isAr ? 'أرسل رمز تحقق من ٦ أرقام إلى هاتفك.' : 'Send a 6-digit SMS code to your phone.')}
          </span>
          <button
            type="button"
            data-testid="2fa-send-sms-btn"
            disabled={smsDispatchBusy || smsCooldownTimer > 0}
            onClick={() => sendSmsCode(false)}
            className="shrink-0 px-2.5 py-1 rounded-lg bg-[#E51C23]/15 text-[#E51C23] font-bold text-[10px] disabled:opacity-50"
          >
            {smsDispatchBusy
              ? '…'
              : smsCooldownTimer > 0
                ? (isAr ? `إعادة (${smsCooldownTimer}ث)` : `Resend (${smsCooldownTimer}s)`)
                : smsSentFlag
                  ? (isAr ? 'إعادة الإرسال' : 'Resend SMS')
                  : (isAr ? 'إرسال الرمز' : 'Send SMS')}
          </button>
        </div>
      )}

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <label className={`text-[11px] font-semibold ${c.secondaryText}`}>
            {isRecovery
              ? (isAr ? 'رمز الاسترداد الاحتياطي (XXXX-XXXX)' : 'Backup recovery code (XXXX-XXXX)')
              : activeMethod === 'sms'
                ? (isAr ? 'رمز الرسالة النصية (٦ أرقام)' : '6-digit SMS verification code')
                : (isAr ? 'رمز تطبيق المصادقة (٦ أرقام)' : '6-digit authenticator code')}
          </label>
          {allowRecovery && (
            <button
              type="button"
              data-testid="2fa-method-recovery"
              onClick={() => updateMethod(isRecovery ? (resolvedDefault || 'totp') : 'recovery')}
              className="text-[10px] font-bold text-[#E51C23] hover:underline"
            >
              {isRecovery
                ? (isAr ? 'العودة لرمز ٦ أرقام' : 'Use 6-digit code instead')
                : (isAr ? 'استخدام رمز استرداد' : 'Use recovery code')}
            </button>
          )}
        </div>
        <input
          type="text"
          dir="ltr"
          inputMode={isRecovery ? 'text' : 'numeric'}
          maxLength={isRecovery ? 12 : 6}
          data-testid="field-twoFactorCode"
          value={codeVal}
          onChange={(e) => {
            const raw = e.target.value;
            updateCode(isRecovery ? raw.toUpperCase() : raw.replace(/\D/g, '').slice(0, 6));
          }}
          placeholder={isRecovery ? 'ABCD-1234' : '000000'}
          className={`w-full px-3.5 h-11 rounded-xl border transition font-mono tracking-widest text-center text-sm font-extrabold ${c.text} focus:outline-none ${
            (error || localError) ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-500/5' : `${c.border} ${c.inputBg}`
          }`}
        />
      </div>

      {(error || localError) && (
        <p role="alert" data-testid="2fa-error" className="text-xs font-semibold text-rose-500">
          {error || localError}
        </p>
      )}

      {!inline && (
        <div className="space-y-2 pt-1">
          <PrimaryButton
            type={onSubmitCode ? 'submit' : 'button'}
            disabled={busy || !canSubmit}
            testId="2fa-verify-submit"
            onClick={!onSubmitCode ? undefined : undefined}
          >
            {busy
              ? (isAr ? 'جارٍ التحقق…' : 'Verifying…')
              : (submitLabel || (isAr ? 'تأكيد رمز التحقق' : 'Verify & Continue'))}
          </PrimaryButton>
          {onCancel && (
            <SecondaryButton onClick={onCancel} disabled={busy}>
              {isAr ? 'رجوع' : 'Back'}
            </SecondaryButton>
          )}
        </div>
      )}
    </div>
  );

  if (inline) return bodyContent;
  return (
    <form noValidate onSubmit={handleFormSubmit}>
      {bodyContent}
    </form>
  );
}

export function TwoFactorStepUpSheet({ open, onClose, onVerified, actionTitle = '' }) {
  const { isAr } = usePrefs();
  const { user } = useSession();
  const [statusInfo, setStatusInfo] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  useEffect(() => {
    if (!open) {
      setVerifyError('');
      return;
    }
    let cancelled = false;
    setLoadingStatus(true);
    apiGet('/auth/2fa/status')
      .then((res) => {
        if (!cancelled) setStatusInfo(res);
      })
      .catch(() => {
        if (!cancelled) {
          const fallbackMethods = [];
          if (user?.totpEnabled) fallbackMethods.push('totp');
          if (user?.smsTwoFactorEnabled) fallbackMethods.push('sms');
          setStatusInfo({
            availableMethods: fallbackMethods.length ? fallbackMethods : ['totp'],
            maskedPhone: user?.maskedPhone || user?.phone || ''
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingStatus(false);
      });
    return () => { cancelled = true; };
  }, [open, user?.totpEnabled, user?.smsTwoFactorEnabled, user?.maskedPhone, user?.phone]);

  const handleVerify = async ({ method, code }) => {
    setVerifyBusy(true);
    setVerifyError('');
    try {
      const res = await apiPost('/auth/2fa/step-up', { method, code });
      if (res?.stepUpToken) {
        await onVerified?.(res.stepUpToken);
      }
    } catch (err) {
      setVerifyError(err?.message || (isAr ? 'رمز التحقق غير صحيح.' : 'Invalid verification code.'));
    } finally {
      setVerifyBusy(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={actionTitle || (isAr ? 'تأكيد هويتك (التحقق بخطوتين)' : "Verify it's you")}
    >
      {loadingStatus ? (
        <Skeleton rows={2} />
      ) : (
        <TwoFactorChallengeCard
          availableMethods={statusInfo?.availableMethods || ['totp']}
          maskedPhone={statusInfo?.maskedPhone || user?.maskedPhone || ''}
          defaultMethod={statusInfo?.availableMethods?.[0] || 'totp'}
          busy={verifyBusy}
          error={verifyError}
          onSubmitCode={handleVerify}
          onCancel={onClose}
        />
      )}
    </BottomSheet>
  );
}
