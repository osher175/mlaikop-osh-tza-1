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
}

/**
 * Links an import line to an EXISTING product of the same business.
 * Only tenant-owned products are listed, so receiving can never write stock
 * into another business's catalog.
 */
export const LinkProductDialog: React.FC<LinkProductDialogProps> = ({
  open,
  onOpenChange,
  businessId,
  suggestedName,
  onSelect,
  isLinking,
}) => {
  const [term, setTerm] = React.useState(suggestedName ?? '');

  React.useEffect(() => {
    if (open) setTerm(suggestedName ?? '');
  }, [open, suggestedName]);

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
    enabled: open && !!businessId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>קישור לפריט מלאי</DialogTitle>
          <DialogDescription>
            בחר את המוצר הקיים שאליו תיקלט הסחורה. ללא קישור לא ניתן לאשר קליטה.
          </DialogDescription>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
};
