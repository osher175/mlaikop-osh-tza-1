import * as React from 'react';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Medal, Award, TrendingUp, Calendar, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/formatCurrency';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/hooks/useBusiness';

interface TopProduct {
  product_id: string;
  product_name: string;
  quantity_sold: number;
  revenue: number;
}

type ViewMode = 'yearly' | 'monthly' | 'weekly';

const HEBREW_MONTHS = [
  { value: '1', label: 'ינואר' },
  { value: '2', label: 'פברואר' },
  { value: '3', label: 'מרץ' },
  { value: '4', label: 'אפריל' },
  { value: '5', label: 'מאי' },
  { value: '6', label: 'יוני' },
  { value: '7', label: 'יולי' },
  { value: '8', label: 'אוגוסט' },
  { value: '9', label: 'ספטמבר' },
  { value: '10', label: 'אוקטובר' },
  { value: '11', label: 'נובמבר' },
  { value: '12', label: 'דצמבר' },
];

const WEEKS = [
  { value: '1', label: 'שבוע ראשון' },
  { value: '2', label: 'שבוע שני' },
  { value: '3', label: 'שבוע שלישי' },
  { value: '4', label: 'שבוע רביעי' },
];

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Trophy className="h-5 w-5 text-yellow-500" />;
    case 2:
      return <Medal className="h-5 w-5 text-gray-400" />;
    case 3:
      return <Award className="h-5 w-5 text-amber-600" />;
    default:
      return <span className="text-sm font-medium text-muted-foreground w-5 text-center">{rank}</span>;
  }
};

const getRankBadgeClass = (rank: number) => {
  switch (rank) {
    case 1:
      return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800';
    case 2:
      return 'bg-gray-50 border-gray-200 dark:bg-gray-900/30 dark:border-gray-700';
    case 3:
      return 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800';
    default:
      return 'bg-background border-border';
  }
};

// Generate available years (2026 and above, up to current year)
const getAvailableYears = () => {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let year = 2026; year <= Math.max(currentYear, 2026); year++) {
    years.push(year.toString());
  }
  return years;
};

// Calculate date range based on selections
const calculateDateRange = (
  viewMode: ViewMode,
  selectedYear: string,
  selectedMonth: string,
  selectedWeek: string
): { dateFrom: string; dateTo: string } => {
  const year = parseInt(selectedYear);
  const month = parseInt(selectedMonth) - 1; // JS months are 0-indexed

  if (viewMode === 'yearly') {
    const dateFrom = new Date(year, 0, 1);
    const dateTo = new Date(year, 11, 31, 23, 59, 59, 999);
    return {
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
    };
  }

  if (viewMode === 'monthly') {
    const dateFrom = new Date(year, month, 1);
    const dateTo = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return {
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
    };
  }

  // Weekly view
  const week = parseInt(selectedWeek);
  const firstDayOfMonth = new Date(year, month, 1);
  const weekStart = new Date(year, month, (week - 1) * 7 + 1);
  const weekEnd = new Date(year, month, Math.min(week * 7, new Date(year, month + 1, 0).getDate()), 23, 59, 59, 999);
  
  return {
    dateFrom: weekStart.toISOString(),
    dateTo: weekEnd.toISOString(),
  };
};

// Format the date range for display
const formatDateRangeLabel = (
  viewMode: ViewMode,
  selectedYear: string,
  selectedMonth: string,
  selectedWeek: string
): string => {
  const monthLabel = HEBREW_MONTHS.find(m => m.value === selectedMonth)?.label || '';
  const weekLabel = WEEKS.find(w => w.value === selectedWeek)?.label || '';

  if (viewMode === 'yearly') {
    return `שנת ${selectedYear}`;
  }
  if (viewMode === 'monthly') {
    return `${monthLabel} ${selectedYear}`;
  }
  return `${weekLabel} - ${monthLabel} ${selectedYear}`;
};

export const TopProductsRanking: React.FC = () => {
  const { business } = useBusiness();
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = (new Date().getMonth() + 1).toString();

  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [selectedYear, setSelectedYear] = useState<string>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [selectedWeek, setSelectedWeek] = useState<string>('1');

  const availableYears = useMemo(() => getAvailableYears(), []);

  const { dateFrom, dateTo } = useMemo(
    () => calculateDateRange(viewMode, selectedYear, selectedMonth, selectedWeek),
    [viewMode, selectedYear, selectedMonth, selectedWeek]
  );

  const dateRangeLabel = useMemo(
    () => formatDateRangeLabel(viewMode, selectedYear, selectedMonth, selectedWeek),
    [viewMode, selectedYear, selectedMonth, selectedWeek]
  );

  const { data: products, isLoading } = useQuery({
    queryKey: ['top_products_ranking', business?.id, dateFrom, dateTo],
    queryFn: async () => {
      if (!business?.id) return [];
      
      const { data, error } = await supabase.rpc('reports_aggregate', {
        business_id: business.id,
        date_from: dateFrom,
        date_to: dateTo,
      });

      if (error) throw error;
      
      // Type assertion for the RPC response
      const result = data as { top_products_list?: TopProduct[] } | null;
      return result?.top_products_list || [];
    },
    enabled: !!business?.id,
    staleTime: 5 * 60 * 1000,
  });

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    // Reset week when switching away from weekly
    if (mode !== 'weekly') {
      setSelectedWeek('1');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            דירוג 20 המוצרים הפופולריים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center py-12">
            <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            דירוג 20 המוצרים הפופולריים
          </CardTitle>

          {/* View Mode Selection */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={viewMode === 'yearly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleViewModeChange('yearly')}
            >
              שנתי
            </Button>
            <Button
              variant={viewMode === 'monthly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleViewModeChange('monthly')}
            >
              חודשי
            </Button>
            <Button
              variant={viewMode === 'weekly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleViewModeChange('weekly')}
            >
              שבועי
            </Button>
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Year Selector - Always visible */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">שנה:</span>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Month Selector - Visible for monthly and weekly */}
            {(viewMode === 'monthly' || viewMode === 'weekly') && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">חודש:</span>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HEBREW_MONTHS.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Week Selector - Only visible for weekly */}
            {viewMode === 'weekly' && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">שבוע:</span>
                <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKS.map((week) => (
                      <SelectItem key={week.value} value={week.value}>
                        {week.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Date Range Label */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md w-fit">
            <Calendar className="h-4 w-4" />
            <span>תקופה: {dateRangeLabel}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {!products || products.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            אין נתוני מכירות לתקופה זו
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground w-16">דירוג</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">שם מוצר</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground w-28">כמות נמכרה</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground w-28">הכנסות</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product, index) => {
                  const rank = index + 1;
                  return (
                    <tr
                      key={product.product_id}
                      className={`border-b border-border/50 transition-colors hover:bg-muted/50 ${getRankBadgeClass(rank)}`}
                    >
                      <td className="py-3 px-2">
                        <div className="flex items-center justify-center">
                          {getRankIcon(rank)}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <span className="font-medium text-foreground">{product.product_name}</span>
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-sm text-muted-foreground">
                          {product.quantity_sold.toLocaleString('he-IL')} יחידות
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-sm font-medium text-emerald-600">
                          {formatCurrency(product.revenue)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
