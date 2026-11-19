import { useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Boxes,
  Cloud,
  Cpu,
  Infinity as InfinityIcon,
  LayoutDashboard,
  Menu,
  Truck,
  UserPlus,
  X,
  Zap,
} from 'lucide-react';
import heroDevices from '@/assets/hero-devices.png';
import mlaikoWordmark from '@/assets/mlaiko-logo-horizontal.png';

type LandingProps = {
  onSignIn: () => void;
  onSignUp: () => void;
};

type Frame = { x: number; y: number; w: number; h: number; imgW: number; imgH: number };

/** Transparent padding around the real artwork. The frame shows the full mark, not a sliced glyph. */
const MLAIKO_FRAME: Frame = { x: 88, y: 368, w: 844, h: 272, imgW: 1024, imgH: 1024 };
/** The metallic X only. The words beside it are set in type so the lockup is not doubled. */
const TRIGGEX_FRAME: Frame = { x: 438, y: 268, w: 660, h: 344, imgW: 1536, imgH: 1024 };
const TRIGGEX_LOGO = '/images/triggex-logo.png';
const TRIGGEX_SITE = 'https://www.triggex.net';

const NAV = [
  { href: '#about', label: 'על המערכת' },
  { href: '#capabilities', label: 'יכולות' },
  { href: '#audience', label: 'למי זה מתאים' },
];

const CAPABILITIES = [
  { icon: Boxes, title: 'ניהול מלאי בזמן אמת', text: 'מעקב אחר כמויות, תנועות מלאי, קליטת סחורה וזמינות מוצרים.' },
  { icon: BarChart3, title: 'סקירות וסטטיסטיקות עסקיות', text: 'ניתוח מכירות, הכנסות, רווחיות וביצועי עובדים באמצעות דוחות ונתונים מרוכזים.' },
  { icon: Truck, title: 'ניהול רכש והזמנות', text: 'מעקב אחר הזמנות מספקים, תהליכי יבוא וקליטת סחורה.' },
  { icon: Cpu, title: 'חיזוי מלאי — בפיתוח', text: 'תכנון עתידי של זיהוי חוסרים צפויים לפי קצב המכירות, כדי להקדים הזמנות ולצמצם מצבי חוסר.' },
];

const BRAND_VALUES = [
  { icon: Cpu, label: 'טכנולוגיה מתקדמת' },
  { icon: LayoutDashboard, label: 'מערכות עסקיות מותאמות' },
  { icon: InfinityIcon, label: 'ליווי ותמיכה מקצועית' },
];

export function PublicLanding({ onSignIn, onSignUp }: LandingProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div dir="rtl" className="min-h-screen overflow-x-hidden bg-[#F6F8FB] font-[Heebo] text-[#0B1933]">
      <header dir="ltr" className="sticky top-0 z-40 flex h-[72px] items-stretch bg-white shadow-[0_10px_28px_rgba(11,25,51,0.05)]">
        <div className="relative flex items-center pl-3 pr-10 sm:pl-6 sm:pr-14">
          <span aria-hidden="true" className="absolute inset-0 bg-[#12C7C1]" style={{ clipPath: 'polygon(0 0, 100% 0, calc(100% - 16px) 100%, 0 100%)' }} />
          <span aria-hidden="true" className="absolute inset-0 bg-[#0B1933]" style={{ clipPath: 'polygon(0 0, calc(100% - 11px) 0, calc(100% - 27px) 100%, 0 100%)' }} />
          <TriggeXLockup compact className="relative z-10" markClassName="h-9 w-auto sm:h-10" />
        </div>

        <nav dir="rtl" className="hidden min-w-0 flex-1 items-center justify-center gap-7 text-[15px] font-medium text-[#44556B] lg:flex" aria-label="ניווט בעמוד">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="rounded-md px-1 py-2 transition-colors hover:text-[#0EB5A5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0EB5A5]">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 px-3 sm:gap-3 sm:px-5">
          <button type="button" onClick={onSignIn} className="hidden h-10 items-center rounded-full border border-[#0EB5A5] bg-white px-5 text-sm font-semibold text-[#0B1933] transition hover:bg-[#F3FBFA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EB5A5] sm:inline-flex">
            התחברות
          </button>
          <button type="button" onClick={onSignUp} className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#0EB5A5] px-3 text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(14,181,165,0.28)] transition hover:bg-[#0CA898] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1933] sm:gap-2 sm:px-5 sm:text-sm">
            <UserPlus size={16} className="hidden min-[380px]:block" />
            הרשמה למערכת
          </button>
          <button type="button" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#0B1933] lg:hidden" aria-expanded={menuOpen} aria-label={menuOpen ? 'סגירת תפריט' : 'פתיחת תפריט'} onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="border-b border-[#E6EDF5] bg-white px-5 py-4 lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="ניווט נייד">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} onClick={closeMenu} className="rounded-xl px-3 py-3 text-base font-medium hover:bg-[#F4F7FB]">
                {item.label}
              </a>
            ))}
            <button type="button" onClick={() => { closeMenu(); onSignIn(); }} className="mt-2 h-11 rounded-full border border-[#0EB5A5] text-sm font-semibold sm:hidden">
              התחברות
            </button>
          </nav>
        </div>
      )}

      <main>
        <section id="about" className="relative scroll-mt-[72px] lg:pb-12">
          <TireTread className="pointer-events-none absolute -left-2 top-8 h-[460px] w-[92px] opacity-60" />
          <TireTread className="pointer-events-none absolute -right-2 bottom-6 h-[420px] w-[84px] opacity-40" />
          <div dir="ltr" className="relative mx-auto grid max-w-[1580px] items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(420px,560px)_minmax(0,1fr)] lg:items-center lg:gap-8 lg:px-8 lg:py-6 xl:grid-cols-[minmax(480px,640px)_minmax(0,1fr)]">
            <div dir="rtl" className="relative z-10 max-w-[640px] justify-self-start text-right">
              <FramedAsset src={mlaikoWordmark} alt="Mlaiko" frame={MLAIKO_FRAME} className="h-[62px] w-auto sm:h-[74px] xl:h-[82px]" />
              <p className="mt-3 text-[15px] text-[#63758A]" dir="ltr">
                A <span className="font-semibold text-[#0EB5A5]">TriggeX</span> Product
              </p>
              <h1 className="mt-4 text-[30px] font-extrabold leading-[1.08] tracking-tight sm:text-[40px] xl:text-[46px]">
                המלאי שלך. העסק שלך.
                <span className="mt-1.5 block text-[0.92em] leading-[1.08] text-[#0EB5A5]">תמונה אחת ברורה.</span>
              </h1>
              <p className="mt-4 max-w-[460px] text-[15px] leading-7 text-[#63758A] sm:text-[17px] sm:leading-8">
                מערכת חכמה לניהול מלאי, מכירות ורכש — עם נתונים, סקירות וסטטיסטיקות שעוזרים לך לקבל החלטות עסקיות מדויקות יותר.
              </p>
              <div dir="ltr" className="mt-6 flex flex-wrap gap-3">
                <button type="button" onClick={onSignIn} className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-l from-[#0EB5A5] to-[#12C7C1] px-6 text-[15px] font-bold text-white shadow-[0_10px_24px_rgba(14,181,165,0.28)] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1933]">
                  <ArrowLeft size={18} />
                  כניסה למערכת
                </button>
                <button type="button" onClick={onSignUp} className="inline-flex h-12 items-center gap-2 rounded-full border border-[#0B1933]/80 bg-white px-6 text-[15px] font-bold text-[#0B1933] transition hover:bg-[#F8FBFC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EB5A5]">
                  <UserPlus size={18} />
                  פתיחת חשבון חדש
                </button>
              </div>
              <ul className="mt-4 flex flex-col gap-2 text-[12px] text-[#44556B] sm:text-[13px] lg:flex-row lg:flex-wrap lg:gap-x-4 lg:gap-y-2">
                <li className="flex items-center gap-2"><Zap size={16} className="shrink-0 text-[#0EB5A5]" /> מהיר ויעיל — לתפעול יומיומי</li>
                <li className="flex items-center gap-2"><Cloud size={16} className="shrink-0 text-[#0EB5A5]" /> זמין מכל מקום — מחשב, טאבלט ומובייל</li>
              </ul>
            </div>

            <div className="relative z-10 w-full" dir="ltr">
              <img
                src={heroDevices}
                alt="טאבלט וסמארטפון המציגים את דשבורד Mlaiko עם נתוני הדגמה"
                width={1024}
                height={576}
                draggable={false}
                className="mx-auto h-auto w-full max-w-[640px] lg:mx-0 lg:max-w-none"
              />
            </div>
          </div>
        </section>

        <section id="capabilities" className="relative z-20 mx-auto max-w-[1580px] scroll-mt-[80px] px-4 pb-5 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {CAPABILITIES.map((item) => (
              <article key={item.title} className="flex min-h-[132px] flex-col items-center justify-center rounded-[24px] bg-white px-5 py-5 text-center shadow-[0_16px_40px_rgba(11,25,51,0.07)]">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F3FBFA]">
                  <item.icon size={22} strokeWidth={1.7} className="text-[#0EB5A5]" />
                </span>
                <h2 className="mt-3 text-[17px] font-extrabold leading-tight xl:text-[18px]">{item.title}</h2>
                <p className="mt-1.5 text-[13px] leading-5 text-[#63758A]">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-label="TriggeX" className="bg-gradient-to-l from-[#071422] via-[#0B1933] to-[#12384A] text-white">
          <div className="mx-auto grid max-w-[1580px] items-center gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[280px_minmax(0,1fr)_minmax(0,1.35fr)] lg:px-10 lg:py-7" dir="ltr">
            <TriggeXLockup markClassName="h-[72px] w-auto sm:h-20" wordClassName="text-[30px] sm:text-[34px]" />
            <div dir="rtl">
              <h2 className="text-[26px] font-extrabold sm:text-[28px]">מבית <span className="text-[#12C7C1]">TriggeX</span></h2>
              <p className="mt-2 max-w-[460px] text-sm leading-7 text-white/75">פתרונות טכנולוגיים חכמים לעסקים, עם דגש על יציבות, יעילות, אמינות וצמיחה עסקית.</p>
            </div>
            <ul dir="rtl" className="grid grid-cols-2 gap-x-3 gap-y-4 text-sm sm:grid-cols-3">
              {BRAND_VALUES.map((item) => (
                <li key={item.label} className="flex flex-col items-center gap-2 text-center lg:border-r lg:border-white/15 lg:px-2">
                  <item.icon size={22} className="text-[#12C7C1]" />
                  <span className="max-w-[9rem] leading-5 text-white/85">{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-[1100px] px-5 py-8 sm:px-8">
          <article id="audience" className="max-w-[540px] scroll-mt-[80px] rounded-[22px] bg-white p-5 shadow-[0_10px_28px_rgba(11,25,51,0.05)]">
            <h2 className="text-lg font-extrabold">למי זה מתאים</h2>
            <p className="mt-2 text-sm leading-7 text-[#63758A]">לעסקים שמנהלים מלאי, מכירות, רכש ועובדים ורוצים תמונה אחת של מה שקורה היום.</p>
          </article>
        </section>
      </main>
    </div>
  );
}

function TriggeXLockup({ compact, className, markClassName, wordClassName }: { compact?: boolean; className?: string; markClassName: string; wordClassName?: string }) {
  return (
    <a
      href={TRIGGEX_SITE}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="TriggeX, מעבר לאתר TriggeX"
      className={`flex items-center gap-2.5 rounded-md text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#12C7C1] ${className ?? ''}`}
    >
      <FramedAsset src={TRIGGEX_LOGO} alt="" frame={TRIGGEX_FRAME} className={markClassName} />
      <span className={`leading-none ${compact ? 'hidden min-[420px]:block' : ''}`}>
        <span className={`block font-extrabold tracking-tight ${wordClassName ?? 'text-[18px] sm:text-[20px]'}`}>TriggeX</span>
        <span className="mt-1 block text-[10px] font-medium tracking-wide text-white/70 sm:text-[11px]">Business Technology</span>
      </span>
    </a>
  );
}

function FramedAsset({ src, alt, frame, className }: { src: string; alt: string; frame: Frame; className?: string }) {
  const widthPct = (frame.imgW / frame.w) * 100;
  const leftPct = -(frame.x / frame.w) * 100;
  const topPct = -(frame.y / frame.h) * 100;
  return (
    <span className={`relative block shrink-0 overflow-hidden ${className ?? ''}`} style={{ aspectRatio: `${frame.w} / ${frame.h}` }}>
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="absolute h-auto max-w-none"
        style={{ width: `${widthPct}%`, left: `${leftPct}%`, top: `${topPct}%` }}
      />
    </span>
  );
}

function TireTread({ className }: { className?: string }) {
  const rows = Array.from({ length: 14 }, (_, index) => index);
  return (
    <svg viewBox="0 0 96 560" className={className} aria-hidden="true">
      {rows.map((row) => (
        <g key={row} transform={`translate(0 ${row * 40})`}>
          <rect x={row % 2 === 0 ? 6 : 22} y="6" width="34" height="12" rx="3" fill="#D5DEE8" />
          <rect x={row % 2 === 0 ? 46 : 58} y="6" width="24" height="12" rx="3" fill="#E6EDF4" />
        </g>
      ))}
    </svg>
  );
}
