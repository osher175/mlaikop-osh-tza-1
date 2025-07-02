
import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface InventoryHeaderProps {
  businessName: string;
  userRole: string;
  isOwner: boolean;
}

export const InventoryHeader: React.FC<InventoryHeaderProps> = ({
  businessName,
  userRole,
  isOwner,
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex justify-between items-center">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">ניהול מלאי</h1>
        <p className="text-gray-600">
          נהל את המוצרים והמלאי של {businessName}
          {isOwner ? ' (בעלים)' : ` (${userRole})`}
        </p>
      </div>
      <Button 
        className="bg-primary hover:bg-primary-600"
        onClick={() => navigate('/add-product')}
      >
        <Plus className="w-4 h-4 ml-2" />
        הוסף מוצר חדש
      </Button>
    </div>
  );
};
