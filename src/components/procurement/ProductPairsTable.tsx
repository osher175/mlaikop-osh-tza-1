import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useSupplierPairs } from '@/hooks/useSupplierPairs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { Save, Search, Trash2 } from 'lucide-react';

export const ProductPairsTable: React.FC = () => {
  const { businessContext } = useBusinessAccess();
  const businessId = businessContext?.business_id;
  const { suppliers } = useSuppliers();
  const { pairs, upsertPair, deletePair } = useSupplierPairs('product');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; name: string } | null>(null);
  const [newA, setNewA] = useState('');
  const [newB, setNewB] = useState('');
  const [newStrategy, setNewStrategy] = useState('balanced');

  const { data: products = [] } = useQuery({
    queryKey: ['products-search', businessId, searchTerm],
    queryFn: async () => {
      if (!businessId || searchTerm.length < 2) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name')
        .eq('business_id', businessId)
        .ilike('name', `%${searchTerm}%`)
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId && searchTerm.length >= 2,
  });

  // Get supplier names map
  const supplierMap = new Map(suppliers.map(s => [s.id, s.name]));

  // Check if product pair overrides a category pair (we'd need category pairs for this)
  const { pairs: categoryPairs } = useSupplierPairs('category');

  const handleAddProductPair = async () => {
    if (!selectedProduct || !newA || !newB || newA === newB) return;
    await upsertPair.mutateAsync({
      scope: 'product',
      product_id: selectedProduct.id,
      supplier_a_id: newA,
      supplier_b_id: newB,
      strategy: newStrategy,
    });
    setSelectedProduct(null);
    setNewA('');
    setNewB('');
    setSearchTerm('');
  };

  return (
    <div className="space-y-4">
      {/* Add new product pair */}
      <div className="space-y-3 p-3 border rounded-lg bg-muted/20">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="חפש מוצר להוספה..."
            value={selectedProduct ? selectedProduct.name : searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setSelectedProduct(null);
            }}
            className="pr-10"
          />
        </div>
        {searchTerm.length >= 2 && !selectedProduct && products.length > 0 && (
          <div className="border rounded-md max-h-32 overflow-y-auto">
            {products.map((p: any) => (
              <button
                key={p.id}
                className="w-full text-right px-3 py-2 hover:bg-muted/50 text-sm"
                onClick={() => {
                  setSelectedProduct(p);
                  setSearchTerm('');
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
        {selectedProduct && (
          <div className="flex flex-wrap gap-2 items-end">
            <Select value={newA} onValueChange={setNewA}>
              <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="ספק A" /></SelectTrigger>
              <SelectContent>
                {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={newB} onValueChange={setNewB}>
              <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="ספק B" /></SelectTrigger>
              <SelectContent>
                {suppliers.filter(s => s.id !== newA).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={newStrategy} onValueChange={setNewStrategy}>
              <SelectTrigger className="h-8 text-xs w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cheapest">זול</SelectItem>
                <SelectItem value="quality">איכות</SelectItem>
                <SelectItem value="balanced">מאוזן</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleAddProductPair} disabled={!newA || !newB || newA === newB}>
              <Save className="h-3 w-3 ml-1" />
              שמור
            </Button>
          </div>
        )}
      </div>

      {/* Existing product pairs */}
      {pairs.length === 0 ? (
        <p className="text-sm text-muted-foreground">אין חריגים לפי מוצר</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="text-right p-2 font-medium">מוצר</th>
                <th className="text-right p-2 font-medium">ספק A</th>
                <th className="text-right p-2 font-medium">ספק B</th>
                <th className="text-right p-2 font-medium">אסטרטגיה</th>
                <th className="text-right p-2 font-medium">פעיל</th>
                <th className="text-right p-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {pairs.map(pair => {
                // Check if this overrides a category pair
                const hasOverride = categoryPairs.some(cp => cp.is_active);
                return (
                  <tr key={pair.id} className="border-b">
                    <td className="p-2 font-medium">
                      {pair.product_id?.slice(0, 8)}...
                      {hasOverride && (
                        <Badge variant="outline" className="mr-2 text-xs">Override</Badge>
                      )}
                    </td>
                    <td className="p-2">{supplierMap.get(pair.supplier_a_id) || '-'}</td>
                    <td className="p-2">{supplierMap.get(pair.supplier_b_id) || '-'}</td>
                    <td className="p-2">
                      {pair.strategy === 'cheapest' ? 'זול' : pair.strategy === 'quality' ? 'איכות' : 'מאוזן'}
                    </td>
                    <td className="p-2">
                      <Switch
                        checked={pair.is_active}
                        onCheckedChange={(v) => upsertPair.mutate({ ...pair, is_active: v })}
                      />
                    </td>
                    <td className="p-2">
                      <Button size="sm" variant="ghost" onClick={() => deletePair.mutate(pair.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
