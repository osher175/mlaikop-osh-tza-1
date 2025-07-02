
import { useState, useRef, useEffect } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { useToast } from '@/hooks/use-toast';

export const useBarcodeScanner = (onBarcodeScanned: (barcode: string) => void) => {
  const [isScanning, setIsScanning] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReader = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningActiveRef = useRef<boolean>(false);
  const { toast } = useToast();

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
      
      const constraints = {
        video: {
          facingMode: 'environment',
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
        videoRef.current.style.transform = 'none';
        
        await waitForVideoReady(videoRef.current);
        
        if (!scanningActiveRef.current) {
          console.log('⚠️ Scanning cancelled during video setup');
          return;
        }

        setCameraReady(true);
        console.log('🎬 Camera is ready, initializing barcode reader...');
        
        if (!codeReader.current) {
          codeReader.current = new BrowserMultiFormatReader();
          console.log('📚 BrowserMultiFormatReader created');
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

        if (!scanningActiveRef.current) {
          console.log('⚠️ Scanning cancelled during final setup');
          return;
        }

        console.log('🔍 Starting barcode detection with enhanced settings...');
        
        controlsRef.current = await codeReader.current.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, error) => {
            if (result && scanningActiveRef.current) {
              const barcodeText = result.getText();
              console.log('🎉 Barcode successfully detected:', barcodeText);
              console.log('📋 Barcode format:', result.getBarcodeFormat());
              
              onBarcodeScanned(barcodeText);
              toast({
                title: "ברקוד נסרק בהצלחה!",
                description: `ברקוד: ${barcodeText}`,
              });
              stopScanning();
            }
            
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
    
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
        console.log('✅ Decoder controls stopped');
      } catch (error) {
        console.error('❌ Error stopping decoder controls:', error);
      }
      controlsRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('📹 Camera track stopped:', track.kind);
      });
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsScanning(false);
    setCameraReady(false);
    setError(null);
    console.log('🧹 Barcode scanning cleanup completed');
  };

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  return {
    isScanning,
    cameraReady,
    error,
    videoRef,
    startScanning,
    stopScanning
  };
};
