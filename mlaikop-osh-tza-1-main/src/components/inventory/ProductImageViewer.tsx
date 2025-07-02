import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Package } from 'lucide-react';

interface ProductImageViewerProps {
  product: {
    id: string;
    name: string;
    image?: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProductImageViewer: React.FC<ProductImageViewerProps> = ({
  product,
  open,
  onOpenChange,
}) => {
  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>תמונת המוצר - {product.name}</DialogTitle>
        </DialogHeader>
        
        <div className="flex justify-center items-center min-h-[400px]">
          {product.image && typeof product.image === 'string' && product.image.trim() !== '' ? (
            <React.Suspense fallback={<div className="w-32 h-32 flex items-center justify-center"><span className="loader"></span></div>}>
              <img
                src={product.image}
                alt={product.name}
                loading="lazy"
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/placeholder.svg';
                }}
              />
            </React.Suspense>
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-500">
              <img src="/placeholder.svg" alt="אין תמונה זמינה" className="w-16 h-16 mb-4 opacity-70" />
              <p>אין תמונה זמינה עבור מוצר זה</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
