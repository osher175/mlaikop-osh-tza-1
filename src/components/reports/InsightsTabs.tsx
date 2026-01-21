import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Loader2, Info, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useInsights } from '@/hooks/useInsights';
import { InsightSeverity } from '@/types/insights';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

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

const NoDataMessage: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <Info className="h-16 w-16 text-muted-foreground mb-4" />
    <p className="text-lg text-muted-foreground">{message}</p>
    <p className="text-sm text-muted-foreground mt-2">
      כשיירשמו פעולות מלאי רלוונטיות, הנתונים יופיעו כאן
    </p>
  </div>
);

export const InsightsTabs: React.FC = () => {
  const { insights, isLoading } = useInsights();
  const navigate = useNavigate();

  const handleOpenProduct = (productId: string) => {
    navigate(`/inventory?product=${productId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!insights) {
    return (
      <Card>
        <CardContent className="py-16">
          <NoDataMessage message="אין מספיק נתונים לחישוב תובנות" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="low_margin" className="w-full" dir="rtl">
      <TabsList className="grid w-full grid-cols-6 mb-6">
        <TabsTrigger value="low_margin" className="text-xs sm:text-sm">
          רווחיות
          {insights.lowMargin.count > 0 && (
            <Badge variant="secondary" className="mr-1 text-xs">{insights.lowMargin.count}</Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="high_discount" className="text-xs sm:text-sm">
          הנחות
          {insights.highDiscount.count > 0 && (
            <Badge variant="secondary" className="mr-1 text-xs">{insights.highDiscount.count}</Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="dead_stock" className="text-xs sm:text-sm">
          מלאי מת
          {insights.deadStock.count > 0 && (
            <Badge variant="secondary" className="mr-1 text-xs">{insights.deadStock.count}</Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="stockout_risk" className="text-xs sm:text-sm">
          חוסר מלאי
          {insights.stockoutRisk.count > 0 && (
            <Badge variant="secondary" className="mr-1 text-xs">{insights.stockoutRisk.count}</Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="cost_spike" className="text-xs sm:text-sm">
          התייקרות
          {insights.costSpike.count > 0 && (
            <Badge variant="secondary" className="mr-1 text-xs">{insights.costSpike.count}</Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="business_health" className="text-xs sm:text-sm">
          בריאות עסקית
        </TabsTrigger>
      </TabsList>

      {/* Low Margin Tab */}
      <TabsContent value="low_margin">
        <Card>
          <CardHeader>
            <CardTitle>רווחיות נמוכה / הפסד לפי מוצר</CardTitle>
            <CardDescription>מוצרים עם רווחיות נמוכה או הפסד ב-30 הימים האחרונים</CardDescription>
          </CardHeader>
          <CardContent>
            {insights.lowMargin.items.length === 0 ? (
              <NoDataMessage message="כל המוצרים ברווחיות תקינה" />
            ) : (
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
                  {insights.lowMargin.items.map(item => (
                    <TableRow key={item.productId}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell>{item.unitsSold}</TableCell>
                      <TableCell>{formatCurrency(item.revenue)}</TableCell>
                      <TableCell className={item.grossProfit < 0 ? 'text-red-600 font-bold' : ''}>
                        {formatCurrency(item.grossProfit)}
                      </TableCell>
                      <TableCell className={item.marginPercent < 0 ? 'text-red-600 font-bold' : ''}>
                        {item.marginPercent.toFixed(1)}%
                      </TableCell>
                      <TableCell>
                        {getSeverityBadge(item.marginPercent < 0 ? 'high' : item.marginPercent < 10 ? 'medium' : 'low')}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenProduct(item.productId)}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* High Discount Tab */}
      <TabsContent value="high_discount">
        <Card>
          <CardHeader>
            <CardTitle>הנחות חריגות</CardTitle>
            <CardDescription>מוצרים עם הנחות גבוהות מ-25% ב-30 הימים האחרונים</CardDescription>
          </CardHeader>
          <CardContent>
            {insights.highDiscount.items.length === 0 ? (
              <NoDataMessage message="אין הנחות חריגות" />
            ) : (
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
                  {insights.highDiscount.items.map(item => (
                    <TableRow key={item.productId}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell>{item.salesCount}</TableCell>
                      <TableCell className="text-orange-600 font-bold">{item.avgDiscountPercent.toFixed(1)}%</TableCell>
                      <TableCell>{formatCurrency(item.totalDiscountIls)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenProduct(item.productId)}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Dead Stock Tab */}
      <TabsContent value="dead_stock">
        <Card>
          <CardHeader>
            <CardTitle>מלאי מת</CardTitle>
            <CardDescription>מוצרים שלא נמכרו מעל 60 יום או בלי היסטוריית מכירות</CardDescription>
          </CardHeader>
          <CardContent>
            {insights.deadStock.items.length === 0 ? (
              <NoDataMessage message="אין מלאי מת" />
            ) : (
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
                  {insights.deadStock.items.map(item => (
                    <TableRow key={item.productId}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>
                        {item.daysSinceLastSale === null 
                          ? <span className="text-muted-foreground italic">אין היסטוריית מכירות</span>
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
                        <Button variant="ghost" size="sm" onClick={() => handleOpenProduct(item.productId)}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Stockout Risk Tab */}
      <TabsContent value="stockout_risk">
        <Card>
          <CardHeader>
            <CardTitle>סיכון חוסר מלאי</CardTitle>
            <CardDescription>מוצרים שצפויים להיגמר תוך פחות מ-7 ימים לפי קצב המכירות</CardDescription>
          </CardHeader>
          <CardContent>
            {insights.stockoutRisk.items.length === 0 ? (
              <NoDataMessage message="אין מוצרים בסיכון חוסר מלאי" />
            ) : (
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
                  {insights.stockoutRisk.items.map(item => (
                    <TableRow key={item.productId}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell>{item.currentQuantity}</TableCell>
                      <TableCell>{item.avgDailySales}</TableCell>
                      <TableCell className={item.daysCover < 3 ? 'text-red-600 font-bold' : ''}>
                        {item.daysCover} ימים
                      </TableCell>
                      <TableCell>
                        {getSeverityBadge(item.daysCover < 3 ? 'high' : item.daysCover < 7 ? 'medium' : 'low')}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenProduct(item.productId)}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Cost Spike Tab */}
      <TabsContent value="cost_spike">
        <Card>
          <CardHeader>
            <CardTitle>התייקרות עלות קנייה</CardTitle>
            <CardDescription>מוצרים שעלות הרכישה שלהם עלתה מעל 10% ב-90 הימים האחרונים</CardDescription>
          </CardHeader>
          <CardContent>
            {insights.costSpike.items.length === 0 ? (
              <NoDataMessage message="אין התייקרויות חריגות" />
            ) : (
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
                  {insights.costSpike.items.map(item => (
                    <TableRow key={item.productId}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell>{formatCurrency(item.avgCost90Days)}</TableCell>
                      <TableCell>{formatCurrency(item.avgCost30Days)}</TableCell>
                      <TableCell className="text-red-600 font-bold">+{item.changePercent.toFixed(1)}%</TableCell>
                      <TableCell>{item.supplierName || '—'}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenProduct(item.productId)}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Business Health Tab */}
      <TabsContent value="business_health">
        <Card>
          <CardHeader>
            <CardTitle>בריאות עסקית - סקירה חודשית</CardTitle>
            <CardDescription>ניתוח מגמות הכנסות, רווחיות והנחות לפי חודשים</CardDescription>
          </CardHeader>
          <CardContent>
            {insights.businessHealth.warning && insights.businessHealth.warningMessage && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 font-semibold">⚠️ {insights.businessHealth.warningMessage}</p>
              </div>
            )}
            {insights.businessHealth.items.filter(m => m.totalRevenue > 0).length === 0 ? (
              <NoDataMessage message="אין נתוני מכירות לשנה הנוכחית" />
            ) : (
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
                  {insights.businessHealth.items.filter(m => m.totalRevenue > 0).map(item => (
                    <TableRow key={item.monthIndex}>
                      <TableCell className="font-medium">{item.month}</TableCell>
                      <TableCell>{formatCurrency(item.totalRevenue)}</TableCell>
                      <TableCell className={item.grossProfit < 0 ? 'text-red-600 font-bold' : 'text-green-600'}>
                        {formatCurrency(item.grossProfit)}
                      </TableCell>
                      <TableCell>{formatCurrency(item.totalDiscounts)}</TableCell>
                      <TableCell>{item.avgDiscountPercent.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
