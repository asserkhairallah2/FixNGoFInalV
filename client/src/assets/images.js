// Local bundled SVG data-URI assets replacing external stock photos (offline-ready, zero CDN).

const carSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="800" height="450">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1120"/>
      <stop offset="55%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="glow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#E51C23" stop-opacity="0.7"/>
      <stop offset="50%" stop-color="#f97316" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.25"/>
    </linearGradient>
    <linearGradient id="body" x1="0" y1="0" x2="1" y2="0.4">
      <stop offset="0%" stop-color="#475569"/>
      <stop offset="45%" stop-color="#94a3b8"/>
      <stop offset="100%" stop-color="#334155"/>
    </linearGradient>
  </defs>
  <rect width="800" height="450" fill="url(#sky)"/>
  <!-- City skyline -->
  <g fill="#0f172a" opacity="0.85">
    <rect x="40" y="130" width="55" height="190"/>
    <rect x="105" y="100" width="70" height="220"/>
    <rect x="190" y="150" width="60" height="170"/>
    <rect x="265" y="115" width="85" height="205"/>
    <rect x="490" y="125" width="75" height="195"/>
    <rect x="580" y="95" width="90" height="225"/>
    <rect x="685" y="140" width="70" height="180"/>
  </g>
  <!-- City bokeh lights -->
  <g opacity="0.55">
    <circle cx="95" cy="210" r="14" fill="#fbbf24"/>
    <circle cx="155" cy="195" r="10" fill="#f97316"/>
    <circle cx="240" cy="220" r="16" fill="#38bdf8"/>
    <circle cx="545" cy="205" r="12" fill="#fbbf24"/>
    <circle cx="640" cy="190" r="18" fill="#E51C23"/>
    <circle cx="725" cy="215" r="11" fill="#fbbf24"/>
  </g>
  <!-- Road & reflection -->
  <rect x="0" y="310" width="800" height="140" fill="#090d16"/>
  <ellipse cx="410" cy="345" rx="310" ry="22" fill="url(#glow)"/>
  <!-- Sleek sedan silhouette -->
  <g transform="translate(135, 185)">
    <path d="M40 120 L85 112 L175 55 C200 42 235 38 305 38 L415 42 C455 44 485 58 515 88 L555 96 C572 100 582 112 580 128 L572 146 L30 146 C22 140 24 124 40 120 Z" fill="url(#body)" stroke="#cbd5e1" stroke-width="2"/>
    <!-- Windows -->
    <path d="M190 62 C210 50 240 47 300 47 L398 50 C430 52 456 64 478 86 L160 88 Z" fill="#0f172a" stroke="#64748b" stroke-width="1.5"/>
    <line x1="305" y1="47" x2="295" y2="87" stroke="#64748b" stroke-width="3"/>
    <!-- Tail light LED bar -->
    <path d="M540 100 L578 106 L575 116 L535 112 Z" fill="#E51C23"/>
    <path d="M32 108 L70 104 L66 114 L30 116 Z" fill="#38bdf8"/>
    <!-- Wheels -->
    <circle cx="145" cy="146" r="38" fill="#090a0f" stroke="#475569" stroke-width="5"/>
    <circle cx="145" cy="146" r="22" fill="#1e293b" stroke="#94a3b8" stroke-width="3"/>
    <circle cx="465" cy="146" r="38" fill="#090a0f" stroke="#475569" stroke-width="5"/>
    <circle cx="465" cy="146" r="22" fill="#1e293b" stroke="#94a3b8" stroke-width="3"/>
  </g>
</svg>`;

const workshopSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="800" height="450">
  <defs>
    <linearGradient id="wbg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="800" height="450" fill="url(#wbg)"/>
  <!-- Ceiling lights -->
  <g fill="#f8fafc" opacity="0.85">
    <rect x="90" y="28" width="140" height="10" rx="5"/>
    <rect x="330" y="28" width="140" height="10" rx="5"/>
    <rect x="570" y="28" width="140" height="10" rx="5"/>
  </g>
  <!-- Service bays structure -->
  <rect x="50" y="70" width="700" height="270" fill="#111827" stroke="#334155" stroke-width="4" rx="12"/>
  <line x1="400" y1="70" x2="400" y2="340" stroke="#334155" stroke-width="4"/>
  <!-- Hydraulic lift columns Bay 1 -->
  <rect x="95" y="110" width="18" height="220" fill="#E51C23"/>
  <rect x="335" y="110" width="18" height="220" fill="#E51C23"/>
  <rect x="95" y="215" width="258" height="12" fill="#64748b"/>
  <!-- Car on lift Bay 1 -->
  <g transform="translate(115, 145)">
    <rect x="20" y="30" width="180" height="36" rx="10" fill="#94a3b8"/>
    <path d="M50 30 L75 6 L145 6 L170 30 Z" fill="#cbd5e1"/>
    <circle cx="55" cy="68" r="18" fill="#0f172a" stroke="#475569" stroke-width="4"/>
    <circle cx="165" cy="68" r="18" fill="#0f172a" stroke="#475569" stroke-width="4"/>
  </g>
  <!-- Hydraulic lift columns Bay 2 -->
  <rect x="445" y="110" width="18" height="220" fill="#E51C23"/>
  <rect x="685" y="110" width="18" height="220" fill="#E51C23"/>
  <rect x="445" y="245" width="258" height="12" fill="#64748b"/>
  <!-- Car on lift Bay 2 -->
  <g transform="translate(465, 175)">
    <rect x="20" y="30" width="180" height="36" rx="10" fill="#38bdf8"/>
    <path d="M50 30 L75 6 L145 6 L170 30 Z" fill="#7dd3fc"/>
    <circle cx="55" cy="68" r="18" fill="#0f172a" stroke="#475569" stroke-width="4"/>
    <circle cx="165" cy="68" r="18" fill="#0f172a" stroke="#475569" stroke-width="4"/>
  </g>
  <!-- Workshop floor -->
  <rect x="0" y="340" width="800" height="110" fill="#1e293b"/>
  <line x1="0" y1="345" x2="800" y2="345" stroke="#E51C23" stroke-width="4"/>
</svg>`;

export const NIGHT_CAR_IMAGE = '/brand/hero-car.jpeg';
export const WORKSHOP_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(workshopSvg)}`;
