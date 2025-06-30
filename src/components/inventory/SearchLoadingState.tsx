
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, AlertCircle } from 'lucide-react';

interface SearchLoadingStateProps {
  isLoading: boolean;
  isEmpty: boolean;
  hasError: boolean;
  searchTerm: string;
}

export const SearchLoadingState: React.FC<SearchLoadingStateProps> = ({
  isLoading,
  isEmpty,
  hasError,
  searchTerm
}) => {
  if (isLoading) {
    return (
      <div className="space-y-3 py-4" style={{ minHeight: '120px' }}>
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg animate-pulse">
          <Skeleton className="h-4 w-4 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg animate-pulse">
          <Skeleton className="h-4 w-4 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg animate-pulse">
          <Skeleton className="h-4 w-4 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">שגיאה בחיפוש</h3>
        <p className="text-gray-500">נסה שוב או רענן את הדף</p>
      </div>
    );
  }

  if (isEmpty && searchTerm.trim()) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Search className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">לא נמצאו מוצרים</h3>
        <p className="text-gray-500">
          לא נמצאו מוצרים התואמים לחיפוש "{searchTerm}"
        </p>
        <p className="text-sm text-gray-400 mt-2">
          נסה לחפש במילות מפתח אחרות או בדוק את הכתיב
        </p>
      </div>
    );
  }

  return null;
};
