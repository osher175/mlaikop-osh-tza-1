
import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Supplier } from '@/hooks/useSuppliers';

interface DeleteSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier | null;
}

export const DeleteSupplierDialog: React.FC<DeleteSupplierDialogProps> = ({
  open,
  onOpenChange,
  supplier
}) => {
  const handleDelete = () => {
    // Logic to delete supplier would go here
    // For now, we'll just close the dialog
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
          <AlertDialogDescription>
            פעולה זו תמחק את הספק "{supplier?.name}" לצמיתות ולא ניתן יהיה לשחזר אותו.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>ביטול</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            מחק
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
