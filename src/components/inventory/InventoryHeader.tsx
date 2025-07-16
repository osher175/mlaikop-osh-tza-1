
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
    <div className="flex flex-col sm:flex-col md:flex-row md:justify-between md:items-center gap-2 w-full">
      <div className="flex-1">
        <h1 className="text-3xl font-bold text-gray-900">ניהול מלאי</h1>
        <p className="text-gray-600">
          נהל את המוצרים והמלאי של {businessName}
          {isOwner ? ' (בעלים)' : ` (${userRole})`}
        </p>
      </div>
      <div className="flex flex-col sm:flex-col md:flex-row gap-2 w-full md:w-auto md:items-center">
        <Button 
          className="bg-primary hover:bg-primary-600 h-12 min-h-[44px] min-w-[44px] w-full md:w-auto"
          onClick={() => navigate('/add-product')}
        >
          <Plus className="w-5 h-5 ml-2" />
          הוסף מוצר חדש
        </Button>
      </div>
    </div>
  );
};
