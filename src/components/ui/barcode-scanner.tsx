
import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { BarcodeVideoDisplay } from './barcode-video-display';
import { BarcodeInstructions } from './barcode-instructions';
import { BarcodeActions } from './barcode-actions';

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
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>סריקת ברקוד</DialogTitle>
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
