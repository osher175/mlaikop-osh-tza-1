
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
        <div className="flex gap-4 justify-center">
          <ProtectedFeature requiredRole="pro_starter_user">
            <Button variant="outline">סנן לפי קטגוריה</Button>
            <Button variant="outline">סנן לפי מיקום</Button>
          </ProtectedFeature>
        </div>
      </CardContent>
    </Card>
  );
};
