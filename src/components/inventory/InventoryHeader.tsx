import React from 'react';
import { Button } from '@/components/ui/button';
import { BillingLockedButton } from '@/components/billing/BillingLockedButton';
import { Plus, Download, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCostVisibility } from '@/hooks/useCostVisibility';
import { exportInventoryToCSV } from '@/utils/exportInventoryCSV';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ProductForExport {
  name: string;
  barcode?: string | null;
  product_categories?: { name: string } | null;
  suppliers?: { name: string } | null;
  supplier_id?: string | null;
  location?: string | null;
  quantity: number;
  cost?: number | null;
  updated_at?: string | null;
}

interface InventoryHeaderProps {
  businessName: string;
  userRole: string;
  isOwner: boolean;
  products?: ProductForExport[];
}

export const InventoryHeader: React.FC<InventoryHeaderProps> = ({
  businessName,
  userRole,
  isOwner,
  products = [],
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hidden: costHidden, toggle: toggleCost } = useCostVisibility();

  const handleExportCSV = async () => {
    if (products.length === 0) {
      toast({
        title: 'אין מוצרים לייצוא',
        description: 'הוסף מוצרים למלאי לפני ייצוא',
        variant: 'destructive',
      });
      return;
    }

    try {
      await exportInventoryToCSV(products);
      toast({
        title: 'הקובץ יורד',
        description: `יוצאו ${products.length} מוצרים לקובץ Excel`,
      });
    } catch (error) {
      toast({
        title: 'שגיאה בייצוא',
        description: 'אירעה שגיאה בעת יצירת הקובץ',
        variant: 'destructive',
      });
    }
  };

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
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-12 min-h-[44px] min-w-[44px]"
                onClick={toggleCost}
                aria-label={costHidden ? 'הצג מחיר עלות' : 'הסתר מחיר עלות'}
                aria-pressed={!costHidden}
              >
                {costHidden ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{costHidden ? 'הצג מחיר עלות' : 'הסתר מחיר עלות (מומלץ ליד לקוחות)'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline"
                className="h-12 min-h-[44px] min-w-[44px] w-full md:w-auto"
                onClick={handleExportCSV}
              >
                <Download className="w-5 h-5 ml-2" />
                📤 ייצוא לאקסל
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>נפתח באקסל ומוכן להדפסה</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <BillingLockedButton
          className="bg-primary hover:bg-primary-600 h-12 min-h-[44px] min-w-[44px] w-full md:w-auto"
          onClick={() => navigate('/add-product')}
        >
          <Plus className="w-5 h-5 ml-2" />
          הוסף מוצר חדש
        </BillingLockedButton>
      </div>
    </div>
  );
};
