import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from 'lucide-react';
import { PeriodType, ReportFiltersResult } from '@/hooks/useReportFilters';

const PERIOD_OPTIONS: { label: string; value: PeriodType }[] = [
  { label: 'יומי', value: 'daily' },
  { label: 'שבועי', value: 'weekly' },
  { label: 'חודשי', value: 'monthly' },
  { label: 'שנתי', value: 'yearly' },
];

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

const getAvailableYears = () => {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let year = 2026; year <= Math.max(currentYear, 2026); year++) {
    years.push(year.toString());
  }
  return years;
};

interface ReportsFilterBarProps {
  filtersResult: ReportFiltersResult;
}

export const ReportsFilterBar: React.FC<ReportsFilterBarProps> = ({ filtersResult }) => {
  const {
    filters,
    dateRangeLabel,
    setPeriodType,
    setSelectedYear,
    setSelectedMonth,
    setSelectedWeek,
  } = filtersResult;

  const availableYears = React.useMemo(() => getAvailableYears(), []);

  return (
    <div className="flex flex-col gap-4">
      {/* Period Type Buttons */}
      <div className="flex flex-wrap gap-2">
        {PERIOD_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={filters.periodType === opt.value ? 'default' : 'outline'}
            onClick={() => setPeriodType(opt.value)}
            className="min-w-[70px]"
            type="button"
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Granular Filters */}
      {filters.periodType !== 'daily' && (
        <div className="flex flex-wrap items-center gap-3">
          {/* Year Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">שנה:</span>
            <Select
              value={filters.selectedYear.toString()}
              onValueChange={(v) => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Month Selector */}
          {(filters.periodType === 'monthly' || filters.periodType === 'weekly') && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">חודש:</span>
              <Select
                value={filters.selectedMonth.toString()}
                onValueChange={(v) => setSelectedMonth(parseInt(v))}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HEBREW_MONTHS.map((month) => (
                    <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Week Selector */}
          {filters.periodType === 'weekly' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">שבוע:</span>
              <Select
                value={filters.selectedWeek.toString()}
                onValueChange={(v) => setSelectedWeek(parseInt(v))}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKS.map((week) => (
                    <SelectItem key={week.value} value={week.value}>{week.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {/* Date Range Label */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md w-fit">
        <Calendar className="h-4 w-4" />
        <span>תקופה: {dateRangeLabel}</span>
      </div>
    </div>
  );
};
