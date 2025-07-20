
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProtectedFeature } from '@/components/ProtectedFeature';

interface InventoryFiltersProps {
  // הסרתי את props של החיפוש מכיוון שעברו לקומפוננטה החדשה
}

export const InventoryFilters: React.FC<InventoryFiltersProps> = () => {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-col md:flex-row gap-2 md:gap-4 justify-center items-stretch w-full">
          <ProtectedFeature requiredRole="pro_starter_user">
            <Button variant="outline" className="h-12 min-h-[44px] min-w-[44px] w-full md:w-auto">סנן לפי קטגוריה</Button>
            <Button variant="outline" className="h-12 min-h-[44px] min-w-[44px] w-full md:w-auto">סנן לפי מיקום</Button>
            {/* TODO: Collapse filters into a dropdown on xs screens if more filters are added */}
          </ProtectedFeature>
        </div>
      </CardContent>
    </Card>
  );
};
