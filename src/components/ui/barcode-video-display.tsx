
import React from 'react';
import { Camera, X } from 'lucide-react';

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
  return (
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
  );
};
