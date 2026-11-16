import React from 'react';
import { FIFO_AGING_READY } from '@/lib/v2/reportFlags';

/** Warehouse age is not the tire DOT age. Lots are not queried while FIFO is off. */
export const ProductAgingNote: React.FC = () => (
  <section className="rounded-lg border border-border bg-muted/40 p-3 text-sm" dir="rtl">
    <h3 className="font-semibold">גיל מלאי במחסן</h3>
    <p className="mt-1 text-muted-foreground">
      {FIFO_AGING_READY
        ? 'שכבות הקליטה עדיין לא נקראות ממסך המוצר.'
        : 'שכבות FIFO עדיין לא פעילות. אין כאן תאריך קליטה משוחזר, ואין ממוצע גיל. גיל המחסן נפרד מגיל הייצור שעל הצמיג.'}
    </p>
  </section>
);
