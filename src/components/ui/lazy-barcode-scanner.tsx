import React, { Suspense, lazy } from 'react';

/**
 * Phase A3: `@zxing/browser` (~zxing decoder) is only needed once the user
 * actually opens the scanner. Loading the real component lazily keeps the
 * library out of the initial bundle. Behavior is identical — the underlying
 * <BarcodeScanner /> is mounted with the same props the moment `open` is true.
 */
const BarcodeScanner = lazy(() =>
  import('@/components/ui/barcode-scanner').then((m) => ({ default: m.BarcodeScanner }))
);

interface LazyBarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onBarcodeScanned: (barcode: string) => void;
}

export const LazyBarcodeScanner: React.FC<LazyBarcodeScannerProps> = ({
  open,
  onClose,
  onBarcodeScanned,
}) => {
  if (!open) return null;

  return (
    <Suspense fallback={null}>
      <BarcodeScanner open={open} onClose={onClose} onBarcodeScanned={onBarcodeScanned} />
    </Suspense>
  );
};
