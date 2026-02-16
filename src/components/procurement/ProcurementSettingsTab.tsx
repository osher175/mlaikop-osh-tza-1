import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CategoryPairsTable } from './CategoryPairsTable';
import { ProductPairsTable } from './ProductPairsTable';
import { Settings } from 'lucide-react';

export const ProcurementSettingsTab: React.FC = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5" />
            ברירת מחדל לפי קטגוריה
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryPairsTable />
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5" />
            חריגים לפי מוצר
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProductPairsTable />
        </CardContent>
      </Card>
    </div>
  );
};
