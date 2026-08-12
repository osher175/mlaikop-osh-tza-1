import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Package } from 'lucide-react';

interface LinkProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId?: string | null;
  suggestedName?: string | null;
  onSelect: (productId: string) => void;
  isLinking?: boolean;
  /** Enables creating a brand new product when nothing matches. */
  onCreate?: (values: { name: string; barcode?: string | null; price?: number | null }) => void;
  isCreating?: boolean;
  suggestedPrice?: number | null;
}

/**
 * Links an import line to an EXISTING product of the same business, or creates
 * a new tenant-owned product when the item was never in inventory before.
 * The new product is created with quantity 0 — stock still enters only through
 * the receiving confirmation RPC.
 */
export const LinkProductDialog: React.FC<LinkProductDialogProps> = ({
  open,
  onOpenChange,
  businessId,
  suggestedName,
  onSelect,
  isLinking,
  onCreate,
  isCreating,
  suggestedPrice,
}) => {
  const [term, setTerm] = React.useState(suggestedName ?? '');
  const [mode, setMode] = React.useState<'search' | 'create'>('search');
  const [name, setName] = React.useState(suggestedName ?? '');
  const [barcode, setBarcode] = React.useState('');
  const [price, setPrice] = React.useState<string>(
    suggestedPrice != null ? String(suggestedPrice) : ''
  );

  React.useEffect(() => {
    if (open) {
      setTerm(suggestedName ?? '');
      setName(suggestedName ?? '');
      setBarcode('');
      setPrice(suggestedPrice != null ? String(suggestedPrice) : '');
      setMode('search');
    }
  }, [open, suggestedName, suggestedPrice]);

  const { data: products = [], isFetching } = useQuery({
    queryKey: ['link-product-search', businessId, term],
    queryFn: async () => {
      let q = supabase
        .from('products')
        .select('id, name, barcode, quantity')
        .eq('business_id', businessId!)
        .order('name')
        .limit(25);
      if (term.trim()) q = q.ilike('name', `%${term.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!businessId && mode === 'search',
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'יצירת מוצר חדש במלאי' : 'קישור לפריט מלאי'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'המוצר ייווצר עם כמות 0 ויקושר לשורה. המלאי ייכנס רק באישור הקליטה.'
              : 'בחר את המוצר הקיים שאליו תיקלט הסחורה. ללא קישור לא ניתן לאשר קליטה.'}
          </DialogDescription>
        </DialogHeader>

        {mode === 'create' ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="new-product-name">שם המוצר</Label>
              <Input
                id="new-product-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-product-barcode">ברקוד (אופציונלי)</Label>
              <Input
                id="new-product-barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-product-price">מחיר מכירה מתוכנן (₪, אופציונלי)</Label>
              <Input
                id="new-product-price"
                type="number"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1 min-h-[44px]"
                disabled={!name.trim() || isCreating}
                onClick={() =>
                  onCreate?.({
                    name,
                    barcode: barcode || null,
                    price: price === '' ? null : Number(price),
                  })
                }
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                ) : (
                  <Plus className="h-4 w-4 ml-2" />
                )}
                צור וקשר
              </Button>
              <Button variant="ghost" className="min-h-[44px]" onClick={() => setMode('search')}>
                חזרה לחיפוש
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="חיפוש מוצר לפי שם"
              autoFocus
            />

            <div className="max-h-72 overflow-y-auto space-y-1">
              {isFetching && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {!isFetching && products.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">לא נמצאו מוצרים</p>
              )}
              {(products as any[]).map((p) => (
                <Button
                  key={p.id}
                  variant="ghost"
                  disabled={isLinking}
                  className="w-full justify-start h-auto py-2"
                  onClick={() => onSelect(p.id)}
                >
                  <Package className="h-4 w-4 ml-2 shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-right truncate">
                    {p.name}
                    {p.barcode ? <span className="text-xs text-muted-foreground"> · {p.barcode}</span> : null}
                  </span>
                  <span className="text-xs text-muted-foreground">מלאי: {p.quantity}</span>
                </Button>
              ))}
            </div>

            {onCreate && (
              <Button
                variant="outline"
                className="w-full min-h-[44px]"
                onClick={() => {
                  setName(term || suggestedName || '');
                  setMode('create');
                }}
              >
                <Plus className="h-4 w-4 ml-2" />
                המוצר לא קיים — צור מוצר חדש
              </Button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
