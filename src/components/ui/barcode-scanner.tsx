
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
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReader = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async () => {
    try {
      setIsScanning(true);
      setCameraReady(false);
      setError(null);
      
      // First, request camera permissions
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
        
        // Initialize the barcode reader
        if (!codeReader.current) {
          codeReader.current = new BrowserMultiFormatReader();
        }

        // Start decoding
        controlsRef.current = await codeReader.current.decodeFromVideoDevice(
          undefined,
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
            // Don't log NotFoundException as it's normal when no barcode is detected
            if (error && error.name !== 'NotFoundException') {
              console.error('Scanning error:', error);
            }
          }
        );
      }
    } catch (error: any) {
      console.error('Error starting camera:', error);
      setError('שגיאה בפתיחת המצלמה');
      toast({
        title: "שגיאה בפתיחת המצלמה",
        description: "אנא ודא שנתת הרשאה לגישה למצלמה",
        variant: "destructive",
      });
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    // Stop the decoder controls
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch (error) {
        console.error('Error stopping controls:', error);
      }
      controlsRef.current = null;
    }
    
    // Stop video stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsScanning(false);
    setCameraReady(false);
    setError(null);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      stopScanning();
    } else if (open) {
      // Start scanning immediately when dialog opens
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
                autoPlay
                style={{ transform: 'scaleX(-1)' }}
              />
              {!cameraReady && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                  <div className="text-white text-center">
                    <Camera className="w-12 h-12 mx-auto mb-2 animate-pulse" />
                    <p>{isScanning ? 'מכין מצלמה...' : 'לחץ כדי להתחיל'}</p>
                  </div>
                </div>
              )}
              {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-500 bg-opacity-75">
                  <div className="text-white text-center">
                    <X className="w-12 h-12 mx-auto mb-2" />
                    <p>{error}</p>
                  </div>
                </div>
              )}
            </div>
            
            {cameraReady && !error && (
              <div className="text-center text-sm text-gray-600">
                כוון את המצלמה לכיוון הברקוד
              </div>
            )}
            
            <div className="flex gap-2">
              {error && (
                <Button
                  onClick={startScanning}
                  variant="outline"
                  className="flex-1"
                  disabled={isScanning}
                >
                  נסה שוב
                </Button>
              )}
              <Button
                onClick={() => handleOpenChange(false)}
                variant="outline"
                className="flex-1"
              >
                <X className="w-4 h-4 ml-2" />
                סגור
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
