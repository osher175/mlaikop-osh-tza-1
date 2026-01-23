import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  InsightsData, 
  InsightType, 
  InsightSeverity,
  LowMarginItem,
  HighDiscountItem,
  DeadStockItem,
  StockoutRiskItem,
  CostSpikeItem,
  BusinessHealthMonth,
} from '@/types/insights';
import { formatCurrency } from '@/lib/formatCurrency';

interface InsightDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  insightType: InsightType | null;
  insights: InsightsData | null;
}

const getSeverityBadge = (severity: InsightSeverity) => {
  switch (severity) {
    case 'high':
      return <Badge variant="destructive">קריטי</Badge>;
    case 'medium':
      return <Badge className="bg-orange-100 text-orange-800">בינוני</Badge>;
    case 'low':
      return <Badge className="bg-green-100 text-green-800">תקין</Badge>;
  }
};

const getMarginSeverity = (margin: number): InsightSeverity => {
  if (margin < 0) return 'high';
  if (margin < 10) return 'medium';
  return 'low';
};

const getStockoutSeverity = (days: number): InsightSeverity => {
  if (days < 3) return 'high';
  if (days < 7) return 'medium';
  return 'low';
};

export const InsightDetailDrawer: React.FC<InsightDetailDrawerProps> = ({
  isOpen,
  onClose,
  insightType,
  insights,
}) => {
  const navigate = useNavigate();

  if (!insightType || !insights) return null;

  const handleOpenProduct = (productId: string) => {
    navigate(`/inventory?product=${productId}`);
    onClose();
  };

  const renderNoData = (message: string) => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Info className="h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-muted-foreground">{message}</p>
      <p className="text-sm text-muted-foreground mt-2">
        כשיירשמו פעולות מלאי רלוונטיות, הנתונים יופיעו כאן
      </p>
    </div>
  );

  const renderLowMarginTable = (items: LowMarginItem[]) => {
    if (items.length === 0) return renderNoData('כל המוצרים ברווחיות תקינה');
    
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">מוצר</TableHead>
            <TableHead className="text-right">יחידות נמכרו</TableHead>
            <TableHead className="text-right">הכנסות</TableHead>
            <TableHead className="text-right">רווח גולמי</TableHead>
            <TableHead className="text-right">אחוז רווח</TableHead>
            <TableHead className="text-right">סטטוס</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(item => (
            <TableRow key={item.productId}>
              <TableCell className="font-medium">{item.productName}</TableCell>
              <TableCell>{item.unitsSold}</TableCell>
              <TableCell>{formatCurrency(item.revenue)}</TableCell>
              <TableCell className={item.grossProfit < 0 ? 'text-red-600' : ''}>
                {formatCurrency(item.grossProfit)}
              </TableCell>
              <TableCell className={item.marginPercent < 0 ? 'text-red-600' : ''}>
                {item.marginPercent.toFixed(1)}%
              </TableCell>
              <TableCell>{getSeverityBadge(getMarginSeverity(item.marginPercent))}</TableCell>
              <TableCell>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleOpenProduct(item.productId)}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const renderHighDiscountTable = (items: HighDiscountItem[]) => {
    if (items.length === 0) return renderNoData('אין הנחות חריגות');
    
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">מוצר</TableHead>
            <TableHead className="text-right">מכירות</TableHead>
            <TableHead className="text-right">הנחה ממוצעת</TableHead>
            <TableHead className="text-right">סה״כ הנחות</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(item => (
            <TableRow key={item.productId}>
              <TableCell className="font-medium">{item.productName}</TableCell>
              <TableCell>{item.salesCount}</TableCell>
              <TableCell className="text-orange-600">{item.avgDiscountPercent.toFixed(1)}%</TableCell>
              <TableCell>{formatCurrency(item.totalDiscountIls)}</TableCell>
              <TableCell>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleOpenProduct(item.productId)}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const renderDeadStockTable = (items: DeadStockItem[]) => {
    if (items.length === 0) return renderNoData('אין מלאי מת');
    
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">מוצר</TableHead>
            <TableHead className="text-right">כמות במלאי</TableHead>
            <TableHead className="text-right">ימים מאז מכירה</TableHead>
            <TableHead className="text-right">שווי עלות מלאי</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(item => (
            <TableRow key={item.productId}>
              <TableCell className="font-medium">{item.productName}</TableCell>
              <TableCell>{item.quantity}</TableCell>
              <TableCell>
                {item.daysSinceLastSale === null 
                  ? <span className="text-muted-foreground">אין היסטוריית מכירות</span>
                  : `${item.daysSinceLastSale} ימים`
                }
              </TableCell>
              <TableCell>
                {item.estimatedValue > 0 
                  ? formatCurrency(item.estimatedValue) 
                  : <span className="text-muted-foreground">—</span>
                }
              </TableCell>
              <TableCell>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleOpenProduct(item.productId)}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const renderStockoutRiskTable = (items: StockoutRiskItem[]) => {
    if (items.length === 0) return renderNoData('אין מוצרים בסיכון חוסר מלאי');
    
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">מוצר</TableHead>
            <TableHead className="text-right">כמות נוכחית</TableHead>
            <TableHead className="text-right">מכירות יומיות (ממוצע)</TableHead>
            <TableHead className="text-right">ימי כיסוי</TableHead>
            <TableHead className="text-right">סטטוס</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(item => (
            <TableRow key={item.productId}>
              <TableCell className="font-medium">{item.productName}</TableCell>
              <TableCell>{item.currentQuantity}</TableCell>
              <TableCell>{item.avgDailySales}</TableCell>
              <TableCell className={item.daysCover < 3 ? 'text-red-600 font-bold' : ''}>
                {item.daysCover} ימים
              </TableCell>
              <TableCell>{getSeverityBadge(getStockoutSeverity(item.daysCover))}</TableCell>
              <TableCell>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleOpenProduct(item.productId)}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const renderCostSpikeTable = (items: CostSpikeItem[]) => {
    if (items.length === 0) return renderNoData('אין התייקרויות חריגות');
    
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">מוצר</TableHead>
            <TableHead className="text-right">עלות ממוצעת (90 יום)</TableHead>
            <TableHead className="text-right">עלות ממוצעת (30 יום)</TableHead>
            <TableHead className="text-right">שינוי</TableHead>
            <TableHead className="text-right">ספק</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(item => (
            <TableRow key={item.productId}>
              <TableCell className="font-medium">{item.productName}</TableCell>
              <TableCell>{formatCurrency(item.avgCost90Days)}</TableCell>
              <TableCell>{formatCurrency(item.avgCost30Days)}</TableCell>
              <TableCell className="text-red-600">+{item.changePercent.toFixed(1)}%</TableCell>
              <TableCell>{item.supplierName || '—'}</TableCell>
              <TableCell>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleOpenProduct(item.productId)}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const renderBusinessHealthTable = (items: BusinessHealthMonth[], warning: boolean, warningMessage?: string) => {
    const hasData = items.some(m => m.totalRevenue > 0);
    if (!hasData) return renderNoData('אין נתוני מכירות לשנה הנוכחית');
    
    return (
      <div>
        {warning && warningMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 font-medium">⚠️ {warningMessage}</p>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">חודש</TableHead>
              <TableHead className="text-right">הכנסות</TableHead>
              <TableHead className="text-right">רווח גולמי</TableHead>
              <TableHead className="text-right">סה״כ הנחות</TableHead>
              <TableHead className="text-right">הנחה ממוצעת</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.filter(m => m.totalRevenue > 0).map(item => (
              <TableRow key={item.monthIndex}>
                <TableCell className="font-medium">{item.month}</TableCell>
                <TableCell>{formatCurrency(item.totalRevenue)}</TableCell>
                <TableCell className={item.grossProfit < 0 ? 'text-red-600' : 'text-green-600'}>
                  {formatCurrency(item.grossProfit)}
                </TableCell>
                <TableCell>{formatCurrency(item.totalDiscounts)}</TableCell>
                <TableCell>{item.avgDiscountPercent.toFixed(1)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const getContent = () => {
    switch (insightType) {
      case 'low_margin':
        return {
          title: 'רווחיות נמוכה / הפסד לפי מוצר',
          description: 'מוצרים עם רווחיות נמוכה או הפסד ב-30 הימים האחרונים',
          content: renderLowMarginTable(insights.lowMargin.items),
        };
      case 'high_discount':
        return {
          title: 'הנחות חריגות',
          description: 'מוצרים עם הנחות גבוהות מהממוצע ב-30 הימים האחרונים',
          content: renderHighDiscountTable(insights.highDiscount.items),
        };
      case 'dead_stock':
        return {
          title: 'מלאי מת',
          description: 'מוצרים שלא נמכרו מעל 60 יום או שאין להם היסטוריית מכירות',
          content: renderDeadStockTable(insights.deadStock.items),
        };
      case 'stockout_risk':
        return {
          title: 'סיכון חוסר מלאי',
          description: 'מוצרים שצפויים להיגמר תוך פחות מ-7 ימים לפי קצב המכירות',
          content: renderStockoutRiskTable(insights.stockoutRisk.items),
        };
      case 'cost_spike':
        return {
          title: 'התייקרות עלות קנייה',
          description: 'מוצרים שעלות הרכישה שלהם עלתה מעל 10% ב-90 הימים האחרונים',
          content: renderCostSpikeTable(insights.costSpike.items),
        };
      case 'business_health':
        return {
          title: 'בריאות עסקית - סקירה חודשית',
          description: 'ניתוח מגמות הכנסות, רווחיות והנחות לפי חודשים',
          content: renderBusinessHealthTable(
            insights.businessHealth.items, 
            insights.businessHealth.warning,
            insights.businessHealth.warningMessage
          ),
        };
    }
  };

  const { title, description, content } = getContent();

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="w-full sm:max-w-2xl overflow-y-auto" dir="rtl">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-xl">{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {content}
      </SheetContent>
    </Sheet>
  );
};
