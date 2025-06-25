
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { ProtectedFeature } from '@/components/ProtectedFeature';

interface InventoryFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export const InventoryFilters: React.FC<InventoryFiltersProps> = ({
  searchTerm,
  onSearchChange,
}) => {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="חפש מוצרים..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pr-10"
            />
          </div>
          <ProtectedFeature requiredRole="pro_starter_user">
            <Button variant="outline">סנן לפי קטגוריה</Button>
            <Button variant="outline">סנן לפי מיקום</Button>
          </ProtectedFeature>
        </div>
      </CardContent>
    </Card>
  );
};
