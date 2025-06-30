import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface InventoryFiltersProps {
  // הסרתי את props של החיפוש מכיוון שעברו לקומפוננטה החדשה
}

export const InventoryFilters: React.FC<InventoryFiltersProps> = () => {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-center text-gray-500">
          {/* הפילטרים הוסרו לפי בקשת המשתמש */}
        </div>
      </CardContent>
    </Card>
  );
};
