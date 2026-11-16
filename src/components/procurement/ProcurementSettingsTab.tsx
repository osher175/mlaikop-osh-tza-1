import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CategoryPairsTable } from './CategoryPairsTable';
import { ProductPairsTable } from './ProductPairsTable';
import { Settings } from 'lucide-react';
import { useV2UiEnabled } from '@/lib/v2/uiFlag';

export const ProcurementSettingsTab: React.FC = () => {
  const v2 = useV2UiEnabled();
  if (!v2) {
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
  }

  return (
    <div data-screen="procurement-settings-v2" className="space-y-4 font-[Heebo] text-v2-text">
      <header>
        <h2 className="text-xl font-extrabold">הגדרות רכש</h2>
        <p className="mt-1 max-w-2xl text-sm text-v2-muted">זוגות ספקים לפי קטגוריה, וחריג למוצר מסוים. סף החוסר והחישוב נשארים כפי שהם.</p>
      </header>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="min-w-0 rounded-[18px] border border-[#e6eef6] bg-white p-4">
          <h3 className="mb-3 flex items-center gap-2 text-base font-extrabold"><Settings className="h-4 w-4 text-[#12a37a]" aria-hidden />ברירת מחדל לפי קטגוריה</h3>
          <CategoryPairsTable />
        </section>
        <section className="min-w-0 rounded-[18px] border border-[#e6eef6] bg-white p-4">
          <h3 className="mb-3 flex items-center gap-2 text-base font-extrabold"><Settings className="h-4 w-4 text-[#12a37a]" aria-hidden />חריגים לפי מוצר</h3>
          <ProductPairsTable />
        </section>
      </div>
    </div>
  );
};
