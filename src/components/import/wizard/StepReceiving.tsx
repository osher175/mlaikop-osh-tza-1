import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ReceivingPanel } from '../ReceivingPanel';

interface Props {
  orderId: string;
  businessId: string;
  items: any[];
  isReadOnly?: boolean;
  onNext: () => void;
}

/**
 * STEP 3 — receiving. Thin wrapper around the existing, verified ReceivingPanel:
 * atomicity, idempotency, PIN and RLS semantics are unchanged. The only stock
 * mutation in the module still happens through `import_receipt_confirm`.
 */
export const StepReceiving: React.FC<Props> = ({ orderId, businessId, items, isReadOnly, onNext }) => (
  <div className="space-y-4" dir="rtl">
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">קליטת סחורה</CardTitle></CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        כאן מזינים כמה יחידות באמת הגיעו מכל פריט. המלאי מתעדכן רק לאחר אישור סופי של הקליטה.
      </CardContent>
    </Card>

    <ReceivingPanel
      orderId={orderId}
      businessId={businessId}
      items={items}
      isReadOnly={isReadOnly}
    />

    <div className="flex justify-start">
      <Button className="min-h-[44px]" onClick={onNext}>
        המשך לסיכום וסגירה
        <ArrowLeft className="h-4 w-4 mr-2" />
      </Button>
    </div>
  </div>
);
