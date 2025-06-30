
import React from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface BarcodeActionsProps {
  error: string | null;
  isScanning: boolean;
  onRetry: () => void;
  onClose: () => void;
}

export const BarcodeActions: React.FC<BarcodeActionsProps> = ({
  error,
  isScanning,
  onRetry,
  onClose
}) => {
  const isMobile = useIsMobile();

  return (
    <div className={`flex gap-3 ${isMobile ? 'flex-col' : 'flex-row'}`}>
      {error && (
        <Button
          onClick={onRetry}
          variant="outline"
          className={`${isMobile ? 'w-full h-12' : 'flex-1'}`}
          disabled={isScanning}
        >
          נסה שוב
        </Button>
      )}
      <Button
        onClick={onClose}
        variant="outline"
        className={`${isMobile ? 'w-full h-12' : 'flex-1'}`}
      >
        <X className="w-4 h-4 ml-2" />
        סגור
      </Button>
    </div>
  );
};
