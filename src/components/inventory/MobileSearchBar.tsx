import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface MobileSearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export const MobileSearchBar: React.FC<MobileSearchBarProps> = ({
  searchTerm,
  onSearchChange,
}) => {
  const isMobile = useIsMobile();

  return (
    <Card className="w-full">
      <CardContent className={`${isMobile ? 'p-3' : 'p-4 md:p-6'} w-full`}>
        <div className="flex flex-col items-center w-full gap-2">
          <div className={`w-full ${isMobile ? 'max-w-full' : 'max-w-md'}`}>
            <label
              htmlFor="inventory-search"
              className="flex items-center gap-2 mb-2 text-base font-semibold text-gray-800"
            >
              <Search className="w-4 h-4 text-primary" />
              חיפוש מוצר
            </label>
            <div className="relative">
              <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
              <Input
                id="inventory-search"
                placeholder="הקלד שם מוצר כדי לחפש..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="h-12 min-h-[44px] w-full text-base md:text-lg pr-12 pl-12 rounded-lg border-2 border-gray-200 bg-white py-3 shadow-sm transition-all duration-300 ease-in-out focus:border-primary focus:ring-2 focus:ring-primary/20 focus:shadow-md hover:border-gray-300 placeholder:text-gray-500 font-medium"
                style={{ fontSize: isMobile ? '16px' : '18px' }}
              />
              {searchTerm && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onSearchChange('')}
                  aria-label="נקה חיפוש"
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 rounded-full hover:bg-gray-100"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
