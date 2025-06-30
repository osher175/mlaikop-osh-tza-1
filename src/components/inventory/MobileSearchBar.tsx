
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface MobileSearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export const MobileSearchBar: React.FC<MobileSearchBarProps> = ({
  searchTerm,
  onSearchChange,
}) => {
  return (
    <Card className="w-full shadow-sm border-gray-200">
      <CardContent className="p-4 sm:p-6">
        <div className="flex justify-center">
          <div className="
            relative 
            w-full
            sm:w-[80%] 
            sm:max-w-[500px]
            lg:max-w-[600px]
            mx-auto
          ">
            <Search className="
              absolute 
              right-4 
              top-1/2 
              transform 
              -translate-y-1/2 
              text-gray-400 
              w-5 h-5 
              sm:w-6 sm:h-6
              transition-colors 
              duration-300
            " />
            <Input
              placeholder="חפש מוצר לפי שם, קטגוריה או ספק..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="
                w-full
                h-12 
                sm:h-14
                pr-12 
                pl-4
                text-base
                sm:text-lg
                lg:text-lg
                font-medium
                rounded-lg 
                border-2 
                border-gray-200 
                bg-white 
                shadow-sm
                transition-all 
                duration-300 
                ease-in-out
                focus:border-primary 
                focus:ring-2 
                focus:ring-primary/20 
                focus:shadow-md
                focus:scale-[1.01]
                hover:border-gray-300
                placeholder:text-gray-500
                placeholder:font-normal
              "
              style={{ 
                fontSize: 'clamp(16px, 2.5vw, 18px)',
                padding: '12px 48px 12px 16px'
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
