import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Shield,
  CreditCard,
  Search,
  Settings,
  Lock,
  Bell,
  FileText,
  Edit3,
  Phone,
  AlertCircle,
  Copy,
  LogOut,
  Building2,
  BarChart3,
  MessageSquare,
  Star,
  Download,
  RefreshCw,
  Check,
  UserCheck,
  KeyRound,
  Smartphone
} from 'lucide-react';
import { usePrefs, useNav, useSession } from '../../app/stores.jsx';
import { get, post, put, del, fileUrl } from '../../api/http.js';
import {
  useDashboard,
  useAdminUsers,
  useKycQueue,
  useAdminSettings,
  useAdminReviews,
  useAdminTickets,
  useAdminReports,
  useAudit
} from '../../api/hooks.js';
import {
  useColors,
  AppTopBar,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  formatLabel,
  pluralCount,
  StarRating,
  Skeleton,
  ErrorState,
  EmptyState,
  Toast,
  inputClass
} from '../../ui/kit.jsx';
import { fmtMoney, fmtNumber, fmtDate, fmtDateTime } from '../../i18n/format.js';

export const ADMIN_MAIN_SCREENS = ['AD01', 'AD02', 'AD04', 'AD05', 'AD06'];

const RAW_HTTP_TITLES = new Set([
  'Conflict', 'Bad Request', 'Unauthorized', 'Forbidden', 'Not Found',
  'Internal Server Error', 'Unprocessable Entity'
]);

function friendlyError(err, isAr, fallbackEn, fallbackAr) {
  const fallback = isAr ? (fallbackAr || fallbackEn) : fallbackEn;
  if (!err) return fallback;
  const code = err.code || '';
  if (code === 'admin.superadmin_protected') {
    return isAr ? 'لا يمكن إيقاف حساب المشرف العام.' : 'A super admin account cannot be suspended.';
  }
  if (code === 'payment_review.resolved') {
    return isAr ? 'تمت تسوية هذه الدفعة بالفعل.' : 'This payment review is already resolved.';
  }
  if (code === 'ticket.message_required') {
    return isAr ? 'يرجى كتابة نص الرد أولاً.' : 'Please enter a reply message.';
  }
  const msg = String(err.message || '').trim();
  if (!msg || RAW_HTTP_TITLES.has(msg) || /^HTTP \d+$/.test(msg)) {
    return fallback;
  }
  return msg;
}

const EXTRA_AUDIT_EN = {
  'payment_review.resolve': 'Resolved cash payment review',
  'withdrawal.process': 'Processed withdrawal request',
  'session.revoke': 'Revoked active session',
  'kyc.review': 'Reviewed KYC application'
};
const EXTRA_AUDIT_AR = {
  'payment_review.resolve': 'تسوية مراجعة دفعة نقدية',
  'withdrawal.process': 'معالجة طلب سحب أرباح',
  'session.revoke': 'إلغاء جلسة نشطة',
  'kyc.review': 'مراجعة طلب توثيق'
};
const ENTITY_AR = {
  PlatformSettings: 'إعدادات المنصة',
  User: 'مستخدم',
  PaymentReview: 'مراجعة دفع',
  Withdrawal: 'طلب سحب',
  Session: 'جلسة',
  KycApplication: 'طلب توثيق',
  SafetyReport: 'بلاغ أمان',
  Review: 'تقييم',
  SupportTicket: 'تذكرة دعم'
};

function formatAuditAction(action, isAr) {
  if (!action) return '—';
  const key = String(action);
  if (isAr && EXTRA_AUDIT_AR[key]) return EXTRA_AUDIT_AR[key];
  if (!isAr && EXTRA_AUDIT_EN[key]) return EXTRA_AUDIT_EN[key];
  return formatLabel(key, isAr);
}

function formatEntityType(entityType, isAr) {
  if (!entityType) return '';
  const key = String(entityType);
  if (isAr && ENTITY_AR[key]) return ENTITY_AR[key];
  return formatLabel(key, isAr);
}

function isImageAttachment(message) {
  const ct = String(message?.fileContentType || '').toLowerCase();
  if (ct.startsWith('image/')) return true;
  return /\.(png|jpe?g|webp|gif)$/i.test(String(message?.fileName || ''));
}

function TicketAttachment({ message, isAr }) {
  if (!message?.fileId) return null;
  const url = fileUrl(message.fileId);
  const label = message.fileName || (isAr ? 'مرفق التذكرة' : 'Ticket attachment');
  return (
    <div className="mt-2 space-y-1.5" data-testid="ticket-attachment">
      {isImageAttachment(message) && (
        <a href={url} target="_blank" rel="noreferrer" className="block">
          <img
            src={url}
            alt={label}
            data-testid="ticket-attachment-image"
            className="max-h-40 rounded-xl border border-slate-500/20 object-contain bg-black/5"
          />
        </a>
      )}
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        download={message.fileName || undefined}
        data-testid="ticket-attachment-link"
        className="inline-flex items-center gap-1.5 text-[11px] font-bold underline"
      >
        <FileText size={12} />
        <span dir="ltr">{label}</span>
      </a>
    </div>
  );
}

function AdminShell({ code, title, onBack, children }) {
  const colors = useColors();
  const nav = useNav();
  const showBack = Boolean(onBack) || !ADMIN_MAIN_SCREENS.includes(code);
  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={showBack} onBack={onBack || (() => nav.back())} title={title} />
      <div className="flex-1 p-4 space-y-3.5 pb-6">{children}</div>
    </div>
  );
}

function initialsOf(name) {
  if (!name) return 'FN';
  const parts = String(name).trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || 'FN';
}

/* =====================================================================
 * AD01: Platform overview
 * ===================================================================== */
export function AD01Screen() {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const ForwardChevron = isAr ? ChevronLeft : ChevronRight;
  const query = useDashboard();
  const data = query.data || {};
  const todayLabel = fmtDate(new Date().toISOString(), lang);

  return (
    <AdminShell code="AD01">
      <div>
        <h1 className={`text-lg font-extrabold ${colors.text}`}>
          {isAr ? 'نظرة عامة على المنصة' : 'Platform overview'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {isAr ? `مساحة المشرف · ${todayLabel}` : `Admin workspace · ${todayLabel}`}
        </p>
      </div>

      {query.isLoading ? (
        <Skeleton rows={4} />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={query.refetch} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface}`}>
              <p className={`text-base font-extrabold ${colors.text}`} data-testid="kpi-users">
                {fmtNumber(data.users ?? 0, lang)}
              </p>
              <p className={`text-[10px] ${colors.secondaryText}`}>
                {isAr ? 'إجمالي المستخدمين' : 'Total users'}
              </p>
            </div>
            <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface}`}>
              <p className={`text-base font-extrabold ${colors.text}`} data-testid="kpi-active-requests">
                {fmtNumber(data.activeRequests ?? 0, lang)}
              </p>
              <p className={`text-[10px] ${colors.secondaryText}`}>
                {isAr ? 'طلبات نشطة' : 'Active requests'}
              </p>
            </div>
            <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface}`}>
              <p className={`text-base font-extrabold ${colors.text}`} data-testid="kpi-pending-kyc">
                {fmtNumber(data.pendingKyc ?? 0, lang)}
              </p>
              <p className={`text-[10px] ${colors.secondaryText}`}>
                {isAr ? 'توثيقات قيد الانتظار' : 'Pending verifications'}
              </p>
            </div>
            <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface}`}>
              <p className={`text-base font-extrabold ${colors.text}`} data-testid="kpi-revenue-today">
                {fmtMoney(data.todayRevenueMinor ?? 0, lang)}
              </p>
              <p className={`text-[10px] ${colors.secondaryText}`}>
                {isAr ? 'مدفوعات اليوم' : 'Payments today'}
              </p>
            </div>
          </div>

          <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2 text-xs`}>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500">
              {isAr ? '• جميع الخدمات تعمل بكفاءة' : '• All services operational'}
            </span>
            <div className="flex justify-between">
              <span className={colors.secondaryText}>
                {isAr ? 'طلبات مكتملة اليوم' : 'Requests completed today'}
              </span>
              <span className={`font-bold ${colors.text}`}>{fmtNumber(data.completedToday ?? 0, lang)}</span>
            </div>
            <div className="flex justify-between">
              <span className={colors.secondaryText}>
                {isAr ? 'مراجعات دفع معلقة' : 'Pending payment reviews'}
              </span>
              <span className={`font-bold ${colors.text}`}>{fmtNumber(data.pendingPaymentReviews ?? 0, lang)}</span>
            </div>
            <div className="flex justify-between">
              <span className={colors.secondaryText}>
                {isAr ? 'بلاغات أمان مفتوحة' : 'Open safety reports'}
              </span>
              <span className={`font-bold ${colors.text}`}>{fmtNumber(data.openSafetyReports ?? 0, lang)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <p className={`text-xs font-extrabold ${colors.text}`}>
              {isAr ? 'يحتاج إلى انتباهك' : 'Needs your attention'}
            </p>
            {[
              {
                icon: CheckCircle2,
                title: pluralCount(
                  data.pendingKyc ?? 0,
                  'verification application',
                  'verification applications',
                  'طلب توثيق',
                  'طلبات توثيق',
                  'طلب توثيق',
                  isAr
                ),
                sub: isAr ? 'مراجعة مستندات مقدمي الخدمة والمراكز' : 'Review provider and center documents',
                target: 'AD02'
              },
              {
                icon: CreditCard,
                title: pluralCount(
                  data.pendingPaymentReviews ?? 0,
                  'payment review',
                  'payment reviews',
                  'مراجعة دفع',
                  'مراجعات دفع',
                  'مراجعة دفع',
                  isAr
                ),
                sub: isAr ? 'تسوية نقدية قيد الانتظار' : 'Cash reconciliation pending',
                target: 'AD07'
              },
              {
                icon: Shield,
                title: pluralCount(
                  data.openSafetyReports ?? 0,
                  'safety report',
                  'safety reports',
                  'بلاغ أمان',
                  'بلاغات أمان',
                  'بلاغ أمان',
                  isAr
                ),
                sub: isAr ? 'مراجعة بلاغات الأمان' : 'Review safety reports',
                target: 'AD09'
              },
              {
                icon: BarChart3,
                title: isAr ? 'تقارير المنصة وسجل التدقيق' : 'Platform reports & audit',
                sub: isAr ? 'تحليلات الإيرادات والطلبات وسجل التدقيق' : 'Revenue, request breakdown, and audit trail',
                target: 'AD16'
              },
              {
                icon: Star,
                title: isAr ? 'التقييمات والشكاوى' : 'Reviews & complaints',
                sub: isAr ? 'مراجعة تقييمات السائقين والشكاوى' : 'Moderate driver reviews and flagged feedback',
                target: 'AD17'
              },
              {
                icon: MessageSquare,
                title: isAr ? 'صندوق الدعم الفني' : 'Support inbox',
                sub: isAr ? 'الرد على تذاكر الدعم المفتوحة' : 'Respond to open customer and provider tickets',
                target: 'AD18'
              }
            ].map((item) => {
              const IconComp = item.icon;
              return (
                <button
                  key={item.target}
                  data-testid={`overview-link-${item.target}`}
                  onClick={() => nav.go(item.target)}
                  className={`w-full p-3 rounded-2xl border ${colors.border} ${colors.surface} flex items-center justify-between text-start`}
                >
                  <div className="flex items-center gap-2.5">
                    <IconComp size={16} className={colors.secondaryText} />
                    <div>
                      <p className={`text-xs font-extrabold ${colors.text}`}>{item.title}</p>
                      <p className={`text-[10px] ${colors.secondaryText}`}>{item.sub}</p>
                    </div>
                  </div>
                  <ForwardChevron size={14} className={colors.secondaryText} />
                </button>
              );
            })}
          </div>
        </>
      )}
    </AdminShell>
  );
}

/* =====================================================================
 * AD02: Verification queue
 * ===================================================================== */
export function AD02Screen() {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const [verifyFilter, setVerifyFilter] = useState('All');
  const query = useKycQueue();
  const items = Array.isArray(query.data) ? query.data : [];

  const filtered = useMemo(() => {
    return items.filter((app) => {
      if (verifyFilter === 'Providers') return app.applicantType !== 'ServiceCenter';
      if (verifyFilter === 'Centers') return app.applicantType === 'ServiceCenter';
      return true;
    });
  }, [items, verifyFilter]);

  const pendingCount = items.filter(
    (a) => a.status === 'Submitted' || a.status === 'UnderReview' || a.status === 'Pending'
  ).length;

  return (
    <AdminShell code="AD02">
      <div>
        <h1 className={`text-lg font-extrabold ${colors.text}`}>
          {isAr ? 'طابور التوثيق' : 'Verification queue'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {isAr
            ? `${pluralCount(pendingCount, '', '', 'طلب توثيق', 'طلبات توثيق', 'طلب توثيق', true)} بانتظار المراجعة`
            : `${pluralCount(pendingCount, 'verification application', 'verification applications', '', '', '', false)} waiting for review`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {[
          { id: 'All', label: isAr ? 'الكل' : 'All' },
          { id: 'Providers', label: isAr ? 'مقدمو الخدمة' : 'Providers' },
          { id: 'Centers', label: isAr ? 'المراكز' : 'Centers' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setVerifyFilter(tab.id)}
            className={`py-2 rounded-xl text-[11px] font-bold border ${
              verifyFilter === tab.id
                ? `${colors.border} ${colors.surface} ${colors.text}`
                : `border-transparent ${colors.secondaryText}`
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <Skeleton rows={3} />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={query.refetch} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={isAr ? 'لا توجد طلبات توثيق' : 'No verification applications'}
          message={isAr ? 'جميع الطلبات تمت مراجعتها.' : 'All verification applications have been processed.'}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => {
            const displayName = app.fullName || app.businessName || app.code;
            const docCount = app.documents?.length ?? 0;
            const isCenter = app.applicantType === 'ServiceCenter';
            const docSummary =
              docCount > 0
                ? app.documents.map((d) => formatLabel(d.documentType, isAr)).join(' · ')
                : '';
            return (
              <button
                key={app.id}
                data-testid="data-row"
                onClick={() => nav.go('AD03', { id: app.id })}
                className={`w-full p-3.5 rounded-2xl border ${colors.border} ${colors.surface} text-start space-y-2`}
              >
                <div className="flex justify-between text-[11px]">
                  <span className={colors.secondaryText}>
                    {app.code} · {fmtDate(app.submittedAt, lang)}
                  </span>
                  <span className={`font-extrabold ${colors.text}`}>
                    {formatLabel(app.applicantType, isAr)}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  {isCenter ? (
                    <div className="w-9 h-9 rounded-xl bg-slate-500/15 text-slate-400 flex items-center justify-center">
                      <Building2 size={16} />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-extrabold text-xs">
                      {initialsOf(displayName)}
                    </div>
                  )}
                  <div>
                    <p className={`text-xs font-extrabold ${colors.text}`}>{displayName}</p>
                    <p className={`text-[11px] ${colors.secondaryText}`}>
                      {docCount === 0
                        ? (isAr ? 'لم يتم رفع مستندات بعد' : 'No documents uploaded yet')
                        : isAr
                        ? pluralCount(docCount, '', '', 'مستند مرفوع', 'مستندات مرفوعة', 'مستنداً مرفوعاً', true)
                        : `${pluralCount(docCount, 'document', 'documents', '', '', '', false)} submitted`}
                    </p>
                  </div>
                </div>
                {docSummary && (
                  <p className={`text-[11px] ${colors.secondaryText}`}>{docSummary}</p>
                )}
                <div className="flex items-center justify-between">
                  <StatusBadge status={app.status} />
                  <span className={`text-[10px] ${colors.secondaryText}`}>{app.address || ''}</span>
                </div>
                <div className="w-full h-1 rounded-full bg-slate-500/20 overflow-hidden">
                  <div
                    className={`h-full ${
                      app.status === 'Approved' ? 'w-full bg-emerald-500' : 'w-1/2 bg-red-600'
                    }`}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}

/* =====================================================================
 * AD03: Review application
 * ===================================================================== */
export function AD03Screen({ id, params }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const targetId = id || params?.id || nav.flow?.kycAppId;

  const detailQuery = useQuery({
    queryKey: ['admin', 'kyc', targetId],
    queryFn: () => get(`/admin/kyc/${targetId}`),
    enabled: !!targetId
  });
  const queueQuery = useKycQueue();
  const app =
    detailQuery.data ||
    (Array.isArray(queueQuery.data)
      ? queueQuery.data.find((x) => String(x.id) === String(targetId)) || queueQuery.data[0]
      : null);

  const [note, setNote] = useState(nav.flow?.kycNote || '');

  useEffect(() => {
    if (app?.reviewerNote && !note) setNote(app.reviewerNote);
  }, [app?.reviewerNote]);

  const handleDecision = (decision) => {
    nav.updateFlow({ kycDecision: decision, kycNote: note, kycAppId: app?.id });
    nav.go('AD15', { id: app?.id, decision });
  };

  const displayName = app?.fullName || app?.businessName || app?.code || '—';
  const docs = Array.isArray(app?.documents) ? app.documents : [];

  return (
    <AdminShell code="AD03">
      <div>
        <h1 className={`text-lg font-extrabold ${colors.text}`}>
          {isAr ? 'مراجعة الطلب' : 'Review application'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {app
            ? `${app.code} · ${isAr ? 'تم الإرسال' : 'Submitted'} ${fmtDate(app.submittedAt, lang)}`
            : isAr
            ? 'تفاصيل طلب التوثيق'
            : 'Verification application details'}
        </p>
      </div>

      {detailQuery.isLoading && queueQuery.isLoading ? (
        <Skeleton rows={3} />
      ) : !app ? (
        <EmptyState
          title={isAr ? 'لم يتم العثور على الطلب' : 'Application not found'}
          message={isAr ? 'اختر طلباً من طابور التوثيق.' : 'Select an application from the verification queue.'}
        />
      ) : (
        <>
          <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2 text-xs`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-9 h-9 shrink-0 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-extrabold text-xs">
                  {initialsOf(displayName)}
                </div>
                <div className="min-w-0">
                  <p className={`font-extrabold truncate ${colors.text}`}>{displayName}</p>
                  <p className={`text-[11px] truncate ${colors.secondaryText}`}>
                    {formatLabel(app.applicantType, isAr)}
                    {app.address ? ` · ${app.address}` : ''}
                  </p>
                </div>
              </div>
              <StatusBadge status={app.status} />
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-500/10">
              <span className={colors.secondaryText}>{isAr ? 'الرمز' : 'Code'}</span>
              <span className={`font-mono font-bold ${colors.text}`}>{app.code}</span>
            </div>
            <div className="flex justify-between">
              <span className={colors.secondaryText}>{isAr ? 'البريد الإلكتروني' : 'Email'}</span>
              <span className={`font-bold ${colors.text}`} dir="ltr">{app.email || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className={colors.secondaryText}>{isAr ? 'الهاتف' : 'Phone'}</span>
              <span className={`font-bold ${colors.text}`} dir="ltr">{app.phone || '—'}</span>
            </div>
            {app.address && (
              <div className="flex justify-between">
                <span className={colors.secondaryText}>{isAr ? 'العنوان' : 'Address'}</span>
                <span className={`font-bold ${colors.text}`}>{app.address}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className={`text-xs font-extrabold ${colors.text}`}>
              {isAr ? 'المستندات المقدمة' : 'Submitted documents'} ({fmtNumber(docs.length, lang)})
            </p>
            {docs.length === 0 ? (
              <div className={`p-3 rounded-xl border ${colors.border} ${colors.surface} text-xs ${colors.secondaryText}`}>
                {isAr ? 'لا توجد مستندات مرفقة بعد.' : 'No documents attached yet.'}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {docs.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    data-testid="data-row"
                    onClick={() =>
                      nav.go('SH17', {
                        appId: app.id,
                        id: doc.id,
                        fileId: doc.fileId,
                        type: doc.documentType,
                        holder: displayName
                      })
                    }
                    className={`p-2 rounded-xl border ${colors.border} ${colors.surface} text-start space-y-1.5`}
                  >
                    {doc.fileId ? (
                      <div className="h-12 rounded-lg bg-slate-900 overflow-hidden flex items-center justify-center">
                        <img
                          src={fileUrl(doc.fileId)}
                          alt={doc.documentType}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="h-12 rounded-lg bg-slate-900 text-white p-1.5 flex flex-col justify-between text-[8px]">
                        <span className="text-slate-400">ARAB REPUBLIC OF EGYPT</span>
                        <span className="font-bold truncate">{displayName}</span>
                      </div>
                    )}
                    <p className={`text-[10px] font-extrabold truncate ${colors.text}`}>
                      {formatLabel(doc.documentType, isAr)}
                    </p>
                    <p className={`text-[9px] ${colors.secondaryText}`}>
                      {formatLabel(doc.status, isAr)}
                    </p>
                  </button>
                ))}
              </div>
            )}
            <p className={`text-[10px] ${colors.secondaryText}`}>
              {isAr
                ? 'اضغط على أي مستند لفحصه. بيانات الهوية تطابق الطلب.'
                : 'Tap a document to inspect. Identity details match the application.'}
            </p>
          </div>

          <div className="space-y-1">
            <label className={`text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'سبب المراجعة / ملاحظة القرار' : 'Review reason / decision note'}
            </label>
            <textarea
              rows={2}
              data-testid="field-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isAr ? 'أضف سبباً يظهر للمتقدم...' : 'Add a reason visible to the applicant...'}
              className={`w-full p-3 rounded-xl border ${colors.border} ${colors.inputBg} text-xs ${colors.text}`}
            />
          </div>

          <div className="space-y-2">
            <PrimaryButton testId="screen-primary" onClick={() => handleDecision('Approved')}>
              {isAr ? 'الموافقة على المتقدم' : 'Approve Applicant'}
            </PrimaryButton>
            <SecondaryButton onClick={() => handleDecision('ChangesNeeded')}>
              {isAr ? 'طلب تعديلات' : 'Request Changes'}
            </SecondaryButton>
            <button
              type="button"
              onClick={() => handleDecision('Rejected')}
              className="w-full py-3 rounded-2xl bg-slate-900 text-white text-xs font-extrabold"
            >
              {isAr ? 'رفض المتقدم' : 'Reject Applicant'}
            </button>
          </div>
        </>
      )}
    </AdminShell>
  );
}

/* =====================================================================
 * AD04: User management
 * ===================================================================== */
export function AD04Screen() {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const query = useAdminUsers();
  const users = Array.isArray(query.data) ? query.data : [];

  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('All');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (userFilter === 'Providers' && !['Mechanic', 'TowCaptain', 'ServiceCenter'].includes(u.role)) {
        return false;
      }
      if (userFilter === 'Suspended' && u.status !== 'Suspended') {
        return false;
      }
      if (!q) return true;
      return (
        String(u.fullName || '').toLowerCase().includes(q) ||
        String(u.email || '').toLowerCase().includes(q) ||
        String(u.role || '').toLowerCase().includes(q)
      );
    });
  }, [users, search, userFilter]);

  return (
    <AdminShell code="AD04">
      <div>
        <h1 className={`text-lg font-extrabold ${colors.text}`}>
          {isAr ? 'إدارة المستخدمين' : 'User management'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {isAr
            ? `${pluralCount(users.length, '', '', 'حساب', 'حسابات', 'حساباً', true)} عبر المنصة`
            : `${pluralCount(users.length, 'account', 'accounts', '', '', '', false)} across the platform`}
        </p>
      </div>

      <div className={`px-3 py-2 rounded-xl border ${colors.border} ${colors.surface} flex items-center gap-2`}>
        <input
          type="text"
          data-testid="field-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isAr ? 'الاسم أو البريد الإلكتروني' : 'Search by name or email'}
          className={`flex-1 bg-transparent outline-none text-xs ${colors.text}`}
        />
        <Search size={14} className={colors.secondaryText} />
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {[
          { id: 'All', label: isAr ? 'الكل' : 'All' },
          { id: 'Providers', label: isAr ? 'مقدمو الخدمة' : 'Providers' },
          { id: 'Suspended', label: isAr ? 'موقوف' : 'Suspended' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setUserFilter(tab.id)}
            className={`py-2 rounded-xl text-[10px] font-bold border ${
              userFilter === tab.id
                ? `${colors.border} ${colors.surface} ${colors.text}`
                : `border-transparent ${colors.secondaryText}`
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <Skeleton rows={4} />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={query.refetch} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={isAr ? 'لا يوجد مستخدمون مطابقون' : 'No matching users'}
          message={isAr ? 'جرّب تغيير البحث أو التصفية.' : 'Try adjusting your search or filter.'}
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((u) => (
            <div
              key={u.id}
              data-testid="data-row"
              onClick={() => nav.go('AD11', { id: u.id })}
              className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs cursor-pointer hover:opacity-95 transition`}
            >
              <div className="flex items-center justify-between">
                <p className={`font-extrabold ${colors.text}`}>{u.fullName}</p>
                <StatusBadge status={u.status} />
              </div>
              <p className={`text-[11px] ${colors.secondaryText}`} dir="ltr">{u.email}</p>
              <div className="flex justify-between items-center pt-1">
                <span className={colors.secondaryText}>{formatLabel(u.role, isAr)}</span>
                {!u.isSuperAdmin && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      nav.go('AD12', { id: u.id });
                    }}
                    className="text-[11px] font-bold text-[#E51C23] hover:underline"
                  >
                    {u.status === 'Suspended'
                      ? isAr
                        ? 'استعادة الحساب'
                        : 'Restore access'
                      : isAr
                      ? 'إدارة الصلاحية'
                      : 'Manage access'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

/* =====================================================================
 * AD05: Pricing & settings (FIX B7 400 BUG)
 * ===================================================================== */
function pricingToForm(data) {
  if (!data) return null;
  const p = data.pricing || data;
  return {
    towBaseEgp: String((p.towBaseMinor ?? 0) / 100),
    mechanicBaseEgp: String((p.mechanicBaseMinor ?? 0) / 100),
    serviceFeeEgp: String((p.serviceFeeMinor ?? 0) / 100),
    towRatePerKm: String(p.towRatePerKm ?? 0),
    surge: String(p.surge ?? 1),
    searchRadiusKm: String(p.searchRadiusKm ?? 0),
    offerTimeoutSeconds: String(p.offerTimeoutSeconds ?? 0),
    p0TimeoutSeconds: String(p.p0TimeoutSeconds ?? 0),
    bookingExpiryHours: String(p.bookingExpiryHours ?? 0),
    minWithdrawalEgp: String((p.minWithdrawalMinor ?? 0) / 100),
    withdrawalFeeMinor: Number(p.withdrawalFeeMinor ?? 0),
    ambulanceNumber: String(p.ambulanceNumber ?? ''),
    policeNumber: String(p.policeNumber ?? '')
  };
}

export function AD05Screen() {
  const colors = useColors();
  const { isAr } = usePrefs();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => get('/admin/settings'),
    staleTime: 0,
    refetchOnMount: 'always'
  });

  const [form, setForm] = useState(() => pricingToForm(query.data));
  const [version, setVersion] = useState(() => query.data?.version ?? null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (query.status === 'pending' && query.fetchStatus === 'idle') {
      query.refetch();
    }
  }, [query.status, query.fetchStatus, query]);

  useEffect(() => {
    if (query.data) {
      setForm(pricingToForm(query.data));
      if (query.data.version) setVersion(query.data.version);
    }
  }, [query.data]);

  const activeForm = form || pricingToForm(query.data);
  const activeVersion = version ?? query.data?.version ?? null;
  const setField = (key, val) =>
    setForm((prev) => ({ ...(prev || pricingToForm(query.data) || {}), [key]: val }));

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!activeForm) return;
    setBusy(true);
    setError('');
    setToast('');
    try {
      const numOr = (val, def) => {
        const n = Number(val);
        return Number.isFinite(n) && n > 0 ? n : def;
      };
      const payload = {
        pricing: {
          towBaseMinor: Math.round(numOr(activeForm.towBaseEgp, 0) * 100),
          mechanicBaseMinor: Math.round(numOr(activeForm.mechanicBaseEgp, 0) * 100),
          serviceFeeMinor: Math.round(numOr(activeForm.serviceFeeEgp, 0) * 100),
          towRatePerKm: numOr(activeForm.towRatePerKm, 1),
          surge: Math.max(1, numOr(activeForm.surge, 1)),
          searchRadiusKm: numOr(activeForm.searchRadiusKm, 1),
          offerTimeoutSeconds: numOr(activeForm.offerTimeoutSeconds, 15),
          p0TimeoutSeconds: numOr(activeForm.p0TimeoutSeconds, 10),
          bookingExpiryHours: numOr(activeForm.bookingExpiryHours, 24),
          minWithdrawalMinor: Math.round(numOr(activeForm.minWithdrawalEgp, 0) * 100),
          withdrawalFeeMinor: Number(activeForm.withdrawalFeeMinor ?? 0),
          ambulanceNumber: String(activeForm.ambulanceNumber || '').trim() || '123',
          policeNumber: String(activeForm.policeNumber || '').trim() || '122'
        }
      };
      const res = await put('/admin/settings', payload);
      if (res) {
        queryClient.setQueryData(['admin', 'settings'], res);
        setForm(pricingToForm(res));
        if (res.version) setVersion(res.version);
      }
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      queryClient.invalidateQueries({ queryKey: ['bootstrap'] });
      setToast(isAr ? 'تم حفظ الإعدادات' : 'Settings saved');
    } catch (err) {
      setError(friendlyError(err, isAr, 'Failed to save settings', 'تعذر حفظ الإعدادات'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell code="AD05">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'التسعير والإعدادات' : 'Pricing & settings'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {isAr ? 'إعدادات المنصة بالكامل · مصر' : 'Platform-wide configuration · Egypt'}
          </p>
        </div>
        <span
          data-testid="settings-version"
          className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-[#E51C23]/15 text-[#E51C23]"
        >
          {activeVersion ? `v${activeVersion}` : '…'}
        </span>
      </div>

      {!activeForm && query.isError ? (
        <ErrorState error={query.error} retry={query.refetch} />
      ) : !activeForm ? (
        <Skeleton rows={4} />
      ) : (
        <form onSubmit={handleSave} className="space-y-3.5">
          <p className={`text-xs font-extrabold ${colors.text}`}>
            {isAr ? 'التسعير الأساسي' : 'Base pricing'}
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className={`text-[10px] ${colors.secondaryText}`}>
                {isAr ? 'أساسي الونش · ج.م' : 'Tow base · EGP'}
              </label>
              <div className={`px-3 py-2 rounded-xl border ${colors.border} ${colors.surface} flex justify-between items-center`}>
                <input
                  type="number"
                  step="1"
                  dir="ltr"
                  data-testid="field-towBaseEgp"
                  value={activeForm.towBaseEgp}
                  onChange={(e) => setField('towBaseEgp', e.target.value)}
                  className={`w-full bg-transparent outline-none text-xs font-bold ${colors.text}`}
                />
                <Edit3 size={12} className={colors.secondaryText} />
              </div>
            </div>
            <div className="space-y-1">
              <label className={`text-[10px] ${colors.secondaryText}`}>
                {isAr ? 'الميكانيكي · ج.م' : 'Mechanic · EGP'}
              </label>
              <div className={`px-3 py-2 rounded-xl border ${colors.border} ${colors.surface} flex justify-between items-center`}>
                <input
                  type="number"
                  step="1"
                  dir="ltr"
                  data-testid="field-mechanicBaseEgp"
                  value={activeForm.mechanicBaseEgp}
                  onChange={(e) => setField('mechanicBaseEgp', e.target.value)}
                  className={`w-full bg-transparent outline-none text-xs font-bold ${colors.text}`}
                />
                <Edit3 size={12} className={colors.secondaryText} />
              </div>
            </div>
            <div className="space-y-1">
              <label className={`text-[10px] ${colors.secondaryText}`}>
                {isAr ? 'معامل الذروة' : 'Surge multiplier'}
              </label>
              <div className={`px-3 py-2 rounded-xl border ${colors.border} ${colors.surface} flex justify-between items-center`}>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  dir="ltr"
                  data-testid="field-surge"
                  value={activeForm.surge}
                  onChange={(e) => setField('surge', e.target.value)}
                  className={`w-full bg-transparent outline-none text-xs font-bold ${colors.text}`}
                />
                <Edit3 size={12} className={colors.secondaryText} />
              </div>
            </div>
            <div className="space-y-1">
              <label className={`text-[10px] ${colors.secondaryText}`}>
                {isAr ? 'رسوم الخدمة · ج.م' : 'Service fee · EGP'}
              </label>
              <div className={`px-3 py-2 rounded-xl border ${colors.border} ${colors.surface} flex justify-between items-center`}>
                <input
                  type="number"
                  step="1"
                  dir="ltr"
                  data-testid="field-serviceFeeEgp"
                  value={activeForm.serviceFeeEgp}
                  onChange={(e) => setField('serviceFeeEgp', e.target.value)}
                  className={`w-full bg-transparent outline-none text-xs font-bold ${colors.text}`}
                />
                <Edit3 size={12} className={colors.secondaryText} />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className={`text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'تعريفة مسافة السحب · ج.م / كم' : 'Tow distance rate · EGP / km'}
            </label>
            <div className={`px-3 py-2 rounded-xl border ${colors.border} ${colors.surface} flex justify-between items-center`}>
              <input
                type="number"
                step="0.1"
                dir="ltr"
                data-testid="field-towRatePerKm"
                value={activeForm.towRatePerKm}
                onChange={(e) => setField('towRatePerKm', e.target.value)}
                className={`w-full bg-transparent outline-none text-xs font-bold ${colors.text}`}
              />
              <Edit3 size={12} className={colors.secondaryText} />
            </div>
          </div>

          <p className={`text-xs font-extrabold ${colors.text}`}>
            {isAr ? 'معاملات المطابقة والسحب' : 'Dispatch & withdrawal thresholds'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className={`text-[10px] ${colors.secondaryText}`}>
                {isAr ? 'نطاق البحث · كم' : 'Search radius · km'}
              </label>
              <div className={`px-3 py-2 rounded-xl border ${colors.border} ${colors.surface}`}>
                <input
                  type="number"
                  dir="ltr"
                  data-testid="field-searchRadiusKm"
                  value={activeForm.searchRadiusKm}
                  onChange={(e) => setField('searchRadiusKm', e.target.value)}
                  className={`w-full bg-transparent outline-none text-xs font-bold ${colors.text}`}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className={`text-[10px] ${colors.secondaryText}`}>
                {isAr ? 'مهلة العرض · ثانية' : 'Offer timeout · sec'}
              </label>
              <div className={`px-3 py-2 rounded-xl border ${colors.border} ${colors.surface}`}>
                <input
                  type="number"
                  dir="ltr"
                  data-testid="field-offerTimeoutSeconds"
                  value={activeForm.offerTimeoutSeconds}
                  onChange={(e) => setField('offerTimeoutSeconds', e.target.value)}
                  className={`w-full bg-transparent outline-none text-xs font-bold ${colors.text}`}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className={`text-[10px] ${colors.secondaryText}`}>
                {isAr ? 'مهلة طوارئ P0 · ثانية' : 'P0 timeout · sec'}
              </label>
              <div className={`px-3 py-2 rounded-xl border ${colors.border} ${colors.surface}`}>
                <input
                  type="number"
                  dir="ltr"
                  data-testid="field-p0TimeoutSeconds"
                  value={activeForm.p0TimeoutSeconds}
                  onChange={(e) => setField('p0TimeoutSeconds', e.target.value)}
                  className={`w-full bg-transparent outline-none text-xs font-bold ${colors.text}`}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className={`text-[10px] ${colors.secondaryText}`}>
                {isAr ? 'الحد الأدنى للسحب · ج.م' : 'Min withdrawal · EGP'}
              </label>
              <div className={`px-3 py-2 rounded-xl border ${colors.border} ${colors.surface}`}>
                <input
                  type="number"
                  dir="ltr"
                  data-testid="field-minWithdrawalEgp"
                  value={activeForm.minWithdrawalEgp}
                  onChange={(e) => setField('minWithdrawalEgp', e.target.value)}
                  className={`w-full bg-transparent outline-none text-xs font-bold ${colors.text}`}
                />
              </div>
            </div>
          </div>

          <p className={`text-xs font-extrabold ${colors.text}`}>
            {isAr ? 'أرقام الطوارئ السريعة' : 'Emergency quick-dial'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className={`text-[10px] ${colors.secondaryText}`}>
                {isAr ? 'الإسعاف' : 'Ambulance'}
              </label>
              <div className={`px-3 py-2 rounded-xl border ${colors.border} ${colors.surface} flex justify-between items-center`}>
                <input
                  type="text"
                  dir="ltr"
                  data-testid="field-ambulanceNumber"
                  value={activeForm.ambulanceNumber}
                  onChange={(e) => setField('ambulanceNumber', e.target.value)}
                  className={`w-full bg-transparent outline-none text-xs font-bold ${colors.text}`}
                />
                <Phone size={12} className={colors.secondaryText} />
              </div>
            </div>
            <div className="space-y-1">
              <label className={`text-[10px] ${colors.secondaryText}`}>
                {isAr ? 'الشرطة' : 'Police'}
              </label>
              <div className={`px-3 py-2 rounded-xl border ${colors.border} ${colors.surface} flex justify-between items-center`}>
                <input
                  type="text"
                  dir="ltr"
                  data-testid="field-policeNumber"
                  value={activeForm.policeNumber}
                  onChange={(e) => setField('policeNumber', e.target.value)}
                  className={`w-full bg-transparent outline-none text-xs font-bold ${colors.text}`}
                />
                <Phone size={12} className={colors.secondaryText} />
              </div>
            </div>
          </div>

          <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} space-y-1 text-[11px]`}>
            <p className={colors.secondaryText}>
              {isAr
                ? 'تطبق الإعدادات الجديدة على الطلبات المستقبلية فقط. عروض الأسعار المعتمدة الحالية تبقى دون تغيير.'
                : 'New settings apply to future requests only. Existing approved quotes remain unchanged.'}
            </p>
            <div className="flex justify-between pt-1">
              <span className={colors.secondaryText}>{isAr ? 'الإصدار النشط' : 'Active version'}</span>
              <span className={`font-bold ${colors.text}`}>
                v{activeVersion ?? 1} · {user?.fullName || (isAr ? 'المشرف' : 'Admin')}
              </span>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs text-rose-500 font-bold">
              {error}
            </p>
          )}
          {toast && (
            <div
              role="status"
              data-testid="settings-toast"
              className="p-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-500 text-xs font-bold flex items-center gap-2"
            >
              <Check size={14} />
              <span>{toast}</span>
            </div>
          )}

          <PrimaryButton type="submit" disabled={busy} testId="screen-primary">
            {busy ? (isAr ? 'جاري الحفظ...' : 'Saving...') : isAr ? 'حفظ الإعدادات' : 'Save Settings'}
          </PrimaryButton>
        </form>
      )}
    </AdminShell>
  );
}

/* =====================================================================
 * AD06: Admin profile
 * ===================================================================== */
export function AD06Screen() {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const { user } = useSession();
  const nav = useNav();
  const ForwardChevron = isAr ? ChevronLeft : ChevronRight;
  const todayLabel = fmtDate(new Date().toISOString(), lang);

  return (
    <AdminShell code="AD06">
      <div>
        <h1 className={`text-lg font-extrabold ${colors.text}`}>
          {isAr ? 'الملف الشخصي' : 'Profile'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {isAr ? `مساحة المشرف · ${todayLabel}` : `Admin workspace · ${todayLabel}`}
        </p>
      </div>

      <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2 text-xs`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 shrink-0 rounded-xl bg-red-600/15 text-red-500 flex items-center justify-center font-extrabold text-xs">
            {initialsOf(user?.fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className={`font-extrabold truncate ${colors.text}`}>{user?.fullName || (isAr ? 'المشرف' : 'Administrator')}</p>
            <p className={`text-[11px] truncate ${colors.secondaryText}`} dir="ltr">{user?.email || '—'}</p>
          </div>
        </div>
        <div className="flex justify-between pt-1 border-t border-slate-500/10">
          <span className={colors.secondaryText}>{isAr ? 'الدور' : 'Role'}</span>
          <span className={`font-bold ${colors.text}`}>
            {user?.isSuperAdmin
              ? isAr
                ? 'مشرف عام'
                : 'Super Admin'
              : isAr
              ? 'مشرف المنصة'
              : 'Administrator'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className={colors.secondaryText}>{isAr ? 'المصادقة الثنائية' : 'Two-factor auth'}</span>
          <span className={`font-bold ${colors.text}`}>
            {user?.twoFactorEnabled ? (isAr ? 'مفعّلة' : 'Enabled') : isAr ? 'غير مفعّلة' : 'Not enabled'}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {[
          {
            icon: Settings,
            title: isAr ? 'إعدادات التطبيق' : 'App settings',
            sub: isAr ? 'اللغة والمظهر والتفضيلات' : 'Language, appearance, and preferences',
            target: 'SH06'
          },
          {
            icon: Lock,
            title: isAr ? 'الأمان والمصادقة الثنائية' : 'Security & 2FA',
            sub: isAr ? 'كلمة المرور وتطبيق المصادقة TOTP' : 'Password and TOTP authenticator enrollment',
            target: 'AD13'
          },
          {
            icon: Smartphone,
            title: isAr ? 'الجلسات النشطة' : 'Active sessions',
            sub: isAr ? 'مراجعة الأجهزة وإلغاء الوصول' : 'Review active devices and revoke sessions',
            target: 'AD14'
          },
          {
            icon: Bell,
            title: isAr ? 'الإشعارات' : 'Notifications',
            sub: isAr ? 'تنبيهات الدفع والبريد والتوثيق' : 'Push, email, and verification alerts',
            target: 'SH10'
          },
          {
            icon: LogOut,
            title: isAr ? 'تسجيل الخروج' : 'Log out',
            sub: isAr ? 'إنهاء جلسة المشرف الحالية' : 'End your current administrator session',
            target: 'SH13'
          }
        ].map((row) => {
          const IconComp = row.icon;
          return (
            <button
              key={row.target}
              onClick={() => nav.go(row.target)}
              className={`w-full p-3.5 rounded-2xl border ${colors.border} ${colors.surface} flex items-center justify-between text-start`}
            >
              <div className="flex items-center gap-2.5">
                <IconComp size={16} className={colors.secondaryText} />
                <div>
                  <p className={`text-xs font-extrabold ${colors.text}`}>{row.title}</p>
                  <p className={`text-[10px] ${colors.secondaryText}`}>{row.sub}</p>
                </div>
              </div>
              <ForwardChevron size={14} className={colors.secondaryText} />
            </button>
          );
        })}
      </div>
    </AdminShell>
  );
}

/* =====================================================================
 * AD07: Payment reviews
 * ===================================================================== */
export function AD07Screen() {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const ForwardChevron = isAr ? ChevronLeft : ChevronRight;
  const [payFilter, setPayFilter] = useState('Pending');

  const query = useQuery({
    queryKey: ['admin', 'payment-reviews'],
    queryFn: () => get('/admin/payment-reviews')
  });
  const items = Array.isArray(query.data) ? query.data : [];

  const filtered = useMemo(() => {
    return items.filter((p) => {
      if (payFilter === 'Pending') return p.status === 'Pending';
      if (payFilter === 'Resolved') return p.status === 'Resolved';
      return true;
    });
  }, [items, payFilter]);

  const pendingCount = items.filter((p) => p.status === 'Pending').length;

  return (
    <AdminShell code="AD07">
      <div>
        <h1 className={`text-lg font-extrabold ${colors.text}`}>
          {isAr ? 'مراجعات الدفع' : 'Payment reviews'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {isAr
            ? pluralCount(pendingCount, '', '', 'مراجعة دفع معلقة', 'مراجعات دفع معلقة', 'مراجعة دفع معلقة', true)
            : pluralCount(pendingCount, 'pending payment review', 'pending payment reviews', '', '', '', false)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {[
          { id: 'Pending', label: isAr ? `معلق (${fmtNumber(pendingCount, lang)})` : `Pending (${pendingCount})` },
          { id: 'Resolved', label: isAr ? 'تمت التسوية' : 'Resolved' },
          { id: 'All', label: isAr ? 'الكل' : 'All' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setPayFilter(tab.id)}
            className={`py-2 rounded-xl text-[11px] font-bold border ${
              payFilter === tab.id
                ? `${colors.border} ${colors.surface} ${colors.text}`
                : `border-transparent ${colors.secondaryText}`
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <Skeleton rows={3} />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={query.refetch} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={isAr ? 'لا توجد مراجعات دفع' : 'No payment reviews'}
          message={isAr ? 'لا توجد عناصر في هذا التبويب.' : 'No payment reviews in this view.'}
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((item) => (
            <button
              key={item.id}
              data-testid="data-row"
              onClick={() => nav.go('AD08', { id: item.id })}
              className={`w-full p-3.5 rounded-2xl border ${colors.border} ${colors.surface} text-start space-y-1.5 text-xs`}
            >
              <div className="flex items-center justify-between">
                <p className={`font-extrabold ${colors.text}`}>
                  {isAr ? 'تسوية نقدية' : 'Cash reconciliation'} · {String(item.requestId || item.id).slice(0, 8)}
                </p>
                <StatusBadge status={item.status} />
              </div>
              <div className="flex justify-between">
                <span className={colors.secondaryText}>
                  {isAr ? 'تأكيد العميل / تحصيل المزود' : 'Customer confirmed / Provider collected'}
                </span>
                <span className={`font-bold ${colors.text}`}>
                  {fmtMoney(item.customerConfirmedMinor, lang)} / {fmtMoney(item.providerCollectedMinor, lang)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={colors.secondaryText}>
                  {isAr ? 'الإجمالي المسجل' : 'Recorded total'}
                </span>
                <span className={`font-bold ${colors.text}`}>{fmtMoney(item.recordedMinor, lang)}</span>
              </div>
              {item.note && <p className={`text-[11px] ${colors.secondaryText}`}>{item.note}</p>}
              <div className="flex justify-between items-center pt-1">
                <span className={`font-bold ${colors.text}`}>
                  {isAr ? 'مراجعة الدفعة' : 'Review Payment'}
                </span>
                <ForwardChevron size={14} className={colors.secondaryText} />
              </div>
            </button>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

/* =====================================================================
 * AD08: Review payment
 * ===================================================================== */
export function AD08Screen({ id, params }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const queryClient = useQueryClient();
  const targetId = id || params?.id;

  const listQuery = useQuery({
    queryKey: ['admin', 'payment-reviews'],
    queryFn: () => get('/admin/payment-reviews')
  });
  const detailQuery = useQuery({
    queryKey: ['admin', 'payment-reviews', targetId],
    queryFn: () => get(`/admin/payment-reviews/${targetId}`),
    enabled: !!targetId
  });

  const item =
    detailQuery.data ||
    (Array.isArray(listQuery.data)
      ? listQuery.data.find((x) => String(x.id) === String(targetId)) || listQuery.data[0]
      : null);

  const [checks, setChecks] = useState({ customer: true, provider: true });
  const [note, setNote] = useState('');
  const [adjustedEgp, setAdjustedEgp] = useState('');
  const [busy, setBusy] = useState(false);
  const [resolvedBanner, setResolvedBanner] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (item?.note && !note) setNote(item.note);
    if (item?.adjustedMinor && !adjustedEgp) setAdjustedEgp(String(item.adjustedMinor / 100));
  }, [item?.id]);

  const handleResolve = async () => {
    if (!item) return;
    setBusy(true);
    setError('');
    try {
      await post(`/admin/payment-reviews/${item.id}/resolve`, {
        adjustedMinor: adjustedEgp ? Math.round(Number(adjustedEgp) * 100) : null,
        note: note || 'Reconciled'
      });
      setResolvedBanner(true);
      queryClient.invalidateQueries({ queryKey: ['admin', 'payment-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
    } catch (err) {
      setError(friendlyError(err, isAr, 'Could not reconcile payment', 'تعذر حفظ التسوية'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell code="AD08">
      <div>
        <h1 className={`text-lg font-extrabold ${colors.text}`}>
          {isAr ? 'مراجعة الدفعة' : 'Review payment'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {item ? `${String(item.requestId || item.id).slice(0, 8)} · ${fmtDate(item.createdAt, lang)}` : '—'}
        </p>
      </div>

      {listQuery.isLoading && detailQuery.isLoading ? (
        <Skeleton rows={3} />
      ) : !item ? (
        <EmptyState
          title={isAr ? 'لا توجد دفعة للمراجعة' : 'No payment review found'}
          message={isAr ? 'جميع المدفوعات تمت تسويتها.' : 'All payment reviews are up to date.'}
        />
      ) : (
        <>
          <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs`}>
            <div className="flex items-center justify-between">
              <p className={`font-extrabold ${colors.text}`}>
                {isAr ? 'الإجمالي المسجل' : 'Recorded total'} · {fmtMoney(item.recordedMinor, lang)}
              </p>
              <StatusBadge status={resolvedBanner ? 'Resolved' : item.status} />
            </div>
            <div className="flex justify-between">
              <span className={colors.secondaryText}>{isAr ? 'تأكيد العميل' : 'Customer confirmed'}</span>
              <span className={`font-bold ${colors.text}`}>{fmtMoney(item.customerConfirmedMinor, lang)}</span>
            </div>
            <div className="flex justify-between">
              <span className={colors.secondaryText}>{isAr ? 'تحصيل مقدم الخدمة' : 'Provider collected'}</span>
              <span className={`font-bold ${colors.text}`}>{fmtMoney(item.providerCollectedMinor, lang)}</span>
            </div>
            <div className="flex justify-between">
              <span className={colors.secondaryText}>{isAr ? 'تاريخ الإنشاء' : 'Created'}</span>
              <span className={`font-bold ${colors.text}`}>{fmtDateTime(item.createdAt, lang)}</span>
            </div>
          </div>

          <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2 text-xs`}>
            <p className={`font-extrabold ${colors.text}`}>{isAr ? 'الأدلة' : 'Evidence checklist'}</p>
            <button
              type="button"
              onClick={() => setChecks((c) => ({ ...c, customer: !c.customer }))}
              className="w-full flex items-center gap-2 text-start"
            >
              <CheckCircle2 size={14} className={checks.customer ? 'text-emerald-500' : colors.secondaryText} />
              <span className={colors.text}>
                {isAr ? 'تأكيد العميل' : 'Customer confirmation'} · {fmtMoney(item.customerConfirmedMinor, lang)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setChecks((c) => ({ ...c, provider: !c.provider }))}
              className="w-full flex items-center gap-2 text-start"
            >
              <CheckCircle2 size={14} className={checks.provider ? 'text-emerald-500' : colors.secondaryText} />
              <span className={colors.text}>
                {isAr ? 'سجل تحصيل مقدم الخدمة' : 'Provider collection record'} · {fmtMoney(item.providerCollectedMinor, lang)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => nav.go('SH17')}
              className="w-full flex justify-between items-center pt-1.5 border-t border-slate-500/10 text-start"
            >
              <div>
                <p className={`font-bold ${colors.text}`}>
                  {isAr ? 'إثبات الإيصال' : 'Receipt evidence'}
                </p>
                <p className={`text-[10px] ${colors.secondaryText}`}>
                  {fmtMoney(item.recordedMinor, lang)}
                </p>
              </div>
              <FileText size={14} className={colors.secondaryText} />
            </button>
          </div>

          <div className="space-y-1">
            <label className={`text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'المبلغ المعدل (اختياري · ج.م)' : 'Adjusted amount (optional · EGP)'}
            </label>
            <input
              type="number"
              step="1"
              data-testid="field-adjustedEgp"
              value={adjustedEgp}
              onChange={(e) => setAdjustedEgp(e.target.value)}
              placeholder={String((item.recordedMinor ?? 0) / 100)}
              className={inputClass()}
            />
          </div>

          <div className="space-y-1">
            <label className={`text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'ملاحظة التسوية' : 'Reconciliation note'}
            </label>
            <textarea
              rows={2}
              data-testid="field-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isAr ? 'السجلات متطابقة. لا يوجد تعديل للمبلغ.' : 'Records match. No amount adjustment.'}
              className={`w-full p-3 rounded-xl border ${colors.border} ${colors.inputBg} text-xs ${colors.text}`}
            />
          </div>

          {error && <p role="alert" className="text-xs text-rose-500 font-bold">{error}</p>}

          {resolvedBanner && (
            <div
              role="status"
              data-testid="reconciled-banner"
              className="p-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-[11px] space-y-0.5"
            >
              <p className="font-bold text-emerald-500">
                {isAr ? 'تمت التسوية · حُفظ التدقيق' : 'Reconciled · Audit saved'}
              </p>
              <p className={colors.secondaryText}>
                {isAr
                  ? 'تم التحقق من الأدلة وحفظ التسوية في سجل التدقيق.'
                  : 'Evidence verified and reconciliation recorded in the audit log.'}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <PrimaryButton
              testId="screen-primary"
              disabled={busy || item.status === 'Resolved' || resolvedBanner}
              onClick={handleResolve}
            >
              {busy ? (isAr ? 'جاري الحفظ...' : 'Saving...') : isAr ? 'تحديد كمسواة' : 'Mark Reconciled'}
            </PrimaryButton>
            <SecondaryButton onClick={() => nav.go('AD07')}>
              {isAr ? 'العودة لمراجعات الدفع' : 'Back to Payment Reviews'}
            </SecondaryButton>
          </div>
        </>
      )}
    </AdminShell>
  );
}

/* =====================================================================
 * AD09: Safety reports
 * ===================================================================== */
export function AD09Screen() {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const ForwardChevron = isAr ? ChevronLeft : ChevronRight;
  const [safetyFilter, setSafetyFilter] = useState('Open');

  const query = useQuery({
    queryKey: ['admin', 'safety'],
    queryFn: () => get('/admin/safety')
  });
  const items = Array.isArray(query.data) ? query.data : [];

  const filtered = useMemo(() => {
    return items.filter((s) => s.status === safetyFilter);
  }, [items, safetyFilter]);

  const openCount = items.filter((s) => s.status === 'Open').length;

  return (
    <AdminShell code="AD09">
      <div>
        <h1 className={`text-lg font-extrabold ${colors.text}`}>
          {isAr ? 'بلاغات الأمان' : 'Safety reports'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {isAr
            ? `${pluralCount(openCount, '', '', 'بلاغ أمان مفتوح', 'بلاغات أمان مفتوحة', 'بلاغ أمان مفتوح', true)} · راجع قبل اتخاذ إجراء`
            : `${pluralCount(openCount, 'open safety report', 'open safety reports', '', '', '', false)} · Review before acting`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {[
          { id: 'Open', label: isAr ? `مفتوح (${fmtNumber(openCount, lang)})` : `Open (${openCount})` },
          { id: 'Escalated', label: isAr ? 'مُصعّد' : 'Escalated' },
          { id: 'Closed', label: isAr ? 'مغلق' : 'Closed' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSafetyFilter(tab.id)}
            className={`py-2 rounded-xl text-[11px] font-bold border ${
              safetyFilter === tab.id
                ? `${colors.border} ${colors.surface} ${colors.text}`
                : `border-transparent ${colors.secondaryText}`
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <Skeleton rows={3} />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={query.refetch} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={isAr ? 'لا توجد بلاغات في هذا التبويب' : 'No safety reports in this tab'}
          message={isAr ? 'اختر تبويباً آخر لعرض السجلات.' : 'Switch tabs to view other reports.'}
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((s) => (
            <button
              key={s.id}
              data-testid="data-row"
              onClick={() => nav.go('AD10', { id: s.id })}
              className={`w-full p-3.5 rounded-2xl border ${colors.border} ${colors.surface} text-start space-y-1.5 text-xs`}
            >
              <div className="flex items-center justify-between">
                <p className={`font-extrabold ${colors.text}`}>
                  {formatLabel(s.category, isAr)} · {String(s.id).slice(0, 8)}
                </p>
                <StatusBadge status={s.status} />
              </div>
              <p className={`text-[11px] ${colors.secondaryText}`}>{s.description}</p>
              <div className="flex justify-between text-[10px]">
                <span className={colors.secondaryText}>{fmtDateTime(s.createdAt, lang)}</span>
                <span className={`font-bold ${colors.text}`}>
                  {isAr ? 'مراجعة بلاغ الأمان' : 'Review Safety Report'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="p-3 rounded-2xl border border-blue-500/30 bg-blue-500/10 text-[11px] space-y-0.5">
        <p className="font-bold text-blue-500">
          {isAr ? 'اعتمد على الأدلة وليس الافتراضات' : 'Use evidence, not assumptions'}
        </p>
        <p className={colors.secondaryText}>
          {isAr
            ? 'البلاغات هي ادعاءات وليست نتائج نهائية. يتطلب التصعيد أو الحفظ ملاحظة تدقيق.'
            : 'Reports are allegations, not findings. Escalation and dismissal require an audit note.'}
        </p>
      </div>
    </AdminShell>
  );
}

/* =====================================================================
 * AD10: Safety report details
 * ===================================================================== */
export function AD10Screen({ id, params }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const queryClient = useQueryClient();
  const ForwardChevron = isAr ? ChevronLeft : ChevronRight;
  const targetId = id || params?.id;

  const listQuery = useQuery({
    queryKey: ['admin', 'safety'],
    queryFn: () => get('/admin/safety')
  });
  const detailQuery = useQuery({
    queryKey: ['admin', 'safety', targetId],
    queryFn: () => get(`/admin/safety/${targetId}`),
    enabled: !!targetId
  });

  const item =
    detailQuery.data ||
    (Array.isArray(listQuery.data)
      ? listQuery.data.find((x) => String(x.id) === String(targetId)) || listQuery.data[0]
      : null);

  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [resolvedStatus, setResolvedStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (item?.reviewNote && !note) setNote(item.reviewNote);
  }, [item?.id]);

  const handleResolve = async (status) => {
    if (!item) return;
    setBusy(true);
    setError('');
    try {
      await post(`/admin/safety/${item.id}/resolve`, {
        status,
        note: note || (status === 'Escalated' ? 'Escalated for safety review' : 'Reviewed and closed')
      });
      setResolvedStatus(status);
      queryClient.invalidateQueries({ queryKey: ['admin', 'safety'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    } catch (err) {
      setError(friendlyError(err, isAr, 'Could not update report', 'تعذر تحديث البلاغ'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell code="AD10">
      <div>
        <h1 className={`text-lg font-extrabold ${colors.text}`}>
          {isAr ? 'تفاصيل بلاغ الأمان' : 'Safety report details'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {item ? `${String(item.id).slice(0, 8)} · ${fmtDateTime(item.createdAt, lang)}` : '—'}
        </p>
      </div>

      {listQuery.isLoading && detailQuery.isLoading ? (
        <Skeleton rows={3} />
      ) : !item ? (
        <EmptyState
          title={isAr ? 'لم يتم العثور على البلاغ' : 'Safety report not found'}
          message={isAr ? 'اختر بلاغاً من القائمة.' : 'Select a report from the safety queue.'}
        />
      ) : (
        <>
          <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs`}>
            <div className="flex items-center justify-between">
              <p className={`font-extrabold ${colors.text}`}>{formatLabel(item.category, isAr)}</p>
              <StatusBadge status={resolvedStatus || item.status} />
            </div>
            <p className={`text-[11px] ${colors.secondaryText}`}>{item.description}</p>
            <button
              type="button"
              onClick={() => nav.go('AD11', { id: item.reportedUserId || item.reporterId })}
              className="w-full flex justify-between items-center pt-1.5 border-t border-slate-500/10"
            >
              <span className={`font-bold ${colors.text}`}>
                {isAr ? 'عرض حساب المستخدم' : 'View User Account'}
              </span>
              <ForwardChevron size={14} className={colors.secondaryText} />
            </button>
          </div>

          <div className="space-y-1">
            <label className={`text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'ملاحظة المراجعة · مطلوبة' : 'Review note · Required'}
            </label>
            <textarea
              rows={2}
              data-testid="field-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                isAr
                  ? 'نحتاج السياق الكامل قبل فرض أي تقييد على الحساب.'
                  : 'Add review findings before escalating or closing.'
              }
              className={`w-full p-3 rounded-xl border ${colors.border} ${colors.inputBg} text-xs ${colors.text}`}
            />
          </div>

          {error && <p role="alert" className="text-xs text-rose-500 font-bold">{error}</p>}

          {resolvedStatus && (
            <div
              role="status"
              data-testid="safety-resolved-banner"
              className="p-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-[11px] space-y-0.5"
            >
              <p className="font-bold text-amber-500">
                {resolvedStatus === 'Escalated'
                  ? isAr
                    ? 'تم التصعيد لفريق الأمان'
                    : 'Escalated to safety team'
                  : isAr
                  ? 'تم إغلاق البلاغ'
                  : 'Report closed'}
              </p>
              <p className={colors.secondaryText}>
                {isAr
                  ? 'تم حفظ ملاحظة المراجعة دون إيقاف الحساب تلقائياً.'
                  : 'Review note saved. Neither action automatically suspends the account.'}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <PrimaryButton
              testId="screen-primary"
              disabled={busy}
              onClick={() => handleResolve('Escalated')}
            >
              {isAr ? 'تصعيد لمراجعة الأمان' : 'Escalate for Safety Review'}
            </PrimaryButton>
            <SecondaryButton
              disabled={busy}
              onClick={() => handleResolve('Closed')}
            >
              {isAr ? 'حفظ وإغلاق البلاغ' : 'Dismiss / Close Report'}
            </SecondaryButton>
          </div>
        </>
      )}
    </AdminShell>
  );
}

/* =====================================================================
 * AD11: User details
 * ===================================================================== */
export function AD11Screen({ id, params }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const ForwardChevron = isAr ? ChevronLeft : ChevronRight;
  const targetId = id || params?.id;

  const usersQuery = useAdminUsers();
  const detailQuery = useQuery({
    queryKey: ['admin', 'users', targetId],
    queryFn: () => get(`/admin/users/${targetId}`),
    enabled: !!targetId
  });

  const users = Array.isArray(usersQuery.data) ? usersQuery.data : [];
  const u =
    detailQuery.data ||
    users.find((x) => String(x.id) === String(targetId)) ||
    users.find((x) => !x.isSuperAdmin) ||
    users[0] ||
    null;

  return (
    <AdminShell code="AD11">
      <div>
        <h1 className={`text-lg font-extrabold ${colors.text}`}>
          {isAr ? 'تفاصيل المستخدم' : 'User details'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {u ? `${u.fullName} · ${formatLabel(u.role, isAr)}` : '—'}
        </p>
      </div>

      {usersQuery.isLoading && detailQuery.isLoading ? (
        <Skeleton rows={3} />
      ) : !u ? (
        <EmptyState
          title={isAr ? 'لم يتم العثور على المستخدم' : 'User not found'}
          message={isAr ? 'اختر مستخدماً من قائمة المستخدمين.' : 'Select a user from user management.'}
        />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <StatusBadge status={u.status} />
            {u.kycStatus && u.kycStatus !== 'None' && <StatusBadge status={u.kycStatus} />}
          </div>

          <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs`}>
            <p className={`font-extrabold ${colors.text}`}>
              {isAr ? 'الحساب والتواصل' : 'Account & contact'}
            </p>
            <p className={`text-[11px] ${colors.secondaryText}`} dir="ltr">{u.email}</p>
            <div className="flex justify-between pt-1">
              <span className={colors.secondaryText}>{isAr ? 'الدور' : 'Role'}</span>
              <span className={`font-bold ${colors.text}`}>{formatLabel(u.role, isAr)}</span>
            </div>
            <div className="flex justify-between">
              <span className={colors.secondaryText}>{isAr ? 'الجلسات النشطة' : 'Active sessions'}</span>
              <span className={`font-bold ${colors.text}`}>{fmtNumber(u.sessions ?? 0, lang)}</span>
            </div>
            <div className="flex justify-between">
              <span className={colors.secondaryText}>{isAr ? 'تاريخ التسجيل' : 'Created date'}</span>
              <span className={`font-bold ${colors.text}`}>{fmtDate(u.createdAt, lang)}</span>
            </div>
          </div>

          <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2 text-xs`}>
            <p className={`font-extrabold ${colors.text}`}>
              {isAr ? 'الأمان والنشاط' : 'Security & activity'}
            </p>
            <button
              type="button"
              onClick={() => nav.go('AD14', { id: u.id })}
              className="w-full flex justify-between items-center text-start py-1"
            >
              <div>
                <p className={`font-bold ${colors.text}`}>
                  {isAr ? 'عرض الجلسات النشطة' : 'View active sessions'}
                </p>
                <p className={`text-[10px] ${colors.secondaryText}`}>
                  {pluralCount(u.sessions ?? 0, 'session', 'sessions', 'جلسة', 'جلسات', 'جلسة', isAr)}
                </p>
              </div>
              <ForwardChevron size={14} className={colors.secondaryText} />
            </button>
            <button
              type="button"
              onClick={() => nav.go('AD07')}
              className="w-full flex justify-between items-center text-start py-1 border-t border-slate-500/10"
            >
              <div>
                <p className={`font-bold ${colors.text}`}>
                  {isAr ? 'مراجعات الدفع' : 'Payment reviews'}
                </p>
                <p className={`text-[10px] ${colors.secondaryText}`}>
                  {isAr ? 'سجل التسويات النقدية' : 'Cash reconciliation records'}
                </p>
              </div>
              <ForwardChevron size={14} className={colors.secondaryText} />
            </button>
            <button
              type="button"
              onClick={() => nav.go('AD09')}
              className="w-full flex justify-between items-center text-start py-1 border-t border-slate-500/10"
            >
              <div>
                <p className={`font-bold ${colors.text}`}>
                  {isAr ? 'بلاغات الأمان' : 'Safety reports'}
                </p>
                <p className={`text-[10px] ${colors.secondaryText}`}>
                  {isAr ? 'مراجعة البلاغات المرتبطة' : 'Review associated safety reports'}
                </p>
              </div>
              <ForwardChevron size={14} className={colors.secondaryText} />
            </button>
          </div>

          <div className="space-y-2">
            {!u.isSuperAdmin && (
              <PrimaryButton testId="screen-primary" onClick={() => nav.go('AD12', { id: u.id })}>
                {isAr ? 'إيقاف / استعادة صلاحية الحساب' : 'Suspend / Restore Account Access'}
              </PrimaryButton>
            )}
            <SecondaryButton onClick={() => nav.go('AD04')}>
              {isAr ? 'العودة للمستخدمين' : 'Back to Users'}
            </SecondaryButton>
          </div>
        </>
      )}
    </AdminShell>
  );
}

/* =====================================================================
 * AD12: Account access decision (FIX B7)
 * ===================================================================== */
export function AD12Screen({ id, params }) {
  const colors = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const queryClient = useQueryClient();
  const initialId = id || params?.id;

  const usersQuery = useAdminUsers();
  const users = useMemo(() => {
    const all = Array.isArray(usersQuery.data) ? usersQuery.data : [];
    return all.filter((u) => !u.isSuperAdmin);
  }, [usersQuery.data]);

  const [selectedUserId, setSelectedUserId] = useState(initialId || '');

  const detailQuery = useQuery({
    queryKey: ['admin', 'users', selectedUserId],
    queryFn: () => get(`/admin/users/${selectedUserId}`),
    enabled: !!selectedUserId
  });

  const targetUser =
    detailQuery.data ||
    users.find((u) => String(u.id) === String(selectedUserId)) ||
    users[0] ||
    null;

  const [accessMode, setAccessMode] = useState('Suspend');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (targetUser) {
      if (!selectedUserId) setSelectedUserId(targetUser.id);
      setAccessMode(targetUser.status === 'Suspended' ? 'Restore' : 'Suspend');
    }
  }, [targetUser?.id, targetUser?.status]);

  const canConfirm = !!targetUser && confirmed && reason.trim().length > 0;

  const handleConfirm = async (e) => {
    if (e) e.preventDefault();
    if (!canConfirm) return;
    setBusy(true);
    setError('');
    setBanner('');
    try {
      const trimmedNote = note.trim();
      const fullReason = trimmedNote ? `${reason} — ${trimmedNote}` : reason;
      if (accessMode === 'Suspend') {
        await post(`/admin/users/${targetUser.id}/suspend`, {
          reason: fullReason
        });
      } else {
        await post(`/admin/users/${targetUser.id}/restore`, {});
      }
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      setBanner(
        accessMode === 'Suspend'
          ? isAr
            ? 'تم إيقاف الحساب بنجاح'
            : 'Account suspended'
          : isAr
          ? 'تمت استعادة الحساب بنجاح'
          : 'Account restored'
      );
      setTimeout(() => nav.go('AD11', { id: targetUser.id }), 300);
    } catch (err) {
      setError(friendlyError(err, isAr, 'Could not update account access', 'تعذر حفظ القرار'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell code="AD12">
      <div>
        <h1 className={`text-lg font-extrabold ${colors.text}`}>
          {isAr ? 'قرار صلاحية الحساب' : 'Account access decision'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {targetUser
            ? `${targetUser.fullName} · ${isAr ? 'تأكيد إداري' : 'Administrative confirmation'}`
            : isAr
            ? 'تأكيد إداري'
            : 'Administrative confirmation'}
        </p>
      </div>

      {usersQuery.isLoading ? (
        <Skeleton rows={3} />
      ) : !targetUser ? (
        <EmptyState
          title={isAr ? 'لا يوجد مستخدم متاح' : 'No eligible user account'}
          message={isAr ? 'لا يمكن تعليق حساب المشرف العام.' : 'Super admin accounts cannot be suspended.'}
        />
      ) : (
        <form onSubmit={handleConfirm} className="space-y-3.5">
          {!initialId && users.length > 1 && (
            <div className="space-y-1">
              <label className={`text-[10px] ${colors.secondaryText}`}>
                {isAr ? 'الحساب المستهدف' : 'Target user account'}
              </label>
              <select
                data-testid="field-userId"
                value={targetUser.id}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className={inputClass()}
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.email}) — {u.status}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: 'Suspend', label: isAr ? 'إيقاف الحساب' : 'Suspend account' },
              { id: 'Restore', label: isAr ? 'استعادة الحساب' : 'Restore account' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-testid={`mode-${tab.id.toLowerCase()}`}
                onClick={() => setAccessMode(tab.id)}
                className={`py-2 rounded-xl text-[11px] font-bold border ${
                  accessMode === tab.id
                    ? `${colors.border} ${colors.surface} ${colors.text}`
                    : `border-transparent ${colors.secondaryText}`
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <label className={`text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'السبب · مطلوب' : 'Reason · Required'}
            </label>
            <select
              data-testid="field-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={inputClass()}
            >
              <option value="">{isAr ? 'اختر السبب...' : 'Select a reason...'}</option>
              <option value="Policy violation">{isAr ? 'مخالفة السياسات' : 'Policy violation'}</option>
              <option value="Fraudulent activity">{isAr ? 'نشاط احتيالي' : 'Fraudulent activity'}</option>
              <option value="Safety concern">{isAr ? 'مخاوف تتعلق بالأمان' : 'Safety concern'}</option>
              <option value="Administrative review">{isAr ? 'مراجعة إدارية' : 'Administrative review'}</option>
              <option value="Verification completed">{isAr ? 'اكتملت مراجعة الحساب' : 'Verification completed'}</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className={`text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'ملاحظة التدقيق الداخلي' : 'Internal audit note'}
            </label>
            <textarea
              rows={2}
              data-testid="field-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                isAr
                  ? 'أضف ملاحظة لسجل التدقيق الداخلي...'
                  : 'Add an internal audit trail note...'
              }
              className={`w-full p-3 rounded-xl border ${colors.border} ${colors.inputBg} text-xs ${colors.text}`}
            />
          </div>

          <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs`}>
            <p className={`font-extrabold ${colors.text}`}>
              {isAr ? 'قبل التأكيد' : 'Before you confirm'}
            </p>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                data-testid="field-confirmed"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="w-4 h-4 rounded accent-[#E51C23] shrink-0"
              />
              <span className={colors.text}>
                {isAr
                  ? 'راجعت الأدلة وحالة الرحلة النشطة'
                  : 'I reviewed the evidence and active-trip status'}
              </span>
            </label>
            <p className={`text-[10px] ${colors.secondaryText}`}>
              {isAr
                ? 'يمنع الإيقاف الطلبات الجديدة وتسجيل الدخول ويلغي الجلسات النشطة.'
                : 'Suspension blocks new requests and sign-ins and revokes active sessions. Restore re-enables access.'}
            </p>
          </div>

          {error && <p role="alert" className="text-xs text-rose-500 font-bold">{error}</p>}

          {banner && (
            <div
              role="status"
              data-testid="access-decision-banner"
              className="p-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-[11px] space-y-0.5"
            >
              <p className="font-bold text-emerald-500">{banner}</p>
            </div>
          )}

          <div className="space-y-2">
            <PrimaryButton type="submit" testId="screen-primary" disabled={busy || !canConfirm}>
              {busy
                ? isAr
                  ? 'جاري الحفظ...'
                  : 'Saving...'
                : isAr
                ? 'تأكيد قرار الصلاحية'
                : 'Confirm Access Decision'}
            </PrimaryButton>
            <SecondaryButton onClick={() => nav.go('AD11', { id: targetUser.id })}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </SecondaryButton>
          </div>
        </form>
      )}
    </AdminShell>
  );
}

/* =====================================================================
 * AD13: Security & two-factor (FIX B7 TOTP)
 * ===================================================================== */
export function AD13Screen() {
  const colors = useColors();
  const { isAr } = usePrefs();
  const { user, loadMe } = useSession();
  const nav = useNav();
  const ForwardChevron = isAr ? ChevronLeft : ChevronRight;

  const [setupData, setSetupData] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const handleSetup = async () => {
    setBusy(true);
    setError('');
    setStatusMsg('');
    try {
      const data = await post('/auth/2fa/setup', {});
      setSetupData(data);
      setRecoveryCodes(null);
      if (data?.otpauthUri) {
        const url = await QRCode.toDataURL(data.otpauthUri, { width: 180, margin: 1 });
        setQrDataUrl(url);
      }
      if (data?.currentCode) {
        setTotpCode(data.currentCode);
      }
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر بدء إعداد المصادقة' : 'Could not start 2FA setup'));
    } finally {
      setBusy(false);
    }
  };

  const handleEnable = async (e) => {
    if (e) e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await post('/auth/2fa/enable', { code: totpCode.trim() });
      setRecoveryCodes(res?.recoveryCodes || []);
      setStatusMsg(isAr ? 'تم تفعيل المصادقة الثنائية' : 'Two-factor authentication enabled');
      await loadMe();
    } catch (err) {
      setError(err.message || (isAr ? 'رمز المصادقة غير صحيح' : 'Invalid authenticator code'));
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    setError('');
    try {
      await post('/auth/2fa/disable', {});
      setSetupData(null);
      setQrDataUrl('');
      setRecoveryCodes(null);
      setTotpCode('');
      setStatusMsg(isAr ? 'تم إيقاف المصادقة الثنائية' : 'Two-factor authentication disabled');
      await loadMe();
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر إيقاف المصادقة' : 'Could not disable 2FA'));
    } finally {
      setBusy(false);
    }
  };

  const copySecret = () => {
    if (!setupData?.secret) return;
    navigator.clipboard?.writeText(setupData.secret).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <AdminShell code="AD13">
      <div>
        <h1 className={`text-lg font-extrabold ${colors.text}`}>
          {isAr ? 'الأمان والمصادقة الثنائية' : 'Security & two-factor'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {user?.fullName || (isAr ? 'المشرف' : 'Administrator')}
          {user?.email ? (
            <>
              {' · '}
              <span dir="ltr">{user.email}</span>
            </>
          ) : null}
        </p>
      </div>

      <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2.5 text-xs`}>
        <button
          type="button"
          onClick={() => nav.go('SH02')}
          className="w-full flex justify-between items-center text-start"
        >
          <div>
            <p className={`font-extrabold ${colors.text}`}>
              {isAr ? 'تغيير كلمة المرور' : 'Change password'}
            </p>
            <p className={`text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'تحديث كلمة مرور المشرف' : 'Update your administrator password'}
            </p>
          </div>
          <Lock size={14} className={colors.secondaryText} />
        </button>
        <button
          type="button"
          onClick={() => nav.go('AD14')}
          className="w-full flex justify-between items-center text-start pt-2 border-t border-slate-500/10"
        >
          <div>
            <p className={`font-extrabold ${colors.text}`}>
              {isAr ? 'الجلسات النشطة' : 'Active sessions'}
            </p>
            <p className={`text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'مراجعة الأجهزة وإلغاء الوصول' : 'Review devices and revoke access'}
            </p>
          </div>
          <ForwardChevron size={14} className={colors.secondaryText} />
        </button>
      </div>

      <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2.5 text-xs`}>
        <div className="flex items-center justify-between">
          <p className={`font-extrabold ${colors.text}`}>
            {isAr ? 'تطبيق المصادقة (TOTP)' : 'Authenticator app (TOTP)'}
          </p>
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
              user?.twoFactorEnabled || recoveryCodes
                ? 'bg-emerald-500/15 text-emerald-500'
                : 'bg-amber-500/15 text-amber-500'
            }`}
          >
            {user?.twoFactorEnabled || recoveryCodes
              ? isAr
                ? '• مفعّل'
                : '• Enabled'
              : isAr
              ? '• غير مفعّل'
              : '• Not enabled'}
          </span>
        </div>

        <button
          type="button"
          data-testid="totp-setup-btn"
          disabled={busy}
          onClick={handleSetup}
          className={`w-full py-2.5 px-3 rounded-xl border ${colors.border} ${colors.elevated} font-bold text-xs ${colors.text} flex items-center justify-center gap-2`}
        >
          <KeyRound size={14} />
          {isAr ? 'إعداد تطبيق المصادقة (TOTP)' : 'Set Up Authenticator (TOTP)'}
        </button>

        {setupData && (
          <div className="space-y-2.5 pt-2 border-t border-slate-500/10">
            <p className={`text-[11px] ${colors.secondaryText}`}>
              {isAr
                ? '١. امسح رمز QR أو أدخل مفتاح الإعداد في تطبيق المصادقة.'
                : '1. Scan the QR code or enter your setup key in your authenticator app.'}
            </p>
            {qrDataUrl && (
              <div className="flex justify-center">
                <img
                  src={qrDataUrl}
                  alt="TOTP QR Code"
                  data-testid="totp-qr"
                  className="w-40 h-40 rounded-xl border border-slate-300 bg-white p-2"
                />
              </div>
            )}
            <div className={`p-2.5 rounded-xl border ${colors.border} flex justify-between items-center gap-2`}>
              <span data-testid="totp-secret" className={`font-mono text-[11px] font-bold break-all ${colors.text}`}>
                {setupData.secret}
              </span>
              <button
                type="button"
                data-testid="totp-copy-btn"
                onClick={copySecret}
                className="shrink-0 px-2 py-1 rounded-lg bg-slate-500/15 text-[10px] font-bold flex items-center gap-1"
              >
                <Copy size={12} />
                {copied ? (isAr ? 'تم النسخ' : 'Copied') : isAr ? 'نسخ' : 'Copy'}
              </button>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className={`text-[10px] ${colors.secondaryText}`}>
                  {isAr ? 'رمز التحقق المكون من ٦ أرقام' : 'Six-digit verification code'}
                </label>
                {setupData.currentCode && (
                  <button
                    type="button"
                    data-testid="totp-autofill-btn"
                    onClick={() => setTotpCode(setupData.currentCode)}
                    className="text-[10px] font-bold text-[#E51C23]"
                  >
                    {isAr ? 'ملء الرمز الحالي' : 'Autofill current code'} ({setupData.currentCode})
                  </button>
                )}
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                data-testid="field-totpCode"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder="000000"
                className={inputClass()}
              />
            </div>

            <PrimaryButton
              testId="totp-enable-btn"
              disabled={busy || totpCode.trim().length !== 6}
              onClick={handleEnable}
            >
              {isAr ? 'تحقق وفعل المصادقة الثنائية' : 'Verify & Enable 2FA'}
            </PrimaryButton>
          </div>
        )}

        {recoveryCodes && recoveryCodes.length > 0 && (
          <div
            data-testid="totp-recovery-codes"
            className="p-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 space-y-2"
          >
            <p className="font-bold text-emerald-500">
              {isAr ? 'رموز الاسترداد لمرة واحدة (احفظها بأمان)' : 'One-time recovery codes (save securely)'}
            </p>
            <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
              {recoveryCodes.map((c) => (
                <div key={c} className={`p-1.5 rounded-lg border ${colors.border} ${colors.surface} text-center font-bold ${colors.text}`}>
                  {c}
                </div>
              ))}
            </div>
          </div>
        )}

        {(user?.twoFactorEnabled || recoveryCodes) && (
          <SecondaryButton onClick={handleDisable} disabled={busy}>
            {isAr ? 'إيقاف المصادقة الثنائية' : 'Disable 2FA'}
          </SecondaryButton>
        )}
      </div>

      {error && <p role="alert" className="text-xs text-rose-500 font-bold">{error}</p>}
      {statusMsg && (
        <div role="status" className="p-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-xs font-bold text-emerald-500">
          {statusMsg}
        </div>
      )}
    </AdminShell>
  );
}

/* =====================================================================
 * AD14: Active sessions (FIX B7)
 * ===================================================================== */
export function AD14Screen({ id, params }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const targetUserId = id || params?.id;

  const query = useQuery({
    queryKey: targetUserId ? ['admin', 'sessions', targetUserId] : ['auth', 'sessions'],
    queryFn: () => get(targetUserId ? `/admin/users/${targetUserId}/sessions` : '/auth/sessions')
  });

  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const sessions = Array.isArray(query.data) ? query.data : [];

  const handleRevokeOne = async (sessionId) => {
    setBusy(true);
    setStatusMsg('');
    try {
      await del(targetUserId ? `/admin/sessions/${sessionId}` : `/auth/sessions/${sessionId}`);
      await query.refetch();
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setStatusMsg(isAr ? 'تم إلغاء الجلسة' : 'Session revoked');
    } finally {
      setBusy(false);
    }
  };

  const handleRevokeOthers = async () => {
    setBusy(true);
    setStatusMsg('');
    try {
      await post('/auth/sessions/revoke-others', {});
      await query.refetch();
      setStatusMsg(isAr ? 'تم إلغاء جميع الجلسات الأخرى' : 'All other sessions revoked');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell code="AD14">
      <div>
        <h1 className={`text-lg font-extrabold ${colors.text}`}>
          {isAr ? 'الجلسات النشطة' : 'Active sessions'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {user?.fullName || (isAr ? 'المشرف' : 'Administrator')} · {isAr ? 'أمان الحساب' : 'Account security'}
        </p>
      </div>

      {query.isLoading ? (
        <Skeleton rows={2} />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={query.refetch} />
      ) : sessions.length === 0 ? (
        <EmptyState
          title={isAr ? 'لا توجد جلسات نشطة' : 'No active sessions'}
          message={isAr ? 'لم يتم العثور على جلسات مفتوحة.' : 'No active sessions found for this account.'}
        />
      ) : (
        <div className="space-y-2.5">
          {sessions.map((s, idx) => (
            <div
              key={s.id}
              data-testid="data-row"
              className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs`}
            >
              <div className="flex items-center justify-between">
                <p className={`font-extrabold truncate max-w-[220px] ${colors.text}`}>
                  {s.deviceLabel || (isAr ? 'متصفح الويب' : 'Web Browser')}
                </p>
                {idx === 0 && !s.revokedAt ? (
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500">
                    {isAr ? '• الجلسة الحالية' : '• Current session'}
                  </span>
                ) : s.revokedAt ? (
                  <StatusBadge status="Closed" text={isAr ? 'ملغاة' : 'Revoked'} />
                ) : null}
              </div>
              <div className="flex justify-between">
                <span className={colors.secondaryText}>{isAr ? 'عنوان IP' : 'IP address'}</span>
                <span className={`font-mono font-bold ${colors.text}`} dir="ltr">{s.ipAddress || '127.0.0.1'}</span>
              </div>
              <div className="flex justify-between">
                <span className={colors.secondaryText}>{isAr ? 'تنتهي في' : 'Expires'}</span>
                <span className={`font-bold ${colors.text}`}>{fmtDateTime(s.expiresAt, lang)}</span>
              </div>
              {!s.revokedAt && (
                <button
                  type="button"
                  data-testid={`revoke-session-${s.id}`}
                  disabled={busy}
                  onClick={() => handleRevokeOne(s.id)}
                  className="w-full flex justify-between items-center pt-1.5 border-t border-slate-500/10 text-start"
                >
                  <div>
                    <p className="font-bold text-red-500">
                      {isAr ? 'إلغاء هذه الجلسة' : 'Revoke'}
                    </p>
                    <p className={`text-[10px] ${colors.secondaryText}`}>
                      {isAr ? 'طلب تسجيل دخول جديد على هذا الجهاز' : 'Require a new sign-in on this device'}
                    </p>
                  </div>
                  <LogOut size={14} className="text-red-500" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {statusMsg && (
        <div role="status" className="p-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-xs font-bold text-emerald-500">
          {statusMsg}
        </div>
      )}

      <div className="space-y-2">
        <PrimaryButton testId="screen-primary" disabled={busy} onClick={handleRevokeOthers}>
          {isAr ? 'إلغاء جميع الجلسات الأخرى' : 'Revoke All Other Sessions'}
        </PrimaryButton>
      </div>
    </AdminShell>
  );
}

/* =====================================================================
 * AD15: Verification decision
 * ===================================================================== */
export function AD15Screen({ id, params }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const queryClient = useQueryClient();

  const normalizeDecision = (raw) => {
    if (raw === 'Rejected' || raw === 'Reject') return 'Rejected';
    if (raw === 'ChangesNeeded' || raw === 'RequestChanges') return 'ChangesNeeded';
    return 'Approved';
  };

  const targetId = id || params?.id || nav.flow?.kycAppId;
  const initialDecision = normalizeDecision(params?.decision || nav.flow?.kycDecision || 'Approved');

  const detailQuery = useQuery({
    queryKey: ['admin', 'kyc', targetId],
    queryFn: () => get(`/admin/kyc/${targetId}`),
    enabled: !!targetId
  });
  const queueQuery = useKycQueue();

  const app =
    detailQuery.data ||
    (Array.isArray(queueQuery.data)
      ? queueQuery.data.find((x) => String(x.id) === String(targetId)) ||
        queueQuery.data.find((x) => x.status === 'Submitted' || x.status === 'UnderReview') ||
        queueQuery.data[0]
      : null);

  const [decision, setDecision] = useState(initialDecision);
  const [note, setNote] = useState(nav.flow?.kycNote || '');
  const [checks, setChecks] = useState({ identity: false, credentials: false });
  const [busy, setBusy] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);
  const [error, setError] = useState('');

  const displayName = app?.fullName || app?.businessName || app?.code || '—';
  const allChecked = checks.identity && checks.credentials;
  const needsReason = decision === 'Rejected' || decision === 'ChangesNeeded';
  const canConfirm = !!app && allChecked && (!needsReason || note.trim().length > 0);

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    setError('');
    try {
      await post(`/admin/kyc/${app.id}/review`, {
        decision,
        note: note.trim() || 'Identity and documents verified.'
      });
      setSavedBanner(true);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'kyc'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      setTimeout(() => nav.go('AD02'), 300);
    } catch (err) {
      setError(friendlyError(err, isAr, 'Could not submit decision', 'تعذر حفظ القرار'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell code="AD15">
      <div>
        <h1 className={`text-lg font-extrabold ${colors.text}`}>
          {isAr ? 'قرار التوثيق' : 'Verification decision'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {app ? `${app.code} · ${displayName} · ${formatLabel(app.applicantType, isAr)}` : '—'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {[
          { id: 'Approved', label: isAr ? 'موافقة' : 'Approve' },
          { id: 'ChangesNeeded', label: isAr ? 'طلب تعديل' : 'Request Changes' },
          { id: 'Rejected', label: isAr ? 'رفض' : 'Reject' }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            data-testid={`decision-${tab.id}`}
            onClick={() => setDecision(tab.id)}
            className={`py-2 rounded-xl text-[11px] font-bold border ${
              decision === tab.id
                ? `${colors.border} ${colors.surface} ${colors.text}`
                : `border-transparent ${colors.secondaryText}`
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2 text-xs`}>
        <p className={`font-extrabold ${colors.text}`}>
          {isAr ? 'قائمة مراجعة المتقدم' : 'Applicant review checklist'}
        </p>
        <label className="w-full flex items-center gap-2.5 text-start cursor-pointer">
          <input
            type="checkbox"
            data-testid="check-identity"
            checked={checks.identity}
            onChange={(e) => setChecks((c) => ({ ...c, identity: e.target.checked }))}
            className="w-4 h-4 rounded accent-[#E51C23] shrink-0"
          />
          <span className={colors.text}>
            {isAr ? 'تم فحص بيانات الهوية والتواصل' : 'Identity and contact details checked'}
          </span>
        </label>
        <label className="w-full flex items-center gap-2.5 text-start cursor-pointer">
          <input
            type="checkbox"
            data-testid="check-credentials"
            checked={checks.credentials}
            onChange={(e) => setChecks((c) => ({ ...c, credentials: e.target.checked }))}
            className="w-4 h-4 rounded accent-[#E51C23] shrink-0"
          />
          <span className={colors.text}>
            {isAr ? 'تمت مراجعة التراخيص والمستندات المهنية' : 'Licenses and professional documents reviewed'}
          </span>
        </label>
        <button
          type="button"
          onClick={() => nav.go('SH17', app?.id ? { appId: app.id, holder: displayName } : {})}
          className="w-full flex justify-between items-center pt-1.5 border-t border-slate-500/10 text-start"
        >
          <div>
            <p className={`font-bold ${colors.text}`}>
              {isAr ? 'فحص المستندات المقدمة' : 'Inspect submitted documents'}
            </p>
            <p className={`text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'عارض المستندات · مراجعة البيانات' : 'Document viewer · Review metadata'}
            </p>
          </div>
          <FileText size={14} className={colors.secondaryText} />
        </button>
      </div>

      <div className="space-y-1">
        <label className={`text-[10px] ${colors.secondaryText}`}>
          {needsReason
            ? isAr
              ? 'سبب القرار / ملاحظة المراجع · مطلوب'
              : 'Decision reason / reviewer note · Required'
            : isAr
            ? 'ملاحظة المراجع (اختياري)'
            : 'Reviewer note (optional)'}
        </label>
        <textarea
          rows={2}
          data-testid="field-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            needsReason
              ? isAr
                ? 'اكتب سبب الرفض أو التعديلات المطلوبة للمتقدم...'
                : 'Describe the required changes or reason for rejection...'
              : isAr
              ? 'أضف ملاحظة اختيارية للمتقدم...'
              : 'Optional note for the applicant...'
          }
          className={`w-full p-3 rounded-xl border ${colors.border} ${colors.inputBg} text-xs ${colors.text}`}
        />
      </div>

      <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1 text-xs`}>
        <p className={`font-extrabold ${colors.text}`}>
          {isAr ? 'إشعار المتقدم' : 'Applicant notification'}
        </p>
        <p className={`text-[11px] ${colors.secondaryText}`}>
          {decision === 'Approved'
            ? isAr
              ? 'تمت الموافقة: تم توثيق حسابك. يمكنك بدء تلقي الطلبات.'
              : "Approved: You're verified and can go online to receive requests."
            : isAr
            ? 'سيظهر سبب الرفض أو التعديل للمتقدم مع خيار إعادة التقديم.'
            : 'Applicant will receive your reason and instructions to resubmit.'}
        </p>
      </div>

      {error && <p role="alert" className="text-xs text-rose-500 font-bold">{error}</p>}

      {savedBanner && (
        <div
          role="status"
          data-testid="kyc-decision-banner"
          className="p-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-[11px] space-y-0.5"
        >
          <p className="font-bold text-emerald-500">
            {isAr ? 'تم حفظ القرار · أُبلغ المتقدم' : 'Decision saved · Applicant notified'}
          </p>
        </div>
      )}

      <div className="space-y-2">
        <PrimaryButton testId="screen-primary" disabled={busy || !canConfirm} onClick={handleConfirm}>
          {busy ? (isAr ? 'جاري الإرسال...' : 'Submitting...') : isAr ? 'تأكيد القرار' : 'Confirm Decision'}
        </PrimaryButton>
        <SecondaryButton onClick={() => nav.go('AD03', { id: app?.id })}>
          {isAr ? 'العودة للطلب' : 'Back to Application'}
        </SecondaryButton>
      </div>
    </AdminShell>
  );
}

/* =====================================================================
 * AD16: Reports & Audit
 * ===================================================================== */
export function AD16Screen() {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const reportsQuery = useAdminReports();
  const auditQuery = useAudit();

  const reports = reportsQuery.data || {};
  const byKind = Array.isArray(reports.byKind) ? reports.byKind : [];
  const byStatus = Array.isArray(reports.byStatus) ? reports.byStatus : [];
  const audits = Array.isArray(auditQuery.data) ? auditQuery.data : [];

  const rawTotalRequests = byStatus.reduce((acc, s) => acc + (s.count ?? 0), 0);
  const totalRequests = rawTotalRequests > 0 ? rawTotalRequests : 1;

  const handleExportCsv = () => {
    const lines = [
      'Section,Key,Value',
      `Summary,TotalRevenueMinor,${reports.revenueMinor ?? 0}`,
      ...byKind.map((k) => `ByKind,${k.kind},${k.count}`),
      ...byStatus.map((s) => `ByStatus,${s.status},${s.count}`),
      ...audits.slice(0, 50).map((a) => `Audit,${a.action},${a.entityType}:${a.entityId || ''} (${a.createdAt})`)
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'fixngo-admin-report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <AdminShell code="AD16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'التقارير وسجل التدقيق' : 'Reports & audit trail'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {isAr ? 'إحصائيات الإيرادات والطلبات وسجل العمليات' : 'Platform analytics and immutable audit log'}
          </p>
        </div>
        <button
          type="button"
          data-testid="export-csv-btn"
          onClick={handleExportCsv}
          className="px-3 py-2 rounded-xl bg-[#E51C23] text-white text-[11px] font-bold flex items-center gap-1.5"
        >
          <Download size={13} />
          {isAr ? 'تصدير CSV' : 'Export CSV'}
        </button>
      </div>

      {reportsQuery.isLoading ? (
        <Skeleton rows={3} />
      ) : (
        <>
          <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1`}>
            <p className={`text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'إجمالي الإيرادات المحصلة' : 'Total settled revenue'}
            </p>
            <p className={`text-xl font-extrabold ${colors.text}`} data-testid="reports-revenue">
              {fmtMoney(reports.revenueMinor ?? 0, lang)}
            </p>
          </div>

          <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2 text-xs`}>
            <p className={`font-extrabold ${colors.text}`}>
              {isAr ? 'الطلبات حسب النوع' : 'Requests by service kind'}
            </p>
            {byKind.length === 0 ? (
              <p className={colors.secondaryText}>{isAr ? 'لا توجد طلبات بعد' : 'No requests recorded yet'}</p>
            ) : (
              byKind.map((row) => {
                const pct = Math.min(100, Math.round(((row.count ?? 0) / totalRequests) * 100));
                return (
                  <div key={row.kind} className="space-y-1">
                    <div className="flex justify-between">
                      <span className={colors.secondaryText}>{formatLabel(row.kind, isAr)}</span>
                      <span className={`font-bold ${colors.text}`}>{fmtNumber(row.count, lang)}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-500/20 overflow-hidden">
                      <div className="h-full bg-[#E51C23]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2 text-xs`}>
            <p className={`font-extrabold ${colors.text}`}>
              {isAr ? 'الطلبات حسب الحالة' : 'Requests by status'}
            </p>
            {byStatus.length === 0 ? (
              <p className={colors.secondaryText}>{isAr ? 'لا توجد بيانات' : 'No status breakdown yet'}</p>
            ) : (
              byStatus.map((row) => {
                const pct = Math.min(100, Math.round(((row.count ?? 0) / totalRequests) * 100));
                return (
                  <div key={row.status} className="space-y-1">
                    <div className="flex justify-between">
                      <span className={colors.secondaryText}>{formatLabel(row.status, isAr)}</span>
                      <span className={`font-bold ${colors.text}`}>{fmtNumber(row.count, lang)}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-500/20 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2 text-xs`}>
        <p className={`font-extrabold ${colors.text}`}>
          {isAr ? 'سجل التدقيق الأخير' : 'Recent audit log'} ({fmtNumber(audits.length, lang)})
        </p>
        {auditQuery.isLoading ? (
          <Skeleton rows={2} />
        ) : audits.length === 0 ? (
          <p className={colors.secondaryText}>{isAr ? 'لا توجد سجلات تدقيق بعد.' : 'No audit entries recorded yet.'}</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {audits.slice(0, 20).map((a) => (
              <div
                key={a.id}
                data-testid="audit-row"
                className="py-1.5 border-b border-slate-500/10 last:border-0 space-y-0.5"
              >
                <div className="flex justify-between gap-2">
                  <span className={`font-bold ${colors.text}`}>{formatAuditAction(a.action, isAr)}</span>
                  <span className={`text-[10px] shrink-0 ${colors.secondaryText}`}>{fmtDateTime(a.createdAt, lang)}</span>
                </div>
                <p className={`text-[10px] ${colors.secondaryText}`}>
                  {formatEntityType(a.entityType, isAr)} {a.entityId ? `· ${String(a.entityId).slice(0, 8)}` : ''}
                  {a.reason ? ` — ${a.reason}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}

/* =====================================================================
 * AD17: Reviews & complaints
 * ===================================================================== */
export function AD17Screen() {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const queryClient = useQueryClient();
  const query = useAdminReviews();
  const reviews = Array.isArray(query.data) ? query.data : [];
  const [hiddenMap, setHiddenMap] = useState({});
  const [busyId, setBusyId] = useState(null);

  const toggleModerate = async (r) => {
    setBusyId(r.id);
    const nextHide = !hiddenMap[r.id];
    try {
      await post(`/admin/reviews/${r.id}/moderate?hide=${nextHide}`, {});
      setHiddenMap((prev) => ({ ...prev, [r.id]: nextHide }));
      queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminShell code="AD17">
      <div>
        <h1 className={`text-lg font-extrabold ${colors.text}`}>
          {isAr ? 'التقييمات والشكاوى' : 'Reviews & complaints'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {pluralCount(reviews.length, 'driver review', 'driver reviews', 'تقييم مسجل', 'تقييمات مسجلة', 'تقييماً مسجلاً', isAr)}
        </p>
      </div>

      {query.isLoading ? (
        <Skeleton rows={3} />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={query.refetch} />
      ) : reviews.length === 0 ? (
        <EmptyState
          title={isAr ? 'لا توجد تقييمات معلقة' : 'No flagged reviews'}
          message={isAr ? 'جميع التقييمات الحالية متوافقة مع السياسات.' : 'All current reviews comply with platform guidelines.'}
        />
      ) : (
        <div className="space-y-2.5">
          {reviews.map((r) => {
            const isHidden = !!hiddenMap[r.id];
            return (
              <div
                key={r.id}
                data-testid="data-row"
                className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2 text-xs`}
              >
                <div className="flex items-center justify-between">
                  <StarRating value={r.stars} />
                  <StatusBadge status={isHidden ? 'Closed' : 'Active'} text={isHidden ? (isAr ? 'مخفي' : 'Hidden') : (isAr ? 'ظاهر' : 'Visible')} />
                </div>
                <p className={colors.text}>{r.text || (isAr ? 'بدون تعليق نصي' : 'No written comment')}</p>
                <div className="flex items-center justify-between pt-1 border-t border-slate-500/10">
                  <span className={`text-[10px] ${colors.secondaryText}`}>{fmtDateTime(r.createdAt, lang)}</span>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => toggleModerate(r)}
                    className="px-3 py-1 rounded-xl bg-[#E51C23]/15 text-[#E51C23] text-[11px] font-bold"
                  >
                    {isHidden
                      ? isAr
                        ? 'استعادة التقييم'
                        : 'Restore Review'
                      : isAr
                      ? 'إخفاء التقييم'
                      : 'Hide Review'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}

/* =====================================================================
 * AD18: Support inbox
 * ===================================================================== */
export function AD18Screen({ id, params }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const queryClient = useQueryClient();
  const ForwardChevron = isAr ? ChevronLeft : ChevronRight;
  const BackChevron = isAr ? ChevronRight : ChevronLeft;
  const ticketsQuery = useAdminTickets();
  const tickets = Array.isArray(ticketsQuery.data) ? ticketsQuery.data : [];

  const incomingId = id || params?.id || '';
  const [selectedId, setSelectedId] = useState(incomingId);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setSelectedId(incomingId);
  }, [incomingId]);

  const threadQuery = useQuery({
    queryKey: ['support', 'tickets', selectedId],
    queryFn: () => get(`/support/tickets/${selectedId}`),
    enabled: !!selectedId
  });

  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [replyError, setReplyError] = useState('');

  const statusCounts = useMemo(() => {
    const counts = { All: tickets.length, NeedsReply: 0, Open: 0, AwaitingSupport: 0, Answered: 0, Closed: 0 };
    for (const t of tickets) {
      if (t.status === 'Open') { counts.Open += 1; counts.NeedsReply += 1; }
      else if (t.status === 'AwaitingSupport') { counts.AwaitingSupport += 1; counts.NeedsReply += 1; }
      else if (t.status === 'Answered') counts.Answered += 1;
      else if (t.status === 'Closed') counts.Closed += 1;
    }
    return counts;
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter === 'NeedsReply' && t.status !== 'Open' && t.status !== 'AwaitingSupport') return false;
      if (statusFilter !== 'All' && statusFilter !== 'NeedsReply' && t.status !== statusFilter) return false;
      if (!needle) return true;
      const hay = `${t.code || ''} ${t.subject || ''} ${t.category || ''} ${t.customerName || ''}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [tickets, statusFilter, searchTerm]);

  const activeTicket =
    threadQuery.data?.ticket ||
    tickets.find((t) => String(t.id) === String(selectedId)) ||
    null;
  const messages = Array.isArray(threadQuery.data?.messages) ? threadQuery.data.messages : [];

  const openTicket = (ticketId) => {
    setStatusMsg('');
    setReplyError('');
    setReply('');
    setSelectedId(ticketId);
    nav.replace('AD18', { id: ticketId });
    if (typeof document !== 'undefined') {
      document.querySelector('.phone-scroll, main')?.scrollTo?.(0, 0);
    }
  };

  const closeTicketView = () => {
    setStatusMsg('');
    setReplyError('');
    setReply('');
    setSelectedId('');
    nav.replace('AD18');
  };

  const handleReply = async (e) => {
    if (e) e.preventDefault();
    if (!activeTicket || !reply.trim()) return;
    setBusy(true);
    setStatusMsg('');
    setReplyError('');
    try {
      await post(`/admin/tickets/${activeTicket.id}/reply`, { text: reply.trim() });
      setReply('');
      await threadQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ['admin', 'tickets'] });
      setStatusMsg(isAr ? 'تم إرسال الرد' : 'Reply sent');
    } catch (err) {
      setReplyError(friendlyError(err, isAr, 'Could not send the reply', 'تعذر إرسال الرد'));
    } finally {
      setBusy(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!activeTicket) return;
    setBusy(true);
    setStatusMsg('');
    setReplyError('');
    try {
      await post(`/admin/tickets/${activeTicket.id}/close`, {});
      await threadQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ['admin', 'tickets'] });
      setStatusMsg(isAr ? 'تم إغلاق التذكرة' : 'Ticket closed');
    } catch (err) {
      setReplyError(friendlyError(err, isAr, 'Could not close the ticket', 'تعذر إغلاق التذكرة'));
    } finally {
      setBusy(false);
    }
  };

  const filterTabs = [
    { id: 'All', label: isAr ? 'الكل' : 'All', count: statusCounts.All },
    { id: 'NeedsReply', label: isAr ? 'بانتظار الرد' : 'Needs reply', count: statusCounts.NeedsReply },
    { id: 'Open', label: isAr ? 'مفتوحة' : 'Open', count: statusCounts.Open },
    { id: 'AwaitingSupport', label: isAr ? 'بانتظار الدعم' : 'Awaiting support', count: statusCounts.AwaitingSupport },
    { id: 'Answered', label: isAr ? 'تم الرد' : 'Answered', count: statusCounts.Answered },
    { id: 'Closed', label: isAr ? 'مغلقة' : 'Closed', count: statusCounts.Closed }
  ];

  // Detail / Conversation View when a ticket is selected
  if (selectedId) {
    return (
      <AdminShell code="AD18" onBack={closeTicketView}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className={`text-lg font-extrabold ${colors.text}`}>
              {activeTicket ? activeTicket.code : (isAr ? 'محادثة التذكرة' : 'Ticket thread')}
            </h1>
            <p className={`text-xs ${colors.secondaryText}`}>
              {activeTicket
                ? `${activeTicket.subject} · ${formatLabel(activeTicket.category, isAr)}`
                : (isAr ? 'تفاصيل التذكرة والردود' : 'Support ticket conversation')}
            </p>
          </div>
          {activeTicket && <StatusBadge status={activeTicket.status} />}
        </div>

        <button
          type="button"
          data-testid="back-to-tickets"
          onClick={closeTicketView}
          className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${colors.secondaryText} hover:${colors.text} w-fit`}
        >
          <BackChevron size={13} />
          <span>{isAr ? 'العودة إلى قائمة التذاكر' : 'Back to all tickets'}</span>
        </button>

        {threadQuery.isLoading && !activeTicket ? (
          <Skeleton rows={3} />
        ) : !activeTicket ? (
          <EmptyState
            title={isAr ? 'لم يتم العثور على التذكرة' : 'Ticket not found'}
            message={isAr ? 'اختر تذكرة من قائمة صندوق الدعم.' : 'Select a ticket from the support inbox.'}
          />
        ) : (
          <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-3 text-xs`}>
            <div className="space-y-1 text-[11px] border-b border-slate-500/10 pb-2.5" data-testid="ticket-customer">
              <div className="flex justify-between gap-2">
                <span className={colors.secondaryText}>{isAr ? 'العميل' : 'Customer'}</span>
                <span className={`font-bold ${colors.text}`}>
                  {activeTicket.customerName || '—'}
                  {activeTicket.customerRole ? ` · ${formatLabel(activeTicket.customerRole, isAr)}` : ''}
                </span>
              </div>
              {activeTicket.customerEmail && (
                <div className="flex justify-between gap-2">
                  <span className={colors.secondaryText}>{isAr ? 'البريد الإلكتروني' : 'Email'}</span>
                  <span className={`font-semibold ${colors.text}`} dir="ltr">{activeTicket.customerEmail}</span>
                </div>
              )}
              {activeTicket.customerPhone && (
                <div className="flex justify-between gap-2">
                  <span className={colors.secondaryText}>{isAr ? 'الهاتف' : 'Phone'}</span>
                  <span className={`font-semibold ${colors.text}`} dir="ltr">{activeTicket.customerPhone}</span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className={colors.secondaryText}>{isAr ? 'المرجع' : 'Reference'}</span>
                <span className={`font-bold font-mono ${colors.text}`} data-testid="ticket-reference">
                  {activeTicket.referenceCode
                    ? `${activeTicket.referenceType === 'Booking' ? (isAr ? 'حجز' : 'Booking') : (isAr ? 'طلب' : 'Trip')} · ${activeTicket.referenceCode}`
                    : '—'}
                </span>
              </div>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {messages.map((m) => {
                const customerAuthor =
                  (m.authorName && m.authorName !== 'You' ? m.authorName : '') ||
                  activeTicket.customerName ||
                  (isAr ? 'العميل' : 'Customer');
                const supportAuthor = m.authorName || (isAr ? 'دعم FixNGo' : 'FixNGo Support');
                return (
                  <div
                    key={m.id}
                    data-testid="ticket-message"
                    className={`p-2.5 rounded-xl ${
                      m.fromSupport ? 'bg-[#E51C23]/15 text-[#E51C23] ms-4' : `${colors.elevated} ${colors.text} me-4`
                    }`}
                  >
                    <div className="flex justify-between gap-2 text-[10px] opacity-80 mb-0.5">
                      <span className="font-bold">
                        {m.fromSupport ? supportAuthor : customerAuthor}
                      </span>
                      <span>{fmtDateTime(m.createdAt, lang)}</span>
                    </div>
                    <p className="text-xs whitespace-pre-wrap">{m.text}</p>
                    {m.fileId && <TicketAttachment message={m} isAr={isAr} />}
                  </div>
                );
              })}
            </div>

            {replyError && (
              <p role="alert" className="text-xs font-bold text-rose-500">
                {replyError}
              </p>
            )}

            {statusMsg && (
              <p role="status" className="text-xs font-bold text-emerald-500">
                {statusMsg}
              </p>
            )}

            <form onSubmit={handleReply} className="space-y-2">
              <textarea
                rows={2}
                data-testid="field-reply"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={isAr ? 'اكتب رد الدعم الفني...' : 'Write a support reply...'}
                className={`w-full p-3 rounded-xl border ${colors.border} ${colors.inputBg} text-xs ${colors.text}`}
              />
              <div className="flex gap-2">
                <PrimaryButton type="submit" testId="screen-primary" disabled={busy || !reply.trim()}>
                  {isAr ? 'إرسال الرد' : 'Send Reply'}
                </PrimaryButton>
                {activeTicket.status !== 'Closed' && (
                  <SecondaryButton disabled={busy} onClick={handleCloseTicket}>
                    {isAr ? 'إغلاق التذكرة' : 'Close Ticket'}
                  </SecondaryButton>
                )}
              </div>
            </form>
          </div>
        )}
      </AdminShell>
    );
  }

  // Inbox List View with Status Filter & Search
  return (
    <AdminShell code="AD18">
      <div>
        <h1 className={`text-lg font-extrabold ${colors.text}`}>
          {isAr ? 'صندوق الدعم الفني' : 'Support inbox'}
        </h1>
        <p className={`text-xs ${colors.secondaryText}`}>
          {statusFilter === 'All' && !searchTerm.trim()
            ? pluralCount(tickets.length, 'support ticket', 'support tickets', 'تذكرة دعم', 'تذاكر دعم', 'تذكرة دعم', isAr)
            : isAr
            ? `عرض ${fmtNumber(filteredTickets.length, lang)} من ${fmtNumber(tickets.length, lang)} تذكرة`
            : `Showing ${fmtNumber(filteredTickets.length, lang)} of ${fmtNumber(tickets.length, lang)} tickets`}
        </p>
      </div>

      {ticketsQuery.isLoading ? (
        <Skeleton rows={3} />
      ) : tickets.length === 0 ? (
        <EmptyState
          title={isAr ? 'لا توجد تذاكر دعم' : 'No support tickets'}
          message={isAr ? 'صندوق الدعم فارغ حالياً.' : 'The support inbox is currently empty.'}
        />
      ) : (
        <>
          <div className={`px-3 py-2 rounded-xl border ${colors.border} ${colors.surface} flex items-center gap-2`}>
            <Search size={14} className={colors.secondaryText} />
            <input
              type="text"
              data-testid="field-ticket-search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isAr ? 'ابحث برمز التذكرة أو الموضوع...' : 'Search by ticket code or subject...'}
              className={`w-full bg-transparent outline-none text-xs ${colors.text}`}
            />
          </div>

          <div className="flex flex-wrap gap-1.5" data-testid="ticket-status-filters">
            {filterTabs.map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`ticket-filter-${tab.id}`}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition inline-flex items-center gap-1.5 ${
                    active
                      ? 'border-[#E51C23] bg-[#E51C23]/15 text-[#E51C23]'
                      : `${colors.border} ${colors.surface} ${colors.secondaryText}`
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${active ? 'bg-[#E51C23]/20 text-[#E51C23]' : colors.elevated}`}>
                    {fmtNumber(tab.count, lang)}
                  </span>
                </button>
              );
            })}
          </div>

          {filteredTickets.length === 0 ? (
            <EmptyState
              title={isAr ? 'لا توجد تذاكر مطابقة' : 'No matching tickets'}
              message={isAr ? 'جرّب تغيير فلتر الحالة أو كلمة البحث.' : 'Try selecting another status filter or clearing the search.'}
            />
          ) : (
            <div className="space-y-2">
              {filteredTickets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  data-testid="data-row"
                  onClick={() => openTicket(t.id)}
                  className={`w-full p-3 rounded-2xl border ${colors.border} ${colors.surface} text-start space-y-1.5 text-xs transition hover:border-[#E51C23]/50`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-extrabold ${colors.text} truncate`}>
                      {t.code} · {t.subject}
                    </span>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className={colors.secondaryText}>
                      {formatLabel(t.category, isAr)}
                      {t.customerName ? ` · ${t.customerName}` : ''}
                    </span>
                    <span className={`inline-flex items-center gap-1 ${colors.secondaryText}`}>
                      <span>{fmtDateTime(t.createdAt, lang)}</span>
                      <ForwardChevron size={12} />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </AdminShell>
  );
}

export const ADMIN_COMPONENTS = {
  AD01: AD01Screen,
  AD02: AD02Screen,
  AD03: AD03Screen,
  AD04: AD04Screen,
  AD05: AD05Screen,
  AD06: AD06Screen,
  AD07: AD07Screen,
  AD08: AD08Screen,
  AD09: AD09Screen,
  AD10: AD10Screen,
  AD11: AD11Screen,
  AD12: AD12Screen,
  AD13: AD13Screen,
  AD14: AD14Screen,
  AD15: AD15Screen,
  AD16: AD16Screen,
  AD17: AD17Screen,
  AD18: AD18Screen
};

export default ADMIN_COMPONENTS;
