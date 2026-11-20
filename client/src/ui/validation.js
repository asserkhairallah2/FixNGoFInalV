// Shared client + server validation helpers, password policy checker, and bilingual error localization.

export function checkPasswordRules(password) {
  const s = String(password ?? '');
  const minLen = s.length >= 8;
  const hasUpper = /[A-Z]/.test(s);
  const hasLower = /[a-z]/.test(s);
  const hasDigit = /\d/.test(s);
  const hasSymbol = /[^A-Za-z0-9]/.test(s);
  return {
    minLen,
    hasUpper,
    hasLower,
    hasDigit,
    hasSymbol,
    isValid: minLen && hasUpper && hasLower && hasDigit && hasSymbol,
  };
}

export function describePasswordIssues(password, isAr = false) {
  const s = String(password ?? '');
  if (!s) {
    return isAr ? 'يرجى إدخال كلمة المرور.' : 'Password is required.';
  }
  const r = checkPasswordRules(s);
  if (r.isValid) return '';

  const missingEn = [];
  const missingAr = [];
  if (!r.minLen) {
    missingEn.push('at least 8 characters');
    missingAr.push('8 خانات على الأقل');
  }
  if (!r.hasUpper) {
    missingEn.push('an uppercase letter (A-Z)');
    missingAr.push('حرف كبير (A-Z)');
  }
  if (!r.hasLower) {
    missingEn.push('a lowercase letter (a-z)');
    missingAr.push('حرف صغير (a-z)');
  }
  if (!r.hasDigit) {
    missingEn.push('a number (0-9)');
    missingAr.push('رقم (0-9)');
  }
  if (!r.hasSymbol) {
    missingEn.push('a symbol (@ # $ !)');
    missingAr.push('رمز خاص (@ # $ !)');
  }

  return isAr
    ? `كلمة المرور ينقصها: ${missingAr.join('، ')}.`
    : `Password is missing: ${missingEn.join(', ')}.`;
}

export function validateEmailField(email, isAr = false) {
  const s = String(email ?? '').trim();
  if (!s) return isAr ? 'يرجى إدخال البريد الإلكتروني.' : 'Email address is required.';
  const at = s.indexOf('@');
  const dot = at > 0 ? s.indexOf('.', at + 2) : -1;
  if (at <= 0 || dot <= at + 1 || dot >= s.length - 1 || s.includes('..') || /\s/.test(s)) {
    return isAr
      ? 'أدخل بريداً إلكترونياً صحيحاً (مثال: name@domain.com).'
      : 'Please enter a valid email address (e.g. name@domain.com).';
  }
  return '';
}

export function validateEgyptPhoneField(phone, isAr = false) {
  const raw = String(phone ?? '').trim();
  if (!raw) return isAr ? 'يرجى إدخال رقم الموبايل.' : 'Mobile number is required.';
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('20') && digits.length === 12) digits = `0${digits.slice(2)}`;
  if (!/^01[0125]\d{8}$/.test(digits)) {
    return isAr
      ? 'أدخل رقم موبايل مصري صحيح (11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015).'
      : 'Enter a valid Egyptian mobile number (11 digits starting with 010, 011, 012, or 015).';
  }
  return '';
}

const AR_ERROR_MAP = [
  [/^Invalid email or password\.?$/i, 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'],
  [/^Email is already registered\.?$/i, 'هذا البريد الإلكتروني مسجل بالفعل.'],
  [/^Email already exists\.?$/i, 'هذا البريد الإلكتروني مسجل بالفعل.'],
  [/^Phone number is already registered\.?$/i, 'رقم الموبايل مسجل بالفعل لحساب آخر.'],
  [/^Phone already exists\.?$/i, 'رقم الموبايل مسجل بالفعل لحساب آخر.'],
  [/^Full name is required\.?$/i, 'يرجى إدخال الاسم الكامل.'],
  [/^Full name must be at least 2 characters\.?$/i, 'يجب أن يتكون الاسم من حرفين على الأقل.'],
  [/^Email address is required\.?$/i, 'يرجى إدخال البريد الإلكتروني.'],
  [/^Please enter a valid email address\.?$/i, 'يرجى إدخال بريد إلكتروني صحيح.'],
  [/^Mobile number is required\.?$/i, 'يرجى إدخال رقم الموبايل.'],
  [/Egyptian mobile number/i, 'أدخل رقم موبايل مصري صحيح (مثل 01012345678 أو +201012345678).'],
  [/^Password is required/i, 'يرجى إدخال كلمة المرور.'],
  [/^Current password is required\.?$/i, 'يرجى إدخال كلمة المرور الحالية.'],
  [/^Current password is incorrect\.?$/i, 'كلمة المرور الحالية غير صحيحة.'],
  [/^New password is required\.?$/i, 'يرجى إدخال كلمة المرور الجديدة.'],
  [/Invalid or expired OTP/i, 'رمز التحقق غير صحيح أو منتهي الصلاحية.'],
  [/Invalid card number/i, 'رقم البطاقة غير صحيح. تحقق من الأرقام وحاول مرة أخرى.'],
  [/Invalid Egyptian IBAN/i, 'رقم الـ IBAN المصري غير صحيح (يجب أن يبدأ بـ EG ويتكون من 29 خانة).'],
  [/already exists|duplicate/i, 'هذه البيانات مسجلة بالفعل في النظام.'],
  [/^Validation failed\.?$/i, 'يرجى مراجعة الحقول المحددة باللون الأحمر.'],
  [/^One or more validation errors occurred\.?$/i, 'يرجى مراجعة الحقول المحددة باللون الأحمر.'],
];

export function localizeErrorMessage(message, isAr = false) {
  const msg = String(message ?? '').trim();
  if (!msg) return '';
  if (!isAr) {
    if (/^(Validation failed\.?|One or more validation errors occurred\.?)$/i.test(msg)) {
      return 'Please check the highlighted fields and try again.';
    }
    return msg;
  }

  const missingMatch = msg.match(/^Password is missing:\s*(.+)\.$/i);
  if (missingMatch) {
    const parts = missingMatch[1]
      .split(/,\s*/)
      .map((p) => {
        if (/8 characters/i.test(p)) return '8 خانات على الأقل';
        if (/uppercase/i.test(p)) return 'حرف كبير (A-Z)';
        if (/lowercase/i.test(p)) return 'حرف صغير (a-z)';
        if (/number/i.test(p)) return 'رقم (0-9)';
        if (/symbol/i.test(p)) return 'رمز خاص (@ # $ !)';
        return p;
      });
    return `كلمة المرور ينقصها: ${parts.join('، ')}.`;
  }

  for (const [rx, ar] of AR_ERROR_MAP) {
    if (rx.test(msg)) return ar;
  }
  return msg;
}

export function normalizeFieldKey(rawKey) {
  const k = String(rawKey ?? '').trim();
  if (!k) return 'general';
  const leaf = k.includes('.') ? k.slice(k.lastIndexOf('.') + 1) : k;
  return leaf.length === 1 ? leaf.toLowerCase() : leaf[0].toLowerCase() + leaf.slice(1);
}

export function extractFieldErrors(rawErrors, code, detail, isAr = false) {
  const map = {};
  if (rawErrors && typeof rawErrors === 'object' && !Array.isArray(rawErrors)) {
    for (const [k, val] of Object.entries(rawErrors)) {
      const key = normalizeFieldKey(k);
      const list = Array.isArray(val) ? val : [val];
      const first = list.map((x) => String(x ?? '').trim()).find(Boolean);
      if (first) {
        map[key] = localizeErrorMessage(first, isAr);
      }
    }
  }

  // Map well-known domain error codes to their input field if not already present
  const fallbackMsg = localizeErrorMessage(detail, isAr);
  if (fallbackMsg) {
    if ((code === 'auth.email_exists') && !map.email) map.email = fallbackMsg;
    if ((code === 'auth.phone_exists') && !map.phone) map.phone = fallbackMsg;
    if ((code === 'auth.invalid_credentials') && !map.password) map.password = fallbackMsg;
    if ((code === 'auth.current_password_wrong' || code === 'auth.wrong_password') && !map.currentPassword) map.currentPassword = fallbackMsg;
    if ((code === 'auth.otp_invalid' || code === 'auth.otp_expired') && !map.code) map.code = fallbackMsg;
    if ((code === 'vehicle.plate_exists' || code === 'vehicle.plate_invalid') && !map.plate) map.plate = fallbackMsg;
    if ((code === 'card.invalid' || code === 'payment.card_invalid') && !map.number) {
      map.number = fallbackMsg;
      map.cardNumber = fallbackMsg;
    }
    if ((code === 'payment.iban_invalid' || code === 'bank.iban_invalid') && !map.iban) map.iban = fallbackMsg;
    if ((code === 'wallet.insufficient' || code === 'withdrawal.min_amount') && !map.amount) map.amount = fallbackMsg;
  }

  return map;
}
