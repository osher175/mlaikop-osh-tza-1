import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Package, Star, Truck, CheckCircle, XCircle, Edit3, Save } from 'lucide-react';
import { ConversationsList } from './ConversationsList';
import { ProcurementStatusBadge } from './ProcurementStatusBadge';
import { ManualQuoteDialog } from './ManualQuoteDialog';
import { useSupplierQuotes } from '@/hooks/useSupplierQuotes';
import { useProcurementActions } from '@/hooks/useProcurementActions';
import { TERMINAL_STATUSES } from '@/constants/procurement';

interface ProcurementDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: {
    id: string;
    product_id: string;
    requested_quantity: number;
    status: string;
    notes: string | null;
    recommended_quote_id: string | null;
    created_at: string;
    updated_at: string;
    products?: { name: string; quantity: number } | null;
    product_threshold?: number | null;
  } | null;
}

export const ProcurementDetailDrawer: React.FC<ProcurementDetailDrawerProps> = ({
  open,
  onOpenChange,
  request,
}) => {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const { quotes, isLoading: quotesLoading } = useSupplierQuotes(request?.id);
  const { updateStatus, updateNotes, updateRecommendedQuote } = useProcurementActions();

  useEffect(() => {
    if (request) {
      setNotesValue(request.notes || '');
      setEditingNotes(false);
    }
  }, [request?.id, request?.notes]);

  if (!request) return null;

  const handleSaveNotes = () => {
    updateNotes.mutate({ requestId: request.id, notes: notesValue });
    setEditingNotes(false);
  };

  const handleStatusChange = (newStatus: string) => {
    updateStatus.mutate({ requestId: request.id, status: newStatus });
  };

  const handleSetRecommended = (quoteId: string) => {
    updateRecommendedQuote.mutate({ requestId: request.id, quoteId });
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

  const isTerminal = (TERMINAL_STATUSES as readonly string[]).includes(request.status);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto" dir="rtl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {request.products?.name || 'מוצר'}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-4">
          {/* Product info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">כמות נוכחית:</span>
              <span className="font-medium mr-1">{request.products?.quantity ?? '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">כמות מבוקשת:</span>
              <span className="font-medium mr-1">{request.requested_quantity}</span>
            </div>
            {request.product_threshold != null && (
              <div>
                <span className="text-muted-foreground">סף מינימום:</span>
                <span className="font-medium mr-1">{request.product_threshold}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">סטטוס:</span>
              <span className="mr-1"><ProcurementStatusBadge status={request.status} /></span>
            </div>
            <div>
              <span className="text-muted-foreground">נוצר:</span>
              <span className="font-medium mr-1">{formatDate(request.created_at)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">עודכן:</span>
              <span className="font-medium mr-1">{formatDate(request.updated_at)}</span>
            </div>
          </div>

          <Separator />

          {/* Notes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-sm">הערות</h4>
              {!editingNotes && !isTerminal && (
                <Button variant="ghost" size="sm" onClick={() => setEditingNotes(true)}>
                  <Edit3 className="h-3 w-3 ml-1" />
                  ערוך
                </Button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-2">
                <Textarea value={notesValue} onChange={e => setNotesValue(e.target.value)} rows={3} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveNotes} disabled={updateNotes.isPending}>
                    <Save className="h-3 w-3 ml-1" />
                    שמור
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditingNotes(false); setNotesValue(request.notes || ''); }}>
                    ביטול
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{request.notes || 'אין הערות'}</p>
            )}
          </div>

          <Separator />

          {/* Quotes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-sm">הצעות מחיר ({quotes.length})</h4>
              {!isTerminal && <ManualQuoteDialog requestId={request.id} />}
            </div>
            {quotesLoading ? (
              <div className="text-sm text-muted-foreground">טוען...</div>
            ) : quotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">אין הצעות מחיר עדיין</p>
            ) : (
              <div className="space-y-2">
                {quotes.map(q => (
                  <div key={q.id} className={`p-3 rounded-lg border text-sm ${request.recommended_quote_id === q.id ? 'border-primary bg-primary/5' : ''}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{q.suppliers?.name || 'ספק'}</span>
                      <span className="font-bold">₪{q.price_per_unit}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-muted-foreground text-xs">
                      {q.delivery_time_days != null && (
                        <span className="flex items-center gap-1">
                          <Truck className="h-3 w-3" />
                          {q.delivery_time_days} ימים
                        </span>
                      )}
                      <span>{q.available ? 'זמין' : 'לא זמין'}</span>
                      {q.score != null && <span>ציון: {q.score}</span>}
                    </div>
                    {q.raw_message && <p className="text-xs mt-1 text-muted-foreground">{q.raw_message}</p>}
                    {!isTerminal && request.recommended_quote_id !== q.id && (
                      <Button size="sm" variant="ghost" className="mt-1 h-7 text-xs" onClick={() => handleSetRecommended(q.id)}>
                        <Star className="h-3 w-3 ml-1" />
                        סמן כהמלצה
                      </Button>
                    )}
                    {request.recommended_quote_id === q.id && (
                      <Badge variant="outline" className="mt-1 text-xs bg-primary/10 text-primary border-primary/30">מומלץ</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Supplier Conversations */}
          <ConversationsList
            requestId={request.id}
            productId={request.product_id}
            isTerminal={isTerminal}
          />

          {/* Actions */}
          {!isTerminal && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-medium text-sm">פעולות</h4>
                <div className="flex flex-wrap gap-2">
                  {request.status === 'draft' && (
                    <Button size="sm" onClick={() => handleStatusChange('in_progress')}>
                      התחל טיפול
                    </Button>
                  )}
                  {['draft', 'in_progress'].includes(request.status) && (
                    <Button size="sm" variant="outline" onClick={() => handleStatusChange('ordered_external')}>
                      <Truck className="h-3 w-3 ml-1" />
                      הוזמן חיצונית
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => handleStatusChange('resolved_external')} className="text-green-700">
                    <CheckCircle className="h-3 w-3 ml-1" />
                    טופל
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleStatusChange('cancelled')} className="text-red-600">
                    <XCircle className="h-3 w-3 ml-1" />
                    ביטול
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
