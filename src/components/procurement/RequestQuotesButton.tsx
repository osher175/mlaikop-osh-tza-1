import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShoppingCart } from 'lucide-react';
import { useProcurementRequests } from '@/hooks/useProcurementRequests';
import { useNavigate } from 'react-router-dom';

interface RequestQuotesButtonProps {
  productId: string;
  productName: string;
  currentQuantity: number;
  threshold?: number;
  existingRequestId?: string;
  size?: 'sm' | 'default';
  className?: string;
}

export const RequestQuotesButton: React.FC<RequestQuotesButtonProps> = ({
  productId,
  productName,
  currentQuantity,
  threshold = 5,
  existingRequestId,
  size = 'sm',
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(Math.max(threshold * 2, 1));
  const [notes, setNotes] = useState('');
  const { createManualRequest } = useProcurementRequests();
  const navigate = useNavigate();

  if (existingRequestId) {
    return (
      <Button
        size={size}
        variant="outline"
        className={`text-indigo-600 hover:text-indigo-700 ${className}`}
        onClick={() => navigate(`/procurement/${existingRequestId}`)}
        title="צפה בבקשת רכש פעילה"
      >
        <ShoppingCart className="w-3 h-3" />
      </Button>
    );
  }

  // Only show for low stock or out of stock
  if (currentQuantity > threshold) return null;

  const handleSubmit = () => {
    createManualRequest.mutate(
      { productId, quantity, notes: notes || undefined },
      { onSuccess: () => setOpen(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size={size}
          variant="outline"
          className={`text-indigo-600 hover:text-indigo-700 ${className}`}
          title="בקש הצעות מחיר"
        >
          <ShoppingCart className="w-3 h-3" />
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader>
          <DialogTitle>בקש הצעות מחיר</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600 mb-4">
          {productName} - מלאי נוכחי: {currentQuantity}
        </p>
        <div className="space-y-3">
          <div>
            <Label>כמות מבוקשת</Label>
            <Input type="number" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)} min="1" />
          </div>
          <div>
            <Label>הערות (אופציונלי)</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <Button onClick={handleSubmit} disabled={createManualRequest.isPending} className="w-full">
            {createManualRequest.isPending ? 'שולח...' : 'שלח בקשה'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
