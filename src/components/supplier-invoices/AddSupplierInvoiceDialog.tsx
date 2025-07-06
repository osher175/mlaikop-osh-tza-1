
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useSupplierInvoices } from '@/hooks/useSupplierInvoices';
import { Upload } from 'lucide-react';

interface AddSupplierInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddSupplierInvoiceDialog: React.FC<AddSupplierInvoiceDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { suppliers } = useSuppliers();
  const { createInvoice } = useSupplierInvoices();
  
  const [formData, setFormData] = useState({
    supplier_id: '',
    invoice_date: '',
    amount: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.supplier_id || !formData.invoice_date || !formData.amount) {
      return;
    }

    await createInvoice.mutateAsync({
      supplier_id: formData.supplier_id,
      invoice_date: formData.invoice_date,
      amount: parseFloat(formData.amount),
      file: selectedFile || undefined,
    });

    // Reset form
    setFormData({
      supplier_id: '',
      invoice_date: '',
      amount: '',
    });
    setSelectedFile(null);
    onOpenChange(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (allowedTypes.includes(file.type)) {
        setSelectedFile(file);
      } else {
        alert('נא לבחור קובץ PDF, JPG או PNG בלבד');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">הוסף חשבונית ספק</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="supplier-select">ספק *</Label>
            <Select
              value={formData.supplier_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, supplier_id: value }))}
              required
            >
              <SelectTrigger className="text-right">
                <SelectValue placeholder="בחר ספק" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice-date">תאריך החשבונית *</Label>
            <Input
              id="invoice-date"
              type="date"
              value={formData.invoice_date}
              onChange={(e) => setFormData(prev => ({ ...prev, invoice_date: e.target.value }))}
              className="text-right"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">סכום (₪) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              placeholder="הכנס סכום"
              className="text-right"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="file-upload">קובץ מצורף (PDF, JPG, PNG)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="file-upload"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="hidden"
              />
              <Label
                htmlFor="file-upload"
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50"
              >
                <Upload className="w-4 h-4" />
                {selectedFile ? selectedFile.name : 'בחר קובץ'}
              </Label>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createInvoice.isPending}
            >
              ביטול
            </Button>
            <Button
              type="submit"
              disabled={createInvoice.isPending}
              className="bg-turquoise hover:bg-turquoise/90"
            >
              {createInvoice.isPending ? 'שומר...' : 'שמור חשבונית'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
