
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, X } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { useToast } from '@/hooks/use-toast';

interface BarcodeScannerProps {
  onScanSuccess: (barcode: string) => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScanSuccess }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReader = useRef<BrowserMultiFormatReader | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (codeReader.current) {
        codeReader.current.reset();
      }
    };
  }, []);

  const startScanning = async () => {
    try {
      setIsScanning(true);
      
      if (!codeReader.current) {
        codeReader.current = new BrowserMultiFormatReader();
      }

      const videoInputDevices = await codeReader.current.listVideoInputDevices();
      
      if (videoInputDevices.length === 0) {
        throw new Error('לא נמצאה מצלמה במכשיר');
      }

      // Use the first available camera (usually back camera on mobile)
      const firstDeviceId = videoInputDevices[0].deviceId;

      if (videoRef.current) {
        await codeReader.current.decodeFromVideoDevice(
          firstDeviceId,
          videoRef.current,
          (result, error) => {
            if (result) {
              const barcodeText = result.getText();
              onScanSuccess(barcodeText);
              toast({
                title: "ברקוד נסרק בהצלחה!",
                description: `ברקוד: ${barcodeText}`,
              });
              stopScanning();
              setIsOpen(false);
            }
            if (error && !(error.name === 'NotFoundException')) {
              console.error('Scanning error:', error);
            }
          }
        );
      }
    } catch (error) {
      console.error('Error starting camera:', error);
      toast({
        title: "שגיאה בפתיחת המצלמה",
        description: "אנא ודא שנתת הרשאה לגישה למצלמה",
        variant: "destructive",
      });
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (codeReader.current) {
      codeReader.current.reset();
    }
    setIsScanning(false);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      stopScanning();
    } else if (open) {
      startScanning();
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="px-2"
      >
        <Camera className="h-4 w-4" />
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>סריקת ברקוד</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-64 object-cover"
                playsInline
                muted
              />
              {!isScanning && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                  <div className="text-white text-center">
                    <Camera className="w-12 h-12 mx-auto mb-2" />
                    <p>מכין מצלמה...</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="text-center text-sm text-gray-600">
              כוון את המצלמה לכיוון הברקוד
            </div>
            
            <Button
              onClick={() => handleOpenChange(false)}
              variant="outline"
              className="w-full"
            >
              <X className="w-4 h-4 ml-2" />
              סגור
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
