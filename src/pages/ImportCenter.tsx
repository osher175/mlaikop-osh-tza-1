import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Coins, CreditCard, Filter, Loader2, Plus, Search, Ship, Warehouse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ImportPinGate } from '@/components/import/ImportPinGate';
import { CreateImportOrderDialog } from '@/components/import/CreateImportOrderDialog';
import { DeleteImportOrderDialog } from '@/components/import/DeleteImportOrderDialog';
import { ImportOrderCard } from '@/components/import/center/ImportOrderCard';
import { IMPORT_STATUS_LABELS, useDeleteImportOrder } from '@/hooks/useImportOrders';
import { useImportDashboard } from '@/hooks/useImportDashboard';
import {
  buildOrderCard,
  dashboardView,
  filterCards,
  formatMoney,
  isActiveStatus,
  summarizeKpis,
  todayIso,
  type DashboardFilters,
} from '@/lib/v2/importDashboardMetrics';
import { filtersFromSearch, filtersToSearch, rememberImportCenterSearch } from '@/lib/v2/importCenterNavigation';

const ImportCenterContent: React.FC = () => {
  const dashboard = useImportDashboard();
  const deleteOrder = useDeleteImportOrder();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromSearch(searchParams.toString()), [searchParams]);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; importNumber: string } | null>(null);
  const today = todayIso();

  useEffect(() => {
    rememberImportCenterSearch(searchParams.toString());
  }, [searchParams]);

  const updateFilters = (patch: Partial<DashboardFilters>) => {
    setSearchParams(filtersToSearch({ ...filters, ...patch }), { replace: true });
  };

  const cards = useMemo(() => {
    if (!dashboard.data) return [];
    return dashboard.data.orders.map((order) => buildOrderCard(order, dashboard.data.items, dashboard.data.payments, today));
  }, [dashboard.data, today]);

  const visible = useMemo(() => filterCards(cards, filters, today), [cards, filters, today]);
  const kpis = useMemo(() => summarizeKpis(visible), [visible]);
  const view = dashboardView({
    isLoading: dashboard.isLoading,
    isError: dashboard.isError,
    orderCount: cards.length,
    visibleCount: visible.length,
  });
  const closedInView = visible.filter((card) => !isActiveStatus(card.order.status)).length;
  const suppliers = useMemo(() => {
    const map = new Map<string, string>();
    cards.forEach((card) => {
      if (card.order.supplierId) map.set(card.order.supplierId, card.order.supplierName);
    });
    return [...map.entries()];
  }, [cards]);

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Ship className="h-9 w-9 shrink-0 text-[hsl(var(--v2-navy))]" strokeWidth={1.75} />
          <div>
            <h1 className="text-[2.15rem] font-bold leading-none text-[hsl(var(--v2-navy))] md:text-[2.4rem]">מרכז הייבוא</h1>
            <p className="mt-2 text-lg text-[hsl(var(--v2-muted))]">ניהול הזמנות יבוא, משלוחים, תשלומים וקליטת סחורה</p>
          </div>
        </div>
        <Button className="h-14 gap-2 rounded-xl bg-[hsl(var(--v2-green))] px-6 text-base text-white shadow-sm hover:bg-[hsl(141_90%_24%)]" onClick={() => setCreateOpen(true)}>
          הזמנה חדשה
          <Plus className="h-5 w-5" strokeWidth={2.25} />
        </Button>
      </div>

      {dashboard.isLoading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin ml-2" />
          טוען הזמנות יבוא…
        </div>
      )}

      {dashboard.isError && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          לא ניתן לטעון את הזמנות היבוא. הרענון לא משנה נתונים.
        </div>
      )}

      {!dashboard.isLoading && !dashboard.isError && (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard
              highlight
              icon={<Ship className="h-7 w-7" strokeWidth={1.75} />}
              label="הזמנות פעילות"
              value={kpis.activeOrders.toLocaleString('he-IL')}
              hint="בלי הושלמו ובלי בוטלו"
            />
            <KpiCard
              icon={<TireMark className="h-7 w-7" />}
              label="סה״כ צמיגים בהזמנות"
              value={kpis.tireQuantity.toLocaleString('he-IL')}
              hint="כמות שהוזמנה בהזמנות הפעילות"
            />
            <KpiCard
              icon={<Coins className="h-7 w-7" strokeWidth={1.75} />}
              label="שווי הזמנות כולל"
              value={kpis.valueByCurrency.length === 0 ? '0' : moneyLines(kpis.valueByCurrency)}
              hint={kpis.valueByCurrency.length === 0
                ? 'אין הזמנות פעילות. סכומים לא מחוברים בין מטבעות.'
                : kpis.valueByCurrency.some((row) => row.incomplete) ? 'יש הזמנות בלי מחיר ספק' : 'כל מטבע בנפרד'}
            />
            <KpiCard
              icon={<CreditCard className="h-7 w-7" strokeWidth={1.75} />}
              label="שולם עד כה"
              value={kpis.paidByCurrency.length === 0 ? '0' : paidLines(kpis.paidByCurrency)}
              hint="תשלום לספק באותו מטבע בלבד"
            />
            <KpiCard
              icon={<Warehouse className="h-7 w-7" strokeWidth={1.75} />}
              label="צפויות לקליטה"
              value={kpis.approachingReceipt.toLocaleString('he-IL')}
              hint="הגעה צפויה בשבעת הימים הקרובים"
            />
          </section>

          <section className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.5fr)_1fr_1fr_1fr_auto]">
            <div className="relative md:col-span-2 xl:col-span-1">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--v2-muted))]" strokeWidth={1.75} />
              <Input
                className="h-12 rounded-xl border-[hsl(var(--v2-border))] bg-white pr-9 text-base text-[hsl(var(--v2-navy))]"
                placeholder="חיפוש לפי מספר הזמנה, ספק או דגם"
                value={filters.search}
                onChange={(event) => updateFilters({ search: event.target.value })}
              />
            </div>
            <Select value={filters.status || 'all'} onValueChange={(value) => updateFilters({ status: value === 'all' ? '' : value })}>
              <SelectTrigger className="h-12 rounded-xl border-[hsl(var(--v2-border))] bg-white text-base text-[hsl(var(--v2-navy))]"><SelectValue placeholder="סטטוס" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                {Object.entries(IMPORT_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.supplierId || 'all'} onValueChange={(value) => updateFilters({ supplierId: value === 'all' ? '' : value })}>
              <SelectTrigger className="h-12 rounded-xl border-[hsl(var(--v2-border))] bg-white text-base text-[hsl(var(--v2-navy))]"><SelectValue placeholder="ספק" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הספקים</SelectItem>
                {suppliers.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.period} onValueChange={(value) => updateFilters({ period: value as DashboardFilters['period'] })}>
              <SelectTrigger className="h-12 rounded-xl border-[hsl(var(--v2-border))] bg-white text-base text-[hsl(var(--v2-navy))]"><SelectValue placeholder="תקופה" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל התקופות</SelectItem>
                <SelectItem value="30">30 הימים האחרונים</SelectItem>
                <SelectItem value="90">90 הימים האחרונים</SelectItem>
                <SelectItem value="year">השנה</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-12 w-12 rounded-xl border-[hsl(var(--v2-border))] bg-white text-[hsl(var(--v2-navy))] shadow-none" aria-label="סינון נוסף">
                  <Filter className="h-5 w-5" strokeWidth={1.75} />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 space-y-3" dir="rtl">
                <p className="text-sm font-semibold">סינון ההזמנות</p>
                <p className="text-xs text-muted-foreground">אלה הסינונים הנתמכים. אין שכבת סינון נוספת.</p>
                <Button
                  variant="outline"
                  className="h-10 w-full"
                  onClick={() => updateFilters({ search: '', status: '', supplierId: '', period: 'all' })}
                >
                  נקה סינון
                </Button>
              </PopoverContent>
            </Popover>
          </section>

          {closedInView > 0 && kpis.activeOrders === 0 && (
            <p className="text-sm text-muted-foreground">
              המדדים הם אפס כי ההזמנות ברשימה הושלמו או בוטלו. הכרטיסים נשארים, והם לא נספרים כהזמנות פעילות.
            </p>
          )}

          {view === 'empty' ? (
            <div className="rounded-2xl border border-dashed bg-card p-8 md:p-12 text-center space-y-3">
              <h2 className="text-xl font-semibold">עדיין לא נפתחו הזמנות יבוא</h2>
              <p className="text-sm text-muted-foreground max-w-xl mx-auto">
                צור את הזמנת היבוא הראשונה כדי להתחיל לנהל ספקים, משלוחים, תשלומים וקליטת סחורה.
              </p>
              <Button className="h-12 gap-2 rounded-xl bg-[hsl(var(--v2-green))] text-white hover:bg-[hsl(141_90%_24%)]" onClick={() => setCreateOpen(true)}>
                הזמנה חדשה
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          ) : view === 'filtered-empty' ? (
            <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
              אין הזמנות שמתאימות לסינון.
            </div>
          ) : (
            <div className="space-y-2.5">
              {visible.map((card) => (
                <ImportOrderCard
                  key={card.order.id}
                  card={card}
                  onDelete={() => setDeleteTarget({ id: card.order.id, importNumber: card.order.importNumber })}
                />
              ))}
            </div>
          )}
        </>
      )}

      <CreateImportOrderDialog open={createOpen} onOpenChange={setCreateOpen} />
      <DeleteImportOrderDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        importNumber={deleteTarget?.importNumber}
        isDeleting={deleteOrder.isPending}
        onConfirm={(pin) => {
          if (!deleteTarget) return;
          deleteOrder.mutate(
            { orderId: deleteTarget.id, pin },
            { onSuccess: () => setDeleteTarget(null) },
          );
        }}
      />
    </div>
  );
};

const KpiCard: React.FC<{ highlight?: boolean; icon: React.ReactNode; label: string; value: React.ReactNode; hint: string }> = ({
  highlight, icon, label, value, hint,
}) => (
  <article className={`flex min-h-[108px] flex-col justify-between rounded-2xl border px-4 py-3 shadow-[var(--v2-shadow)] ${highlight ? 'border-[hsl(var(--v2-green-soft))] bg-[hsl(var(--v2-green-soft))]' : 'border-[hsl(var(--v2-border))] bg-white'}`}>
    <div className="flex items-start justify-between gap-2">
      <span className="text-sm text-[hsl(var(--v2-muted))]">{label}</span>
      <span className="shrink-0 text-[hsl(var(--v2-green))]">{icon}</span>
    </div>
    <div>
      <div className="text-3xl font-bold leading-none text-[hsl(var(--v2-navy))]">{value}</div>
      <p className="mt-1.5 text-xs leading-snug text-[hsl(var(--v2-muted))]">{hint}</p>
    </div>
  </article>
);

function moneyLines(rows: { currency: string; amount: number; incomplete: boolean }[]) {
  if (rows.length === 0) return '0';
  return (
    <span className="block space-y-1">
      {rows.map((row) => (
        <span key={row.currency} className="block text-xl">
          {formatMoney(row.amount, row.currency)}
          {row.incomplete ? ' +' : ''}
        </span>
      ))}
    </span>
  );
}

function paidLines(rows: { currency: string; paid: number; percent: number | null }[]) {
  if (rows.length === 0) return '0';
  return (
    <span className="block space-y-1">
      {rows.map((row) => (
        <span key={row.currency} className="block text-xl">
          {formatMoney(row.paid, row.currency)}
          <span className="mr-2 text-sm font-semibold text-[hsl(var(--v2-green))]">
            {row.percent == null ? '' : `${row.percent}%`}
          </span>
        </span>
      ))}
    </span>
  );
}

function TireMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 4.5v2.2M12 17.3v2.2M4.5 12h2.2M17.3 12h2.2M6.6 6.6l1.6 1.6M15.8 15.8l1.6 1.6M17.4 6.6l-1.6 1.6M8.2 15.8l-1.6 1.6" />
    </svg>
  );
}

export const ImportCenter: React.FC = () => (
  <ImportPinGate>
    <ImportCenterContent />
  </ImportPinGate>
);

export default ImportCenter;
