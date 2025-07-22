
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
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier | null;
  onDelete: (id: string) => void;
}

const DeleteSupplierDialog: React.FC<DeleteSupplierDialogProps> = ({
  isOpen,
  onClose,
  supplier,
  onDelete
}) => {
  const handleDelete = () => {
    if (supplier) {
      onDelete(supplier.id);
    }
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
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

export default DeleteSupplierDialog;
