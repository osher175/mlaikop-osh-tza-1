import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Boxes, CalendarDays, CheckCircle2, Package, Truck } from 'lucide-react';
import { receiptPostingAvailable } from '@/lib/v2/goodsReceipt';
import { canReceive, ordersWritable } from '@/lib/v2/purchaseOrder';

const LINE_COLUMNS = ['מוצר', 'מידה', 'הוזמן', 'נקלט קודם', 'יתרה', 'לקליטה עכשיו', 'עלות ליחידה', 'סה״כ שורה'];

/**
 * Receiving layout. With the ledger off there is no order to fill, and nothing here changes stock.
 */
export const GoodsReceivingV2: React.FC = () => {
  const [params] = useSearchParams();
  const orderId = params.get('order');
  const posting = receiptPostingAvailable();
  const ledger = ordersWritable();
  const blocked = !ledger || !posting;

  return (
    <div dir="rtl" data-screen="goods-receiving-visual" className="min-w-0 font-[Heebo] text-v2-text">
      <header className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-[#e7f8f4] text-[#12a37a]" aria-hidden>
            <Package className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-[26px] font-extrabold leading-none md:text-[30px]">קליטת סחורה</h1>
            <p className="mt-1.5 max-w-xl text-sm text-v2-muted">קליטת מלאי או חלקית של הזמנת רכש ועדכון עלויות. הזמנה לבדה אינה מגדילה מלאי.</p>
          </div>
        </div>
        <Link to="/procurement" className="inline-flex h-11 items-center gap-2 self-start rounded-[14px] border border-[#dbe4ee] bg-white px-4 font-bold shadow-sm">
          <ArrowRight className="h-4 w-4" aria-hidden />חזרה להזמנות
        </Link>
      </header>

      <p className="mb-4 rounded-[16px] bg-[#fff7ed] px-4 py-3 text-sm font-semibold text-[#c2410c]" role="status">
        {orderId
          ? 'התקבל מזהה הזמנה, אבל ספר ההזמנות כבוי ולכן אין מספר, ספק, כמויות או מחירים. המלאי לא משתנה.'
          : 'אין הזמנה לקליטה. בוחרים הזמנה שממתינה לאספקה או באספקה חלקית. טיוטה, הזמנה שהושלמה והזמנה שבוטלה אינן נפתחות לקליטה.'}
        {blocked ? ' הקליטה בפועל כבויה.' : ''}
      </p>

      <section className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="פרטי ההזמנה לקליטה">
        <Info icon={CalendarDays} label="תאריך הזמנה" value="לא זמין" />
        <Info icon={ClipboardMark} label="מס׳ הזמנה" value={orderId ? 'לא נטען' : 'אין הזמנה'} />
        <Info icon={Truck} label="ספק" value="לא זמין" />
        <Info icon={Boxes} label="סטטוס הזמנה" value="לא זמין" tone="text-[#c2410c]" />
      </section>
      <section className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {['סה״כ הזמנה', 'נקלט עד כה', 'יתרה פתוחה'].map((label) => (
          <article key={label} className="rounded-[18px] border border-[#e6eef6] bg-white px-4 py-3 shadow-sm">
            <p className="text-sm font-bold text-v2-muted">{label}</p>
            <p className="mt-1 text-2xl font-extrabold">לא זמין</p>
          </article>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
        <aside className="h-fit rounded-[20px] border border-[#e6eef6] bg-white p-4 shadow-sm">
          <h2 className="text-base font-extrabold">סיכום קליטה</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between"><dt className="text-v2-muted">פריטים לקליטה</dt><dd className="font-extrabold">לא זמין</dd></div>
            <div className="flex items-center justify-between"><dt className="text-v2-muted">כמות</dt><dd className="font-extrabold">לא זמין</dd></div>
          </dl>
          <div className="mt-4 rounded-[16px] bg-[#e7f8f2] px-3 py-3">
            <p className="text-xs font-bold text-[#0f9f6e]">עלות כוללת</p>
            <p className="text-2xl font-extrabold text-[#0f9f6e]">לא זמין</p>
          </div>
          <label className="mt-4 flex items-start gap-2 text-sm font-semibold text-v2-muted">
            <input type="checkbox" disabled className="mt-1" />
            עדכון עלות הרכש הנוכחית. ההזמנה המקורית אינה נדרסת, ומחיר מכירה היסטורי אינו משתנה.
          </label>
        </aside>

        <section className="overflow-hidden rounded-[20px] border border-[#e6eef6] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#eef3f8] p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-v2-muted">קליטה מלאה מקבלת את היתרה הפתוחה בלבד. שורה שלא נבחרה אינה נקלטה.</p>
            <div className="flex rounded-[14px] bg-[#f4f7fb] p-1" role="group" aria-label="סוג קליטה">
              <button type="button" disabled className="h-11 rounded-[12px] bg-[#12b981] px-4 text-sm font-extrabold text-white opacity-60">קליטה חלקית</button>
              <button type="button" disabled className="h-11 rounded-[12px] px-4 text-sm font-extrabold opacity-60">קליטה מלאה</button>
            </div>
          </div>
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-[#f6f8fb] text-[#7b8798]">
                <tr>{LINE_COLUMNS.map((column) => <th key={column} className="px-3 py-3 text-right text-xs font-bold">{column}</th>)}</tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={LINE_COLUMNS.length} className="px-4 py-12 text-center">
                    <Package className="mx-auto mb-2 h-6 w-6 text-[#9aa6b5]" aria-hidden />
                    <p className="font-extrabold">אין שורות לקליטה</p>
                    <p className="mt-1 text-sm text-v2-muted">הטבלה תציג את שורות ההזמנה אחרי שההזמנה נטענת. אין כאן מוצרים לדוגמה.</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="px-4 py-10 text-center md:hidden">
            <p className="font-extrabold">אין שורות לקליטה</p>
            <p className="mt-1 text-sm text-v2-muted">במובייל כל שורה תוצג ככרטיס מוצר, לא כטבלה חתוכה.</p>
          </div>
          <label className="block border-t border-[#eef3f8] p-4 text-sm font-bold text-v2-muted">הערות לקליטה
            <textarea aria-label="הערות לקליטה" disabled rows={3} placeholder="ההערות יישמרו רק עם קליטה מאושרת" className="mt-2 w-full rounded-[14px] border border-[#dbe4ee] bg-[#f8fafc] px-3 py-2 font-normal" />
          </label>
        </section>
      </div>

      <footer className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" disabled title="סגירת יתרה אינה מגדילה מלאי, והפעולה כבויה" className="h-12 rounded-[14px] border border-[#dbe4ee] bg-white px-4 font-bold opacity-60">סגור יתרה שלא סופקה</button>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" disabled className="h-12 rounded-[14px] border border-[#dbe4ee] bg-white px-4 font-bold opacity-60">שמור טיוטה</button>
          <button type="button" disabled className="inline-flex h-12 items-center justify-center gap-2 rounded-[14px] bg-[#12b981] px-5 font-extrabold text-white opacity-50">
            <CheckCircle2 className="h-4 w-4" aria-hidden />אישור קליטה
          </button>
        </div>
      </footer>
      <p className="mt-2 text-xs text-v2-muted">טיוטה {canReceive('draft') ? 'פתוחה לקליטה' : 'סגורה לקליטה'}. קליטה חלקית ומלאה מחשבות רק יתרה פתוחה, ומחיר שסוכם בהזמנה אינו נדרס.</p>
    </div>
  );
};

const ClipboardMark = Package;

const Info: React.FC<{ icon: React.FC<{ className?: string }>; label: string; value: string; tone?: string }> = ({ icon: Icon, label, value, tone }) => (
  <article className="flex items-center justify-between gap-3 rounded-[18px] border border-[#e6eef6] bg-white px-4 py-3 shadow-sm">
    <div>
      <p className="text-xs font-bold text-v2-muted">{label}</p>
      <p className={`mt-1 text-lg font-extrabold ${tone ?? ''}`}>{value}</p>
    </div>
    <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#f4f7fb] text-[#12a37a]" aria-hidden><Icon className="h-5 w-5" /></span>
  </article>
);
