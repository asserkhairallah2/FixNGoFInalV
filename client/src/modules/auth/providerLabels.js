// Shared label / plural helpers for the provider modules (auth, mechanic, captain, center).
// Wraps the kit's formatLabel with the extra enum values those screens display, so no raw
// enum (e.g. `JobEarning`, `CheckedIn`, `WheelLift`) ever reaches the UI in EN or AR.
import { formatLabel } from '../../ui/kit.jsx';

const EXTRA_EN = {
  JobEarning: 'Job earning', Earning: 'Earning', Withdrawal: 'Withdrawal', Payout: 'Payout',
  Commission: 'Platform fee', Refund: 'Refund', Adjustment: 'Adjustment', Bonus: 'Bonus',
  CashCollected: 'Cash collected', Cash: 'Cash', Card: 'Card', Wallet: 'Wallet',
  CheckedIn: 'Checked in', NoShow: 'No-show', Ready: 'Ready', ReadyForPickup: 'Ready for pickup',
  Flatbed: 'Flatbed', WheelLift: 'Wheel-lift', HookAndChain: 'Hook & chain', Integrated: 'Integrated',
  wheel_lift: 'Wheel Lift Tow', PickedUp: 'Vehicle loaded', Delivered: 'Delivered', Dropoff: 'Drop-off',
  AtDestination: 'At destination', Loading: 'Loading', Towing: 'Towing'
};
const EXTRA_AR = {
  JobEarning: 'أرباح مهمة', Earning: 'أرباح', Withdrawal: 'سحب', Payout: 'تحويل',
  Commission: 'رسوم المنصة', Refund: 'استرداد', Adjustment: 'تسوية', Bonus: 'مكافأة',
  CashCollected: 'تم تحصيل نقدي', Cash: 'نقدي', Card: 'بطاقة', Wallet: 'المحفظة',
  CheckedIn: 'تم تسجيل الوصول', NoShow: 'لم يحضر', Ready: 'جاهز', ReadyForPickup: 'جاهز للاستلام',
  Flatbed: 'سطحة', WheelLift: 'رفع العجلات', HookAndChain: 'خطاف وسلسلة', Integrated: 'ونش متكامل',
  wheel_lift: 'ونش رفع العجلات', PickedUp: 'تم تحميل السيارة', Delivered: 'تم التسليم', Dropoff: 'التسليم',
  AtDestination: 'عند الوجهة', Loading: 'جاري التحميل', Towing: 'جاري السحب'
};

/** Friendly EN/AR label for any enum/status/doc-type value shown on provider screens. */
export function providerLabel(key, isAr = false) {
  if (key === null || key === undefined || key === '') return '—';
  const s = String(key);
  if (isAr && EXTRA_AR[s]) return EXTRA_AR[s];
  if (!isAr && EXTRA_EN[s]) return EXTRA_EN[s];
  return formatLabel(s, isAr);
}

const AR_NOUNS = {
  bay: ['منصة', 'منصتان', 'منصات', 'منصة'],
  booking: ['حجز', 'حجزان', 'حجوزات', 'حجز'],
  job: ['مهمة', 'مهمتان', 'مهام', 'مهمة'],
  trip: ['رحلة', 'رحلتان', 'رحلات', 'رحلة'],
  service: ['خدمة', 'خدمتان', 'خدمات', 'خدمة'],
  technician: ['فني', 'فنيان', 'فنيين', 'فني'],
  review: ['تقييم', 'تقييمان', 'تقييمات', 'تقييم'],
  day: ['يوم', 'يومان', 'أيام', 'يوم'],
  year: ['سنة', 'سنتان', 'سنوات', 'سنة'],
  minute: ['دقيقة', 'دقيقتان', 'دقائق', 'دقيقة'],
  order: ['أمر شغل', 'أمرا شغل', 'أوامر شغل', 'أمر شغل']
};

/**
 * Count + correctly pluralised noun, e.g. plural(1, 'bay') → "1 bay", plural(3, 'booking') → "3 bookings".
 * AR uses the Arabic dual / plural (3–10) / singular (11+) forms for the nouns in AR_NOUNS.
 */
export function plural(n, noun, isAr = false, enPlural) {
  const parsed = Number(n);
  const count = Number.isFinite(parsed) ? parsed : 0;
  if (isAr && AR_NOUNS[noun]) {
    const [one, two, few, many] = AR_NOUNS[noun];
    if (count === 1) return `١ ${one}`;
    if (count === 2) return two;
    if (count === 0 || (count >= 3 && count <= 10)) return `${count.toLocaleString('ar-EG')} ${few}`;
    return `${count.toLocaleString('ar-EG')} ${many}`;
  }
  const word = count === 1 ? noun : (enPlural || `${noun}s`);
  return `${count} ${word}`;
}
