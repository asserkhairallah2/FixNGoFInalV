import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sun,
  Moon,
  Send,
  Eye,
  EyeOff,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Upload,
  Phone,
  LogOut,
  Building2,
  Trash2,
  MapPin,
  HelpCircle,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Lock,
  ShieldCheck,
  MessageSquare,
  X
} from 'lucide-react';
import { usePrefs, useNav, useSession, homeForUser, resolveDeepLink } from '../../app/stores.jsx';
import { get, post, put, uploadFile, fileUrl } from '../../api/http.js';
import {
  useBootstrap,
  useRequests,
  useBookings,
  useThreads,
  useThread,
  useFaqs,
  useTickets,
  useBanks,
  useWallet,
  useWithdrawals,
  useWithdraw,
  useKyc,
  k
} from '../../api/hooks.js';
import {
  useColors,
  AppTopBar,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  ShieldLogo,
  EmergencySOSBar,
  Skeleton,
  Toast,
  formatLabel,
  pluralCount
} from '../../ui/kit.jsx';
import { fmtMoney, fmtDate, fmtTime, fmtDateTime } from '../../i18n/format.js';

export const SHARED_INTERNAL_FALLBACK_BACK = {
  SH08: 'SH07',
  SH09: 'SH07',
  SH16: 'SH15',
  SH18: 'SH17',
  SH20: 'SH14'
};

const RAW_HTTP_TITLES = new Set([
  'Conflict', 'Bad Request', 'Unauthorized', 'Forbidden', 'Not Found',
  'Internal Server Error', 'Unprocessable Entity'
]);

const TERMINAL_REQUEST_STATUSES = new Set(['Completed', 'Cancelled', 'NoProviders']);
const TERMINAL_BOOKING_STATUSES = new Set(['Completed', 'Cancelled', 'Rejected', 'Expired']);
const TERMINAL_WITHDRAWAL_STATUSES = new Set(['Confirmed', 'Failed']);

function friendlyError(err, isAr, fallbackEn, fallbackAr) {
  const fallback = isAr ? (fallbackAr || fallbackEn) : fallbackEn;
  if (!err) return fallback;
  const code = err.code || '';
  if (code === 'withdrawal.below_minimum') {
    return isAr ? 'المبلغ المطلوب أقل من الحد الأدنى للسحب.' : (err.message || fallback);
  }
  if (code === 'withdrawal.insufficient') {
    return isAr ? 'الرصيد المتاح في المحفظة غير كافٍ.' : 'Insufficient available wallet balance.';
  }
  if (code === 'withdrawal.bank_required') {
    return isAr ? 'يلزم وجود حساب بنكي افتراضي موثق لإتمام السحب.' : 'A verified default bank account is required.';
  }
  if (code === 'payment.iban_invalid') {
    return isAr ? 'صيغة رقم IBAN المصري غير صحيحة (٢٩ حرفاً وتبدأ بـ EG).' : 'Invalid Egyptian IBAN (must be 29 characters starting with EG).';
  }
  if (code === 'payment.bank_invalid') {
    return isAr ? 'يرجى اختيار بنك صالح من القائمة.' : 'Please select a valid bank.';
  }
  if (code === 'auth.invalid_credentials') {
    return isAr ? 'كلمة المرور غير صحيحة.' : 'Password is incorrect.';
  }
  if (code === 'deletion.blocked') {
    return isAr
      ? 'يرجى إنهاء الطلبات أو الحجوزات النشطة أو عمليات السحب المعلقة قبل حذف الحساب.'
      : 'Resolve active requests, bookings, or pending withdrawals before deleting your account.';
  }
  const msg = String(err.message || '').trim();
  if (!msg || RAW_HTTP_TITLES.has(msg) || /^HTTP \d+$/.test(msg)) {
    return fallback;
  }
  return msg;
}

function isImageAttachment(message) {
  const ct = String(message?.fileContentType || '').toLowerCase();
  if (ct.startsWith('image/')) return true;
  return /\.(png|jpe?g|webp|gif)$/i.test(String(message?.fileName || ''));
}

function TicketAttachment({ message, isAr }) {
  if (!message?.fileId) return null;
  const url = fileUrl(message.fileId);
  const label = message.fileName || (isAr ? 'مرفق التذكرة' : 'Attachment');
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
        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#E51C23] underline"
      >
        <FileText size={12} />
        <span dir="ltr">{label}</span>
      </a>
    </div>
  );
}

/* =====================================================================
 * SH01: Chat with your provider / customer
 * ===================================================================== */
export function SH01Screen({ id, params }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const { user } = useSession();
  const qc = useQueryClient();

  const threadsQuery = useThreads();
  const requestsQuery = useRequests();
  const threads = Array.isArray(threadsQuery.data) ? threadsQuery.data : [];
  const requests = Array.isArray(requestsQuery.data) ? requestsQuery.data : [];

  const [selectedThreadId, setSelectedThreadId] = useState(() => id || params?.id || null);
  const [chatInput, setChatInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [locBusy, setLocBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // Start or resolve thread by requestId or bookingId if passed via params
  useEffect(() => {
    let cancelled = false;
    async function resolveContextThread() {
      const reqId = params?.requestId || (id && requests.some((r) => r.id === id) ? id : null);
      const bookId = params?.bookingId || null;
      if (reqId) {
        try {
          const started = await post(`/requests/${reqId}/chat`, {});
          if (!cancelled && started?.id) {
            setSelectedThreadId(started.id);
            qc.invalidateQueries({ queryKey: k.threads });
          }
        } catch (err) {
          if (!cancelled) setError(err.message || '');
        }
      } else if (bookId) {
        try {
          const started = await post('/chat/threads', { bookingId: bookId });
          if (!cancelled && started?.id) {
            setSelectedThreadId(started.id);
            qc.invalidateQueries({ queryKey: k.threads });
          }
        } catch (err) {
          if (!cancelled) setError(err.message || '');
        }
      }
    }
    if (params?.requestId || params?.bookingId) {
      resolveContextThread();
    }
    return () => { cancelled = true; };
  }, [params?.requestId, params?.bookingId, id, requests, qc]);

  // Default to first thread when threads load
  const activeThreadId = selectedThreadId || id || params?.id || threads[0]?.id || null;
  const threadQuery = useThread(activeThreadId);

  const activeThread = threadQuery.data || threads.find((t) => t.id === activeThreadId) || null;
  const messages = Array.isArray(activeThread?.messages) ? activeThread.messages : [];

  const activeRequest = requests.find((r) => r.status !== 'Completed' && r.status !== 'Cancelled') || requests[0] || null;
  const counterpartLabel = activeRequest
    ? (user?.id === activeRequest.customerId
      ? (activeRequest.providerName || (isAr ? 'مقدم الخدمة' : 'Assigned Provider'))
      : (activeRequest.customerName || (isAr ? 'العميل' : 'Customer')))
    : (user?.fullName || (isAr ? 'محادثة مباشرة' : 'Direct Chat'));

  async function ensureThreadForAction() {
    if (activeThreadId) return activeThreadId;
    if (params?.requestId || activeRequest?.id) {
      const targetReqId = params?.requestId || activeRequest.id;
      const started = await post(`/requests/${targetReqId}/chat`, {});
      if (started?.id) {
        setSelectedThreadId(started.id);
        qc.invalidateQueries({ queryKey: k.threads });
        return started.id;
      }
    }
    return null;
  }

  async function handleSend(e) {
    if (e) e.preventDefault();
    if (!chatInput.trim() || busy) return;
    setError('');
    setBusy(true);
    try {
      const tid = await ensureThreadForAction();
      if (!tid) {
        throw new Error(isAr ? 'لا توجد محادثة نشطة حالياً.' : 'No active conversation thread selected.');
      }
      await post(`/chat/threads/${tid}/messages`, { text: chatInput.trim() }, { idempotencyKey: crypto.randomUUID() });
      setChatInput('');
      await Promise.all([
        threadQuery.refetch(),
        threadsQuery.refetch()
      ]);
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر إرسال الرسالة' : 'Could not send message'));
    } finally {
      setBusy(false);
    }
  }

  async function handleShareLocation() {
    if (locBusy) return;
    setError('');
    setLocBusy(true);
    try {
      const tid = await ensureThreadForAction();
      if (!tid) {
        throw new Error(isAr ? 'لا توجد محادثة نشطة لمشاركة الموقع.' : 'No active conversation to share location.');
      }
      const lat = user?.latitude ?? activeRequest?.pickupLatitude ?? 30.0444;
      const lng = user?.longitude ?? activeRequest?.pickupLongitude ?? 31.2357;
      await post(`/chat/threads/${tid}/location`, { latitude: lat, longitude: lng });
      setToast(isAr ? 'تمت مشاركة موقعك المباشر' : 'Live location shared');
      await Promise.all([
        threadQuery.refetch(),
        threadsQuery.refetch()
      ]);
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر مشاركة الموقع' : 'Could not share location'));
    } finally {
      setLocBusy(false);
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back()} />
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className={`text-lg font-extrabold ${colors.text}`}>
                {isAr ? 'محادثة مع الكابتن' : 'Chat with your captain'}
              </h1>
              <p className={`text-[11px] ${colors.secondaryText}`}>
                {counterpartLabel} · {isAr ? 'متصل' : 'Online'}
                {activeRequest?.code ? ` · ${activeRequest.code}` : ''}
                {' · '}
                {isAr ? 'خاص وآمن' : 'Private & secure'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleShareLocation}
              disabled={locBusy}
              data-testid="share-location-btn"
              className={`px-2.5 py-1.5 rounded-xl border ${colors.border} ${colors.surface} text-[11px] font-bold text-[#E51C23] flex items-center gap-1 shrink-0 hover:opacity-80`}
            >
              <MapPin size={13} />
              <span>{isAr ? 'مشاركة الموقع' : 'Share Location'}</span>
            </button>
          </div>

          {threads.length > 0 && (
            <div className="space-y-1.5">
              <p className={`text-[10px] font-bold uppercase ${colors.secondaryText}`}>
                {isAr ? 'المحادثات النشطة' : 'Active conversations'} ({threads.length})
              </p>
              <div className="space-y-1.5 max-h-28 overflow-y-auto">
                {threads.map((t, index) => {
                  const lastMsg = t.messages?.[t.messages.length - 1];
                  const isSelected = t.id === activeThreadId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      data-testid="data-row"
                      onClick={() => setSelectedThreadId(t.id)}
                      className={`w-full p-2.5 rounded-xl border text-start flex items-center justify-between text-xs transition ${
                        isSelected
                          ? 'border-[#E51C23] bg-[#E51C23]/10'
                          : `${colors.border} ${colors.surface}`
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <MessageSquare size={14} className={isSelected ? 'text-[#E51C23]' : colors.secondaryText} />
                        <div className="truncate">
                          <p className={`font-bold truncate ${colors.text}`}>
                            {counterpartLabel} #{index + 1}
                          </p>
                          <p className={`text-[10px] truncate ${colors.secondaryText}`}>
                            {lastMsg?.messageType === 'location'
                              ? (isAr ? '📍 موقع مباشر' : '📍 Live location')
                              : (lastMsg?.text || (isAr ? 'بدء المحادثة' : 'Start conversation'))}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[10px] ${colors.secondaryText} shrink-0`}>
                        {lastMsg?.sentAt ? fmtTime(lastMsg.sentAt, lang) : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2.5 overflow-y-auto max-h-80 px-1">
            {messages.length === 0 ? (
              <div className={`p-4 rounded-2xl border ${colors.border} ${colors.surface} text-center text-xs ${colors.secondaryText}`}>
                {isAr
                  ? 'لا توجد رسائل في هذه المحادثة بعد. اكتب رسالة أو شارك موقعك بالأسفل.'
                  : 'No messages in this thread yet. Send a message or share your live location below.'}
              </div>
            ) : (
              messages.map((m, idx) => {
                const isMine = m.senderId === user?.id || m.fromMe || m.isMine;
                if (m.messageType === 'location') {
                  return (
                    <div
                      key={m.id || idx}
                      className={`p-2.5 rounded-2xl border ${colors.border} ${colors.surface} max-w-[78%] space-y-1 ${
                        isMine ? (isAr ? 'mr-auto' : 'ml-auto') : ''
                      }`}
                    >
                      <div className="h-10 rounded-xl bg-slate-500/10 flex items-center justify-between px-3">
                        <span className="text-[10px] font-bold text-red-500">
                          {user?.areaLabel || activeRequest?.pickupAddress || (isAr ? 'موقع مباشر' : 'LIVE PIN')}
                        </span>
                        <MapPin size={14} className="text-red-500" />
                      </div>
                      <p className={`text-[10px] font-bold ${colors.text}`}>
                        {isAr ? 'تمت مشاركة الموقع المباشر' : 'Live location shared'}
                        {m.sentAt ? ` · ${fmtTime(m.sentAt, lang)}` : ''}
                      </p>
                    </div>
                  );
                }
                return (
                  <div
                    key={m.id || idx}
                    className={`p-3 rounded-2xl text-xs max-w-[85%] ${
                      isMine
                        ? `${isAr ? 'mr-auto' : 'ml-auto'} bg-[#E51C23] text-white`
                        : `${colors.surface} border ${colors.border} ${colors.text}`
                    }`}
                  >
                    <p>{m.text}</p>
                    <p className="text-[9px] opacity-75 text-end mt-1">
                      {m.sentAt ? fmtTime(m.sentAt, lang) : ''}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
        </div>

        <form onSubmit={handleSend} className="flex items-center gap-2 pt-2">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            data-testid="field-text"
            placeholder={isAr ? 'اكتب رسالة...' : 'Type a message...'}
            className={`flex-1 px-3.5 h-11 rounded-xl border ${colors.border} ${colors.inputBg} text-xs ${colors.text}`}
          />
          <button
            type="submit"
            disabled={busy}
            aria-label="Send"
            className="w-11 h-11 rounded-xl bg-[#E51C23] text-white flex items-center justify-center disabled:opacity-50"
          >
            <Send size={15} className={isAr ? 'rotate-180' : ''} />
          </button>
        </form>
      </div>
    </div>
  );
}

/* =====================================================================
 * SH02: Change password
 * ===================================================================== */
export function SH02Screen() {
  const colors = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const { user } = useSession();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [toast, setToast] = useState('');

  const hasLen = newPassword.length >= 8;
  const hasCase = /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword);
  const hasNum = /\d/.test(newPassword);
  const hasSpec = /[^A-Za-z0-9]/.test(newPassword);
  const score = [hasLen, hasCase, hasNum, hasSpec].filter(Boolean).length;

  const strengthLabel = score >= 4
    ? (isAr ? 'قوية' : 'Strong')
    : score >= 2
    ? (isAr ? 'متوسطة' : 'Medium')
    : newPassword.length > 0
    ? (isAr ? 'ضعيفة' : 'Weak')
    : (isAr ? 'أدخل كلمة المرور' : 'Enter password');

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setError('');
    if (!currentPassword || !newPassword) {
      setError(isAr ? 'يرجى إدخال كلمة المرور الحالية والجديدة.' : 'Please enter your current and new password.');
      return;
    }
    if (confirmPassword && confirmPassword !== newPassword) {
      setError(isAr ? 'كلمتا المرور غير متطابقتين.' : 'New passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await post('/auth/change-password', { currentPassword, newPassword });
      setDone(true);
      setToast(isAr ? 'تم تحديث كلمة المرور بنجاح' : 'Password updated successfully');
      setTimeout(() => nav.back(), 450);
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر تحديث كلمة المرور' : 'Could not update password'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back()} />
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'تغيير كلمة المرور' : 'Change password'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {user?.fullName ? `${user.fullName} · ` : ''}
            {isAr ? 'حافظ على أمان حسابك في كل رحلة.' : 'Keep your account secure on every journey.'}
          </p>
        </div>

        <div className="space-y-1">
          <label className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'كلمة المرور الحالية' : 'Current password'}
          </label>
          <div className={`px-3 h-11 rounded-xl border ${colors.border} ${colors.surface} flex justify-between items-center text-xs ${colors.text}`}>
            <input
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              data-testid="field-currentPassword"
              placeholder="••••••••••••"
              className={`bg-transparent w-full outline-none text-xs ${colors.text}`}
            />
            <button type="button" onClick={() => setShowCurrent((v) => !v)} aria-label="Toggle current password">
              {showCurrent ? <EyeOff size={14} className={colors.secondaryText} /> : <Eye size={14} className={colors.secondaryText} />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'كلمة المرور الجديدة' : 'New password'}
          </label>
          <div className={`px-3 h-11 rounded-xl border ${colors.border} ${colors.surface} flex justify-between items-center text-xs ${colors.text}`}>
            <input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              data-testid="field-newPassword"
              placeholder="••••••••••••"
              className={`bg-transparent w-full outline-none text-xs ${colors.text}`}
            />
            <button type="button" onClick={() => setShowNew((v) => !v)} aria-label="Toggle new password">
              {showNew ? <EyeOff size={14} className={colors.secondaryText} /> : <Eye size={14} className={colors.secondaryText} />}
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {[1, 2, 3, 4].map((bar) => (
              <div
                key={bar}
                className={`h-1 rounded-full ${
                  score >= bar ? 'bg-emerald-500' : 'bg-slate-500/25'
                }`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px]">
            <span className={colors.secondaryText}>{isAr ? 'قوة كلمة المرور' : 'Password strength'}</span>
            <span className={`font-bold ${score >= 4 ? 'text-emerald-500' : score >= 2 ? 'text-amber-500' : colors.secondaryText}`}>
              {strengthLabel}
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <label className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'تأكيد كلمة المرور الجديدة' : 'Confirm new password'}
          </label>
          <div className={`px-3 h-11 rounded-xl border ${colors.border} ${colors.surface} flex justify-between items-center text-xs ${colors.text}`}>
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              data-testid="field-confirmPassword"
              placeholder="••••••••••••"
              className={`bg-transparent w-full outline-none text-xs ${colors.text}`}
            />
            <button type="button" onClick={() => setShowConfirm((v) => !v)} aria-label="Toggle confirm password">
              {showConfirm ? <EyeOff size={14} className={colors.secondaryText} /> : <Eye size={14} className={colors.secondaryText} />}
            </button>
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1 text-[11px] ${colors.secondaryText}`}>
          <p className={hasLen ? 'text-emerald-500 font-semibold' : colors.text}>
            {isAr ? '✓ ٨ أحرف على الأقل' : '✓ At least 8 characters'}
          </p>
          <p className={hasCase ? 'text-emerald-500 font-semibold' : colors.text}>
            {isAr ? '✓ أحرف كبيرة وصغيرة' : '✓ Uppercase and lowercase letters'}
          </p>
          <p className={hasNum && hasSpec ? 'text-emerald-500 font-semibold' : colors.text}>
            {isAr ? '✓ رقم ورمز خاص' : '✓ A number and a special character'}
          </p>
          <p className="pt-1">
            {isAr ? 'ستظل قيد تسجيل الدخول على هذا الجهاز.' : "You'll stay signed in on this device."}
          </p>
        </div>

        {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
        {done && <p role="status" className="text-xs text-emerald-500">{isAr ? 'تم الحفظ بنجاح' : 'Saved successfully'}</p>}

        <PrimaryButton type="submit" disabled={busy} testId="screen-primary">
          {isAr ? 'تحديث كلمة المرور' : 'Update Password'}
        </PrimaryButton>
      </form>
    </div>
  );
}

/* =====================================================================
 * SH03: Connection interrupted
 * ===================================================================== */
export function SH03Screen() {
  const colors = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const { user } = useSession();
  const requestsQuery = useRequests();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const requests = Array.isArray(requestsQuery.data) ? requestsQuery.data : [];
  const activeReq = requests.find((r) => r.status !== 'Completed' && r.status !== 'Cancelled') || requests[0] || null;

  async function handleRetry() {
    setBusy(true);
    try {
      await get('/system/status');
      setToast(isAr ? 'تمت استعادة الاتصال' : 'Connection restored');
      nav.replace(homeForUser(user));
    } catch {
      nav.replace(homeForUser(user));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back()} />
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <div className="p-4 space-y-4">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'انقطع الاتصال' : 'Connection interrupted'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {isAr ? 'سنعيدك للمسار الصحيح فوراً.' : "We'll get you back on track."}
          </p>
        </div>

        <div className="py-5 flex flex-col items-center text-center space-y-2.5">
          <div className="w-16 h-16 rounded-full bg-red-500/15 text-red-500 flex items-center justify-center">
            <WifiOff size={28} />
          </div>
          <h2 className={`text-sm font-extrabold ${colors.text}`}>
            {isAr ? 'فقدنا الاتصال بالإنترنت' : 'We lost the connection'}
          </h2>
          <p className={`text-xs ${colors.secondaryText} max-w-[240px]`}>
            {isAr
              ? 'تحقق من اتصال الإنترنت وحاول مرة أخرى. طلبك النشط محفوظ بأمان.'
              : 'Check your internet and try again. Your active request is safe.'}
          </p>
          <span className={`px-3 py-1 rounded-full border ${colors.border} ${colors.surface} text-[10px] font-bold ${colors.secondaryText}`}>
            • ERR_NETWORK_503
          </span>
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1 text-xs`}>
          <div className="flex justify-between">
            <span className={colors.secondaryText}>{isAr ? 'الطلب النشط' : 'Active request'}</span>
            <span className={`font-extrabold ${colors.text}`}>
              {activeReq
                ? `${activeReq.code} · ${isAr ? 'محفوظ' : 'Saved'}`
                : (isAr ? 'لا يوجد طلب نشط' : 'No active request')}
            </span>
          </div>
          <p className={`text-[11px] ${colors.secondaryText}`}>
            {isAr
              ? 'إذا كنت في خطر فوري، اتصل بـ ١٢٣ للإسعاف أو ١٢٢ للشرطة.'
              : "If you're in immediate danger, call 123 for an ambulance or 122 for police."}
          </p>
        </div>

        <EmergencySOSBar onClick={() => nav.go('SH19')} />

        <div className="space-y-2">
          <PrimaryButton onClick={handleRetry} disabled={busy} testId="screen-primary">
            {isAr ? 'إعادة المحاولة' : 'Try Again'}
          </PrimaryButton>
          <button
            type="button"
            onClick={() => nav.go('SH07')}
            className="w-full py-3 rounded-2xl bg-slate-900 text-white text-xs font-extrabold"
          >
            {isAr ? 'تواصل مع الدعم' : 'Contact Support'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
 * SH04: Your trips (Empty state)
 * ===================================================================== */
export function SH04Screen() {
  const colors = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const { user } = useSession();

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back()} />

      <div className="p-4 space-y-4">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'رحلاتك' : 'Your trips'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {user?.fullName ? `${user.fullName} · ` : ''}
            {isAr ? 'بداية جديدة، والدعم جاهز دائماً.' : 'A fresh start, with backup ready.'}
          </p>
        </div>

        <div className="py-5 flex flex-col items-center text-center space-y-3">
          <div className={`w-36 h-24 rounded-2xl border ${colors.border} ${colors.surface} flex items-center justify-center relative`}>
            <span className="text-3xl">🚗</span>
            <MapPin size={18} className="text-red-500 absolute top-3 right-5" />
          </div>
          <h2 className={`text-sm font-extrabold ${colors.text}`}>
            {isAr ? 'لا توجد رحلات هنا بعد' : 'Nothing here just yet'}
          </h2>
          <p className={`text-xs ${colors.secondaryText} max-w-[240px]`}>
            {isAr
              ? 'ستظهر رحلاتك المكتملة هنا. المساعدة دائماً على بُعد ضغطة واحدة.'
              : 'Your completed trips will appear here. Help is always one tap away.'}
          </p>
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} text-xs ${colors.secondaryText}`}>
          {isAr
            ? 'هل تحتاج صيانة دورية بدلاً من ذلك؟ اكتشف مراكز الخدمة الموثوقة بالقرب منك.'
            : 'Need routine maintenance instead? Discover trusted service centers near you.'}
        </div>

        <div className="space-y-2">
          <PrimaryButton onClick={() => nav.go('C06')} testId="screen-primary">
            {isAr ? 'طلب مساعدة على الطريق' : 'Request Roadside Help'}
          </PrimaryButton>
          <SecondaryButton onClick={() => nav.go('C17')}>
            {isAr ? 'البحث عن مراكز الخدمة' : 'Find Service Centers'}
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
 * SH05: Privacy & terms
 * ===================================================================== */
export function SH05Screen({ params }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const [legalTab, setLegalTab] = useState(() => (params?.tab === 'terms' ? 'terms' : 'privacy'));

  const bootstrapQuery = useBootstrap();
  const legalQuery = useQuery({
    queryKey: ['support', 'legal', legalTab],
    queryFn: () => get(`/support/legal/${legalTab}`)
  });

  const bootDoc = Array.isArray(bootstrapQuery.data?.legal)
    ? bootstrapQuery.data.legal.find((l) => l.key === legalTab)
    : null;
  const activeDoc = legalQuery.data || bootDoc || null;

  const privacySections = [
    {
      t: isAr ? '١. معلوماتك' : '1. Your information',
      b: isAr
        ? 'يجمع FixNGo بيانات حسابك ومعلومات المركبة وسجل الخدمة لربطك بمقدمي الخدمة ومراكز الصيانة المعتمدين.'
        : 'FixNGo collects your account details, vehicle information and service history to connect you with verified roadside providers and service centers.'
    },
    {
      t: isAr ? '٢. الموقع والسلامة على الطريق' : '2. Location & roadside safety',
      b: isAr
        ? 'بإذنك، نستخدم موقعك لمطابقة أقرب مقدمي الخدمة وتتبع الرحلة النشطة. يتم مشاركة موقعك الدقيق فقط مع مقدم الخدمة المعين لطلبك.'
        : 'With your permission, we use your location to match nearby providers and track an active trip. Your precise location is shared only with the provider assigned to your request.'
    },
    {
      t: isAr ? '٣. المدفوعات والسجلات' : '3. Payments & records',
      b: isAr
        ? 'نحتفظ بالفواتير وتأكيدات الدفع لأغراض الدعم والأمان والالتزامات القانونية. لا يتم تخزين أرقام البطاقات الكاملة لدى FixNGo.'
        : 'We retain invoices and payment confirmations for support, safety and legal obligations. Card payments are processed securely; full card numbers are not stored by FixNGo.'
    },
    {
      t: isAr ? '٤. خياراتك وحقوقك' : '4. Your choices & rights',
      b: isAr
        ? 'يمكنك تحديث بياناتك والتحكم في الإشعارات وطلب الوصول إلى معلوماتك الشخصية أو حذفها عبر مركز المساعدة.'
        : 'You can update your details, control notifications and request access to or deletion of your personal information through the Help & Support Center.'
    }
  ];

  const termsSections = [
    {
      t: isAr ? '١. شروط الخدمة والمساعدة' : '1. Service & assistance terms',
      b: isAr
        ? 'راجع واعتمد عرض السعر قبل بدء العمل. المساعدة على الطريق لا تغني عن خدمات الطوارئ؛ في الخطر الفوري اتصل بـ ١٢٣ أو ١٢٢.'
        : 'Review and approve your estimate before work begins. Roadside assistance does not replace emergency services. In immediate danger, call 123 or 122.'
    },
    {
      t: isAr ? '٢. التسعير والموافقة على التكلفة' : '2. Pricing & estimate approval',
      b: isAr
        ? 'تخضع طلبات السحب والميكانيكي المتنقل للتسعير الشفاف المعتمد في المنصة. لا تبدأ أعمال الإصلاح إلا بعد موافقتك على التكلفة.'
        : 'Tow and mobile mechanic requests follow transparent platform pricing. Repair work only starts after you approve the provider estimate.'
    },
    {
      t: isAr ? '٣. الإلغاء والمواعيد' : '3. Cancellations & bookings',
      b: isAr
        ? 'لا تُفرض رسوم على إلغاء البحث قبل تعيين مقدم خدمة. يمكن إعادة جدولة مواعيد مراكز الخدمة أو إلغاؤها من تفاصيل الموعد.'
        : 'Cancelling a search before provider assignment is free of charge. Service center appointments may be rescheduled or cancelled from appointment details.'
    },
    {
      t: isAr ? '٤. التزامات مقدمي الخدمة' : '4. Provider verification & conduct',
      b: isAr
        ? 'يلتزم جميع الميكانيكيين وكباتن الأوناش ومراكز الخدمة بمعايير التوثيق والسلامة المهنية المعتمدة في مصر.'
        : 'All mechanics, tow captains and service centers must maintain verified credentials and follow professional roadside safety standards.'
    }
  ];

  const sections = legalTab === 'privacy' ? privacySections : termsSections;

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back()} />

      <div className="p-4 space-y-3">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'الخصوصية والشروط' : 'Privacy & terms'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {activeDoc?.updatedAt
              ? `${isAr ? 'آخر تحديث · ' : 'Last updated · '}${fmtDate(activeDoc.updatedAt, lang)} · v${activeDoc.version ?? 1}`
              : (isAr ? 'آخر تحديث · الإصدار ١' : 'Last updated · Version 1')}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1.5" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={legalTab === 'privacy'}
            data-testid="tab-privacy"
            onClick={() => setLegalTab('privacy')}
            className={`py-2 rounded-xl text-[11px] font-bold border ${
              legalTab === 'privacy'
                ? `${colors.border} ${colors.surface} ${colors.text}`
                : `border-transparent ${colors.secondaryText}`
            }`}
          >
            {isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={legalTab === 'terms'}
            data-testid="tab-terms"
            onClick={() => setLegalTab('terms')}
            className={`py-2 rounded-xl text-[11px] font-bold border ${
              legalTab === 'terms'
                ? `${colors.border} ${colors.surface} ${colors.text}`
                : `border-transparent ${colors.secondaryText}`
            }`}
          >
            {isAr ? 'شروط الخدمة' : 'Terms of Service'}
          </button>
        </div>

        {activeDoc && (
          <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1 text-xs`}>
            <p className={`font-extrabold ${colors.text}`}>
              {isAr ? activeDoc.titleAr : activeDoc.titleEn}
            </p>
            <p className={`text-[11px] leading-relaxed ${colors.secondaryText}`}>
              {isAr ? activeDoc.bodyAr : activeDoc.bodyEn}
            </p>
          </div>
        )}

        <div className="space-y-2.5 text-xs">
          {sections.map((sec, idx) => (
            <div key={idx} className="space-y-0.5">
              <p className={`font-extrabold ${colors.text}`}>{sec.t}</p>
              <p className={`text-[11px] leading-relaxed ${colors.secondaryText}`}>{sec.b}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
 * SH06: App settings (Language, Theme & Sign-in OTP)
 * ===================================================================== */
export function SH06Screen() {
  const colors = useColors();
  const { isAr, lang, setLang, theme, setTheme } = usePrefs();
  const nav = useNav();
  const { user, loadMe } = useSession();
  const ForwardChevron = isAr ? ChevronLeft : ChevronRight;

  const [otpOnLogin, setOtpOnLogin] = useState(() => !!user?.otpOnLogin);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (user && typeof user.otpOnLogin === 'boolean') {
      setOtpOnLogin(user.otpOnLogin);
    }
  }, [user]);

  async function toggleOtpOnLogin() {
    const next = !otpOnLogin;
    setOtpOnLogin(next);
    try {
      await put('/auth/me', { otpOnLogin: next });
      await loadMe();
      setToast(
        next
          ? (isAr ? 'تم تفعيل رمز التحقق عند تسجيل الدخول' : 'Sign-in verification code enabled')
          : (isAr ? 'تم إيقاف رمز التحقق عند تسجيل الدخول' : 'Sign-in verification code disabled')
      );
    } catch {
      setOtpOnLogin(!next);
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back()} />
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <div className="p-4 space-y-4">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'إعدادات التطبيق' : 'App settings'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {user?.fullName ? `${user.fullName} · ` : ''}
            {isAr
              ? 'تحكم في اللغة والمظهر والتفضيلات الخاصة بك.'
              : 'Manage language, appearance and preferences.'}
          </p>
        </div>

        <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} text-[11px] ${colors.secondaryText}`}>
          {isAr
            ? 'تتم مزامنة التفضيلات عبر أجهزتك النشطة.'
            : 'Preferences are synced across your active devices.'}
        </div>

        <div className={`p-4 rounded-2xl border ${colors.border} ${colors.surface} space-y-2.5`}>
          <p className={`text-xs font-extrabold ${colors.text}`}>
            {isAr ? 'اللغة / Language' : 'Language'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setLang('ar')}
              data-testid="lang-ar"
              className={`py-2.5 rounded-xl text-xs font-bold border transition ${
                lang === 'ar'
                  ? 'border-[#E51C23] bg-[#E51C23] text-white'
                  : `${colors.border} ${colors.elevated} ${colors.text}`
              }`}
            >
              العربية
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              data-testid="lang-en"
              className={`py-2.5 rounded-xl text-xs font-bold border transition ${
                lang === 'en'
                  ? 'border-[#E51C23] bg-[#E51C23] text-white'
                  : `${colors.border} ${colors.elevated} ${colors.text}`
              }`}
            >
              English
            </button>
          </div>
          <p className={`text-[11px] ${colors.secondaryText}`}>
            {lang === 'en'
              ? 'English is currently selected for the app interface.'
              : 'اللغة العربية مفعلة حالياً لواجهة التطبيق بالكامل مع اتجاه من اليمين لليسار (RTL).'}
          </p>
        </div>

        <div className={`p-4 rounded-2xl border ${colors.border} ${colors.surface} space-y-2.5`}>
          <p className={`text-xs font-extrabold ${colors.text}`}>
            {isAr ? 'المظهر / Appearance' : 'Appearance'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTheme('dark')}
              data-testid="theme-dark"
              className={`py-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition ${
                theme === 'dark'
                  ? 'border-[#E51C23] bg-[#E51C23] text-white'
                  : `${colors.border} ${colors.elevated} ${colors.text}`
              }`}
            >
              <Moon size={14} /> {isAr ? 'داكن' : 'Dark'}
            </button>
            <button
              type="button"
              onClick={() => setTheme('light')}
              data-testid="theme-light"
              className={`py-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition ${
                theme === 'light'
                  ? 'border-[#E51C23] bg-[#E51C23] text-white'
                  : `${colors.border} ${colors.elevated} ${colors.text}`
              }`}
            >
              <Sun size={14} /> {isAr ? 'فاتح' : 'Light'}
            </button>
          </div>
          <p className={`text-[11px] ${colors.secondaryText}`}>
            {theme === 'dark'
              ? isAr
                ? 'المظهر الداكن مفعل حالياً في جميع شاشات التطبيق.'
                : 'Dark theme is currently active across the app.'
              : isAr
              ? 'المظهر الفاتح مفعل حالياً في جميع شاشات التطبيق.'
              : 'Light theme is currently active across the app.'}
          </p>
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} flex items-center justify-between text-xs`}>
          <div className="pe-3">
            <p className={`font-extrabold ${colors.text}`}>
              {isAr ? 'طلب رمز تحقق عند تسجيل الدخول (OTP)' : 'Require verification code at sign-in (OTP)'}
            </p>
            <p className={`text-[10px] ${colors.secondaryText}`}>
              {isAr
                ? 'إرسال رمز تحقق لمرة واحدة عند كل تسجيل دخول لحماية إضافية.'
                : 'Send a one-time verification code on every login for extra protection.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={otpOnLogin}
            data-testid="toggle-otp-login"
            onClick={toggleOtpOnLogin}
            className={`w-9 h-5 rounded-full transition-colors p-0.5 flex items-center shrink-0 ${
              otpOnLogin ? 'bg-emerald-500 justify-end' : 'bg-slate-600 justify-start'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-white shadow" />
          </button>
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2 text-xs`}>
          <button
            type="button"
            onClick={() => nav.go('SH10')}
            className="w-full flex justify-between items-center text-start py-1"
          >
            <span className={`font-bold ${colors.text}`}>
              {isAr ? 'تفضيلات الإشعارات' : 'Notification Preferences'}
            </span>
            <ForwardChevron size={14} className={colors.secondaryText} />
          </button>
          <button
            type="button"
            onClick={() => nav.go('SH05')}
            className="w-full pt-2 border-t border-slate-500/10 flex justify-between items-center text-start py-1"
          >
            <span className={`font-bold ${colors.text}`}>
              {isAr ? 'الخصوصية والشروط' : 'Privacy & Terms'}
            </span>
            <ForwardChevron size={14} className={colors.secondaryText} />
          </button>
          <button
            type="button"
            onClick={() => nav.go('SH11')}
            className="w-full pt-2 border-t border-slate-500/10 flex justify-between items-center text-start py-1"
          >
            <span className={`font-bold ${colors.text}`}>
              {isAr ? 'عن FixNGo' : 'About FixNGo'}
            </span>
            <ForwardChevron size={14} className={colors.secondaryText} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setTheme('light');
            setLang('en');
          }}
          data-testid="screen-primary"
          className="w-full py-3 rounded-2xl bg-slate-900 text-white text-xs font-extrabold"
        >
          {isAr ? 'استعادة الإعدادات الافتراضية' : 'Reset to Defaults'}
        </button>
      </div>
    </div>
  );
}

/* =====================================================================
 * SH07: Help & support
 * ===================================================================== */
export function SH07Screen() {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const { user } = useSession();
  const faqsQuery = useFaqs();
  const ticketsQuery = useTickets();

  const faqs = Array.isArray(faqsQuery.data) ? faqsQuery.data : [];
  const tickets = Array.isArray(ticketsQuery.data) ? ticketsQuery.data : [];
  const [openFaqId, setOpenFaqId] = useState(null);

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back()} />

      <div className="p-4 space-y-3.5">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'المساعدة والدعم' : 'Help & support'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {user?.fullName ? `${user.fullName} · ` : ''}
            {isAr ? 'نحن معك عندما يصعب الطريق.' : "We're here when the road gets difficult."}
          </p>
        </div>

        <EmergencySOSBar onClick={() => nav.go('SH19')} />

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2 text-xs`}>
          <p className={`font-extrabold ${colors.text}`}>
            {isAr ? 'أثناء الرحلة النشطة' : 'During an active trip'}
          </p>
          <p className={`text-[11px] ${colors.secondaryText}`}>
            {isAr
              ? 'إذا كنت في خطر فوري، اتصل بخدمات الطوارئ أولاً. دعم FixNGo ليس خدمة طوارئ.'
              : "If you're in immediate danger, contact emergency services first. FixNGo support is not an emergency service."}
          </p>
          <button
            type="button"
            onClick={() => nav.go('SH19')}
            className="w-full flex justify-between items-center pt-1.5 border-t border-slate-500/10 text-start"
          >
            <div>
              <p className="font-bold text-red-500">
                {isAr ? 'مساعدة الطوارئ' : 'Emergency assistance'}
              </p>
              <p className={`text-[10px] ${colors.secondaryText}`}>
                {isAr ? 'مصر · الإسعاف ١٢٣ · الشرطة ١٢٢' : 'Egypt · Ambulance 123 · Police 122'}
              </p>
            </div>
            <AlertTriangle size={14} className="text-red-500" />
          </button>
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2.5 text-xs`}>
          <p className={`font-extrabold ${colors.text}`}>
            {isAr ? 'الأسئلة الشائعة' : 'Frequently asked questions'}
          </p>
          {faqs.length === 0 ? (
            <p className={`text-[11px] ${colors.secondaryText}`}>
              {isAr ? 'جاري تحميل الأسئلة الشائعة...' : 'Loading FAQs...'}
            </p>
          ) : (
            faqs.map((faq, idx) => {
              const isOpen = openFaqId === null ? idx === 0 : openFaqId === faq.id;
              return (
                <div key={faq.id || idx} className={idx > 0 ? 'pt-2 border-t border-slate-500/10' : ''}>
                  <button
                    type="button"
                    onClick={() => setOpenFaqId(isOpen ? 'none' : faq.id)}
                    className="w-full flex items-center justify-between text-start gap-2"
                  >
                    <span className={`font-bold ${colors.text}`}>
                      {isAr ? faq.questionAr : faq.questionEn}
                    </span>
                    {isOpen ? (
                      <ChevronUp size={14} className={colors.secondaryText} />
                    ) : (
                      <ChevronDown size={14} className={colors.secondaryText} />
                    )}
                  </button>
                  {isOpen && (
                    <p className={`text-[10px] ${colors.secondaryText} pt-1`}>
                      {isAr ? faq.answerAr : faq.answerEn}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="space-y-2">
          <p className={`text-xs font-extrabold ${colors.text}`}>
            {isAr ? 'تذاكر الدعم الخاصة بك' : 'Your support tickets'} (
            {pluralCount(tickets.length, 'support ticket', 'support tickets', 'تذكرة دعم', 'تذاكر دعم', 'تذكرة دعم', isAr)})
          </p>
          {tickets.length === 0 ? (
            <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} text-xs ${colors.secondaryText}`}>
              {isAr ? 'لا توجد تذاكر دعم مفتوحة حالياً.' : 'No support tickets submitted yet.'}
            </div>
          ) : (
            tickets.map((t) => (
              <button
                key={t.id}
                type="button"
                data-testid="data-row"
                onClick={() => nav.go('SH09', { id: t.id })}
                className={`w-full p-3.5 rounded-2xl border ${colors.border} ${colors.surface} flex justify-between items-center text-start text-xs`}
              >
                <div className="space-y-0.5">
                  <p className={`font-extrabold ${colors.text}`}>
                    {t.subject || (isAr ? 'تذكرة دعم' : 'Support ticket')}
                  </p>
                  <p className={`text-[10px] ${colors.secondaryText}`}>
                    {t.code} · {formatLabel(t.category, isAr)} · {fmtDate(t.createdAt, lang)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={t.status} />
                  <HelpCircle size={15} className={colors.secondaryText} />
                </div>
              </button>
            ))
          )}
        </div>

        <PrimaryButton onClick={() => nav.go('SH08')} testId="screen-primary">
          {isAr ? 'تذكرة دعم جديدة' : 'New Support Ticket'}
        </PrimaryButton>
      </div>
    </div>
  );
}

/* =====================================================================
 * SH08: New support ticket
 * ===================================================================== */
export function SH08Screen() {
  const colors = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const { user } = useSession();
  const qc = useQueryClient();
  const requestsQuery = useRequests();
  const bookingsQuery = useBookings();

  const requests = Array.isArray(requestsQuery.data) ? requestsQuery.data : [];
  const bookings = Array.isArray(bookingsQuery.data) ? bookingsQuery.data : [];

  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [refId, setRefId] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const categories = [
    { value: 'General', en: 'General', ar: 'عام' },
    { value: 'Payment', en: 'Payment & receipt', ar: 'الدفع والإيصال' },
    { value: 'Request', en: 'Roadside request', ar: 'طلب مساعدة على الطريق' },
    { value: 'Booking', en: 'Service center booking', ar: 'حجز مركز خدمة' },
    { value: 'Account', en: 'Account & profile', ar: 'الحساب والملف الشخصي' },
    { value: 'Safety', en: 'Safety & conduct', ar: 'السلامة والسلوك' }
  ];

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const uploaded = await uploadFile(file, 'support');
      setAttachment(uploaded);
    } catch (err) {
      setAttachment(null);
      setError(friendlyError(err, isAr, 'Could not upload attachment.', 'تعذر رفع المرفق.'));
    } finally {
      setUploading(false);
    }
  }

  const canSubmit = Boolean(category && subject.trim() && description.trim() && !busy && !uploading);

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setError('');
    if (!category) {
      setError(isAr ? 'يرجى اختيار فئة التذكرة.' : 'Please select a category.');
      return;
    }
    const finalSubject = subject.trim();
    const finalDescription = description.trim();
    if (!finalSubject || !finalDescription) {
      setError(isAr ? 'يرجى إدخال موضوع التذكرة والوصف.' : 'Please enter both a subject and description.');
      return;
    }
    setBusy(true);
    try {
      const selectedReq = requests.find((r) => r.id === refId);
      const selectedBook = bookings.find((b) => b.id === refId);
      const created = await post('/support/tickets', {
        category,
        subject: finalSubject,
        description: finalDescription,
        referenceType: selectedReq ? 'Request' : selectedBook ? 'Booking' : null,
        referenceId: selectedReq?.id || selectedBook?.id || null,
        attachmentFileId: attachment?.id || null
      });
      await qc.invalidateQueries({ queryKey: k.tickets });
      setDone(true);
      nav.go('SH09', created?.id ? { id: created.id } : {});
    } catch (err) {
      setError(friendlyError(err, isAr, 'Could not submit ticket', 'تعذر إرسال التذكرة'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back('SH07')} />

      <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'تذكرة دعم جديدة' : 'New support ticket'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {user?.fullName ? `${user.fullName} · ` : ''}
            {isAr ? 'أخبرنا بما حدث. نحن نستمع إليك.' : "Tell us what happened. We're listening."}
          </p>
        </div>

        <div className="space-y-1">
          <label className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'الفئة · مطلوبة' : 'Category · Required'}
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            data-testid="field-Category"
            className={`w-full px-3.5 h-11 rounded-xl border ${colors.border} ${colors.surface} text-xs font-bold ${colors.text}`}
          >
            <option value="">{isAr ? 'اختر الفئة...' : 'Select category...'}</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {isAr ? c.ar : c.en}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'الموضوع' : 'Subject'}
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            data-testid="field-Subject"
            placeholder={isAr ? 'ملخص قصير للمشكلة' : 'Brief summary of your issue'}
            className={`w-full px-3.5 h-11 rounded-xl border ${colors.border} ${colors.surface} text-xs ${colors.text}`}
          />
        </div>

        {(requests.length > 0 || bookings.length > 0) && (
          <div className="space-y-1">
            <label className={`text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'مرجع الرحلة / الحجز (اختياري)' : 'Trip / booking reference (optional)'}
            </label>
            <select
              value={refId}
              onChange={(e) => setRefId(e.target.value)}
              className={`w-full px-3.5 h-11 rounded-xl border ${colors.border} ${colors.surface} text-xs font-bold ${colors.text}`}
            >
              <option value="">{isAr ? 'بدون مرجع محدد' : 'None'}</option>
              {requests.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} · {formatLabel(r.status, isAr)}
                </option>
              ))}
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} · {b.serviceName || formatLabel(b.status, isAr)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1">
          <label className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'الوصف' : 'Description'}
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            data-testid="field-Description"
            placeholder={isAr ? 'اشرح تفاصيل المشكلة ليتمكن فريق الدعم من مساعدتك...' : 'Describe what happened so our support team can help...'}
            className={`w-full p-3 rounded-xl border ${colors.border} ${colors.surface} text-xs ${colors.text}`}
          />
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2 text-xs`}>
          <p className={`font-extrabold ${colors.text}`}>
            {isAr ? 'المرفقات (اختياري)' : 'Attachments (optional)'}
          </p>
          <label className="flex justify-between items-center cursor-pointer hover:opacity-90">
            <div>
              <p className={`font-semibold ${colors.text}`}>
                {uploading
                  ? (isAr ? 'جاري رفع الملف...' : 'Uploading attachment...')
                  : (isAr ? 'إضافة صورة أو مستند' : 'Add photo or document')}
              </p>
              <p className={`text-[10px] ${colors.secondaryText}`}>
                {isAr ? 'JPG أو PNG أو PDF · حتى ١٠ ميجابايت' : 'JPG, PNG or PDF · Up to 10 MB'}
              </p>
            </div>
            <Upload size={14} className={colors.secondaryText} />
            <input
              type="file"
              data-testid="field-attachment"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>
          {attachment && (
            <div
              data-testid="uploaded-attachment"
              className={`flex items-center justify-between gap-2 p-2 rounded-xl border ${colors.border} ${colors.elevated}`}
            >
              <span className="text-[11px] text-emerald-500 font-semibold truncate" dir="ltr">
                {attachment.fileName}
              </span>
              <button
                type="button"
                data-testid="remove-attachment"
                onClick={() => setAttachment(null)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-rose-500 hover:bg-rose-500/10 shrink-0"
              >
                <X size={11} />
                <span>{isAr ? 'إزالة' : 'Remove'}</span>
              </button>
            </div>
          )}
        </div>

        <div className="p-3 rounded-2xl border border-blue-500/30 bg-blue-500/10 text-[11px] space-y-0.5">
          <p className="font-bold text-blue-500">
            {isAr ? 'جاهز للإرسال' : 'Ready to send'}
          </p>
          <p className={colors.secondaryText}>
            {isAr
              ? 'سيتم مشاركة المرجع والرسالة مع فريق الدعم. لا ترفق بيانات البطاقة البنكية أو كلمات المرور.'
              : "Your reference and message will be shared with the support team. Don't attach payment card details or passwords."}
          </p>
        </div>

        {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
        {done && <p role="status" className="text-xs text-emerald-500">{isAr ? 'تم الحفظ بنجاح' : 'Saved successfully'}</p>}

        <PrimaryButton type="submit" disabled={!canSubmit} testId="screen-primary">
          {busy ? (isAr ? 'جاري الإرسال...' : 'Submitting...') : (isAr ? 'إرسال التذكرة' : 'Submit Ticket')}
        </PrimaryButton>
      </form>
    </div>
  );
}

/* =====================================================================
 * SH09: Support ticket detail
 * ===================================================================== */
export function SH09Screen({ id, params }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const { user } = useSession();
  const qc = useQueryClient();

  const ticketsQuery = useTickets();
  const tickets = Array.isArray(ticketsQuery.data) ? ticketsQuery.data : [];
  const resolvedId = id || params?.id || tickets[0]?.id || null;

  const detailQuery = useQuery({
    queryKey: ['support', 'tickets', resolvedId],
    queryFn: () => get(`/support/tickets/${resolvedId}`),
    enabled: !!resolvedId
  });

  const [supportReply, setSupportReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const ticket = detailQuery.data?.ticket || tickets.find((t) => t.id === resolvedId) || null;
  const messages = Array.isArray(detailQuery.data?.messages) ? detailQuery.data.messages : [];

  async function handleSendReply(e) {
    if (e) e.preventDefault();
    if (!supportReply.trim() || !resolvedId || busy) return;
    setError('');
    setBusy(true);
    try {
      await post(`/support/tickets/${resolvedId}/reply`, { text: supportReply.trim() });
      setSupportReply('');
      setToast(isAr ? 'تم إرسال ردك لفريق الدعم' : 'Reply sent to support');
      await Promise.all([
        detailQuery.refetch(),
        qc.invalidateQueries({ queryKey: k.tickets })
      ]);
    } catch (err) {
      setError(friendlyError(err, isAr, 'Could not send reply', 'تعذر إرسال الرد'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back('SH07')} />
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <div className="p-4 space-y-3.5">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'تذكرة الدعم' : 'Support ticket'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {ticket
              ? `${ticket.code} · ${fmtDateTime(ticket.createdAt, lang)}`
              : (isAr ? 'تفاصيل تذكرة الدعم' : 'Support ticket details')}
          </p>
        </div>

        {ticket && <StatusBadge status={ticket.status} />}

        {ticket ? (
          <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs`}>
            <p className={`font-extrabold ${colors.text}`}>
              {ticket.subject}
            </p>
            <div className="flex justify-between gap-2">
              <span className={colors.secondaryText}>{isAr ? 'المرجع' : 'Reference'}</span>
              <span className={`font-bold font-mono ${colors.text}`} data-testid="ticket-reference">
                {ticket.referenceCode || '—'}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className={colors.secondaryText}>{isAr ? 'الفئة' : 'Category'}</span>
              <span className={`font-bold ${colors.text}`}>{formatLabel(ticket.category, isAr)}</span>
            </div>
            <p className={`text-[10px] ${colors.secondaryText} pt-1`}>
              {isAr
                ? 'نرد عادةً خلال ٢٤ ساعة. ستتلقى إشعاراً عندما يرد فريق الدعم.'
                : "We usually reply within 24 hours. You'll receive a notification when support responds."}
            </p>
          </div>
        ) : (
          <div className={`p-4 rounded-2xl border ${colors.border} ${colors.surface} text-xs ${colors.secondaryText}`}>
            {isAr ? 'لا توجد تذكرة محددة حالياً.' : 'No support ticket found.'}
          </div>
        )}

        <div className="space-y-2.5">
          {messages.map((m) => {
            const authorLabel = m.fromSupport
              ? (m.authorName || (isAr ? 'دعم FixNGo' : 'FixNGo Support'))
              : ((m.authorName && m.authorName !== 'You' ? m.authorName : '') ||
                  ticket?.customerName ||
                  user?.fullName ||
                  '—');
            return (
              <div
                key={m.id}
                data-testid="ticket-message"
                className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1 text-xs`}
              >
                <div className="flex justify-between items-center gap-2">
                  <p className={`font-extrabold ${colors.text}`}>{authorLabel}</p>
                  {m.createdAt && (
                    <span className={`text-[10px] shrink-0 ${colors.secondaryText}`}>
                      {fmtDateTime(m.createdAt, lang)}
                    </span>
                  )}
                </div>
                <p className={`text-[11px] whitespace-pre-wrap ${colors.secondaryText}`}>{m.text}</p>
                {m.fileId && <TicketAttachment message={m} isAr={isAr} />}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSendReply} className="space-y-2.5">
          <div className="space-y-1">
            <label className={`text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'الرد على الدعم' : 'Reply to support'}
            </label>
            <div className={`p-3 rounded-xl border ${colors.border} ${colors.surface} flex justify-between items-center gap-2`}>
              <input
                value={supportReply}
                onChange={(e) => setSupportReply(e.target.value)}
                data-testid="field-reply"
                placeholder={isAr ? 'اكتب رسالة...' : 'Type a message...'}
                className={`bg-transparent text-xs ${colors.text} w-full outline-none`}
              />
              <button type="submit" disabled={busy || !supportReply.trim()} aria-label="Send reply">
                <Send size={14} className={colors.secondaryText} />
              </button>
            </div>
          </div>

          {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}

          <PrimaryButton type="submit" disabled={busy} testId="screen-primary">
            {isAr ? 'إرسال الرسالة' : 'Send Message'}
          </PrimaryButton>
        </form>
      </div>
    </div>
  );
}

/* =====================================================================
 * SH10: Notification preferences
 * ===================================================================== */
export function SH10Screen() {
  const colors = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const { user } = useSession();

  const prefsQuery = useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: () => get('/notifications/preferences')
  });

  const [notifState, setNotifState] = useState({
    push: true,
    email: true,
    tripsAndSafety: true,
    bookings: true,
    offers: false
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (prefsQuery.data) {
      setNotifState({
        push: prefsQuery.data.push ?? true,
        email: prefsQuery.data.email ?? true,
        tripsAndSafety: true,
        bookings: prefsQuery.data.bookings ?? true,
        offers: prefsQuery.data.offers ?? false
      });
    }
  }, [prefsQuery.data]);

  async function handleSave() {
    setBusy(true);
    try {
      await put('/notifications/preferences', {
        push: notifState.push,
        email: notifState.email,
        bookings: notifState.bookings,
        offers: notifState.offers
      });
      setDone(true);
      setToast(isAr ? 'تم حفظ تفضيلات الإشعارات' : 'Notification preferences saved');
      await prefsQuery.refetch();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back()} />
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <div className="p-4 space-y-3.5">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'تفضيلات الإشعارات' : 'Notification preferences'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {user?.fullName ? `${user.fullName} · ` : ''}
            {isAr ? 'اختر ما يصلك. الأمان يأتي أولاً.' : 'Choose what reaches you. Safety comes first.'}
          </p>
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2.5 text-xs`}>
          <p className={`font-extrabold ${colors.text}`}>
            {isAr ? 'القنوات' : 'Channels'}
          </p>
          {[
            {
              k: 'push',
              t: isAr ? 'إشعارات الهاتف' : 'Push notifications',
              s: isAr ? 'تحديثات الرحلة على هذا الجهاز' : 'Trip updates on this device'
            },
            {
              k: 'email',
              t: isAr ? 'إشعارات البريد الإلكتروني' : 'Email notifications',
              s: isAr ? 'الإيصالات وتحديثات الحجوزات' : 'Receipts and booking updates'
            }
          ].map((item) => (
            <div key={item.k} className="flex items-center justify-between">
              <div>
                <p className={`font-bold ${colors.text}`}>{item.t}</p>
                <p className={`text-[10px] ${colors.secondaryText}`}>{item.s}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!!notifState[item.k]}
                data-testid={`toggle-${item.k}`}
                onClick={() => setNotifState((p) => ({ ...p, [item.k]: !p[item.k] }))}
                className={`w-9 h-5 rounded-full transition-colors p-0.5 flex items-center ${
                  notifState[item.k] ? 'bg-emerald-500 justify-end' : 'bg-slate-600 justify-start'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white shadow" />
              </button>
            </div>
          ))}
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2.5 text-xs`}>
          <p className={`font-extrabold ${colors.text}`}>
            {isAr ? 'ما تتلقاه' : 'What you receive'}
          </p>
          {[
            {
              k: 'tripsAndSafety',
              locked: true,
              t: isAr ? 'تحديثات الرحلة والأمان' : 'Trips & safety',
              s: isAr ? 'تنبيهات الرحلة النشطة الهامة تظل مفعلة دائماً' : 'Critical active-trip alerts stay enabled'
            },
            {
              k: 'bookings',
              t: isAr ? 'حجوزات مراكز الخدمة' : 'Service center bookings',
              s: isAr ? 'التأكيدات وتغييرات المواعيد' : 'Confirmations and appointment changes'
            },
            {
              k: 'offers',
              t: isAr ? 'العروض والخصومات' : 'Promotions & offers',
              s: isAr ? 'أخبار وعروض اختيارية' : 'Optional product news and offers'
            }
          ].map((item) => (
            <div key={item.k} className="flex items-center justify-between">
              <div>
                <p className={`font-bold ${colors.text}`}>{item.t}</p>
                <p className={`text-[10px] ${colors.secondaryText}`}>{item.s}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!!notifState[item.k]}
                disabled={item.locked}
                data-testid={`toggle-${item.k}`}
                onClick={() => !item.locked && setNotifState((p) => ({ ...p, [item.k]: !p[item.k] }))}
                className={`w-9 h-5 rounded-full transition-colors p-0.5 flex items-center ${
                  notifState[item.k] ? 'bg-emerald-500 justify-end' : 'bg-slate-600 justify-start'
                } ${item.locked ? 'opacity-75 cursor-not-allowed' : ''}`}
              >
                <span className="w-4 h-4 rounded-full bg-white shadow flex items-center justify-center">
                  {item.locked && <Lock size={9} className="text-emerald-600" />}
                </span>
              </button>
            </div>
          ))}
        </div>

        <div className="p-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-[11px] space-y-0.5">
          <p className="font-bold text-amber-500">
            {isAr ? 'يلزم إذن الجهاز' : 'Device permission needed'}
          </p>
          <p className={colors.secondaryText}>
            {isAr
              ? 'إذا تم حظر الإشعارات بواسطة جهازك، قم بتفعيلها من إعدادات الجهاز.'
              : 'If push is blocked by your device, enable notifications in device settings. Safety updates remain available in the app and by email.'}
          </p>
        </div>

        <div className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} flex justify-between items-center text-xs`}>
          <div>
            <p className={`font-bold ${colors.text}`}>
              {isAr ? 'فتح إعدادات الجهاز' : 'Open Device Settings'}
            </p>
            <p className={`text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'إذن الإشعارات · إعدادات النظام' : 'Notification permission · Native device settings'}
            </p>
          </div>
          <Settings size={14} className={colors.secondaryText} />
        </div>

        {done && <p role="status" className="text-xs text-emerald-500">{isAr ? 'تم الحفظ بنجاح' : 'Saved successfully'}</p>}

        <PrimaryButton onClick={handleSave} disabled={busy} testId="screen-primary">
          {isAr ? 'حفظ التفضيلات' : 'Save Preferences'}
        </PrimaryButton>
      </div>
    </div>
  );
}

/* =====================================================================
 * SH11: About FixNGo
 * ===================================================================== */
export function SH11Screen() {
  const colors = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const ForwardChevron = isAr ? ChevronLeft : ChevronRight;

  const statusQuery = useQuery({
    queryKey: ['system', 'status'],
    queryFn: () => get('/system/status')
  });

  const version = statusQuery.data?.version || '1.0.0';

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back()} />

      <div className="p-4 space-y-4">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'عن FixNGo' : 'About FixNGo'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {isAr ? 'معاً على الطريق من جديد.' : 'Back on the road. Together.'}
          </p>
        </div>

        <div className="py-4 flex flex-col items-center gap-2 text-center">
          <ShieldLogo size={64} />
          <h2 className={`text-xl font-black italic ${colors.text}`} dir="ltr">
            Fix<span className="text-[#FF0000]">N</span>Go
          </h2>
          <p className={`text-[11px] ${colors.secondaryText}`}>
            {isAr ? `الإصدار ${version} · مصر` : `Version ${version} · Egypt`}
          </p>
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-2.5 text-xs`}>
          <p className={colors.secondaryText}>
            {isAr
              ? 'ميكانيكيون معتمدون، كباتن أوناش ومراكز خدمة موثوقة أينما يأخذك الطريق.'
              : 'Trusted mechanics, tow captains and service centers. Wherever the road takes you.'}
          </p>
          <button
            type="button"
            onClick={() => nav.go('SH07')}
            className="w-full pt-2 border-t border-slate-500/10 flex justify-between items-center text-start"
          >
            <div>
              <p className={`font-bold ${colors.text}`}>{isAr ? 'المساعدة والدعم' : 'Help & Support'}</p>
              <p className={`text-[10px] ${colors.secondaryText}`}>
                {isAr ? 'مركز دعم العملاء ٢٤/٧' : '24/7 Customer Support Center'}
              </p>
            </div>
            <ForwardChevron size={14} className={colors.secondaryText} />
          </button>
          <button
            type="button"
            onClick={() => nav.go('SH05', { tab: 'privacy' })}
            className="w-full pt-2 border-t border-slate-500/10 flex justify-between items-center text-start"
          >
            <div>
              <p className={`font-bold ${colors.text}`}>{isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}</p>
              <p className={`text-[10px] ${colors.secondaryText}`}>
                {isAr ? 'كيف نحمي معلوماتك' : 'How we protect your information'}
              </p>
            </div>
            <ForwardChevron size={14} className={colors.secondaryText} />
          </button>
          <button
            type="button"
            onClick={() => nav.go('SH05', { tab: 'terms' })}
            className="w-full pt-2 border-t border-slate-500/10 flex justify-between items-center text-start"
          >
            <div>
              <p className={`font-bold ${colors.text}`}>{isAr ? 'شروط الخدمة' : 'Terms of Service'}</p>
              <p className={`text-[10px] ${colors.secondaryText}`}>
                {isAr ? 'المساعدة على الطريق والمدفوعات والحجوزات' : 'Roadside assistance, payments and bookings'}
              </p>
            </div>
            <ForwardChevron size={14} className={colors.secondaryText} />
          </button>
        </div>

        <PrimaryButton onClick={() => nav.back()} testId="screen-primary">
          {isAr ? 'العودة إلى الملف الشخصي' : 'Back to Profile'}
        </PrimaryButton>
      </div>
    </div>
  );
}

/* =====================================================================
 * SH12: Edit account
 * ===================================================================== */
export function SH12Screen() {
  const colors = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const { user, loadMe } = useSession();
  const ForwardChevron = isAr ? ChevronLeft : ChevronRight;

  const [fullName, setFullName] = useState(() => user?.fullName || '');
  const [email, setEmail] = useState(() => user?.email || '');
  const [phone, setPhone] = useState(() => user?.phone || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  async function handleSave(e) {
    if (e) e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await put('/auth/me', {
        fullName: fullName.trim() || user?.fullName,
        email: email.trim() || user?.email,
        phone: phone.trim() || user?.phone
      });
      await loadMe();
      setDone(true);
      setToast(isAr ? 'تم حفظ تغييرات الحساب' : 'Account changes saved');
    } catch (err) {
      setError(friendlyError(err, isAr, 'Could not save account changes', 'تعذر حفظ التغييرات'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back()} />
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <form onSubmit={handleSave} className="p-4 space-y-3.5">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'تعديل الحساب' : 'Edit account'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {user?.fullName ? `${user.fullName} · ` : ''}
            {isAr ? 'معلومات حسابك' : 'Your account information'}
          </p>
        </div>

        <div className="space-y-1">
          <label className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'الاسم الكامل' : 'Full name'}
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            data-testid="field-fullName"
            className={`w-full px-3.5 h-11 rounded-xl border ${colors.border} ${colors.surface} text-xs font-bold ${colors.text}`}
          />
        </div>

        <div className="space-y-1">
          <label className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'البريد الإلكتروني' : 'Email address'}
          </label>
          <input
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="field-email"
            className={`w-full px-3.5 h-11 rounded-xl border ${colors.border} ${colors.surface} text-xs font-bold ${colors.text}`}
          />
        </div>

        <div className="space-y-1">
          <label className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'رقم الهاتف' : 'Phone number'}
          </label>
          <input
            type="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            data-testid="field-phone"
            className={`w-full px-3.5 h-11 rounded-xl border ${colors.border} ${colors.surface} text-xs font-bold ${colors.text}`}
          />
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs`}>
          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500">
            {isAr ? '• جهة الاتصال موثقة' : '• Contact verified'}
          </span>
          <p className={`text-[11px] ${colors.secondaryText}`}>
            {isAr
              ? 'يتطلب تغيير البريد أو الهاتف رمز تحقق قبل استخدام جهة الاتصال الجديدة.'
              : 'Changing email or phone requires a verification code before the new contact is used.'}
          </p>
          <button
            type="button"
            onClick={() => nav.go('SH02')}
            className="w-full pt-2 border-t border-slate-500/10 flex justify-between items-center text-start"
          >
            <span className={`font-bold ${colors.text}`}>
              {isAr ? 'تغيير كلمة المرور' : 'Change Password'}
            </span>
            <ForwardChevron size={14} className={colors.secondaryText} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => nav.go('SH21')}
          className={`w-full p-3.5 rounded-2xl border ${colors.border} ${colors.surface} flex justify-between items-center text-start`}
        >
          <div>
            <p className="text-xs font-extrabold text-red-500">
              {isAr ? 'طلب حذف الحساب' : 'Request Account Deletion'}
            </p>
            <p className={`text-[10px] ${colors.secondaryText}`}>
              {isAr
                ? 'مراجعة الرحلات النشطة والسجلات المحتفظ بها والتأكيد'
                : 'Review active trips, retained records and confirmation'}
            </p>
          </div>
          <Trash2 size={14} className="text-red-500" />
        </button>

        {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
        {done && <p role="status" className="text-xs text-emerald-500">{isAr ? 'تم الحفظ بنجاح' : 'Saved successfully'}</p>}

        <PrimaryButton type="submit" disabled={busy} testId="screen-primary">
          {isAr ? 'حفظ تغييرات الحساب' : 'Save Account Changes'}
        </PrimaryButton>
      </form>
    </div>
  );
}

/* =====================================================================
 * SH13: Log out of FixNGo?
 * ===================================================================== */
export function SH13Screen() {
  const colors = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const { user, logout } = useSession();
  const ForwardChevron = isAr ? ChevronLeft : ChevronRight;
  const [busy, setBusy] = useState(false);

  const canHaveActiveRequest = Boolean(user && ['CarOwner', 'Mechanic', 'TowCaptain'].includes(user.role));
  const requestsQuery = useQuery({
    queryKey: k.requests,
    queryFn: () => get('/requests'),
    enabled: canHaveActiveRequest
  });
  const requests = Array.isArray(requestsQuery.data) ? requestsQuery.data : [];
  const activeReq = canHaveActiveRequest
    ? requests.find((r) => r?.status && !TERMINAL_REQUEST_STATUSES.has(r.status)) || null
    : null;

  async function handleConfirmLogout() {
    setBusy(true);
    try {
      await logout();
    } finally {
      setBusy(false);
      nav.replace('A03');
    }
  }

  function handleReturnToActiveRequest() {
    if (!activeReq) return;
    const resolved = resolveDeepLink(`request:${activeReq.id}`, user?.role);
    if (resolved?.code) nav.go(resolved.code, resolved.params);
  }

  const sessionBodyCopy =
    user?.role === 'Admin'
      ? isAr
        ? 'سيتم إنهاء جلسة المشرف الحالية على هذا الجهاز. تظل إعدادات المنصة وسجلات التدقيق محفوظة بأمان.'
        : 'Your active administrator session on this device will end. Platform settings and audit logs remain safely recorded.'
      : user?.role === 'ServiceCenter'
      ? isAr
        ? 'ستحتاج إلى بريدك الإلكتروني وكلمة المرور لتسجيل الدخول مجدداً. تظل حجوزات المركز وأوامر الشغل وقائمة الخدمات محفوظة.'
        : "You'll need your email and password to sign back in. Center bookings, work orders, and catalog settings remain saved."
      : ['Mechanic', 'TowCaptain'].includes(user?.role)
      ? isAr
        ? 'ستحتاج إلى بريدك الإلكتروني وكلمة المرور لتسجيل الدخول مجدداً. تظل أرباح محفظتك وسجل خدماتك وملفك الشخصي محفوظة.'
        : "You'll need your email and password to sign back in. Your wallet earnings, service history, and profile stay saved."
      : isAr
      ? 'ستحتاج إلى بريدك الإلكتروني وكلمة المرور لتسجيل الدخول مجدداً. تظل مركباتك وحجوزاتك وإيصالاتك محفوظة في حسابك.'
      : "You'll need your email and password to sign back in. Saved vehicles, bookings and receipts stay in your account.";

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back()} />

      <div className="p-4 space-y-3.5">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'تسجيل الخروج من FixNGo؟' : 'Log out of FixNGo?'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {user?.fullName ? `${user.fullName} · ${formatLabel(user.role, isAr)} · ` : ''}
            {isAr ? 'أكد قبل مغادرة هذا الجهاز.' : 'Confirm before leaving this device.'}
          </p>
        </div>

        <div className={`p-4 rounded-2xl border ${colors.border} ${colors.surface} flex flex-col items-center text-center space-y-2`}>
          <div className="w-12 h-12 rounded-2xl bg-red-500/15 text-red-500 flex items-center justify-center">
            <LogOut size={22} />
          </div>
          {user && (
            <p className={`text-xs font-extrabold ${colors.text}`}>
              {user.fullName} ({formatLabel(user.role, isAr)})
            </p>
          )}
          <p className={`text-xs ${colors.secondaryText}`}>{sessionBodyCopy}</p>
        </div>

        {activeReq && (
          <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs`}>
            <p className={`font-extrabold ${colors.text}`}>
              {isAr ? 'قبل المغادرة' : 'Before you leave'}
            </p>
            <p className={`text-[11px] ${colors.secondaryText}`}>
              {isAr
                ? `تسجيل الخروج لا يلغي الطلب النشط (${activeReq.code}). عد إلى الطلب النشط إذا كنت لا تزال بحاجة للمتابعة.`
                : `Logging out does not cancel your active request (${activeReq.code}). Return to the active request if you still need assistance.`}
            </p>
            <button
              type="button"
              data-testid="return-active-request-btn"
              onClick={handleReturnToActiveRequest}
              className="w-full flex justify-between items-center pt-1.5 border-t border-slate-500/10"
            >
              <span className={`font-bold ${colors.text}`}>
                {isAr ? 'العودة للطلب النشط' : 'Return to Active Request'}
              </span>
              <ForwardChevron size={14} className={colors.secondaryText} />
            </button>
          </div>
        )}

        {['Mechanic', 'TowCaptain'].includes(user?.role) && (
          <div className="p-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-[11px] space-y-0.5">
            <p className="font-bold text-amber-500">
              {isAr ? 'أمان مقدمي الخدمة' : 'Provider safety'}
            </p>
            <p className={colors.secondaryText}>
              {isAr
                ? 'يجب على الميكانيكيين والكباتن إنهاء المهمة النشطة أو تسليمها بأمان قبل تسجيل الخروج.'
                : 'Mechanics and captains must finish or safely hand over an active job before signing out. Set availability offline to stop new requests.'}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <PrimaryButton onClick={handleConfirmLogout} disabled={busy} testId="screen-primary">
            {isAr ? 'تأكيد تسجيل الخروج' : 'Confirm Log Out'}
          </PrimaryButton>
          <SecondaryButton onClick={() => nav.back()}>
            {isAr ? 'إلغاء' : 'Cancel'}
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
 * SH14: Bank accounts
 * ===================================================================== */
export function SH14Screen() {
  const colors = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const { user } = useSession();
  const banksQuery = useBanks();

  const banks = Array.isArray(banksQuery.data) ? banksQuery.data : [];

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back()} />

      <div className="p-4 space-y-3.5">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'الحسابات البنكية' : 'Bank accounts'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {user?.fullName ? `${user.fullName} · ` : ''}
            {isAr ? 'وجهات سحب الأرباح' : 'Your payout destinations'}
          </p>
        </div>

        {banksQuery.isLoading ? (
          <Skeleton rows={2} />
        ) : banks.length === 0 ? (
          <div className={`p-4 rounded-2xl border ${colors.border} ${colors.surface} text-xs ${colors.secondaryText} space-y-1`}>
            <p className={`font-bold ${colors.text}`}>
              {isAr ? 'لا توجد حسابات بنكية محفوظة بعد' : 'No bank accounts saved yet'}
            </p>
            <p>
              {isAr
                ? 'أضف حساباً بنكياً مصرياً باسمك لسحب أرباحك.'
                : 'Add an Egyptian bank account in your name to withdraw earnings.'}
            </p>
          </div>
        ) : (
          banks.map((b) => (
            <div
              key={b.id}
              data-testid="data-row"
              className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className={`font-extrabold ${colors.text}`}>{b.bankName}</p>
                <div className="flex items-center gap-1">
                  {b.isVerified && <StatusBadge status="Verified" />}
                  {b.isDefault && (
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500">
                      {isAr ? '• الافتراضي' : '• Default'}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-between pt-1">
                <span className={colors.secondaryText}>{isAr ? 'صاحب الحساب' : 'Account holder'}</span>
                <span className={`font-bold ${colors.text}`}>{b.holderName}</span>
              </div>
              <div className="flex justify-between">
                <span className={colors.secondaryText}>{isAr ? 'رقم الحساب' : 'Account'}</span>
                <span className={`font-bold font-mono ${colors.text}`} dir="ltr">•••• {b.ibanLast4}</span>
              </div>
              <div className="flex justify-between">
                <span className={colors.secondaryText}>IBAN</span>
                <span className={`font-bold font-mono ${colors.text}`} dir="ltr">EG•• •••• •••• {b.ibanLast4}</span>
              </div>
              <div className="flex items-center gap-1.5 pt-1 text-[11px]">
                <CheckCircle2 size={13} className="text-emerald-500" />
                <span className={colors.text}>{isAr ? 'مستخدم لعمليات السحب' : 'Use for withdrawals'}</span>
              </div>
            </div>
          ))
        )}

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs`}>
          <p className={`font-extrabold ${colors.text}`}>
            {isAr ? 'طريقة السحب' : 'Payout method'}
          </p>
          <p className={`text-[11px] ${colors.secondaryText}`}>
            {isAr ? 'تحويل بنكي · ج.م' : 'Bank transfer · EGP'}
          </p>
          <p className={`text-[10px] ${colors.secondaryText}`}>
            {isAr
              ? 'تذهب التحويلات فقط إلى الحساب البنكي الموثق والمختار باسمك.'
              : 'Withdrawals go only to the selected, verified bank account in your name.'}
          </p>
        </div>

        {!banksQuery.isLoading && banks.length > 0 && banks.some((b) => b.isVerified) && (
          <div
            data-testid="payout-destination-banner"
            className="p-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-[11px] space-y-0.5"
          >
            <p className="font-bold text-emerald-500">
              {isAr ? 'تم حفظ وجهة السحب' : 'Payout destination saved'}
            </p>
            <p className={colors.secondaryText}>
              {isAr
                ? 'تستخدم طلبات السحب المستقبلية حسابك المختار.'
                : 'Future withdrawal reviews use your selected account. Pending payouts keep their original destination.'}
            </p>
          </div>
        )}

        <PrimaryButton onClick={() => nav.go('SH20')} testId="screen-primary">
          {isAr ? '+ إضافة حساب بنكي' : '+ Add Bank Account'}
        </PrimaryButton>
      </div>
    </div>
  );
}

/* =====================================================================
 * SH15: Withdraw earnings
 * ===================================================================== */
export function SH15Screen() {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const { user } = useSession();

  const walletQuery = useWallet();
  const banksQuery = useBanks();
  const bootstrapQuery = useBootstrap();
  const withdrawMutation = useWithdraw();

  const balanceMinor = walletQuery.data?.balanceMinor ?? 0;
  const banks = Array.isArray(banksQuery.data) ? banksQuery.data : [];
  const defaultBank = banks.find((b) => b.isDefault && b.isVerified) || banks.find((b) => b.isVerified) || null;
  const feeMinor = bootstrapQuery.data?.pricing?.withdrawalFeeMinor ?? 0;
  const minWithdrawalMinor = bootstrapQuery.data?.pricing?.minWithdrawalMinor ?? 10000;

  const [amountEgp, setAmountEgp] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (balanceMinor >= minWithdrawalMinor && amountEgp === '') {
      setAmountEgp(String(Math.floor(balanceMinor / 100)));
    }
  }, [balanceMinor, minWithdrawalMinor, amountEgp]);

  const parsedAmount = Number(amountEgp);
  const requestedMinor = Math.max(0, Math.round((Number.isFinite(parsedAmount) ? parsedAmount : 0) * 100));
  const netMinor = Math.max(0, requestedMinor - feeMinor);
  const remainingMinor = Math.max(0, balanceMinor - requestedMinor);
  const canWithdraw =
    confirmed &&
    balanceMinor >= minWithdrawalMinor &&
    requestedMinor >= minWithdrawalMinor &&
    requestedMinor <= balanceMinor &&
    !!defaultBank;

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setError('');
    if (!confirmed) {
      setError(isAr ? 'يرجى تأكيد المبلغ والحساب البنكي.' : 'Please confirm the amount and bank destination.');
      return;
    }
    if (!defaultBank) {
      setError(isAr ? 'يلزم وجود حساب بنكي موثق لإتمام السحب.' : 'Please add a verified bank account first.');
      return;
    }
    if (requestedMinor < minWithdrawalMinor) {
      setError(
        isAr
          ? `الحد الأدنى للسحب هو ${fmtMoney(minWithdrawalMinor, lang)}`
          : `Minimum withdrawal is ${fmtMoney(minWithdrawalMinor, lang)}`
      );
      return;
    }
    if (requestedMinor > balanceMinor) {
      setError(isAr ? 'المبلغ المطلوب يتجاوز الرصيد المتاح.' : 'Requested amount exceeds available balance.');
      return;
    }
    try {
      const res = await withdrawMutation.mutateAsync({
        amountMinor: requestedMinor,
        idempotencyKey: crypto.randomUUID()
      });
      nav.go('SH16', res?.id ? { id: res.id } : {});
    } catch (err) {
      setError(friendlyError(err, isAr, 'Could not submit withdrawal request', 'تعذر إرسال طلب السحب'));
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back('SH14')} />

      <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'سحب الأرباح' : 'Withdraw earnings'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {user?.fullName ? `${user.fullName} · ` : ''}
            {isAr ? 'تحويل بنكي' : 'Bank transfer'}
          </p>
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface}`}>
          <p className={`text-[10px] font-bold uppercase ${colors.secondaryText}`}>
            {isAr ? 'الرصيد المتاح' : 'AVAILABLE BALANCE'}
          </p>
          <p className={`text-xl font-extrabold ${colors.text}`} data-testid="wallet-balance">
            {fmtMoney(balanceMinor, lang)}
          </p>
        </div>

        <div className="space-y-1">
          <label className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'مبلغ السحب · ج.م' : 'Withdrawal amount · EGP'}
          </label>
          <div className={`px-3.5 h-11 rounded-xl border ${colors.border} ${colors.surface} flex justify-between items-center text-xs font-bold ${colors.text}`}>
            <input
              type="number"
              min="1"
              step="1"
              dir="ltr"
              placeholder={String(minWithdrawalMinor / 100)}
              value={amountEgp}
              onChange={(e) => setAmountEgp(e.target.value)}
              data-testid="field-amountEgp"
              className={`bg-transparent w-full outline-none text-xs font-bold ${colors.text}`}
            />
            <span className={`text-[10px] ${colors.secondaryText}`}>EGP</span>
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} flex justify-between items-center text-xs`}>
          <div>
            <p className={`font-extrabold ${colors.text}`}>
              {isAr ? 'الوجهة' : 'Destination'}
            </p>
            {defaultBank ? (
              <>
                <p className={`text-[11px] ${colors.text}`}>
                  {defaultBank.bankName} · <span dir="ltr">•••• {defaultBank.ibanLast4}</span>
                </p>
                <p className={`text-[10px] ${colors.secondaryText}`}>
                  {defaultBank.holderName} · {isAr ? 'الحساب البنكي المختار' : 'Selected bank account'}
                </p>
              </>
            ) : (
              <button
                type="button"
                onClick={() => nav.go('SH20')}
                className="text-[11px] font-bold text-[#E51C23] underline pt-0.5"
              >
                {isAr ? '+ إضافة حساب بنكي موثق' : '+ Add a verified bank account'}
              </button>
            )}
          </div>
          <Building2 size={16} className={colors.secondaryText} />
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs`}>
          <p className={`font-extrabold ${colors.text}`}>
            {isAr ? 'مراجعة السحب' : 'Withdrawal review'}
          </p>
          <div className="flex justify-between">
            <span className={colors.secondaryText}>{isAr ? 'المبلغ' : 'Amount'}</span>
            <span className={`font-bold ${colors.text}`}>{fmtMoney(requestedMinor, lang)}</span>
          </div>
          <div className="flex justify-between">
            <span className={colors.secondaryText}>{isAr ? 'رسوم التحويل' : 'Transfer fee'}</span>
            <span className={`font-bold ${colors.text}`}>{fmtMoney(feeMinor, lang)}</span>
          </div>
          <div className="flex justify-between">
            <span className={colors.secondaryText}>{isAr ? 'الصافي للبنك' : 'Net to bank'}</span>
            <span className={`font-bold ${colors.text}`}>{fmtMoney(netMinor, lang)}</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-slate-500/10">
            <span className={colors.secondaryText}>
              {isAr ? 'الرصيد بعد السحب' : 'Balance after withdrawal'}
            </span>
            <span className={`font-extrabold ${colors.text}`}>{fmtMoney(remainingMinor, lang)}</span>
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            data-testid="confirm-withdrawal"
            className="w-4 h-4 rounded accent-[#E51C23] shrink-0"
          />
          <span className={colors.text}>
            {isAr ? 'أؤكد المبلغ والحساب البنكي المستلم' : 'I confirm the amount and bank destination'}
          </span>
        </label>

        {balanceMinor < minWithdrawalMinor && (
          <p className={`text-[11px] ${colors.secondaryText}`}>
            {isAr
              ? `يلزم توفر رصيد لا يقل عن ${fmtMoney(minWithdrawalMinor, lang)} لطلب السحب.`
              : `You need an available balance of at least ${fmtMoney(minWithdrawalMinor, lang)} to request a withdrawal.`}
          </p>
        )}

        {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}

        <PrimaryButton type="submit" disabled={withdrawMutation.isPending || !canWithdraw} testId="screen-primary">
          {isAr ? 'طلب السحب' : 'Request Withdrawal'}
        </PrimaryButton>
      </form>
    </div>
  );
}

/* =====================================================================
 * SH16: Withdrawal submitted
 * ===================================================================== */
export function SH16Screen({ id, params }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const { user } = useSession();

  const withdrawalsQuery = useQuery({
    queryKey: k.withdrawals,
    queryFn: () => get('/payments/withdrawals'),
    refetchInterval: 4000
  });
  const banksQuery = useBanks();
  const walletQuery = useWallet();

  const withdrawals = Array.isArray(withdrawalsQuery.data) ? withdrawalsQuery.data : [];
  const targetId = id || params?.id || null;
  const withdrawal = (targetId && withdrawals.find((w) => w.id === targetId)) || withdrawals[0] || null;
  const banks = Array.isArray(banksQuery.data) ? banksQuery.data : [];
  const defaultBank = banks.find((b) => b.isDefault) || banks[0] || null;
  const balanceMinor = walletQuery.data?.balanceMinor ?? 0;

  const statusOrder = ['Requested', 'Processing', 'Sent', 'Confirmed'];
  const currentStepIdx = Math.max(0, statusOrder.indexOf(String(withdrawal?.status || 'Requested')));

  const timelineSteps = [
    { key: 'Requested', en: 'Requested', ar: 'تم الطلب' },
    { key: 'Processing', en: 'Processing by FixNGo', ar: 'قيد المعالجة بواسطة FixNGo' },
    { key: 'Sent', en: 'Sent to bank', ar: 'أُرسل للبنك' },
    { key: 'Confirmed', en: 'Bank confirmation', ar: 'تأكيد البنك' }
  ];

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back('SH15')} />

      <div className="p-4 space-y-3.5">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'تم تقديم طلب السحب' : 'Withdrawal submitted'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {withdrawal ? withdrawal.code : (isAr ? 'تتبع حالة السحب' : 'Withdrawal status tracking')}
          </p>
        </div>

        <StatusBadge status={withdrawal?.status || 'Requested'} />

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface}`}>
          <p className={`text-[10px] font-bold uppercase ${colors.secondaryText}`}>
            {isAr ? 'صافي التحويل' : 'NET PAYOUT'}
          </p>
          <p className={`text-xl font-extrabold ${colors.text}`}>
            {fmtMoney(withdrawal?.netMinor ?? withdrawal?.amountMinor ?? 0, lang)}
          </p>
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs`}>
          <p className={`font-extrabold ${colors.text}`}>
            {isAr ? 'تفاصيل السحب' : 'Withdrawal details'}
          </p>
          <div className="flex justify-between">
            <span className={colors.secondaryText}>{isAr ? 'صاحب الحساب' : 'Account holder'}</span>
            <span className={`font-bold ${colors.text}`}>
              {defaultBank?.holderName || user?.fullName || '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={colors.secondaryText}>{isAr ? 'البنك' : 'Bank'}</span>
            <span className={`font-bold ${colors.text}`}>
              {defaultBank?.bankName || '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={colors.secondaryText}>{isAr ? 'الحساب' : 'Account'}</span>
            <span className={`font-bold font-mono ${colors.text}`} dir="ltr">
              {defaultBank?.ibanLast4 ? `•••• ${defaultBank.ibanLast4}` : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={colors.secondaryText}>{isAr ? 'المطلوب / الرسوم' : 'Requested / fee'}</span>
            <span className={`font-bold ${colors.text}`}>
              {fmtMoney(withdrawal?.amountMinor ?? 0, lang)} / {fmtMoney(withdrawal?.feeMinor ?? 0, lang)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={colors.secondaryText}>{isAr ? 'المتبقي المتاح' : 'Remaining available'}</span>
            <span className={`font-bold ${colors.text}`}>{fmtMoney(balanceMinor, lang)}</span>
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs`} data-testid="withdrawal-timeline">
          <p className={`font-extrabold ${colors.text}`}>
            {isAr ? 'تتبع التحويل' : 'Payout tracking'}
          </p>
          {timelineSteps.map((step, idx) => {
            const reached = idx <= currentStepIdx;
            const isCurrent = idx === currentStepIdx;
            return (
              <div key={step.key} className="flex justify-between items-center">
                <span className={reached ? `font-bold ${colors.text}` : colors.secondaryText}>
                  • {isAr ? step.ar : step.en}
                </span>
                <span className={`text-[10px] font-semibold ${
                  reached ? 'text-emerald-500' : colors.secondaryText
                }`}>
                  {reached
                    ? (isCurrent ? (isAr ? 'الحالة الحالية' : 'Current') : (isAr ? 'مكتمل' : 'Done'))
                    : (isAr ? 'ليس بعد' : 'Not yet')}
                </span>
              </div>
            );
          })}
          {withdrawal?.failureReason && (
            <p className="text-[11px] text-rose-500 pt-1">{withdrawal.failureReason}</p>
          )}
        </div>

        <PrimaryButton
          onClick={() => nav.go(user?.role === 'TowCaptain' ? 'T09' : 'M07')}
          testId="screen-primary"
        >
          {isAr ? 'العودة إلى الأرباح' : 'Back to Earnings'}
        </PrimaryButton>
      </div>
    </div>
  );
}

/* =====================================================================
 * SH17: Document viewer (FIX B4)
 * ===================================================================== */
export function SH17Screen({ id, params }) {
  const colors = useColors();
  const { isAr, lang } = usePrefs();
  const nav = useNav();
  const { user } = useSession();
  const isAdmin = user?.role === 'Admin';

  const myKycQuery = useQuery({
    queryKey: k.kyc,
    queryFn: () => get('/providers/kyc/me'),
    enabled: !isAdmin && !params?.appId
  });
  const adminKycQuery = useQuery({
    queryKey: ['admin', 'kyc', params?.appId],
    queryFn: () => get(`/admin/kyc/${params.appId}`),
    enabled: !!params?.appId
  });
  const adminQueueQuery = useQuery({
    queryKey: ['admin', 'kyc', 'queue'],
    queryFn: () => get('/admin/kyc/queue'),
    enabled: isAdmin
  });

  const targetKey = id || params?.id || params?.docId || params?.fileId || params?.type || null;
  const kyc = useMemo(() => {
    if (params?.appId && adminKycQuery.data) return adminKycQuery.data;
    if (isAdmin) {
      const queue = Array.isArray(adminQueueQuery.data) ? adminQueueQuery.data : [];
      if (params?.appId) {
        const byApp = queue.find((a) => String(a.id) === String(params.appId));
        if (byApp) return byApp;
      }
      if (targetKey) {
        const byDoc = queue.find((a) =>
          Array.isArray(a.documents) &&
          a.documents.some((d) => d.id === targetKey || d.fileId === targetKey)
        );
        if (byDoc) return byDoc;
      }
      return queue[0] || null;
    }
    return myKycQuery.data;
  }, [params?.appId, adminKycQuery.data, isAdmin, adminQueueQuery.data, targetKey, myKycQuery.data]);

  const documents = Array.isArray(kyc?.documents) ? kyc.documents : [];

  const doc = (targetKey && documents.find(
    (d) => d.id === targetKey || d.fileId === targetKey || d.documentType === targetKey
  )) || documents[0] || null;

  const previewFileId = doc?.fileId || params?.fileId || null;
  const hasUploadedFile = !!previewFileId && previewFileId !== '00000000-0000-0000-0000-000000000000';
  const holderName =
    kyc?.fullName ||
    kyc?.businessName ||
    params?.holder ||
    (isAdmin ? (isAr ? 'مقدم الطلب' : 'Applicant') : user?.fullName) ||
    (isAr ? 'مقدم الخدمة' : 'Provider');
  const docType = doc?.documentType || params?.type || 'NationalId';

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back()} />

      <div className="p-4 space-y-3.5">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'عارض المستندات' : 'Document viewer'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {holderName}
            {kyc?.code ? ` · ${kyc.code}` : ''}
            {' · '}
            {isAr ? 'مستند التوثيق · معاينة آمنة' : 'Verification document · Secure preview'}
          </p>
        </div>

        <StatusBadge status={doc?.status || kyc?.status || 'Submitted'} />

        <div className={`p-4 rounded-2xl border ${colors.border} ${colors.surface} space-y-2.5`}>
          {hasUploadedFile ? (
            <div className="space-y-2">
              <div className="w-full rounded-xl overflow-hidden border border-slate-500/20 bg-black/5 flex items-center justify-center min-h-[160px]">
                <img
                  src={fileUrl(previewFileId)}
                  alt={docType}
                  data-testid="document-preview-image"
                  className="max-h-56 w-auto object-contain"
                />
              </div>
              <a
                href={fileUrl(previewFileId)}
                target="_blank"
                rel="noreferrer"
                data-testid="open-original-file"
                className="inline-block text-[11px] font-bold text-[#E51C23] underline"
              >
                {isAr ? 'فتح الملف الأصلي' : 'Open original file'}
              </a>
            </div>
          ) : (
            <div className="space-y-2" data-testid="document-preview-image">
              <FileText size={22} className={colors.secondaryText} />
              <p className={`text-xs font-extrabold ${colors.text}`}>
                {isAr ? 'مستند التوثيق' : 'VERIFICATION DOCUMENT'}
              </p>
              <p className={`text-[11px] ${colors.secondaryText}`}>
                {isAdmin
                  ? isAr
                    ? 'لم يتم إرفاق ملف صورة لهذا المستند في الطلب المرسل.'
                    : 'No file image was uploaded for this credential entry.'
                  : isAr
                  ? 'معاينة آمنة للمستند · ارفع نسخة جديدة أو استبدل المستند الحالي.'
                  : 'Secure document preview card · Upload or replace this credential below.'}
              </p>
            </div>
          )}
          <p className={`text-[11px] ${colors.secondaryText}`}>
            {isAr ? 'المالك: ' : 'Holder: '}
            <span className={`font-bold ${colors.text}`}>{holderName}</span>
            {' · '}
            {isAr ? 'النوع: ' : 'Type: '}
            <span className={`font-bold ${colors.text}`}>{formatLabel(docType, isAr)}</span>
          </p>
        </div>

        {documents.length > 1 && (
          <div className="space-y-1.5">
            <p className={`text-[10px] font-bold uppercase ${colors.secondaryText}`}>
              {isAr ? 'جميع المستندات المرفوعة' : 'All uploaded documents'} ({documents.length})
            </p>
            <div className="space-y-1.5">
              {documents.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  data-testid="data-row"
                  onClick={() => nav.replace('SH17', { id: d.id, fileId: d.fileId, type: d.documentType, appId: kyc?.id || params?.appId, holder: holderName })}
                  className={`w-full p-2.5 rounded-xl border text-start flex items-center justify-between text-xs ${
                    d.id === doc?.id ? 'border-[#E51C23] bg-[#E51C23]/10' : `${colors.border} ${colors.surface}`
                  }`}
                >
                  <span className={`font-bold ${colors.text}`}>{formatLabel(d.documentType, isAr)}</span>
                  <StatusBadge status={d.status} />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs`}>
          <p className={`font-extrabold ${colors.text}`}>
            {isAr ? 'بيانات المستند' : 'Document metadata'}
          </p>
          <div className="flex justify-between">
            <span className={colors.secondaryText}>{isAr ? 'نوع المستند' : 'Document type'}</span>
            <span className={`font-bold ${colors.text}`}>{formatLabel(docType, isAr)}</span>
          </div>
          <div className="flex justify-between">
            <span className={colors.secondaryText}>{isAr ? 'تاريخ الرفع' : 'Uploaded'}</span>
            <span className={`font-bold ${colors.text}`}>
              {doc?.createdAt ? fmtDateTime(doc.createdAt, lang) : fmtDate(kyc?.submittedAt, lang)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={colors.secondaryText}>{isAr ? 'حالة المراجعة' : 'Review state'}</span>
            <span className={`font-bold ${colors.text}`}>
              {formatLabel(doc?.status || kyc?.status || 'Submitted', isAr)}
            </span>
          </div>
          {kyc?.code && (
            <div className="flex justify-between">
              <span className={colors.secondaryText}>{isAr ? 'رمز الطلب' : 'Application code'}</span>
              <span className={`font-bold font-mono ${colors.text}`}>{kyc.code}</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {!isAdmin && (
            <PrimaryButton
              onClick={() => {
                nav.updateFlow({ replaceDocType: docType });
                nav.go('SH18', { type: docType });
              }}
              testId="replace-doc-btn"
            >
              {isAr ? 'استبدال المستند / رفع جديد' : 'Replace Document / Upload New'}
            </PrimaryButton>
          )}
          <SecondaryButton onClick={() => nav.back()}>
            {isAr ? 'إغلاق المعاينة' : 'Close Preview'}
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
 * SH18: Upload a document (FIX B4)
 * ===================================================================== */
export function SH18Screen({ params }) {
  const colors = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const { user } = useSession();
  const qc = useQueryClient();

  const docTypes = [
    { value: 'NationalId', en: 'National ID', ar: 'البطاقة الشخصية' },
    { value: 'DrivingLicense', en: 'Driving license', ar: 'رخصة القيادة' },
    { value: 'ProfessionalCertificate', en: 'Professional certificate', ar: 'شهادة مهنية' },
    { value: 'TruckRegistration', en: 'Truck registration', ar: 'رخصة الونش' },
    { value: 'CommercialLicense', en: 'Commercial license', ar: 'السجل التجاري' },
    { value: 'TaxId', en: 'Tax ID card', ar: 'البطاقة الضريبية' },
    { value: 'CenterPhoto', en: 'Service center photo', ar: 'صورة مركز الخدمة' }
  ];

  const [documentType, setDocumentType] = useState(
    () => params?.type || nav.flow?.replaceDocType || 'NationalId'
  );
  const [frontFile, setFrontFile] = useState(null);
  const [backFile, setBackFile] = useState(null);
  const [frontPreview, setFrontPreview] = useState('');
  const [backPreview, setBackPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleFrontChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFrontFile(f);
    setError('');
    if (f.type?.startsWith('image/')) {
      setFrontPreview(URL.createObjectURL(f));
    } else {
      setFrontPreview('');
    }
  }

  function handleBackChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBackFile(f);
    if (f.type?.startsWith('image/')) {
      setBackPreview(URL.createObjectURL(f));
    } else {
      setBackPreview('');
    }
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setError('');
    if (!frontFile) {
      setError(isAr ? 'يرجى اختيار ملف المستند للرفع.' : 'Please choose a document file to upload.');
      return;
    }
    setBusy(true);
    try {
      const uploadedFront = await uploadFile(frontFile, 'kyc');
      await post('/providers/kyc/documents', {
        documentType,
        fileId: uploadedFront.id
      });
      if (backFile) {
        const uploadedBack = await uploadFile(backFile, 'kyc');
        await post('/providers/kyc/documents', {
          documentType: `${documentType}Back`,
          fileId: uploadedBack.id
        });
      }
      await qc.invalidateQueries({ queryKey: k.kyc });
      setSubmitted(true);
      setTimeout(() => {
        nav.go('A11');
      }, 450);
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر رفع المستند' : 'Could not upload document'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back('SH17')} />

      <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'رفع مستند' : 'Upload a document'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {user?.fullName ? `${user.fullName} · ` : ''}
            {isAr ? 'التوثيق والشهادات' : 'Verification & credentials'}
          </p>
        </div>

        <div className="space-y-1">
          <label className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'نوع المستند' : 'Document type'}
          </label>
          <select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            data-testid="field-documentType"
            className={`w-full px-3.5 h-11 rounded-xl border ${colors.border} ${colors.surface} text-xs font-bold ${colors.text}`}
          >
            {docTypes.map((dt) => (
              <option key={dt.value} value={dt.value}>
                {isAr ? dt.ar : dt.en}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs cursor-pointer hover:opacity-90 block`}>
            <Upload size={15} className="text-[#E51C23]" />
            <p className={`font-extrabold ${colors.text}`}>{isAr ? 'الصورة الأمامية / المستند' : 'Front photo / file'}</p>
            <p className={`text-[10px] truncate ${colors.secondaryText}`}>
              {frontFile ? frontFile.name : (isAr ? 'اختر ملفاً (JPG, PNG, PDF)' : 'Choose file (JPG, PNG, PDF)')}
            </p>
            <p className={`text-[10px] font-semibold ${frontFile ? 'text-emerald-500' : colors.secondaryText}`}>
              {frontFile ? (isAr ? 'جاهز للرفع' : 'Ready to upload') : (isAr ? 'مطلوب' : 'Required')}
            </p>
            {frontPreview && (
              <img src={frontPreview} alt="Front preview" className="w-full h-16 object-cover rounded-lg mt-1" />
            )}
            <input
              type="file"
              data-testid="file-input"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              onChange={handleFrontChange}
              className="sr-only"
            />
          </label>

          <label className={`p-3 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs cursor-pointer hover:opacity-90 block`}>
            <Upload size={15} className={colors.secondaryText} />
            <p className={`font-extrabold ${colors.text}`}>{isAr ? 'الصورة الخلفية (اختياري)' : 'Back photo (optional)'}</p>
            <p className={`text-[10px] truncate ${colors.secondaryText}`}>
              {backFile ? backFile.name : (isAr ? 'اختر ملفاً (اختياري)' : 'Choose file (optional)')}
            </p>
            <p className={`text-[10px] font-semibold ${backFile ? 'text-emerald-500' : colors.secondaryText}`}>
              {backFile ? (isAr ? 'جاهز للرفع' : 'Ready to upload') : (isAr ? 'اختياري' : 'Optional')}
            </p>
            {backPreview && (
              <img src={backPreview} alt="Back preview" className="w-full h-16 object-cover rounded-lg mt-1" />
            )}
            <input
              type="file"
              data-testid="file-input-back"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              onChange={handleBackChange}
              className="sr-only"
            />
          </label>
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs`}>
          <p className={`font-extrabold ${colors.text}`}>
            {isAr ? 'متطلبات الصورة' : 'Photo requirements'}
          </p>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-500" />
            <span className={colors.text}>
              {isAr ? 'جميع الزوايا واضحة بدون انعكاس أو تشويش' : 'All corners visible, no glare or blur'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-500" />
            <span className={colors.text}>
              {isAr ? 'البيانات مقروءة والمستند ساري الصلاحية' : 'Details readable and document current'}
            </span>
          </div>
        </div>

        {submitted && (
          <div role="status" className="p-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-[11px] space-y-0.5">
            <p className="font-bold text-amber-500">
              {isAr ? 'تم الإرسال للمراجعة' : 'Submitted for review'}
            </p>
            <p className={colors.secondaryText}>
              {isAr
                ? 'تم حفظ المستند البديل بأمان. تظل حالة المراجعة الحالية مرئية حتى يكتمل التحقق.'
                : 'Your replacement is saved securely. The current review state remains visible until verification finishes.'}
            </p>
          </div>
        )}

        {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}

        <PrimaryButton type="submit" disabled={busy} testId="screen-primary">
          {isAr ? 'إرسال المستند' : 'Submit Document'}
        </PrimaryButton>
      </form>
    </div>
  );
}

/* =====================================================================
 * SH19: Emergency assistance
 * ===================================================================== */
export function SH19Screen() {
  const colors = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const { user } = useSession();
  const ForwardChevron = isAr ? ChevronLeft : ChevronRight;

  const bootstrapQuery = useBootstrap();
  const requestsQuery = useRequests();

  const ambulanceNum = bootstrapQuery.data?.pricing?.ambulanceNumber || '123';
  const policeNum = bootstrapQuery.data?.pricing?.policeNumber || '122';
  const requests = Array.isArray(requestsQuery.data) ? requestsQuery.data : [];
  const activeReq = requests.find((r) => r.status !== 'Completed' && r.status !== 'Cancelled') || requests[0] || null;

  const [busy, setBusy] = useState(false);
  const [sosSent, setSosSent] = useState(false);
  const [toast, setToast] = useState('');

  async function handleShareSos() {
    if (busy) return;
    setBusy(true);
    try {
      const lat = activeReq?.pickupLatitude ?? user?.latitude ?? 30.0444;
      const lng = activeReq?.pickupLongitude ?? user?.longitude ?? 31.2357;
      await post('/support/sos', {
        latitude: lat,
        longitude: lng,
        note: 'Emergency SOS'
      });
      setSosSent(true);
      setToast(isAr ? 'تم إرسال بلاغ الطوارئ ومشاركة موقعك' : 'Emergency SOS sent with your live location');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back()} />
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <div className="p-4 space-y-3.5">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'مساعدة الطوارئ' : 'Emergency assistance'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {isAr ? 'مصر · لحالات الخطر الفوري فقط' : 'Egypt · For immediate danger only'}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl border border-red-500/30 bg-red-500/10 space-y-2 text-xs">
          <p className="font-extrabold text-red-500 flex items-center gap-1.5">
            <AlertTriangle size={14} />
            <span>{isAr ? 'طوارئ SOS · خطر فوري؟' : 'Emergency SOS · Immediate danger?'}</span>
          </p>
          <div className="flex justify-between font-bold text-red-500">
            <a href={`tel:${ambulanceNum}`} className="flex items-center gap-1 underline">
              <Phone size={12} />
              <span>{isAr ? `${ambulanceNum} · الإسعاف` : `${ambulanceNum} · Ambulance`}</span>
            </a>
            <a href={`tel:${policeNum}`} className="flex items-center gap-1 underline">
              <Phone size={12} />
              <span>{isAr ? `${policeNum} · الشرطة` : `${policeNum} · Police`}</span>
            </a>
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs`}>
          <p className={`font-extrabold ${colors.text}`}>
            {isAr ? 'موقع رحلتك النشطة' : 'Your active trip location'}
          </p>
          {activeReq ? (
            <>
              <p className={`font-bold ${colors.text}`}>
                {activeReq.code} · {activeReq.pickupAddress}
              </p>
              <p className={`text-[11px] ${colors.secondaryText}`}>
                {[activeReq.vehicleColor, activeReq.vehicleMake, activeReq.vehicleModel, activeReq.vehiclePlate]
                  .filter(Boolean)
                  .join(' · ') || formatLabel(activeReq.status, isAr)}
              </p>
            </>
          ) : (
            <p className={`text-[11px] ${colors.secondaryText}`}>
              {user?.areaLabel || (isAr ? 'القاهرة، مصر · الموقع الجغرافي الحالي' : 'Cairo, Egypt · Current GPS coordinates')}
            </p>
          )}
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1 text-xs`}>
          <p className={`font-extrabold ${colors.text}`}>
            {isAr ? 'حافظ على سلامتك قدر الإمكان' : 'Stay as safe as you can'}
          </p>
          <p className={`text-[11px] ${colors.secondaryText}`}>
            {isAr
              ? 'ابتعد عن حركة المرور إن أمكن وشغل أضواء الانتظار. لا تقم بالإصلاح في حارة سير نشطة.'
              : 'Move away from traffic if safe. Keep hazards on. Never repair in a live lane.'}
          </p>
        </div>

        {sosSent && (
          <div role="status" className="p-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-500 font-bold">
            {isAr ? '✓ تمت مشاركة موقعك مع فريق طوارئ FixNGo' : '✓ Location shared with FixNGo SOS safety team'}
          </div>
        )}

        <button
          type="button"
          onClick={() => nav.go('SH07')}
          className={`w-full p-3 rounded-2xl border ${colors.border} ${colors.surface} flex justify-between items-center text-xs font-bold ${colors.text}`}
        >
          <span>{isAr ? 'المساعدة والدعم لغير الطوارئ' : 'Non-emergency help & support'}</span>
          <ForwardChevron size={14} className={colors.secondaryText} />
        </button>

        <div className="space-y-2">
          <PrimaryButton onClick={handleShareSos} disabled={busy} testId="screen-primary">
            {isAr ? 'مشاركة موقعي مع طوارئ FixNGo SOS' : 'Share My Location with FixNGo SOS'}
          </PrimaryButton>
          <a
            href={`tel:${ambulanceNum}`}
            className="w-full min-h-[48px] rounded-2xl bg-[#E51C23]/15 border border-[#E51C23]/40 text-[#E51C23] font-bold text-xs flex items-center justify-center gap-2"
          >
            <Phone size={14} />
            <span>{isAr ? `اتصال ${ambulanceNum} · الإسعاف` : `Call ${ambulanceNum} · Ambulance`}</span>
          </a>
          <a
            href={`tel:${policeNum}`}
            className={`w-full min-h-[48px] rounded-2xl border ${colors.border} ${colors.surface} ${colors.text} font-bold text-xs flex items-center justify-center gap-2`}
          >
            <Phone size={14} />
            <span>{isAr ? `اتصال ${policeNum} · الشرطة` : `Call ${policeNum} · Police`}</span>
          </a>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
 * SH20: Add bank account
 * ===================================================================== */
export function SH20Screen() {
  const colors = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const { user } = useSession();
  const qc = useQueryClient();
  const bootstrapQuery = useBootstrap();

  const banks = Array.isArray(bootstrapQuery.data?.banks) ? bootstrapQuery.data.banks : [];

  const [holderName, setHolderName] = useState(() => user?.fullName || '');
  const [bankCode, setBankCode] = useState('');
  const [iban, setIban] = useState('');
  const [useAsPayout, setUseAsPayout] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (user?.fullName && !holderName) {
      setHolderName(user.fullName);
    }
  }, [user, holderName]);

  const compactIban = iban.replace(/\s+/g, '').toUpperCase();
  const ibanShapeValid = /^EG\d{27}$/.test(compactIban);
  const canSave = Boolean(holderName.trim() && bankCode && compactIban.length > 0 && !busy);

  async function handleSave(e) {
    if (e) e.preventDefault();
    setError('');
    if (!holderName.trim()) {
      setError(isAr ? 'يرجى إدخال اسم صاحب الحساب.' : 'Please enter the account holder name.');
      return;
    }
    if (!bankCode) {
      setError(isAr ? 'يرجى اختيار البنك.' : 'Please select a bank.');
      return;
    }
    if (!compactIban) {
      setError(isAr ? 'يرجى إدخال رقم IBAN المصري.' : 'Please enter your Egyptian IBAN.');
      return;
    }
    setBusy(true);
    try {
      await post('/payments/banks', {
        holderName: holderName.trim(),
        bankCode,
        iban: compactIban,
        isDefault: useAsPayout
      });
      await qc.invalidateQueries({ queryKey: k.banks });
      setDone(true);
      nav.go('SH14');
    } catch (err) {
      setError(friendlyError(err, isAr, 'Could not save bank account', 'تعذر حفظ الحساب البنكي'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back('SH14')} />

      <form onSubmit={handleSave} className="p-4 space-y-3.5">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'إضافة حساب بنكي' : 'Add bank account'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {isAr ? 'تحويلات آمنة · يجب أن يكون الحساب باسمك.' : 'Secure payouts · Account must be in your name.'}
          </p>
        </div>

        <div className="space-y-1">
          <label className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'اسم صاحب الحساب · مطلوب' : 'Account holder · Required'}
          </label>
          <input
            type="text"
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            data-testid="field-holderName"
            placeholder={isAr ? 'الاسم الكامل كما يظهر في البنك' : 'Full name as registered with the bank'}
            className={`w-full px-3.5 h-11 rounded-xl border ${colors.border} ${colors.surface} text-xs font-bold ${colors.text}`}
          />
        </div>

        <div className="space-y-1">
          <label className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'البنك · مطلوب' : 'Bank · Required'}
          </label>
          <select
            value={bankCode}
            onChange={(e) => setBankCode(e.target.value)}
            data-testid="field-bankCode"
            className={`w-full px-3.5 h-11 rounded-xl border ${colors.border} ${colors.surface} text-xs font-bold ${colors.text}`}
          >
            <option value="">{isAr ? 'اختر البنك...' : 'Select bank...'}</option>
            {banks.map((b) => (
              <option key={b.code} value={b.code}>
                {isAr ? b.nameAr : b.nameEn}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'رقم IBAN المصري (٢٩ حرفاً) · مطلوب' : 'Egyptian IBAN (29 chars) · Required'}
          </label>
          <input
            type="text"
            dir="ltr"
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            data-testid="field-iban"
            placeholder="EG00 0000 0000 0000 0000 0000 0000 0"
            className={`w-full px-3.5 h-11 rounded-xl border ${colors.border} ${colors.surface} text-xs font-mono font-bold ${colors.text}`}
          />
        </div>

        <div className="p-3 rounded-2xl border border-blue-500/30 bg-blue-500/10 text-[11px] space-y-0.5">
          <p className="font-bold text-blue-500">
            {ibanShapeValid
              ? (isAr ? 'صيغة IBAN مطابقة (٢٩ حرفاً)' : 'IBAN length & prefix valid')
              : (isAr ? 'متطلبات رقم IBAN المصري' : 'Egyptian IBAN requirements')}
          </p>
          <p className={colors.secondaryText}>
            {isAr
              ? 'يتكون رقم IBAN المصري من ٢٩ حرفاً ويبدأ بـ EG. يتم إخفاء التفاصيل الكاملة بعد الحفظ.'
              : 'Egypt IBANs contain 29 characters and begin with EG. Full account details are masked after saving.'}
          </p>
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} flex items-center justify-between text-xs`}>
          <div>
            <p className={`font-extrabold ${colors.text}`}>
              {isAr ? 'استخدام كحساب سحب افتراضي' : 'Use as payout account'}
            </p>
            <p className={`text-[10px] ${colors.secondaryText}`}>
              {isAr ? 'اختياره لمراجعات السحب المستقبلية' : 'Select for future withdrawal reviews'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            data-testid="toggle-useAsPayout"
            aria-checked={useAsPayout}
            onClick={() => setUseAsPayout(!useAsPayout)}
            className={`w-9 h-5 rounded-full transition-colors p-0.5 flex items-center ${
              useAsPayout ? 'bg-emerald-500 justify-end' : 'bg-slate-600 justify-start'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-white shadow" />
          </button>
        </div>

        {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
        {done && <p role="status" className="text-xs text-emerald-500">{isAr ? 'تم الحفظ بنجاح' : 'Saved successfully'}</p>}

        <PrimaryButton type="submit" disabled={!canSave} testId="screen-primary">
          {busy ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ الحساب البنكي' : 'Save Bank Account')}
        </PrimaryButton>
      </form>
    </div>
  );
}

/* =====================================================================
 * SH21: Request account deletion
 * ===================================================================== */
export function SH21Screen() {
  const colors = useColors();
  const { isAr } = usePrefs();
  const nav = useNav();
  const { user, logout } = useSession();

  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isNonAdmin = Boolean(user && user.role !== 'Admin');
  const canHaveBookings = Boolean(user && (user.role === 'CarOwner' || user.role === 'ServiceCenter'));
  const isFieldProvider = Boolean(user && ['Mechanic', 'TowCaptain'].includes(user.role));

  const requestsQuery = useQuery({
    queryKey: k.requests,
    queryFn: () => get('/requests'),
    enabled: isNonAdmin
  });
  const bookingsQuery = useQuery({
    queryKey: k.bookings,
    queryFn: () => get('/centers/bookings'),
    enabled: canHaveBookings
  });
  const withdrawalsQuery = useQuery({
    queryKey: k.withdrawals,
    queryFn: () => get('/payments/withdrawals'),
    enabled: isFieldProvider
  });

  const activeRequestCount = useMemo(() => {
    if (!isNonAdmin) return 0;
    const rows = Array.isArray(requestsQuery.data) ? requestsQuery.data : [];
    return rows.filter((r) => r?.status && !TERMINAL_REQUEST_STATUSES.has(r.status)).length;
  }, [isNonAdmin, requestsQuery.data]);

  const activeBookingCount = useMemo(() => {
    if (!canHaveBookings) return 0;
    const rows = Array.isArray(bookingsQuery.data) ? bookingsQuery.data : [];
    return rows.filter((b) => b?.status && !TERMINAL_BOOKING_STATUSES.has(b.status)).length;
  }, [canHaveBookings, bookingsQuery.data]);

  const pendingWithdrawalCount = useMemo(() => {
    if (!isFieldProvider) return 0;
    const rows = Array.isArray(withdrawalsQuery.data) ? withdrawalsQuery.data : [];
    return rows.filter((w) => w?.status && !TERMINAL_WITHDRAWAL_STATUSES.has(w.status)).length;
  }, [isFieldProvider, withdrawalsQuery.data]);

  const blockerLabels = useMemo(() => {
    const list = [];
    if (activeRequestCount > 0) {
      list.push(
        pluralCount(
          activeRequestCount,
          'active roadside request',
          'active roadside requests',
          'طلب مساعدة نشط',
          'طلبات مساعدة نشطة',
          'طلب مساعدة نشط',
          isAr
        )
      );
    }
    if (activeBookingCount > 0) {
      list.push(
        pluralCount(
          activeBookingCount,
          'active appointment',
          'active appointments',
          'موعد حجز نشط',
          'مواعيد حجز نشطة',
          'موعد حجز نشط',
          isAr
        )
      );
    }
    if (pendingWithdrawalCount > 0) {
      list.push(
        pluralCount(
          pendingWithdrawalCount,
          'pending withdrawal',
          'pending withdrawals',
          'عملية سحب معلقة',
          'عمليات سحب معلقة',
          'عملية سحب معلقة',
          isAr
        )
      );
    }
    return list;
  }, [activeRequestCount, activeBookingCount, pendingWithdrawalCount, isAr]);

  const hasBlockers = blockerLabels.length > 0;
  const canSubmit = Boolean(understood && password.trim().length > 0 && !hasBlockers && !busy);

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setError('');
    if (!password.trim()) {
      setError(isAr ? 'يرجى إعادة إدخال كلمة المرور للتأكيد.' : 'Please re-enter your password to confirm.');
      return;
    }
    if (!understood) {
      setError(isAr ? 'يرجى الموافقة على شروط حذف الحساب.' : 'Please confirm that you understand the account deletion rules.');
      return;
    }
    if (hasBlockers) {
      setError(
        isAr
          ? 'يرجى إنهاء جميع الخدمات النشطة قبل تقديم طلب حذف الحساب.'
          : 'Please resolve all active services before requesting account deletion.'
      );
      return;
    }
    setBusy(true);
    try {
      await post('/support/deletion', { password });
      await logout();
      nav.replace('A02');
    } catch (err) {
      setError(friendlyError(err, isAr, 'Could not request account deletion', 'تعذر تقديم طلب حذف الحساب'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`min-h-full flex flex-col ${colors.bg}`} data-testid="screen">
      <AppTopBar showBack={true} onBack={() => nav.back()} />

      <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
        <div>
          <h1 className={`text-lg font-extrabold ${colors.text}`}>
            {isAr ? 'طلب حذف الحساب' : 'Request account deletion'}
          </h1>
          <p className={`text-xs ${colors.secondaryText}`}>
            {user?.fullName ? `${user.fullName} · ` : ''}
            {isAr ? 'راجع قبل المتابعة' : 'Review before continuing'}
          </p>
        </div>

        <div className={`p-3.5 rounded-2xl border ${colors.border} ${colors.surface} space-y-1.5 text-xs`}>
          <p className={`font-extrabold ${colors.text}`}>
            {isAr ? 'ماذا يعني ذلك' : 'What this means'}
          </p>
          <p className={`text-[11px] ${colors.secondaryText}`}>
            {isAr
              ? 'سيتم إزالة الوصول إلى ملفك الشخصي ومركباتك المحفوظة وتفضيلاتك الشخصية بعد معالجة الطلب.'
              : 'Access to your profile, saved vehicles and personal preferences will be removed after the request is processed.'}
          </p>
          <p className={`text-[11px] ${colors.secondaryText}`}>
            {isAr
              ? 'قد يتم الاحتفاظ بالفواتير وسجلات الدفع والأمان حيثما يقتضي القانون.'
              : 'Invoices, payment and safety records may be retained where legally required. You can ask support about retained data.'}
          </p>
        </div>

        {hasBlockers ? (
          <div
            role="status"
            data-testid="deletion-blockers"
            className="p-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-[11px] space-y-1"
          >
            <p className="font-bold text-rose-500">
              {isAr ? 'لا يمكن حذف الحساب حالياً بسبب خدمات نشطة:' : 'Active blockers must be resolved first:'}
            </p>
            <ul className="list-disc ps-4 space-y-0.5 text-rose-500 font-semibold">
              {blockerLabels.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="p-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-[11px] space-y-0.5">
            <p className="font-bold text-amber-500">
              {isAr ? 'أنهِ الخدمات النشطة أولاً' : 'Resolve active services first'}
            </p>
            <p className={colors.secondaryText}>
              {isAr
                ? 'تمنع الرحلات النشطة والطلبات غير المدفوعة والحجوزات القادمة حذف الحساب.'
                : 'Active trips, unpaid requests and upcoming bookings block deletion. Finish or manage them before submitting.'}
            </p>
          </div>
        )}

        <div className="space-y-1">
          <label className={`text-[10px] ${colors.secondaryText}`}>
            {isAr ? 'أعد إدخال كلمة المرور · مطلوب' : 'Re-enter your password · Required'}
          </label>
          <div className={`px-3 h-11 rounded-xl border ${colors.border} ${colors.surface} flex justify-between items-center text-xs ${colors.text}`}>
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="field-password"
              placeholder="••••••••••••"
              className={`bg-transparent w-full outline-none text-xs ${colors.text}`}
            />
            <button type="button" onClick={() => setShowPass((v) => !v)} aria-label="Toggle password visibility">
              {showPass ? <EyeOff size={14} className={colors.secondaryText} /> : <Eye size={14} className={colors.secondaryText} />}
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={understood}
            onChange={(e) => setUnderstood(e.target.checked)}
            data-testid="confirm-deletion"
            className="w-4 h-4 rounded accent-[#E51C23] shrink-0"
          />
          <span className={colors.text}>
            {isAr ? 'أفهم تبعات البيانات والوصول للحساب' : 'I understand the data and access implications'}
          </span>
        </label>

        {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}

        <div className="space-y-2">
          <PrimaryButton type="submit" disabled={!canSubmit} testId="screen-primary">
            {busy ? (isAr ? 'جاري التقديم...' : 'Submitting...') : (isAr ? 'طلب حذف الحساب' : 'Request Account Deletion')}
          </PrimaryButton>
          <SecondaryButton onClick={() => nav.back()}>
            {isAr ? 'الإبقاء على حسابي' : 'Keep My Account'}
          </SecondaryButton>
        </div>
      </form>
    </div>
  );
}

export const SHARED_COMPONENTS = {
  SH01: SH01Screen,
  SH02: SH02Screen,
  SH03: SH03Screen,
  SH04: SH04Screen,
  SH05: SH05Screen,
  SH06: SH06Screen,
  SH07: SH07Screen,
  SH08: SH08Screen,
  SH09: SH09Screen,
  SH10: SH10Screen,
  SH11: SH11Screen,
  SH12: SH12Screen,
  SH13: SH13Screen,
  SH14: SH14Screen,
  SH15: SH15Screen,
  SH16: SH16Screen,
  SH17: SH17Screen,
  SH18: SH18Screen,
  SH19: SH19Screen,
  SH20: SH20Screen,
  SH21: SH21Screen
};
