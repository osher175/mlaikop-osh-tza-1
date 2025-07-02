
import React from 'react';

interface BarcodeInstructionsProps {
  cameraReady: boolean;
  error: string | null;
}

export const BarcodeInstructions: React.FC<BarcodeInstructionsProps> = ({
  cameraReady,
  error
}) => {
  if (!cameraReady || error) {
    return null;
  }

  return (
    <div className="text-center">
      <div className="text-sm text-gray-600 mb-2">
        כוון את המצלמה לכיוון הברקוד
      </div>
      <div className="text-xs text-gray-500">
        תומך ב: EAN-13, Code128, QR Code ועוד
      </div>
    </div>
  );
};
