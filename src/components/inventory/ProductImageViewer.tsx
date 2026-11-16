
import React from 'react';
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
  const [failed, setFailed] = React.useState(false);
  const image = product?.image?.trim() || null;

  React.useEffect(() => {
    setFailed(false);
  }, [product?.id, image]);

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[60] max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-4xl overflow-y-auto p-4 sm:p-6" dir="rtl">
        <DialogHeader className="pe-10">
          <DialogTitle>תמונת המוצר - {product.name}</DialogTitle>
        </DialogHeader>
        
        <div className="flex min-h-0 items-center justify-center">
          {image && !failed ? (
            <img
              src={image}
              alt={product.name}
              className="max-h-[calc(100dvh-8rem)] max-w-full object-contain rounded-lg shadow-lg"
              onError={() => setFailed(true)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-500">
              <Package className="w-16 h-16 mb-4" />
              <p>אין תמונה זמינה עבור מוצר זה</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
