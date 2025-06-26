
import React from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

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
  return (
    <div className="flex gap-2">
      {error && (
        <Button
          onClick={onRetry}
          variant="outline"
          className="flex-1"
          disabled={isScanning}
        >
          נסה שוב
        </Button>
      )}
      <Button
        onClick={onClose}
        variant="outline"
        className="flex-1"
      >
        <X className="w-4 h-4 ml-2" />
        סגור
      </Button>
    </div>
  );
};
