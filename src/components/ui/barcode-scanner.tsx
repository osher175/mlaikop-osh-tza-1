
import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { BarcodeVideoDisplay } from './barcode-video-display';
import { BarcodeInstructions } from './barcode-instructions';
import { BarcodeActions } from './barcode-actions';
import { useIsMobile } from '@/hooks/use-mobile';

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onBarcodeScanned: (barcode: string) => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ 
  open, 
  onClose, 
  onBarcodeScanned 
}) => {
  const isMobile = useIsMobile();
  const {
    isScanning,
    cameraReady,
    error,
    videoRef,
    startScanning,
    stopScanning
  } = useBarcodeScanner((barcode: string) => {
    onBarcodeScanned(barcode);
    onClose();
  });

  useEffect(() => {
    if (open) {
      startScanning();
    } else {
      stopScanning();
    }
  }, [open, startScanning, stopScanning]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent 
        className={`${isMobile ? 'max-w-[95vw] max-h-[90vh] p-4' : 'max-w-md'}`} 
        dir="rtl"
      >
        <DialogHeader>
          <DialogTitle className="text-center">סריקת ברקוד</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <BarcodeVideoDisplay
            videoRef={videoRef}
            cameraReady={cameraReady}
            error={error}
            isScanning={isScanning}
          />
          
          <BarcodeInstructions
            cameraReady={cameraReady}
            error={error}
          />
          
          <BarcodeActions
            error={error}
            isScanning={isScanning}
            onRetry={startScanning}
            onClose={onClose}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
