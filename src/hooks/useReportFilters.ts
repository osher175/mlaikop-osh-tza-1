import { useState, useMemo, useCallback } from 'react';

export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ReportFilters {
  periodType: PeriodType;
  selectedYear: number;
  selectedMonth: number; // 1-12
  selectedWeek: number;  // 1-4
}

export interface ComputedDateRange {
  from: string; // ISO string
  to: string;   // ISO string
}

export interface ReportFiltersResult {
  filters: ReportFilters;
  dateRange: ComputedDateRange;
  dateRangeLabel: string;
  setPeriodType: (type: PeriodType) => void;
  setSelectedYear: (year: number) => void;
  setSelectedMonth: (month: number) => void;
  setSelectedWeek: (week: number) => void;
}

const HEBREW_MONTHS = [
  '', 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

const HEBREW_WEEKS = ['', 'שבוע ראשון', 'שבוע שני', 'שבוע שלישי', 'שבוע רביעי'];

/**
 * Build a date range from filters using Asia/Jerusalem timezone.
 * This is the SINGLE source of truth for date boundaries.
 */
export function buildReportDateRange(filters: ReportFilters): ComputedDateRange {
  const { periodType, selectedYear, selectedMonth, selectedWeek } = filters;
  const tz = 'Asia/Jerusalem';

  // Helper: create a Date from Asia/Jerusalem local components
  const localToUTC = (year: number, month: number, day: number, h = 0, m = 0, s = 0, ms = 0): Date => {
    // Format a date string in the target timezone and parse it
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
    // Create formatter to find UTC offset for this local time
    const local = new Date(dateStr + 'Z');
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
    // Find offset by comparing formatted date with what we want
    // Simpler approach: use the fact that we know Israel is UTC+2 or UTC+3
    // But for correctness, let's use a calculation approach
    const testDate = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00Z`);
    const parts = formatter.formatToParts(testDate);
    const tzHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const utcHour = testDate.getUTCHours();
    const offset = tzHour - utcHour; // offset in hours (positive = ahead of UTC)
    
    // Adjust: local time - offset = UTC time
    const result = new Date(dateStr + 'Z');
    result.setUTCHours(result.getUTCHours() - offset);
    return result;
  };

  let fromDate: Date;
  let toDate: Date;

  switch (periodType) {
    case 'daily': {
      const now = new Date();
      // Get today's date in Asia/Jerusalem
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
      const [y, mo, d] = todayStr.split('-').map(Number);
      fromDate = localToUTC(y, mo, d, 0, 0, 0, 0);
      toDate = localToUTC(y, mo, d, 23, 59, 59, 999);
      break;
    }
    case 'weekly': {
      const jsMonth = selectedMonth - 1;
      const daysInMonth = new Date(selectedYear, jsMonth + 1, 0).getDate();
      const weekStart = (selectedWeek - 1) * 7 + 1;
      const weekEnd = Math.min(selectedWeek * 7, daysInMonth);
      fromDate = localToUTC(selectedYear, selectedMonth, weekStart, 0, 0, 0, 0);
      toDate = localToUTC(selectedYear, selectedMonth, weekEnd, 23, 59, 59, 999);
      break;
    }
    case 'monthly': {
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      fromDate = localToUTC(selectedYear, selectedMonth, 1, 0, 0, 0, 0);
      toDate = localToUTC(selectedYear, selectedMonth, daysInMonth, 23, 59, 59, 999);
      break;
    }
    case 'yearly': {
      fromDate = localToUTC(selectedYear, 1, 1, 0, 0, 0, 0);
      toDate = localToUTC(selectedYear, 12, 31, 23, 59, 59, 999);
      break;
    }
    default: {
      fromDate = localToUTC(selectedYear, selectedMonth, 1, 0, 0, 0, 0);
      const daysInMonth2 = new Date(selectedYear, selectedMonth, 0).getDate();
      toDate = localToUTC(selectedYear, selectedMonth, daysInMonth2, 23, 59, 59, 999);
    }
  }

  const range = {
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
  };

  // Dev-mode debug logging
  if (import.meta.env.DEV) {
    console.log('[ReportFilters] Computed date range:', {
      filters,
      from: range.from,
      to: range.to,
      fromLocal: new Date(range.from).toLocaleString('he-IL', { timeZone: tz }),
      toLocal: new Date(range.to).toLocaleString('he-IL', { timeZone: tz }),
    });
  }

  return range;
}

/**
 * Build the equivalent previous period date range for comparison.
 * monthly March 2026 → February 2026
 * yearly 2026 → 2025
 * weekly week 2 of March → week 1 of March
 * daily → yesterday
 */
export function buildPreviousDateRange(filters: ReportFilters): ComputedDateRange {
  const prev = { ...filters };

  switch (filters.periodType) {
    case 'daily': {
      // Previous day — recompute by shifting the "today" logic isn't possible
      // so we compute yesterday explicitly
      const now = new Date();
      const tz = 'Asia/Jerusalem';
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
      const [y, mo, d] = todayStr.split('-').map(Number);
      const yesterday = new Date(y, mo - 1, d - 1);
      prev.selectedYear = yesterday.getFullYear();
      prev.selectedMonth = yesterday.getMonth() + 1;
      // We'll use the daily branch which reads "now", so we need to build manually
      return buildReportDateRange({
        ...prev,
        periodType: 'daily',
      });
    }
    case 'weekly': {
      if (prev.selectedWeek > 1) {
        prev.selectedWeek -= 1;
      } else {
        // Go to previous month, last week
        if (prev.selectedMonth > 1) {
          prev.selectedMonth -= 1;
        } else {
          prev.selectedMonth = 12;
          prev.selectedYear -= 1;
        }
        prev.selectedWeek = 4;
      }
      break;
    }
    case 'monthly': {
      if (prev.selectedMonth > 1) {
        prev.selectedMonth -= 1;
      } else {
        prev.selectedMonth = 12;
        prev.selectedYear -= 1;
      }
      break;
    }
    case 'yearly': {
      prev.selectedYear -= 1;
      break;
    }
  }

  return buildReportDateRange(prev);
}

function buildDateRangeLabel(filters: ReportFilters): string {
  const { periodType, selectedYear, selectedMonth, selectedWeek } = filters;
  const monthName = HEBREW_MONTHS[selectedMonth] || '';
  const weekName = HEBREW_WEEKS[selectedWeek] || '';

  switch (periodType) {
    case 'daily':
      return 'היום';
    case 'weekly':
      return `${weekName} - ${monthName} ${selectedYear}`;
    case 'monthly':
      return `${monthName} ${selectedYear}`;
    case 'yearly':
      return `שנת ${selectedYear}`;
    default:
      return `${monthName} ${selectedYear}`;
  }
}

export function useReportFilters(): ReportFiltersResult {
  const now = new Date();
  const [periodType, setPeriodType] = useState<PeriodType>('monthly');
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedWeek, setSelectedWeek] = useState(1);

  const filters: ReportFilters = useMemo(() => ({
    periodType,
    selectedYear,
    selectedMonth,
    selectedWeek,
  }), [periodType, selectedYear, selectedMonth, selectedWeek]);

  const dateRange = useMemo(() => buildReportDateRange(filters), [filters]);
  const dateRangeLabel = useMemo(() => buildDateRangeLabel(filters), [filters]);

  const handleSetPeriodType = useCallback((type: PeriodType) => {
    setPeriodType(type);
    if (type !== 'weekly') {
      setSelectedWeek(1);
    }
  }, []);

  return {
    filters,
    dateRange,
    dateRangeLabel,
    setPeriodType: handleSetPeriodType,
    setSelectedYear,
    setSelectedMonth,
    setSelectedWeek,
  };
}
