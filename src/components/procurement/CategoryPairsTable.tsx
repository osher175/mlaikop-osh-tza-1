import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useSupplierPairs } from '@/hooks/useSupplierPairs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { Save } from 'lucide-react';

export const CategoryPairsTable: React.FC = () => {
  const { businessContext } = useBusinessAccess();
  const businessId = businessContext?.business_id;
  const { suppliers } = useSuppliers();
  const { pairs, upsertPair } = useSupplierPairs('category');
  const [edits, setEdits] = useState<Record<string, { a: string; b: string; strategy: string; active: boolean }>>({});

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .eq('business_id', businessId)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId,
  });

  const getPairForCategory = (catId: string) =>
    pairs.find(p => p.category_id === catId && p.is_active);

  const getEdit = (catId: string) => {
    if (edits[catId]) return edits[catId];
    const existing = getPairForCategory(catId);
    return existing
      ? { a: existing.supplier_a_id, b: existing.supplier_b_id, strategy: existing.strategy, active: existing.is_active }
      : { a: '', b: '', strategy: 'balanced', active: true };
  };

  const setEdit = (catId: string, field: string, value: any) => {
    const current = getEdit(catId);
    setEdits(prev => ({ ...prev, [catId]: { ...current, [field]: value } }));
  };

  const handleSave = async (catId: string) => {
    const edit = getEdit(catId);
    if (!edit.a || !edit.b || edit.a === edit.b) return;
    const existing = getPairForCategory(catId);
    await upsertPair.mutateAsync({
      id: existing?.id,
      scope: 'category',
      category_id: catId,
      supplier_a_id: edit.a,
      supplier_b_id: edit.b,
      strategy: edit.strategy,
      is_active: edit.active,
    });
    setEdits(prev => {
      const copy = { ...prev };
      delete copy[catId];
      return copy;
    });
  };

  if (categories.length === 0) {
    return <p className="text-sm text-muted-foreground">אין קטגוריות מוגדרות בעסק</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr className="border-b">
            <th className="text-right p-2 font-medium">קטגוריה</th>
            <th className="text-right p-2 font-medium">ספק A</th>
            <th className="text-right p-2 font-medium">ספק B</th>
            <th className="text-right p-2 font-medium">אסטרטגיה</th>
            <th className="text-right p-2 font-medium">פעיל</th>
            <th className="text-right p-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {categories.map((cat: any) => {
            const edit = getEdit(cat.id);
            const isDirty = !!edits[cat.id];
            return (
              <tr key={cat.id} className="border-b">
                <td className="p-2 font-medium">{cat.name}</td>
                <td className="p-2">
                  <Select value={edit.a} onValueChange={v => setEdit(cat.id, 'a', v)}>
                    <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="בחר" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-2">
                  <Select value={edit.b} onValueChange={v => setEdit(cat.id, 'b', v)}>
                    <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="בחר" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.filter(s => s.id !== edit.a).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-2">
                  <Select value={edit.strategy} onValueChange={v => setEdit(cat.id, 'strategy', v)}>
                    <SelectTrigger className="h-8 text-xs w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cheapest">זול</SelectItem>
                      <SelectItem value="quality">איכות</SelectItem>
                      <SelectItem value="balanced">מאוזן</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-2">
                  <Switch checked={edit.active} onCheckedChange={v => setEdit(cat.id, 'active', v)} />
                </td>
                <td className="p-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!edit.a || !edit.b || edit.a === edit.b || upsertPair.isPending}
                    onClick={() => handleSave(cat.id)}
                  >
                    <Save className="h-3 w-3" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
