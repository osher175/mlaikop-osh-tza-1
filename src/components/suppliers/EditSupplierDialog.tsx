
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Supplier } from '@/hooks/useSuppliers';

interface EditSupplierDialogProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier | null;
  onSave: (supplier: Supplier) => void;
}

const EditSupplierDialog: React.FC<EditSupplierDialogProps> = ({
  isOpen,
  onClose,
  supplier,
  onSave
}) => {
  const { toast } = useToast();
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [agentName, setAgentName] = React.useState('');
  const [contactEmail, setContactEmail] = React.useState('');
  const [salesAgentName, setSalesAgentName] = React.useState('');
  const [salesAgentPhone, setSalesAgentPhone] = React.useState('');

  React.useEffect(() => {
    if (supplier) {
      setName(supplier.name || '');
      setPhone(supplier.phone || '');
      setEmail(supplier.email || '');
      setAgentName(supplier.agent_name || '');
      setContactEmail(supplier.contact_email || '');
      setSalesAgentName(supplier.sales_agent_name || '');
      setSalesAgentPhone(supplier.sales_agent_phone || '');
    }
  }, [supplier]);

  const handleSave = () => {
    if (!name.trim()) {
      toast({
        title: "שם ספק נדרש",
        description: "אנא הכנס שם ספק",
        variant: "destructive",
      });
      return;
    }

    if (!supplier) return;

    const updatedSupplier: Supplier = {
      ...supplier,
      name,
      phone,
      email,
      agent_name: agentName,
      contact_email: contactEmail,
      sales_agent_name: salesAgentName,
      sales_agent_phone: salesAgentPhone
    };

    onSave(updatedSupplier);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>עריכת ספק</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              שם
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="phone" className="text-right">
              טלפון
            </Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">
              דוא"ל
            </Label>
            <Input
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="agentName" className="text-right">
              שם סוכן
            </Label>
            <Input
              id="agentName"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="contactEmail" className="text-right">
              דוא"ל ליצירת קשר
            </Label>
            <Input
              id="contactEmail"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="salesAgentName" className="text-right">
              שם סוכן מכירות
            </Label>
            <Input
              id="salesAgentName"
              value={salesAgentName}
              onChange={(e) => setSalesAgentName(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="salesAgentPhone" className="text-right">
              טלפון סוכן מכירות
            </Label>
            <Input
              id="salesAgentPhone"
              value={salesAgentPhone}
              onChange={(e) => setSalesAgentPhone(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSave}>
            שמור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditSupplierDialog;
