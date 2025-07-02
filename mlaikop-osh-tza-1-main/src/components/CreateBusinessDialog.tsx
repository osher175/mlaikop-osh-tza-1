
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBusiness } from '@/hooks/useBusiness';

interface CreateBusinessDialogProps {
  open: boolean;
  onClose: () => void;
}

export const CreateBusinessDialog: React.FC<CreateBusinessDialogProps> = ({ open, onClose }) => {
  const [businessName, setBusinessName] = useState('');
  const { createBusiness } = useBusiness();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) return;

    try {
      await createBusiness.mutateAsync({ name: businessName });
      setBusinessName('');
      onClose();
    } catch (error) {
      console.error('Error creating business:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>צור עסק חדש</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="businessName">שם העסק</Label>
            <Input
              id="businessName"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="הכנס שם עסק..."
              required
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={createBusiness.isPending}>
              {createBusiness.isPending ? 'יוצר...' : 'צור עסק'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              ביטול
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
