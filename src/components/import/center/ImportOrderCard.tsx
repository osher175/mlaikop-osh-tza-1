import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Calendar, ChevronDown, Coins, CreditCard, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IMPORT_STATUS_LABELS } from '@/hooks/useImportOrders';
import { formatMoney, LOGISTICS_STAGES, logisticsStageIndex, stageProgressLabel, todayIso, type OrderCardModel } from '@/lib/v2/importDashboardMetrics';
import { orderHref } from '@/lib/v2/importCenterNavigation';
import { LogisticsRail, LogisticsStageIcon } from './LogisticsRail';

interface Props {
  card: OrderCardModel;
  onDelete: () => void;
}

const navy = 'text-[hsl(var(--v2-navy))]';
const muted = 'text-[hsl(var(--v2-muted))]';
const line = 'border-[hsl(var(--v2-border))]';

/**
 * Two-level order card. Payment percent is paid supplier amount divided by known goods value.
 * The lower progress cell is a stage count, not a percent derived from the stage index.
 */
export const ImportOrderCard: React.FC<Props> = ({ card, onDelete }) => {
  const { order } = card;
  const percent = card.paymentPercent;
  const width = percent == null ? 0 : Math.min(100, Math.max(0, percent));
  const stageIndex = logisticsStageIndex(order.status);
  const lateDays = order.estimatedArrival && card.delayed ? daysPast(order.estimatedArrival, todayIso()) : 0;
  const cancelled = order.status === 'cancelled';

  return (
    <article className={`rounded-2xl border bg-white px-5 py-5 shadow-[var(--v2-shadow)] ${line}`} dir="rtl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <div className="min-w-0 shrink-0 xl:w-52">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`text-xl font-bold tracking-tight ${navy}`}>{order.importNumber}</h3>
            <Badge className={cancelled
              ? 'gap-1 border-transparent bg-[hsl(var(--v2-red-soft))] font-medium text-[hsl(var(--v2-red))] hover:bg-[hsl(var(--v2-red-soft))]'
              : 'gap-1 border-transparent bg-[hsl(var(--v2-green-soft))] font-medium text-[hsl(var(--v2-green))] hover:bg-[hsl(var(--v2-green-soft))]'}>
              {!cancelled && <LogisticsStageIcon status={order.status} className="h-3.5 w-3.5" />}
              {IMPORT_STATUS_LABELS[order.status] ?? order.status}
            </Badge>
          </div>
          <p className={`mt-1 truncate text-base font-medium ${navy}`}>{order.supplierName}</p>
          <p className={`truncate text-sm ${muted}`}>
            {card.brands.length > 0 ? `${card.brands.join(' · ')} · ` : ''}
            {order.orderDate}
          </p>
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto">
          <LogisticsRail status={order.status} variant="card" />
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 xl:w-44">
          {card.delayed && (
            <p className="flex items-center gap-1.5 rounded-full bg-[hsl(var(--v2-red-soft))] px-2.5 py-1 text-sm font-medium text-[hsl(var(--v2-red))]">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              עיכוב צפוי{lateDays > 0 ? ` · ${lateDays} ימים` : ''}
            </p>
          )}
          <Button asChild variant="outline" className={`h-11 rounded-xl bg-white shadow-none ${line} ${navy}`}>
            <Link to={orderHref(order.id)}>
              <Eye className="h-4 w-4" />
              פרטים
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className={`h-11 rounded-xl bg-white shadow-none ${line} ${navy}`} aria-label={`פעולות ${order.importNumber}`}>
                פעולות
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem className="text-destructive" onClick={onDelete}>מחיקת הזמנה</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className={`mt-4 grid grid-cols-2 gap-y-3 border-t pt-4 md:grid-cols-3 xl:grid-cols-5 ${line}`}>
        <Metric icon={<TireMark className="h-3.5 w-3.5 text-[hsl(var(--v2-green))]" />} label="כמות צמיגים" value={card.tireQuantity.toLocaleString('he-IL')} />
        <Metric
          icon={<Coins className="h-3.5 w-3.5 text-[hsl(var(--v2-green))]" strokeWidth={1.75} />}
          label="שווי הזמנה"
          value={card.goodsAmount == null ? 'לא ידוע' : formatMoney(card.goodsAmount, order.currencyCode)}
          mutedValue={card.goodsAmount == null}
        />
        <div className={`px-1 xl:border-r xl:px-4 ${line}`}>
          <p className={`flex items-center gap-1.5 text-xs ${muted}`}>
            <CreditCard className="h-3.5 w-3.5 text-[hsl(var(--v2-blue))]" strokeWidth={1.75} />
            תשלום לספק
          </p>
          <p className={`mt-1 text-lg font-bold leading-none ${percent == null ? muted : 'text-[hsl(var(--v2-blue))]'}`}>
            {percent == null ? 'לא מחושב' : `${percent}%`}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--v2-blue-soft))]">
            <div className="h-full bg-[hsl(var(--v2-blue))]" style={{ width: `${width}%` }} />
          </div>
          <p className={`mt-1 text-xs ${muted}`}>{formatMoney(card.paidAmount, order.currencyCode)}</p>
        </div>
        <Metric
          icon={<LogisticsStageIcon status={order.status} className="h-3.5 w-3.5 text-[hsl(var(--v2-green))]" />}
          label="התקדמות"
          value={stageIndex < 0 ? stageProgressLabel(order.status) : `${stageIndex + 1} מתוך ${LOGISTICS_STAGES.length}`}
          hint={stageIndex < 0 ? undefined : LOGISTICS_STAGES[stageIndex].label}
          tone={stageIndex < 0 ? 'muted' : 'green'}
        />
        <div className={`px-1 xl:border-r xl:px-4 ${line}`}>
          <p className={`flex items-center gap-1.5 text-xs ${muted}`}>
            <Calendar className="h-3.5 w-3.5" strokeWidth={1.75} />
            צפי הגעה
          </p>
          <p className={`mt-1 text-lg font-bold leading-none ${card.delayed ? 'text-[hsl(var(--v2-red))]' : order.estimatedArrival ? navy : muted}`}>
            {order.estimatedArrival ?? 'לא הוגדר'}
          </p>
          {card.approaching && !card.delayed && <p className="mt-1 text-xs text-[hsl(var(--v2-green))]">בתוך 7 ימים</p>}
        </div>
      </div>
    </article>
  );
};

const Metric: React.FC<{
  icon?: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  mutedValue?: boolean;
  tone?: 'navy' | 'green' | 'muted';
}> = ({ icon, label, value, hint, mutedValue, tone = 'navy' }) => (
  <div className={`px-1 xl:border-r xl:px-4 first:xl:border-r-0 ${line}`}>
    <p className={`flex items-center gap-1.5 text-xs ${muted}`}>
      {icon}
      {label}
    </p>
    <p className={`mt-1 text-lg font-bold leading-none ${mutedValue || tone === 'muted' ? muted : tone === 'green' ? 'text-[hsl(var(--v2-green))]' : navy}`}>
      {value}
    </p>
    {hint && <p className={`mt-1 text-xs ${tone === 'green' ? 'text-[hsl(var(--v2-green))]' : muted}`}>{hint}</p>}
  </div>
);

function TireMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 4.5v2.2M12 17.3v2.2M4.5 12h2.2M17.3 12h2.2M6.6 6.6l1.6 1.6M15.8 15.8l1.6 1.6M17.4 6.6l-1.6 1.6M8.2 15.8l-1.6 1.6" />
    </svg>
  );
}

function daysPast(arrival: string, today: string): number {
  const [y1, m1, d1] = arrival.split('-').map(Number);
  const [y2, m2, d2] = today.split('-').map(Number);
  const start = Date.UTC(y1, (m1 || 1) - 1, d1 || 1);
  const end = Date.UTC(y2, (m2 || 1) - 1, d2 || 1);
  return Math.max(0, Math.round((end - start) / 86400000));
}
