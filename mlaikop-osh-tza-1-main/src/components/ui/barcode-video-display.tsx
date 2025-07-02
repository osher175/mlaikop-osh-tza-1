
import React from 'react';
import { Camera, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface BarcodeVideoDisplayProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  cameraReady: boolean;
  error: string | null;
  isScanning: boolean;
}

export const BarcodeVideoDisplay: React.FC<BarcodeVideoDisplayProps> = ({
  videoRef,
  cameraReady,
  error,
  isScanning
}) => {
  const isMobile = useIsMobile();

  return (
    <div className="relative bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        className={`w-full object-cover ${isMobile ? 'h-48 sm:h-64' : 'h-64'}`}
        playsInline
        muted
        autoPlay
      />
      
      {/* Scanning overlay */}
      <div className="absolute inset-0 border-2 border-transparent">
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-32 border-2 border-white rounded-lg opacity-75">
          <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-green-500 rounded-tl-lg animate-pulse"></div>
          <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-green-500 rounded-tr-lg animate-pulse"></div>
          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-green-500 rounded-bl-lg animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-green-500 rounded-br-lg animate-pulse"></div>
        </div>
      </div>
      
      {!cameraReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-white text-center">
            <Camera className="w-12 h-12 mx-auto mb-2 animate-pulse" />
            <p className="text-sm">{isScanning ? 'מכין מצלמה...' : 'לחץ כדי להתחיל'}</p>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-500 bg-opacity-75">
          <div className="text-white text-center p-4">
            <X className="w-12 h-12 mx-auto mb-2" />
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};
