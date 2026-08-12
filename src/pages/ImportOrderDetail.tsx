import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Loader2, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { ImportPinGate } from '@/components/import/ImportPinGate';
import { ImportStepper, ImportStepKey } from '@/components/import/wizard/ImportStepper';
import { StepOrderDetails } from '@/components/import/wizard/StepOrderDetails';
import { StepCosts } from '@/components/import/wizard/StepCosts';
import { StepSummary } from '@/components/import/wizard/StepSummary';
import { JourneyTimeline } from '@/components/import/journey/JourneyTimeline';
import { journeyMilestone, journeyProgress } from '@/components/import/journey/importJourney';
import { ReceivingDialog } from '@/components/import/ReceivingDialog';

import { useImportOrder, EVENT_TYPE_LABELS } from '@/hooks/useImportOrder';
import { useImportReceiving } from '@/hooks/useImportReceiving';
import { IMPORT_STATUS_LABELS, PURCHASE_TYPE_LABELS } from '@/hooks/useImportOrders';

/**
 * Import lifecycle screen — three business sections:
 *   הזמנה · מעקב יבוא · תמונת מצב
 * Receiving and closure are contextual actions, not sections. This file is a UX
 * shell only: every mutation goes through the existing verified hooks/RPCs, and
 * stock still moves only via `import_receipt_confirm`.
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
  const [receivingOpen, setReceivingOpen] = useState(false);

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
  const eventRows = ((events.data as any[]) ?? []);
  const landed = ((landedCost.data as any[]) ?? []);
  const isReadOnly = o.status === 'cancelled' || o.status === 'completed';

  const receivedUnits = itemRows.reduce((s, i) => s + Number(i.received_quantity ?? 0), 0);
  const completed: Record<ImportStepKey, boolean> = {
    order: itemRows.length > 0,
    tracking: costRows.length > 0 || paymentRows.length > 0,
    status: o.status === 'completed',
  };
  const milestone = journeyMilestone(o.status);
  const progress = journeyProgress(o.status);

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
                {milestone ? `${milestone.icon} ${milestone.label}` :
                  IMPORT_STATUS_LABELS[o.status as keyof typeof IMPORT_STATUS_LABELS] ?? o.status}
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground">
              {o.suppliers?.name ?? 'ללא ספק'} · {PURCHASE_TYPE_LABELS[o.purchase_type] ?? o.purchase_type} · {o.currency_code}
              {' · '}התקדמות {progress}%
            </p>
          </div>
        </div>
        <Button
          className="min-h-[44px]"
          variant="secondary"
          onClick={() => setReceivingOpen(true)}
          disabled={o.status === 'cancelled' || o.status === 'completed'}
        >
          <PackageCheck className="w-4 h-4 ml-2" />
          קליטת סחורה
        </Button>

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
          onNext={() => setStep('tracking')}
        />
      )}

      {step === 'tracking' && (
        <div className="space-y-4">
          <JourneyTimeline
            status={o.status}
            events={eventRows}
            isReadOnly={o.status === 'cancelled' || o.status === 'completed'}
            isUpdating={updateStatus.isPending}
            onSetStatus={(s) => updateStatus.mutate(s)}
          />
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
            onNext={() => setStep('status')}
          />
        </div>
      )}

      {step === 'status' && (
        <StepSummary
          orderId={id!}
          items={itemRows}
          landed={landed}
          costSummary={costSummary.data}
          payments={paymentRows}
          receivedUnits={receivedUnits}
        />
      )}

      <Accordion type="single" collapsible>
        <AccordionItem value="advanced">
          <AccordionTrigger className="text-sm">מתקדם — היסטוריית פעולות</AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">היסטוריית פעולות</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {eventRows.map((ev: any) => (
                  <div key={ev.id} className="flex items-start gap-3 border-b pb-3 last:border-0">
                    <Badge variant="outline">{EVENT_TYPE_LABELS[ev.event_type] ?? ev.event_type}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {new Date(ev.created_at).toLocaleString('he-IL')}
                    </span>
                  </div>
                ))}
                {eventRows.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">אין פעולות מתועדות</p>
                )}
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <ReceivingDialog
        open={receivingOpen}
        onOpenChange={setReceivingOpen}
        orderId={id!}
        businessId={o.business_id}
        items={itemRows}
        isReadOnly={o.status === 'cancelled'}
      />
    </div>
  );
};

export const ImportOrderDetail: React.FC = () => (
  <ImportPinGate>
    <ImportOrderDetailContent />
  </ImportPinGate>
);

export default ImportOrderDetail;
