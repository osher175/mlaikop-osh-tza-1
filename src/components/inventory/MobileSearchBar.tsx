
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
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
      <CardContent className={`${isMobile ? 'p-2' : 'p-4 md:p-6'} w-full`}>
        <div className="flex justify-center w-full">
          <div className={`relative w-full ${isMobile ? 'max-w-full' : 'max-w-md'}`}>
            <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors duration-300" />
            <Input
              placeholder="חפש מוצר לפי שם, קטגוריה או ספק..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className={`h-12 min-h-[44px] w-full md:w-auto text-base md:text-lg pr-12 rounded-lg border-2 border-gray-200 bg-white px-4 py-3 shadow-sm transition-all duration-300 ease-in-out focus:border-primary focus:ring-2 focus:ring-primary/20 focus:shadow-md focus:scale-[1.02] hover:border-gray-300 placeholder:text-gray-500 font-medium`}
              style={{ fontSize: isMobile ? '16px' : '18px' }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
