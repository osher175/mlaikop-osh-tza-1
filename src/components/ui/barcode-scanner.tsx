
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
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReader = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      stopScanning();
    };
  }, []);

  const startScanning = async () => {
    try {
      setIsScanning(true);
      setCameraReady(false);
      
      if (!codeReader.current) {
        codeReader.current = new BrowserMultiFormatReader();
      }

      const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();
      
      if (videoInputDevices.length === 0) {
        throw new Error('לא נמצאה מצלמה במכשיר');
      }

      // Use the first available camera (usually back camera on mobile)
      const firstDeviceId = videoInputDevices[0].deviceId;

      if (videoRef.current) {
        // Wait a bit for the video element to be ready
        setTimeout(async () => {
          try {
            controlsRef.current = await codeReader.current.decodeFromVideoDevice(
              firstDeviceId,
              videoRef.current,
              (result, error) => {
                if (result) {
                  const barcodeText = result.getText();
                  console.log('Barcode scanned:', barcodeText);
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
            setCameraReady(true);
          } catch (error) {
            console.error('Error starting decoder:', error);
            toast({
              title: "שגיאה בהפעלת הסריקה",
              description: "נסה שוב או בדוק הרשאות המצלמה",
              variant: "destructive",
            });
            setIsScanning(false);
          }
        }, 300);
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
    // Stop the decoder controls if they exist
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch (error) {
        console.error('Error stopping controls:', error);
      }
      controlsRef.current = null;
    }
    
    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsScanning(false);
    setCameraReady(false);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      stopScanning();
    } else if (open) {
      // Small delay to ensure dialog is fully rendered
      setTimeout(() => {
        startScanning();
      }, 100);
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
                id="video-preview"
                className="w-full h-64 object-cover"
                playsInline
                muted
                autoPlay
              />
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                  <div className="text-white text-center">
                    <Camera className="w-12 h-12 mx-auto mb-2" />
                    <p>{isScanning ? 'מכין מצלמה...' : 'לחץ כדי להתחיל'}</p>
                  </div>
                </div>
              )}
            </div>
            
            {cameraReady && (
              <div className="text-center text-sm text-gray-600">
                כוון את המצלמה לכיוון הברקוד
              </div>
            )}
            
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
