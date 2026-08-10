import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Check, Link2, Loader2, Minus, PackageCheck, Plus, Save, X } from 'lucide-react';
import {
  useImportReceiving,
  SHORTAGE_RESOLUTIONS,
  SHORTAGE_RESOLUTION_LABELS,
  type ShortageResolution,
} from '@/hooks/useImportReceiving';
import { LinkProductDialog } from './LinkProductDialog';

interface ReceivingPanelProps {
  orderId: string;
  businessId?: string | null;
  items: any[];
  isReadOnly?: boolean;
}

/**
 * Phase 2 receiving screen — built for a phone in a warehouse:
 * large touch targets, one card per line, no horizontal scrolling.
 *
 * INVENTORY INVARIANT: typing quantities and saving a draft never changes stock.
 * Stock moves only when the user passes the explicit confirmation dialog, which
 * calls the atomic server RPC `import_receipt_confirm`.
 */
export const ReceivingPanel: React.FC<ReceivingPanelProps> = ({
  orderId,
  businessId,
  items,
  isReadOnly,
}) => {
  const {
    receipts,
    draft,
    draftLines,
    receiptLines,
    startReceiving,
    saveDraft,
    confirmReceipt,
    cancelDraft,
    correctReceipt,
    resolveShortage,
    linkProduct,
  } = useImportReceiving(orderId);

  const [quantities, setQuantities] = React.useState<Record<string, string>>({});
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [linkItem, setLinkItem] = React.useState<any | null>(null);
  const [shortageItem, setShortageItem] = React.useState<any | null>(null);
  const [shortageResolution, setShortageResolution] = React.useState<ShortageResolution>('supplier_shortage');
  const [shortageNotes, setShortageNotes] = React.useState('');
  const [correctionLine, setCorrectionLine] = React.useState<any | null>(null);
  const [correctionDelta, setCorrectionDelta] = React.useState('');
  const [correctionReason, setCorrectionReason] = React.useState('');

  // Hydrate the editor from the saved draft whenever it changes on the server.
  React.useEffect(() => {
    if (!draft) return;
    const q: Record<string, string> = {};
    const n: Record<string, string> = {};
    draftLines.forEach((l: any) => {
      q[l.import_order_item_id] = String(l.received_quantity ?? 0);
      if (l.notes) n[l.import_order_item_id] = l.notes;
    });
    setQuantities(q);
    setNotes(n);
  }, [draft?.id, draftLines.length]);

  const confirmedLines = ((receiptLines.data as any[]) ?? []).filter(
    (l) => l.applied_at && (!draft || l.import_receipt_id !== draft.id)
  );

  const confirmedByItem = React.useMemo(() => {
    const m = new Map<string, number>();
    confirmedLines.forEach((l) => {
      m.set(l.import_order_item_id, (m.get(l.import_order_item_id) ?? 0) + Number(l.received_quantity ?? 0));
    });
    return m;
  }, [confirmedLines]);

  const itemLabel = (item: any) =>
    item.product_description || item.supplier_sku || item.manufacturer_name || 'פריט';

  const getQty = (itemId: string) => {
    const raw = quantities[itemId];
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  };

  const setQty = (itemId: string, value: number) =>
    setQuantities((prev) => ({ ...prev, [itemId]: String(Math.max(0, value)) }));

  const linesForSave = items
    .map((item) => ({
      import_order_item_id: item.id,
      received_quantity: getQty(item.id),
      notes: notes[item.id]?.trim() || null,
    }))
    .filter((l) => l.received_quantity > 0);

  const totalUnits = linesForSave.reduce((s, l) => s + l.received_quantity, 0);
  const missingLink = items.filter((i) => getQty(i.id) > 0 && !i.product_id);
  const canConfirm = !!draft && linesForSave.length > 0 && missingLink.length === 0;

  const openItems = items.filter((item) => {
    const remaining =
      Number(item.ordered_quantity ?? 0) -
      Number(item.received_quantity ?? 0) -
      Number(item.not_arriving_quantity ?? 0);
    return remaining > 0;
  });

  /* ------------------------------ no open draft ----------------------------- */
  if (!draft) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">קליטת סחורה</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              פתיחת קליטה יוצרת טיוטה בלבד. המלאי מתעדכן רק לאחר אישור מפורש בסוף התהליך.
            </p>
            <Button
              className="w-full sm:w-auto min-h-[44px]"
              disabled={isReadOnly || startReceiving.isPending || openItems.length === 0}
              onClick={() => startReceiving.mutate()}
            >
              {startReceiving.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <PackageCheck className="h-4 w-4 ml-2" />
              )}
              התחל קליטה
            </Button>
            {openItems.length === 0 && (
              <p className="text-sm text-muted-foreground">אין פריטים פתוחים לקליטה בהזמנה זו.</p>
            )}
          </CardContent>
        </Card>

        <ReceiptHistory
          receipts={(receipts.data as any[]) ?? []}
          lines={confirmedLines}
          items={items}
          isReadOnly={isReadOnly}
          onCorrect={(line) => {
            setCorrectionLine(line);
            setCorrectionDelta('');
            setCorrectionReason('');
          }}
        />

        <ShortagePanel
          items={items}
          isReadOnly={isReadOnly}
          onResolve={(item) => {
            setShortageItem(item);
            setShortageResolution('supplier_shortage');
            setShortageNotes('');
          }}
        />

        <CorrectionDialog
          line={correctionLine}
          items={items}
          delta={correctionDelta}
          reason={correctionReason}
          setDelta={setCorrectionDelta}
          setReason={setCorrectionReason}
          isPending={correctReceipt.isPending}
          onClose={() => setCorrectionLine(null)}
          onSubmit={() => {
            correctReceipt.mutate(
              {
                receiptItemId: correctionLine.id,
                delta: Math.trunc(Number(correctionDelta)),
                reason: correctionReason.trim(),
              },
              { onSuccess: () => setCorrectionLine(null) }
            );
          }}
        />

        <ShortageDialog
          item={shortageItem}
          resolution={shortageResolution}
          setResolution={setShortageResolution}
          notes={shortageNotes}
          setNotes={setShortageNotes}
          isPending={resolveShortage.isPending}
          onClose={() => setShortageItem(null)}
          onSubmit={() =>
            resolveShortage.mutate(
              {
                itemId: shortageItem.id,
                resolution: shortageResolution,
                notes: shortageNotes.trim() || null,
              },
              { onSuccess: () => setShortageItem(null) }
            )
          }
        />
      </div>
    );
  }

  /* ------------------------------- open draft ------------------------------- */
  return (
    <div className="space-y-4 pb-24">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          טיוטת קליטה {draft.receipt_number ?? ''} פתוחה. שמירת טיוטה אינה מעדכנת את המלאי.
        </AlertDescription>
      </Alert>

      <div className="space-y-3">
        {openItems.map((item) => {
          const ordered = Number(item.ordered_quantity ?? 0);
          const already = Number(item.received_quantity ?? 0);
          const notArriving = Number(item.not_arriving_quantity ?? 0);
          const remaining = Math.max(0, ordered - already - notArriving);
          const qty = getQty(item.id);
          const over = qty > remaining;

          return (
            <Card key={item.id} className={over ? 'border-yellow-400' : undefined}>
              <CardContent className="p-3 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{itemLabel(item)}</p>
                    <p className="text-xs text-muted-foreground">
                      הוזמן {ordered} · נקלט {already} · נותר {remaining}
                    </p>
                  </div>
                  {item.product_id ? (
                    <Badge variant="secondary" className="shrink-0">מקושר</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 min-h-[40px]"
                      disabled={isReadOnly}
                      onClick={() => setLinkItem(item)}
                    >
                      <Link2 className="h-4 w-4 ml-1" />
                      קשר מוצר
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 shrink-0"
                    disabled={isReadOnly}
                    onClick={() => setQty(item.id, qty - 1)}
                    aria-label="הפחת יחידה"
                  >
                    <Minus className="h-5 w-5" />
                  </Button>
                  <Input
                    inputMode="numeric"
                    className="h-12 text-center text-lg"
                    value={quantities[item.id] ?? ''}
                    placeholder="0"
                    disabled={isReadOnly}
                    onChange={(e) =>
                      setQuantities((prev) => ({ ...prev, [item.id]: e.target.value.replace(/[^\d]/g, '') }))
                    }
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 shrink-0"
                    disabled={isReadOnly}
                    onClick={() => setQty(item.id, qty + 1)}
                    aria-label="הוסף יחידה"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-12 shrink-0"
                    disabled={isReadOnly}
                    onClick={() => setQty(item.id, remaining)}
                  >
                    הכל
                  </Button>
                </div>

                {over && (
                  <p className="text-xs text-yellow-700">
                    הכמות גבוהה מהיתרה שהוזמנה — עודף ייקלט ויירשם ככזה.
                  </p>
                )}

                <Input
                  className="h-10"
                  placeholder="הערה לשורה (אופציונלי)"
                  value={notes[item.id] ?? ''}
                  disabled={isReadOnly}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {missingLink.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {missingLink.length} שורות עם כמות אינן מקושרות למוצר במלאי. יש לקשר לפני אישור.
          </AlertDescription>
        </Alert>
      )}

      <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t p-3 -mx-3 flex flex-wrap gap-2">
        <div className="flex-1 min-w-[120px] text-sm">
          <span className="text-muted-foreground">סה״כ לקליטה: </span>
          <span className="font-semibold">{totalUnits}</span>
        </div>
        <Button
          variant="outline"
          className="min-h-[44px]"
          disabled={isReadOnly || saveDraft.isPending}
          onClick={() => saveDraft.mutate({ receiptId: draft.id, lines: linesForSave })}
        >
          {saveDraft.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Save className="h-4 w-4 ml-2" />}
          שמור טיוטה
        </Button>
        <Button
          variant="ghost"
          className="min-h-[44px]"
          disabled={isReadOnly || cancelDraft.isPending}
          onClick={() => cancelDraft.mutate(draft.id)}
        >
          <X className="h-4 w-4 ml-2" />
          בטל טיוטה
        </Button>
        <Button
          className="min-h-[44px]"
          disabled={isReadOnly || !canConfirm || confirmReceipt.isPending}
          onClick={() => setConfirmOpen(true)}
        >
          <Check className="h-4 w-4 ml-2" />
          אשר קליטה למלאי
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>אישור קליטה למלאי</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תעדכן את המלאי בפועל ואינה ניתנת לביטול בלחיצה אחת. תיקון לאחר אישור מתבצע
              דרך רישום תיקון נפרד.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="max-h-56 overflow-y-auto text-sm space-y-1">
            {linesForSave.map((l) => {
              const item = items.find((i) => i.id === l.import_order_item_id);
              return (
                <div key={l.import_order_item_id} className="flex justify-between gap-2 border-b py-1">
                  <span className="truncate">{item ? itemLabel(item) : ''}</span>
                  <span className="font-medium shrink-0">{l.received_quantity}</span>
                </div>
              );
            })}
            <div className="flex justify-between pt-2 font-semibold">
              <span>סה״כ יחידות</span>
              <span>{totalUnits}</span>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await saveDraft.mutateAsync({ receiptId: draft.id, lines: linesForSave });
                confirmReceipt.mutate(draft.id, { onSuccess: () => setConfirmOpen(false) });
              }}
            >
              אשר קליטה למלאי
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LinkProductDialog
        open={!!linkItem}
        onOpenChange={(o) => !o && setLinkItem(null)}
        businessId={businessId}
        suggestedName={linkItem ? itemLabel(linkItem) : ''}
        isLinking={linkProduct.isPending}
        onSelect={(productId) =>
          linkProduct.mutate(
            { itemId: linkItem.id, productId },
            { onSuccess: () => setLinkItem(null) }
          )
        }
      />
    </div>
  );
};

/* --------------------------------- history -------------------------------- */

const ReceiptHistory: React.FC<{
  receipts: any[];
  lines: any[];
  items: any[];
  isReadOnly?: boolean;
  onCorrect: (line: any) => void;
}> = ({ receipts, lines, items, isReadOnly, onCorrect }) => {
  const confirmed = receipts.filter((r) => r.status === 'confirmed');
  if (confirmed.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">קליטות שאושרו</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {confirmed.map((r) => (
          <div key={r.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{r.receipt_number}</span>
              <span className="text-xs text-muted-foreground">
                {r.confirmed_at ? new Date(r.confirmed_at).toLocaleDateString('he-IL') : ''}
              </span>
            </div>
            {lines
              .filter((l) => l.import_receipt_id === r.id)
              .map((l) => {
                const item = items.find((i) => i.id === l.import_order_item_id);
                return (
                  <div key={l.id} className="flex items-center justify-between gap-2 text-sm border-b py-1">
                    <span className="truncate">
                      {item?.product_description || item?.supplier_sku || 'פריט'}
                    </span>
                    <span className="shrink-0 flex items-center gap-2">
                      <span className="font-medium">{l.received_quantity}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isReadOnly}
                        onClick={() => onCorrect(l)}
                      >
                        תיקון
                      </Button>
                    </span>
                  </div>
                );
              })}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

/* -------------------------------- shortages ------------------------------- */

const ShortagePanel: React.FC<{
  items: any[];
  isReadOnly?: boolean;
  onResolve: (item: any) => void;
}> = ({ items, isReadOnly, onResolve }) => {
  const shortages = items.filter((i) => {
    const remaining =
      Number(i.ordered_quantity ?? 0) -
      Number(i.received_quantity ?? 0) -
      Number(i.not_arriving_quantity ?? 0);
    return Number(i.received_quantity ?? 0) > 0 && remaining > 0;
  });
  if (shortages.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">חוסרים פתוחים</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          כמות שלא נקלטה נשארת ״בדרך״ עד לסגירת החוסר.
        </p>
        {shortages.map((item) => {
          const remaining =
            Number(item.ordered_quantity ?? 0) -
            Number(item.received_quantity ?? 0) -
            Number(item.not_arriving_quantity ?? 0);
          return (
            <div key={item.id} className="flex items-center justify-between gap-2 text-sm border-b py-2">
              <div className="min-w-0">
                <p className="truncate">{item.product_description || item.supplier_sku || 'פריט'}</p>
                <p className="text-xs text-muted-foreground">
                  חסר {remaining}
                  {item.shortage_resolution
                    ? ` · ${SHORTAGE_RESOLUTION_LABELS[item.shortage_resolution as ShortageResolution] ?? item.shortage_resolution}`
                    : ''}
                </p>
              </div>
              <Button size="sm" variant="outline" disabled={isReadOnly} onClick={() => onResolve(item)}>
                סגור חוסר
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

const ShortageDialog: React.FC<{
  item: any | null;
  resolution: ShortageResolution;
  setResolution: (r: ShortageResolution) => void;
  notes: string;
  setNotes: (n: string) => void;
  isPending: boolean;
  onClose: () => void;
  onSubmit: () => void;
}> = ({ item, resolution, setResolution, notes, setNotes, isPending, onClose, onSubmit }) => (
  <AlertDialog open={!!item} onOpenChange={(o) => !o && onClose()}>
    <AlertDialogContent dir="rtl">
      <AlertDialogHeader>
        <AlertDialogTitle>סגירת חוסר</AlertDialogTitle>
        <AlertDialogDescription>
          סגירת חוסר אינה משנה מלאי — היא רק קובעת אם הכמות החסרה עדיין ״בדרך״.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div className="space-y-3">
        <Select value={resolution} onValueChange={(v) => setResolution(v as ShortageResolution)}>
          <SelectTrigger>
            <SelectValue placeholder="בחר סיבה" />
          </SelectTrigger>
          <SelectContent>
            {SHORTAGE_RESOLUTIONS.map((r) => (
              <SelectItem key={r} value={r}>
                {SHORTAGE_RESOLUTION_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="הערות (אופציונלי)" />
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel>ביטול</AlertDialogCancel>
        <AlertDialogAction disabled={isPending} onClick={(e) => { e.preventDefault(); onSubmit(); }}>
          שמור
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

/* ------------------------------- corrections ------------------------------ */

const CorrectionDialog: React.FC<{
  line: any | null;
  items: any[];
  delta: string;
  reason: string;
  setDelta: (v: string) => void;
  setReason: (v: string) => void;
  isPending: boolean;
  onClose: () => void;
  onSubmit: () => void;
}> = ({ line, items, delta, reason, setDelta, setReason, isPending, onClose, onSubmit }) => {
  const item = line ? items.find((i) => i.id === line.import_order_item_id) : null;
  const parsed = Math.trunc(Number(delta));
  const valid = Number.isFinite(parsed) && parsed !== 0 && reason.trim().length >= 3;

  return (
    <AlertDialog open={!!line} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>תיקון קליטה</AlertDialogTitle>
          <AlertDialogDescription>
            התיקון נרשם כתנועת מלאי נוספת ומעדכן את המלאי. הקליטה המקורית נשמרת כפי שהיא.
            {item ? ` פריט: ${item.product_description || item.supplier_sku || ''}` : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          <Input
            inputMode="numeric"
            placeholder="הפרש (למשל 3 או 3-)"
            value={delta}
            onChange={(e) => setDelta(e.target.value.replace(/[^\d-]/g, ''))}
          />
          <Textarea
            placeholder="סיבת התיקון (חובה)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>ביטול</AlertDialogCancel>
          <AlertDialogAction
            disabled={!valid || isPending}
            onClick={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            רשום תיקון
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
