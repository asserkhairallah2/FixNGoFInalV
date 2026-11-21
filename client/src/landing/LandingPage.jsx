import React, { useState } from 'react';
import {
  ShieldCheck, MapPin, Wrench, Truck, Building2, AlertTriangle,
  Sun, Moon, Smartphone, CheckCircle2, Sparkles, Clock, Mail, Layers
} from 'lucide-react';
import { usePrefs } from '../app/stores.jsx';
import { ShieldLogo } from '../ui/kit.jsx';
import './landing.css';

export default function LandingPage({ onOpenMobile }) {
  const { isAr, isDark, setLang, setTheme } = usePrefs();
  const [activeView, setActiveView] = useState('home');
  const [logoError, setLogoError] = useState(false);

  const toggleLanguage = () => setLang(isAr ? 'en' : 'ar');
  const toggleThemeMode = () => setTheme(isDark ? 'light' : 'dark');

  const navItems = [
    { id: 'home', en: 'Home', ar: 'الرئيسية' },
    { id: 'how', en: 'How It Works', ar: 'كيف يعمل' },
    { id: 'about', en: 'About Project', ar: 'عن المشروع' },
    { id: 'legal', en: 'Terms & Privacy', ar: 'الشروط والخصوصية' },
  ];

  const features = [
    {
      icon: ShieldCheck,
      enTitle: 'KYC-Verified Specialists',
      arTitle: 'مختصون معتمدون وموثقون',
      enDesc: 'Every mobile mechanic, tow captain, and service center undergoes multi-document KYC verification before accepting jobs.',
      arDesc: 'يخضع كل ميكانيكي متنقل وكابتن ونش ومركز خدمة لمراجعة وثائق الهوية والتراخيص قبل استقبال الطلبات.',
    },
    {
      icon: Sparkles,
      enTitle: 'Transparent EGP Pricing',
      arTitle: 'تسعير شفاف وواضح بالجنيه',
      enDesc: 'Instant upfront callout & distance estimates, itemized on-site repair quotes, and digital tax receipts.',
      arDesc: 'تكلفة تقديرية فورية قبل الإرسال، مع مقايسة إصلاح مفصلة توافق عليها أولاً وإيصال رقمي معتمد.',
    },
    {
      icon: MapPin,
      enTitle: 'Live Google Maps & SignalR',
      arTitle: 'تتبع لحظي عبر خرائط جوجل',
      enDesc: 'Interactive GPS pin-drop, Google Cloud Places & Routes calculation, and real-time 7-step WebSocket dispatch.',
      arDesc: 'تحديد موقعك بدقة عبر GPS وخرائط جوجل، حساب المسار تلقائياً، وتتبع حي من ٧ مراحل لحظة بلحظة.',
    },
    {
      icon: Building2,
      enTitle: 'Certified Service Centers',
      arTitle: 'حجز مراكز الخدمة المعتمدة',
      enDesc: 'Browse verified workshops across Egypt, compare ratings, pick an open time slot, and track bay work orders.',
      arDesc: 'تصفح مراكز الصيانة المعتمدة، قارن تقييمات السائقين، اختر الموعد المتاح وتابع أمر الشغل مباشرة.',
    },
    {
      icon: AlertTriangle,
      enTitle: 'Priority P0 Emergency SOS',
      arTitle: 'استغاثة طوارئ وحوادث P0',
      enDesc: 'One-tap highway SOS shares live GPS coordinates with the FixNGo Safety Desk alongside direct 123 / 122 hotlines.',
      arDesc: 'زر استغاثة فوري يشارك إحداثياتك الحية مع غرفة الأمان وأولوية قصوى لأوناش الطوارئ وأرقام الإسعاف والنجدة.',
    },
    {
      icon: Layers,
      enTitle: 'ASP.NET Core 8 Architecture',
      arTitle: 'معمارية .NET 8 نظيفة ومتكاملة',
      enDesc: 'Engineered on 4 Clean Architecture C# layers, EF Core, SignalR hubs, Zoho Mail OTPs, and 5 role-tailored mobile experiences.',
      arDesc: 'مبني على معمارية Clean Architecture بـ ٤ طبقات C#، مع تحقق بريد Zoho وتجربة متكاملة لـ ٥ أدوار مختلفة.',
    },
  ];

  const steps = [
    {
      num: '1',
      enTitle: 'Pin Breakdown & Vehicle',
      arTitle: 'حدد موقعك ونوع العطل',
      enDesc: 'Choose Tow Truck, Mobile Mechanic, Service Center, or a 1-tap shortcut (Battery, Tire, Fuel, Accident) and drop your GPS pin.',
      arDesc: 'اختر ونش إنقاذ أو ميكانيكي متنقل أو اختصاراً سريعاً (بطارية، إطار، وقود، حادث) وحدد موقعك على الخريطة.',
    },
    {
      num: '2',
      enTitle: 'Match Online Specialists',
      arTitle: 'قارن المختصين المتصلين الآن',
      enDesc: 'Inspect real provider profiles, verified ratings, customer reviews, ETA, and upfront callout fares.',
      arDesc: 'استعرض ملفات الفنيين المتصلين فعلياً وتقييمات العملاء السابقة ووقت الوصول المتوقع قبل الاختيار.',
    },
    {
      num: '3',
      enTitle: 'Approve Quote & Track Live',
      arTitle: 'اعتمد المقايسة وتابع مباشرة',
      enDesc: 'Follow your specialist live on the map, chat securely, and review itemized parts & labor before work starts.',
      arDesc: 'تابع تحرك الفني مباشرة على الخريطة، تواصل معه عبر المحادثة، واعتمد تكلفة الإصلاح بشفافية تامة.',
    },
    {
      num: '4',
      enTitle: 'Settle & Rate Your Experience',
      arTitle: 'ادفع نقداً أو بالبطاقة وقيّم',
      enDesc: 'Pay seamlessly via Cash, Bank Card, or Apple Pay—instantly crediting the specialist wallet and issuing your receipt.',
      arDesc: 'سدد نقداً أو ببطاقتك البنكية مع تسوية فورية في محفظة الفني وإصدار إيصالك الرقمي وتقييم الخدمة.',
    },
  ];

  const handleNav = (id) => {
    setActiveView(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="fn-landing">
      {/* Floating Liquid Glass Pill Navbar */}
      <header className="fn-navbar-wrap">
        <nav className="fn-navbar" aria-label={isAr ? 'التنقل الرئيسي' : 'Primary navigation'}>
          <button type="button" className="fn-brand" onClick={() => handleNav('home')}>
            {!logoError ? (
              <img
                src="/brand/logo-full.png"
                alt="FixNGo"
                className="fn-brand-logo"
                onError={() => setLogoError(true)}
              />
            ) : (
              <>
                <ShieldLogo size={34} />
                <span dir="ltr">
                  Fix<span style={{ color: '#E51C23' }}>N</span>Go
                </span>
              </>
            )}
          </button>

          <div className="fn-nav-links">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`fn-nav-link ${activeView === item.id ? 'active' : ''}`}
              >
                {isAr ? item.ar : item.en}
              </button>
            ))}
          </div>

          <div className="fn-nav-actions">
            <button
              type="button"
              onClick={toggleLanguage}
              data-testid="landing-lang-btn"
              className="fn-lang-btn"
              title={isAr ? 'Switch to English' : 'التبديل إلى العربية'}
            >
              {isAr ? 'EN' : 'عربي'}
            </button>

            <button
              type="button"
              onClick={toggleThemeMode}
              data-testid="landing-theme-btn"
              className="fn-icon-btn"
              aria-label={isAr ? 'تبديل المظهر' : 'Toggle theme'}
              title={isAr ? 'تبديل المظهر' : 'Toggle theme'}
            >
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <button
              type="button"
              onClick={onOpenMobile}
              data-phone-preview="true"
              data-testid="open-mobile-app-btn"
              className="fn-phone-pill-btn"
              title={isAr ? 'فتح تطبيق الموبايل التفاعلي' : 'Open interactive mobile app'}
            >
              <Smartphone size={16} />
              <span>{isAr ? 'الموبايل' : 'Mobile App'}</span>
            </button>
          </div>
        </nav>
      </header>

      <main>
        {activeView === 'about' ? (
          <section className="fn-section">
            <div className="fn-container">
              <div className="fn-section-head">
                <span className="fn-section-eyebrow">{isAr ? 'نبذة عن المشروع' : 'About FixNGo'}</span>
                <h1 className="fn-section-title">
                  {isAr ? 'منظومة ذكية للمساعدة على الطريق وخدمات السيارات في مصر' : 'Smart Roadside Rescue & Automotive Care Platform for Egypt'}
                </h1>
                <p className="fn-section-sub">
                  {isAr
                    ? 'مشروع هندسي متكامل يربط أصحاب السيارات بالميكانيكيين المتنقلين وكباتن الأوناش ومراكز الصيانة المعتمدة في تجربة فورية موثوقة.'
                    : 'A full-stack engineering platform connecting drivers with verified mobile mechanics, tow captains, and certified service centers in real time.'}
                </p>
              </div>

              <div className="fn-grid-2">
                <div className="fn-glass p-7 space-y-4">
                  <h2 className="text-xl font-extrabold">{isAr ? 'المعمارية التقنية' : 'Technical Architecture'}</h2>
                  <ul className="space-y-2.5 text-sm leading-relaxed" style={{ color: 'var(--fn-text-2)' }}>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 size={17} className="text-[#E51C23] shrink-0 mt-0.5" />
                      <span><strong>ASP.NET Core 8 MVC &amp; Clean Architecture:</strong> Domain, Application, Infrastructure &amp; Web presentation layers with strict dependency inversion.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 size={17} className="text-[#E51C23] shrink-0 mt-0.5" />
                      <span><strong>Real Cloud Integrations:</strong> Google Cloud Maps, Places (New) &amp; Routes APIs, plus Zoho Mail transactional OTP verification (<code dir="ltr">noreply-fixngo@nerot.me</code>).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 size={17} className="text-[#E51C23] shrink-0 mt-0.5" />
                      <span><strong>5 Complete Role Consoles:</strong> Car Owner, Mobile Mechanic, Tow Captain, Service Center, and Platform Admin—accessible directly inside the interactive mobile simulator.</span>
                    </li>
                  </ul>
                  <div className="pt-2">
                    <button type="button" onClick={onOpenMobile} className="fn-btn-primary">
                      <Smartphone size={17} />
                      <span>{isAr ? 'جرّب تطبيق الموبايل الآن' : 'Launch Interactive Mobile App'}</span>
                    </button>
                  </div>
                </div>

                <div className="fn-glass p-7 space-y-4">
                  <h2 className="text-xl font-extrabold">{isAr ? 'التواصل والدعم' : 'Contact & Official Channels'}</h2>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--fn-text-2)' }}>
                    {isAr
                      ? 'للاستفسارات التقنية أو تجربة كافة صلاحيات المنصة، افتح محاكي الموبايل من شريط التنقل بالأعلى.'
                      : 'For technical inquiries or to explore all five role experiences live, launch the mobile simulator from the top navigation bar.'}
                  </p>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-center gap-2.5">
                      <Mail size={16} className="text-[#E51C23]" />
                      <span dir="ltr" className="font-semibold">noreply-fixngo@nerot.me</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Clock size={16} className="text-[#E51C23]" />
                      <span>{isAr ? 'خدمة الطوارئ والمساعدة على مدار الساعة ٢٤/٧' : '24/7 Emergency Roadside Dispatch Coverage'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : activeView === 'legal' ? (
          <section className="fn-section">
            <div className="fn-container">
              <div className="fn-section-head">
                <span className="fn-section-eyebrow">{isAr ? 'الشروط والخصوصية' : 'Legal & Privacy'}</span>
                <h1 className="fn-section-title">
                  {isAr ? 'شروط الاستخدام وسياسة الخصوصية' : 'Terms of Service & Privacy Policy'}
                </h1>
                <p className="fn-section-sub">
                  {isAr
                    ? 'نلتزم بحماية بيانات المستخدمين وشفافية التسعير وتوثيق هوية جميع مقدمي الخدمة.'
                    : 'We are committed to driver safety, transparent EGP fare breakdowns, and strict KYC verification.'}
                </p>
              </div>
              <div className="fn-grid-2">
                <div className="fn-glass p-7 space-y-3">
                  <h2 className="text-lg font-extrabold">{isAr ? 'شروط الخدمة' : 'Terms of Service'}</h2>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--fn-text-2)' }}>
                    {isAr
                      ? 'تعمل منصة FixNGo كوسيط تقني يربط السائقين بمقدمي خدمات الطريق ومراكز الصيانة المعتمدين. يتم عرض التكلفة التقديرية والمقايسة التفصيلية لاعتماد العميل قبل بدء أي إصلاح.'
                      : 'FixNGo connects motorists with KYC-approved roadside specialists and workshops. All repair quotes require customer approval prior to execution, backed by digital invoices.'}
                  </p>
                </div>
                <div className="fn-glass p-7 space-y-3">
                  <h2 className="text-lg font-extrabold">{isAr ? 'حماية البيانات والخصوصية' : 'Privacy & Location Data'}</h2>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--fn-text-2)' }}>
                    {isAr
                      ? 'تُستخدم إحداثيات الموقع الجغرافي حصرياً لمطابقة أقرب فني متصل وتتبع تنفيذ الخدمة أو بلاغات الطوارئ SOS، ولا تتم مشاركة أرقام الهواتف إلا بعد قبول الطلب.'
                      : 'GPS coordinates are used strictly to match nearby online specialists, calculate accurate routes, and dispatch SOS assistance. Personal contact details remain protected prior to assignment.'}
                  </p>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <>
            {/* Hero Section */}
            {activeView === 'home' && (
              <section className="fn-hero">
                <div className="fn-container fn-hero-grid">
                  <div>
                    <div className="fn-eyebrow">
                      <span className="fn-eyebrow-dot" />
                      <span>
                        {isAr
                          ? 'مساعدة فورية على الطريق ٢٤/٧ في جميع أنحاء مصر'
                          : '24/7 Roadside Assistance & Car Care Across Egypt'}
                      </span>
                    </div>

                    <h1 className="fn-hero-title">
                      {isAr
                        ? 'مساعدة فورية على الطريق، أينما كنت.'
                        : 'Fast roadside rescue, right where you are.'}
                    </h1>

                    <p className="fn-hero-sub">
                      {isAr
                        ? 'منصة FixNGo تجمع أوناش الإنقاذ، الميكانيكيين المتنقلين، ومراكز الصيانة المعتمدة في تطبيق واحد — بتسعير شفاف، تتبع حي عبر خرائط جوجل، وتوثيق كامل لمقدمي الخدمة.'
                        : 'FixNGo unifies flatbed tow captains, on-spot mobile mechanics, and certified service centers in one seamless platform — with upfront EGP fares, live Google Maps tracking, and verified specialists.'}
                    </p>

                    <div className="fn-hero-cta">
                      <button
                        type="button"
                        onClick={onOpenMobile}
                        data-testid="hero-open-mobile-btn"
                        className="fn-btn-primary"
                      >
                        <Smartphone size={18} />
                        <span>{isAr ? 'افتح تطبيق الموبايل' : 'Open Mobile App'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNav('how')}
                        className="fn-btn-glass"
                      >
                        <span>{isAr ? 'كيف يعمل المشروع' : 'How It Works'}</span>
                      </button>
                    </div>

                    <div className="fn-trust-row">
                      <span className="fn-trust-item">
                        <CheckCircle2 size={16} className="text-[#10b981]" />
                        {isAr ? 'فنيون ومراكز موثقة KYC' : 'KYC-Verified Network'}
                      </span>
                      <span className="fn-trust-item">
                        <CheckCircle2 size={16} className="text-[#10b981]" />
                        {isAr ? 'تسعير شفاف بالجنيه المصري' : 'Upfront EGP Estimates'}
                      </span>
                      <span className="fn-trust-item">
                        <CheckCircle2 size={16} className="text-[#10b981]" />
                        {isAr ? 'تتبع حي ومحادثة فورية' : 'Live SignalR GPS & Chat'}
                      </span>
                    </div>
                  </div>

                  <div className="fn-hero-visual">
                    <div
                      className="fn-blob"
                      role="button"
                      tabIndex={0}
                      onClick={onOpenMobile}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpenMobile(); }}
                      title={isAr ? 'اضغط لفتح تطبيق الموبايل' : 'Click to launch mobile app'}
                    >
                      <img src="/brand/icon.png" alt="FixNGo Emblem" />
                    </div>

                    <div className="fn-glass fn-float-chip c1">
                      <Truck size={18} className="text-[#E51C23]" />
                      <div>
                        <div className="text-xs font-extrabold">{isAr ? 'ونش سطحة في الطريق' : 'Flatbed Tow En Route'}</div>
                        <div className="text-[11px]" style={{ color: 'var(--fn-text-2)' }}>
                          {isAr ? 'يصل خلال ٦ دقائق · تتبع مباشر' : '6 min ETA · Live GPS'}
                        </div>
                      </div>
                    </div>

                    <div className="fn-glass fn-float-chip c2">
                      <Wrench size={18} className="text-[#10b981]" />
                      <div>
                        <div className="text-xs font-extrabold">{isAr ? 'مقايسة إصلاح معتمدة' : 'Itemized Repair Quote'}</div>
                        <div className="text-[11px]" style={{ color: 'var(--fn-text-2)' }}>
                          {isAr ? 'موافقة العميل قبل البدء' : 'Approved before work starts'}
                        </div>
                      </div>
                    </div>

                    <div className="fn-glass fn-float-chip c3">
                      <ShieldCheck size={18} className="text-[#E51C23]" />
                      <span>{isAr ? '٤.٩ ★ شبكة معتمدة' : '4.9 ★ Verified Specialists'}</span>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Why FixNGo Features */}
            {activeView === 'home' && (
              <section className="fn-section">
                <div className="fn-container">
                  <div className="fn-section-head">
                    <span className="fn-section-eyebrow">{isAr ? 'لماذا FixNGo؟' : 'Why FixNGo?'}</span>
                    <h2 className="fn-section-title">
                      {isAr ? 'كل ما تحتاجه سيارتك في منصة واحدة موحدة' : 'Everything motorists & providers need in one unified platform'}
                    </h2>
                    <p className="fn-section-sub">
                      {isAr
                        ? 'مصمم بأحدث معايير الجودة لربط أصحاب السيارات ومقدمي الخدمة ومراكز الصيانة بسلاسة وأمان.'
                        : 'Built end-to-end with real-time dispatch, fair wallet settlements, and verified automotive care.'}
                    </p>
                  </div>

                  <div className="fn-grid-3">
                    {features.map((f) => {
                      const Icon = f.icon;
                      return (
                        <div key={f.enTitle} className="fn-glass fn-card-hover p-6">
                          <div className="fn-feat-icon">
                            <Icon size={22} />
                          </div>
                          <h3 className="text-base font-extrabold mb-1.5">{isAr ? f.arTitle : f.enTitle}</h3>
                          <p className="text-sm leading-relaxed" style={{ color: 'var(--fn-text-2)' }}>
                            {isAr ? f.arDesc : f.enDesc}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* How It Works Section */}
            <section className="fn-section">
              <div className="fn-container">
                <div className="fn-section-head">
                  <span className="fn-section-eyebrow">{isAr ? 'خطوات بسيطة' : 'How It Works'}</span>
                  <h2 className="fn-section-title">
                    {isAr ? 'من العطل إلى العودة للطريق في ٤ خطوات' : 'From breakdown to back on the road in 4 steps'}
                  </h2>
                  <p className="fn-section-sub">
                    {isAr
                      ? 'تجربة مصممة لتقليل وقت الانتظار وضمان الشفافية الكاملة في كل طلب.'
                      : 'Engineered to minimize roadside wait times while keeping pricing and communication crystal clear.'}
                  </p>
                </div>

                <div className="fn-grid-4">
                  {steps.map((s) => (
                    <div key={s.num} className="fn-glass fn-card-hover p-6">
                      <div className="fn-step-num">{s.num}</div>
                      <h3 className="text-base font-extrabold mb-1.5">{isAr ? s.arTitle : s.enTitle}</h3>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--fn-text-2)' }}>
                        {isAr ? s.arDesc : s.enDesc}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Interactive Mobile App CTA Banner */}
                <div className="fn-glass p-8 mt-12 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="space-y-1.5 text-center md:text-start">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-[#E51C23]">
                      {isAr ? 'معاينة حية وتفاعلية بالكامل' : 'Live Interactive Mobile Simulator'}
                    </div>
                    <h3 className="text-xl md:text-2xl font-black">
                      {isAr
                        ? 'جرّب تطبيق الموبايل الكامل مباشرة من المتصفح'
                        : 'Experience the full FixNGo mobile app live in your browser'}
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--fn-text-2)' }}>
                      {isAr
                        ? 'اضغط على زر الموبايل لاستعراض واجهات العميل، الميكانيكي، كابتن الونش، مركز الصيانة، والمشرف.'
                        : 'Click Mobile App to interact with the live Car Owner, Mechanic, Tow Captain, Service Center, and Admin experiences.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenMobile}
                    className="fn-btn-primary shrink-0"
                  >
                    <Smartphone size={18} />
                    <span>{isAr ? 'تشغيل تطبيق الموبايل' : 'Launch Mobile App'}</span>
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Minimal Liquid Glass Footer */}
      <footer className="fn-footer">
        <div className="fn-container flex flex-col sm:flex-row items-center justify-between gap-4 text-xs" style={{ color: 'var(--fn-text-2)' }}>
          <div className="flex items-center gap-2.5 font-bold" style={{ color: 'var(--fn-text)' }}>
            <ShieldLogo size={24} />
            <span dir="ltr">FixNGo</span>
            <span className="font-normal" style={{ color: 'var(--fn-text-3)' }}>
              • {isAr ? 'منصة المساعدة على الطريق وخدمات السيارات' : '24/7 Roadside Assistance & Car Care'}
            </span>
          </div>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className="hover:underline bg-transparent border-0 cursor-pointer text-xs font-semibold"
                style={{ color: 'var(--fn-text-2)' }}
              >
                {isAr ? item.ar : item.en}
              </button>
            ))}
            <button
              type="button"
              onClick={onOpenMobile}
              className="hover:underline bg-transparent border-0 cursor-pointer text-xs font-bold text-[#E51C23]"
            >
              {isAr ? 'فتح الموبايل' : 'Mobile App'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
