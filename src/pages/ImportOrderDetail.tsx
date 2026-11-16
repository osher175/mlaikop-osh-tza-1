import React, { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, ClipboardList, FileText, History, Loader2, Lock, Package, Ship, Truck, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImportPinGate } from '@/components/import/ImportPinGate';
import { StepOrderDetails } from '@/components/import/wizard/StepOrderDetails';
import { StepCosts } from '@/components/import/wizard/StepCosts';
import { DocumentsCard } from '@/components/import/wizard/DocumentsCard';
import { LogisticsRail } from '@/components/import/center/LogisticsRail';
import { ProductCatalogPanel } from '@/components/import/catalog/ProductCatalogPanel';
import { ShipmentReadout } from '@/components/import/detail/ShipmentReadout';
import { ReceivingDialog } from '@/components/import/ReceivingDialog';
import { DeleteImportOrderDialog } from '@/components/import/DeleteImportOrderDialog';
import { useImportOrder, EVENT_TYPE_LABELS } from '@/hooks/useImportOrder';
import { useImportReceiving } from '@/hooks/useImportReceiving';
import { useDeleteImportOrder, IMPORT_STATUS_LABELS } from '@/hooks/useImportOrders';
import { useImportDashboard } from '@/hooks/useImportDashboard';
import { milestoneDates } from '@/components/import/journey/importJourney';
import { paidImportIls } from '@/lib/v2/importPaymentMath';
import { formatCurrency } from '@/lib/formatCurrency';
import {
  buildOrderCard,
  canOpenLegacyReceiving,
  commercialLabel,
  formatMoney,
  mapItemRow,
  mapOrderRow,
  mapPaymentRow,
  orderDetailView,
  todayIso,
} from '@/lib/v2/importDashboardMetrics';
import {
  FUTURE_RECEIVING_LABEL,
  orderHref,
  orderTabFromSearch,
  rememberedImportCenterHref,
} from '@/lib/v2/importCenterNavigation';

const ImportOrderDetailContent: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = orderTabFromSearch(searchParams.toString());
  const returnHref = rememberedImportCenterHref();
  const [receivingOpen, setReceivingOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteOrder = useDeleteImportOrder();
  const {
    order, items, costs, payments, documents, events, landedCost, costSummary,
    updateOrder, updateStatus, addItem, updateItem, deleteItem, addCost, finalizeCost,
    addPayment, uploadDocument, openDocument,
  } = useImportOrder(id);
  const { linkProduct, createAndLinkProduct } = useImportReceiving(id);
  const dashboard = useImportDashboard();

  const orderRow = order.data;
  const isReadOnly = orderRow?.status === 'cancelled' || orderRow?.status === 'completed';
  const today = todayIso();
  const card = useMemo(() => {
    if (!orderRow) return null;
    return buildOrderCard(
      mapOrderRow(orderRow as never),
      (items.data ?? []).map((row) => mapItemRow(row)),
      (payments.data ?? []).map((row) => mapPaymentRow(row)),
      today,
    );
  }, [orderRow, items.data, payments.data, today]);

  const neighbors = useMemo(() => {
    const list = dashboard.data?.orders ?? [];
    const index = list.findIndex((row) => row.id === id);
    return {
      previous: index > 0 ? list[index - 1] : null,
      next: index >= 0 && index < list.length - 1 ? list[index + 1] : null,
    };
  }, [dashboard.data, id]);

  const dates = useMemo(() => milestoneDates(events.data ?? []), [events.data]);
  const linkedProductIds = (items.data ?? []).map((item) => item.product_id).filter((value): value is string => !!value);
  const receivingAllowed = card ? canOpenLegacyReceiving(card.order.status, card.receivedQuantity) : false;
  const expenses = Number(costSummary.data?.effective_total_ils ?? 0);
  const estimatedExpenses = Number(costSummary.data?.estimated_total_ils ?? expenses);
  const paidIls = paidImportIls(payments.data ?? []);

  const detailView = orderDetailView({
    isLoading: order.isLoading,
    isError: order.isError,
    hasOrder: !!orderRow && !!card,
  });

  if (detailView === 'loading') {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground" dir="rtl">
        <Loader2 className="h-5 w-5 animate-spin ml-2" />
        טוען הזמנת יבוא…
      </div>
    );
  }

  if (detailView === 'error') {
    return (
      <div className="space-y-4" dir="rtl">
        <Button variant="outline" className="min-h-[44px] w-full sm:w-auto" onClick={() => navigate(returnHref)}>חזרה למרכז הייבוא</Button>
        <p>לא ניתן לטעון את ההזמנה. זו אינה הזמנה ריקה, ולא הוצגה הזמנה לדוגמה.</p>
      </div>
    );
  }

  if (detailView === 'missing' || !orderRow || !card) {
    return (
      <div className="space-y-4" dir="rtl">
        <Button variant="outline" className="min-h-[44px] w-full sm:w-auto" onClick={() => navigate(returnHref)}>חזרה למרכז הייבוא</Button>
        <p>לא נמצאה הזמנה עם המזהה הזה, או שאין הרשאה לצפות בה. לא הוצגה הזמנה לדוגמה.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" className="h-10 px-2" onClick={() => navigate(returnHref)}>
          <ArrowRight className="h-4 w-4 ml-1" />
          חזרה לרשימת ההזמנות
        </Button>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-9 w-9" disabled={!neighbors.previous} onClick={() => neighbors.previous && navigate(orderHref(neighbors.previous.id, activeTab))} aria-label="הזמנה קודמת">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" disabled={!neighbors.next} onClick={() => neighbors.next && navigate(orderHref(neighbors.next.id, activeTab))} aria-label="הזמנה הבאה">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-muted-foreground">פרטי הזמנת יבוא</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{card.order.importNumber}</h1>
          <p className="text-base">{card.order.supplierName}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-transparent">
              <Ship className="h-3.5 w-3.5 ml-1" />
              {IMPORT_STATUS_LABELS[card.order.status] ?? card.order.status}
            </Badge>
            <Badge variant="outline">מסחרי: {commercialLabel(card.order.commercialStatus)}</Badge>
            <span className="text-sm text-muted-foreground">
              צפי הגעה: {card.order.estimatedArrival ?? 'לא הוגדר'}
              {arrivalHint(card.order.estimatedArrival)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-10 rounded-xl" disabled title="עדכון משלוח יגיע בשלב הבא">
            <Truck className="h-4 w-4 ml-2" />
            עדכון משלוח
          </Button>
          <Button variant="secondary" className="h-10 rounded-xl" disabled title="מסך הקליטה החדש אינו פעיל">
            <Lock className="h-4 w-4 ml-2" />
            {FUTURE_RECEIVING_LABEL}
          </Button>
        </div>
      </header>

      <section className="rounded-2xl border bg-card px-3 py-3 overflow-x-auto">
        <LogisticsRail status={card.order.status} dates={dates} />
        <p className="text-[11px] text-muted-foreground mt-2">
          הציר מציג את סטטוס הלוגיסטיקה השמור. תשלום לספק אינו מסמן שלב במשלוח.
        </p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
        <Summary title="פרטי הזמנה" soft>
          <Line label="תאריך" value={card.order.orderDate} />
          <Line label="מטבע" value={card.order.currencyCode} />
          <Line label="כמות" value={card.tireQuantity.toLocaleString('he-IL')} />
          <Line label="שווי סחורה" value={card.goodsAmount == null ? 'לא ידוע' : formatMoney(card.goodsAmount, card.order.currencyCode)} />
        </Summary>
        <Summary title="תשלומים לספק">
          <Line label="שולם באותו מטבע" value={formatMoney(card.paidAmount, card.order.currencyCode)} />
          <Line label="אחוז מהסחורה" value={card.paymentPercent == null ? 'לא מחושב' : `${card.paymentPercent}%`} />
          <Line label="שולם בש״ח (רישומים)" value={formatCurrency(paidIls)} />
        </Summary>
        <Summary title="הוצאות יבוא">
          <Line label="אפקטיבי בש״ח" value={formatCurrency(expenses)} />
          <Line label="משוער בש״ח" value={costSummary.data ? formatCurrency(estimatedExpenses) : 'לא זמין'} />
          <p className="text-xs text-muted-foreground">הקצאת עלויות ליחידה אינה זמינה בשלב זה.</p>
        </Summary>
        <Summary title="מצב">
          <Line label="מסחרי" value={commercialLabel(card.order.commercialStatus)} />
          <Line label="לוגיסטי" value={IMPORT_STATUS_LABELS[card.order.status] ?? card.order.status} />
          <Line label="הגעה בפועל" value={card.order.actualArrival ?? 'לא נרשמה'} />
          {card.delayed && <p className="text-xs text-amber-700">תאריך ההגעה הצפוי עבר.</p>}
        </Summary>
      </section>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setSearchParams(value === 'products' ? {} : { tab: value }, { replace: true })}
        className="space-y-4"
      >
        <TabsList className="h-auto w-full max-w-full justify-start gap-1 overflow-x-auto bg-transparent p-0">
          <TabsTrigger value="products" className={tabClass}><Package className="h-4 w-4 ml-1" />מוצרים ({(items.data ?? []).length})</TabsTrigger>
          <TabsTrigger value="payments" className={tabClass}><Wallet className="h-4 w-4 ml-1" />תשלומים</TabsTrigger>
          <TabsTrigger value="shipping" className={tabClass}><Truck className="h-4 w-4 ml-1" />שילוח</TabsTrigger>
          <TabsTrigger value="expenses" className={tabClass}><ClipboardList className="h-4 w-4 ml-1" />הוצאות יבוא</TabsTrigger>
          <TabsTrigger value="receipts" className={tabClass}><Package className="h-4 w-4 ml-1" />קליטות</TabsTrigger>
          <TabsTrigger value="documents" className={tabClass}><FileText className="h-4 w-4 ml-1" />מסמכים</TabsTrigger>
          <TabsTrigger value="history" className={tabClass}><History className="h-4 w-4 ml-1" />היסטוריה</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <StepOrderDetails
            order={orderRow}
            items={items.data ?? []}
            updateOrder={updateOrder}
            addItem={addItem}
            updateItem={updateItem}
            deleteItem={deleteItem}
            linkProduct={linkProduct}
            createAndLinkProduct={createAndLinkProduct}
            isReadOnly={isReadOnly}
            landed={landedCost.data ?? []}
          />
          <ProductCatalogPanel businessId={orderRow.business_id} productIds={linkedProductIds} />
        </TabsContent>

        <TabsContent value="payments">
          <StepCosts
            focus="payments"
            order={orderRow}
            costs={costs.data ?? []}
            payments={payments.data ?? []}
            landed={landedCost.data ?? []}
            costSummary={costSummary.data}
            documents={documents.data ?? []}
            addCost={addCost}
            finalizeCost={finalizeCost}
            addPayment={addPayment}
            uploadDocument={uploadDocument}
            openDocument={openDocument}
            isReadOnly={isReadOnly}
          />
        </TabsContent>

        <TabsContent value="shipping" className="space-y-3">
          <ShipmentReadout businessId={orderRow.business_id} orderId={orderRow.id} />
          <div className="rounded-2xl border p-4 space-y-2">
            <p className="font-medium">סטטוס לוגיסטי שמור על ההזמנה</p>
            <p className="text-sm">{IMPORT_STATUS_LABELS[card.order.status] ?? card.order.status}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="min-h-[44px]"
                disabled={isReadOnly || updateStatus.isPending}
                onClick={() => {
                  const next = nextLogisticsStatus(card.order.status);
                  if (next) updateStatus.mutate(next);
                }}
              >
                {nextLogisticsStatus(card.order.status) ? `עדכון סטטוס: ${IMPORT_STATUS_LABELS[nextLogisticsStatus(card.order.status)!]}` : 'אין שלב לוגיסטי הבא'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">הכפתור מעדכן רק את סטטוס ההזמנה הקיים. הוא לא יוצר משלוח, מכולה או קליטה.</p>
          </div>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            שורות ההוצאה הקיימות נשארות. הקצאה משותפת, חותם עלות ועלות נחיתה חדשה אינם זמינים.
          </p>
          <StepCosts
            focus="expenses"
            order={orderRow}
            costs={costs.data ?? []}
            payments={payments.data ?? []}
            landed={landedCost.data ?? []}
            costSummary={costSummary.data}
            documents={documents.data ?? []}
            addCost={addCost}
            finalizeCost={finalizeCost}
            addPayment={addPayment}
            uploadDocument={uploadDocument}
            openDocument={openDocument}
            isReadOnly={isReadOnly}
          />
        </TabsContent>

        <TabsContent value="receipts" className="space-y-3">
          <div className="rounded-2xl border p-4 space-y-3">
            <p className="font-medium">קליטות שכבר נרשמו</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[280px] text-sm">
                <thead>
                  <tr className="text-muted-foreground text-right">
                    <th className="py-2 font-medium">פריט</th>
                    <th className="py-2 font-medium">הוזמן</th>
                    <th className="py-2 font-medium">נקלט</th>
                  </tr>
                </thead>
                <tbody>
                  {(items.data ?? []).map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="py-2">{item.product_description}</td>
                      <td className="py-2">{item.ordered_quantity}</td>
                      <td className="py-2">{item.received_quantity ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button className="min-h-[44px] w-full sm:w-auto" disabled={!receivingAllowed} onClick={() => receivingAllowed && setReceivingOpen(true)}>
              {!receivingAllowed && <Lock className="h-4 w-4 ml-2" />}
              {card.receivedQuantity > 0 ? 'המשך קליטה במסלול הקיים' : 'קליטה במסלול הקיים'}
            </Button>
            <p className="text-xs text-muted-foreground">
              זהו חלון הקליטה שכבר קיים במערכת. הוא נפתח אחרי סימון הגעה למחסן, או כשכבר נרשמה כמות שנקלטה.
              הכפתור «{FUTURE_RECEIVING_LABEL}» בכותרת נשאר כבוי ואין לו כתובת.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsCard
            documents={documents.data ?? []}
            uploadDocument={uploadDocument}
            openDocument={openDocument}
            isReadOnly={isReadOnly}
          />
        </TabsContent>

        <TabsContent value="history">
          <div className="rounded-2xl border divide-y">
            {(events.data ?? []).length === 0 && (
              <p className="p-6 text-sm text-muted-foreground text-center">אין אירועים שמורים להזמנה.</p>
            )}
            {(events.data ?? []).map((event) => (
              <div key={event.id} className="p-4 flex flex-wrap items-center justify-between gap-2">
                <span>{EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}</span>
                <span className="text-sm text-muted-foreground">{new Date(event.created_at).toLocaleString('he-IL')}</span>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-start">
        <Button variant="outline" className="text-destructive min-h-[44px]" disabled={isReadOnly} onClick={() => setDeleteOpen(true)}>
          מחיקת הזמנה
        </Button>
      </div>

      <ReceivingDialog
        open={receivingOpen}
        onOpenChange={setReceivingOpen}
        orderId={orderRow.id}
        businessId={orderRow.business_id}
        items={items.data ?? []}
      />
      <DeleteImportOrderDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        importNumber={orderRow.import_number}
        isDeleting={deleteOrder.isPending}
        onConfirm={(pin) => deleteOrder.mutate({ orderId: orderRow.id, pin }, { onSuccess: () => navigate(returnHref) })}
      />
    </div>
  );
};

const NEXT_STATUS: Record<string, string> = {
  ordered: 'preparing',
  preparing: 'shipped',
  shipped: 'in_transit',
  in_transit: 'arrived_israel',
  arrived_israel: 'customs_clearance',
  customs_clearance: 'receiving',
  receiving: 'received_pending_costs',
  received_pending_costs: 'completed',
};

function nextLogisticsStatus(status: string): string | null {
  return NEXT_STATUS[status] ?? null;
}

const tabClass = 'h-10 shrink-0 rounded-xl px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none';

function arrivalHint(date: string | null): string {
  if (!date) return '';
  const today = todayIso();
  const [y1, m1, d1] = date.split('-').map(Number);
  const [y2, m2, d2] = today.split('-').map(Number);
  const days = Math.round((Date.UTC(y1, (m1 || 1) - 1, d1 || 1) - Date.UTC(y2, (m2 || 1) - 1, d2 || 1)) / 86400000);
  if (days > 0) return ` (עוד ${days} ימים)`;
  if (days < 0) return ` (עברו ${Math.abs(days)} ימים)`;
  return ' (היום)';
}

const Summary: React.FC<{ title: string; children: React.ReactNode; soft?: boolean }> = ({ title, children, soft }) => (
  <article className={`rounded-2xl border px-3.5 py-3 space-y-1.5 shadow-sm ${soft ? 'border-primary/25 bg-primary/10' : 'bg-card'}`}>
    <h2 className="text-sm font-semibold">{title}</h2>
    {children}
  </article>
);

const Line: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <p className="text-sm flex items-center justify-between gap-3">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium">{value}</span>
  </p>
);

export const ImportOrderDetail: React.FC = () => (
  <ImportPinGate>
    <ImportOrderDetailContent />
  </ImportPinGate>
);

export default ImportOrderDetail;
