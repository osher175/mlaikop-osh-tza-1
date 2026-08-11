import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ImportPinGate } from '@/components/import/ImportPinGate';
import { ImportStepper, ImportStepKey } from '@/components/import/wizard/ImportStepper';
import { StepOrderDetails } from '@/components/import/wizard/StepOrderDetails';
import { StepCosts } from '@/components/import/wizard/StepCosts';
import { StepReceiving } from '@/components/import/wizard/StepReceiving';
import { StepSummary } from '@/components/import/wizard/StepSummary';

import { useImportOrder, EVENT_TYPE_LABELS } from '@/hooks/useImportOrder';
import { useImportReceiving } from '@/hooks/useImportReceiving';
import { IMPORT_STATUSES, IMPORT_STATUS_LABELS, PURCHASE_TYPE_LABELS } from '@/hooks/useImportOrders';

/**
 * Guided 4-step import experience.
 *
 * This file is a UX shell only: every mutation still goes through the existing,
 * already-verified hooks and RPCs. Receiving is untouched — stock moves only via
 * `import_receipt_confirm` inside ReceivingPanel.
 */
const ImportOrderDetailContent: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    order, items, costs, payments, documents, events, landedCost, costSummary,
    updateStatus, updateOrder, addItem, updateItem, deleteItem,
    addCost, finalizeCost, addPayment, uploadDocument, openDocument,
  } = useImportOrder(id);
  const { linkProduct } = useImportReceiving(id);

  const [step, setStep] = useState<ImportStepKey>('order');

  if (order.isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  if (!order.data) {
    return <div className="text-center py-20 text-muted-foreground">הזמנת היבוא לא נמצאה</div>;
  }

  const o = order.data as any;
  const itemRows = ((items.data as any[]) ?? []);
  const costRows = ((costs.data as any[]) ?? []);
  const paymentRows = ((payments.data as any[]) ?? []);
  const documentRows = ((documents.data as any[]) ?? []);
  const landed = ((landedCost.data as any[]) ?? []);
  const isReadOnly = o.status === 'cancelled' || o.status === 'completed';

  const receivedUnits = itemRows.reduce((s, i) => s + Number(i.received_quantity ?? 0), 0);
  const completed: Record<ImportStepKey, boolean> = {
    order: itemRows.length > 0,
    costs: costRows.length > 0 || paymentRows.length > 0,
    receiving: receivedUnits > 0,
    summary: o.status === 'completed',
  };

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/import')}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {o.import_number}
              <Badge variant={o.status === 'completed' ? 'secondary' : 'default'}>
                {IMPORT_STATUS_LABELS[o.status as keyof typeof IMPORT_STATUS_LABELS] ?? o.status}
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground">
              {o.suppliers?.name ?? 'ללא ספק'} · {PURCHASE_TYPE_LABELS[o.purchase_type] ?? o.purchase_type} · {o.currency_code}
            </p>
          </div>
        </div>
        <Select value={o.status} onValueChange={(v) => updateStatus.mutate(v)}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {IMPORT_STATUSES.map((s) => (
              <SelectItem key={s} value={s} disabled={s === 'completed' && o.status !== 'completed'}>
                {IMPORT_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ImportStepper current={step} completed={completed} onSelect={setStep} />

      {step === 'order' && (
        <StepOrderDetails
          order={o}
          items={itemRows}
          updateOrder={updateOrder}
          addItem={addItem}
          updateItem={updateItem}
          deleteItem={deleteItem}
          linkProduct={linkProduct}
          isReadOnly={isReadOnly}
          onNext={() => setStep('costs')}
        />
      )}

      {step === 'costs' && (
        <StepCosts
          order={o}
          costs={costRows}
          payments={paymentRows}
          landed={landed}
          costSummary={costSummary.data}
          documents={documentRows}
          addCost={addCost}
          finalizeCost={finalizeCost}
          addPayment={addPayment}
          uploadDocument={uploadDocument}
          openDocument={openDocument}
          isReadOnly={isReadOnly}
          onNext={() => setStep('receiving')}
        />
      )}

      {step === 'receiving' && (
        <StepReceiving
          orderId={id!}
          businessId={o.business_id}
          items={itemRows}
          isReadOnly={o.status === 'cancelled'}
          onNext={() => setStep('summary')}
        />
      )}

      {step === 'summary' && (
        <StepSummary
          orderId={id!}
          items={itemRows}
          landed={landed}
          costSummary={costSummary.data}
          payments={paymentRows}
        />
      )}

      <Accordion type="single" collapsible>
        <AccordionItem value="advanced">
          <AccordionTrigger className="text-sm">מתקדם — היסטוריית פעולות</AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">היסטוריית פעולות</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {((events.data as any[]) ?? []).map((ev: any) => (
                  <div key={ev.id} className="flex items-start gap-3 border-b pb-3 last:border-0">
                    <Badge variant="outline">{EVENT_TYPE_LABELS[ev.event_type] ?? ev.event_type}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {new Date(ev.created_at).toLocaleString('he-IL')}
                    </span>
                  </div>
                ))}
                {((events.data as any[]) ?? []).length === 0 && (
                  <p className="text-center text-muted-foreground py-8">אין פעולות מתועדות</p>
                )}
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export const ImportOrderDetail: React.FC = () => (
  <ImportPinGate>
    <ImportOrderDetailContent />
  </ImportPinGate>
);

export default ImportOrderDetail;
