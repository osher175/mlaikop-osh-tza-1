
import React, { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, Loader2 } from 'lucide-react';

interface OptimizedSearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  isLoading?: boolean;
}

export const OptimizedSearchBar: React.FC<OptimizedSearchBarProps> = ({
  searchTerm,
  onSearchChange,
  isLoading = false
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
  }, [onSearchChange]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  return (
    <Card className="w-full shadow-sm border-gray-200 transition-all duration-200">
      <CardContent className="p-3 sm:p-4 lg:p-6">
        <div className="flex justify-center">
          <div className="
            relative 
            w-full
            sm:w-[85%] 
            sm:max-w-[500px]
            lg:max-w-[600px]
            mx-auto
          ">
            {/* Search Icon with Loading State */}
            <div className="
              absolute 
              right-4 
              top-1/2 
              transform 
              -translate-y-1/2 
              transition-colors 
              duration-300
              z-10
            ">
              {isLoading ? (
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary animate-spin" />
              ) : (
                <Search className="
                  w-5 h-5 
                  sm:w-6 sm:h-6
                  text-gray-400
                  transition-colors 
                  duration-300
                " />
              )}
            </div>

            <Input
              placeholder="חפש מוצר לפי שם, קטגוריה או ספק..."
              value={searchTerm}
              onChange={handleInputChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              className="
                w-full
                h-12 
                sm:h-14
                lg:h-16
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
                focus:shadow-lg
                focus:scale-[1.005]
                hover:border-gray-300
                hover:shadow-md
                placeholder:text-gray-500
                placeholder:font-normal
                disabled:opacity-50
                disabled:cursor-not-allowed
              "
              style={{ 
                fontSize: 'clamp(16px, 2.5vw, 18px)',
                padding: '14px 48px 14px 16px',
                // Prevent zoom on iOS
                WebkitAppearance: 'none'
              }}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />

            {/* Focus indicator for better accessibility */}
            {isFocused && (
              <div className="
                absolute 
                inset-0 
                rounded-lg 
                border-2 
                border-primary 
                pointer-events-none
                animate-pulse
              " />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
