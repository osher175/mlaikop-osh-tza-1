
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
  const scanningActiveRef = useRef<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  const waitForVideoReady = (video: HTMLVideoElement): Promise<void> => {
    return new Promise((resolve) => {
      if (video.readyState >= 2) {
        console.log('🎥 Video already ready, readyState:', video.readyState);
        resolve();
      } else {
        console.log('⏳ Waiting for video loadedmetadata event...');
        const handleLoadedMetadata = () => {
          console.log('✅ Video loadedmetadata fired, readyState:', video.readyState);
          video.removeEventListener('loadedmetadata', handleLoadedMetadata);
          // Additional stabilization delay
          setTimeout(() => {
            console.log('🎯 Video stabilization completed');
            resolve();
          }, 1500);
        };
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
      }
    });
  };

  const startScanning = async () => {
    try {
      console.log('🚀 Starting barcode scanning process...');
      setIsScanning(true);
      setCameraReady(false);
      setError(null);
      scanningActiveRef.current = true;
      
      // Enhanced camera constraints for better barcode recognition
      const constraints = {
        video: {
          facingMode: 'environment', // Use back camera for better scanning
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 }
        }
      };
      
      console.log('📷 Requesting camera access with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      streamRef.current = stream;
      console.log('✅ Camera stream obtained successfully');
      
      if (videoRef.current && scanningActiveRef.current) {
        console.log('🔗 Connecting stream to video element...');
        videoRef.current.srcObject = stream;
        
        // Remove any transforms that might interfere with barcode detection
        videoRef.current.style.transform = 'none';
        
        // Wait for video to be fully ready
        await waitForVideoReady(videoRef.current);
        
        if (!scanningActiveRef.current) {
          console.log('⚠️ Scanning cancelled during video setup');
          return;
        }

        setCameraReady(true);
        console.log('🎬 Camera is ready, initializing barcode reader...');
        
        // Initialize the barcode reader
        if (!codeReader.current) {
          codeReader.current = new BrowserMultiFormatReader();
          console.log('📚 BrowserMultiFormatReader created');
        }

        // Additional stability delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (!scanningActiveRef.current) {
          console.log('⚠️ Scanning cancelled during final setup');
          return;
        }

        console.log('🔍 Starting barcode detection with enhanced settings...');
        
        // Start decoding with comprehensive error handling
        controlsRef.current = await codeReader.current.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, error) => {
            if (result && scanningActiveRef.current) {
              const barcodeText = result.getText();
              console.log('🎉 Barcode successfully detected:', barcodeText);
              console.log('📋 Barcode format:', result.getBarcodeFormat());
              
              onScanSuccess(barcodeText);
              toast({
                title: "ברקוד נסרק בהצלחה!",
                description: `ברקוד: ${barcodeText}`,
              });
              stopScanning();
              setIsOpen(false);
            }
            
            // Log only significant errors to avoid console spam
            if (error && error.name !== 'NotFoundException') {
              console.log('⚠️ Scanning error:', error.name, error.message);
            }
          }
        );
        
        console.log('🔄 Barcode scanning loop started successfully');
      }
    } catch (error: any) {
      console.error('❌ Error starting camera or barcode scanning:', error);
      let errorMessage = 'שגיאה בפתיחת המצלמה';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'נדרשת הרשאה לגישה למצלמה';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'לא נמצאה מצלמה במכשיר';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'הדפדפן אינו תומך בסריקת ברקוד';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'הגדרות המצלמה אינן נתמכות';
      }
      
      setError(errorMessage);
      toast({
        title: "שגיאה בפתיחת המצלמה",
        description: errorMessage,
        variant: "destructive",
      });
      setIsScanning(false);
      scanningActiveRef.current = false;
    }
  };

  const stopScanning = () => {
    console.log('🛑 Stopping barcode scanning...');
    scanningActiveRef.current = false;
    
    // Stop the decoder controls
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
        console.log('✅ Decoder controls stopped');
      } catch (error) {
        console.error('❌ Error stopping decoder controls:', error);
      }
      controlsRef.current = null;
    }
    
    // Stop video stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('📹 Camera track stopped:', track.kind);
      });
      streamRef.current = null;
    }
    
    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsScanning(false);
    setCameraReady(false);
    setError(null);
    console.log('🧹 Barcode scanning cleanup completed');
  };

  const handleOpenChange = (open: boolean) => {
    console.log('🔄 Dialog open state changing to:', open);
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
              <div className="text-center">
                <div className="text-sm text-gray-600 mb-2">
                  כוון את המצלמה לכיוון הברקוד
                </div>
                <div className="text-xs text-gray-500">
                  תומך ב: EAN-13, Code128, QR Code ועוד
                </div>
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
