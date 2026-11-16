import React from 'react';
import { PAGE_SIZES, type PageSize } from '@/lib/v2/listPage';

export const ListPager: React.FC<{
  from: number;
  to: number;
  total: number;
  page: number;
  pages: number;
  size: PageSize;
  onPage: (page: number) => void;
  onSize: (size: PageSize) => void;
}> = ({ from, to, total, page, pages, size, onPage, onSize }) => (
  <footer className="flex flex-col gap-2 border-t border-[#eef3f8] px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
    <p className="font-bold">{from}–{to} מתוך {total}</p>
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-xs font-bold text-v2-muted">שורות
        <select aria-label="שורות בעמוד" value={size} className="mr-2 h-10 rounded-[12px] border border-[#dbe4ee] bg-white px-2 font-bold" onChange={(event) => onSize(Number(event.target.value) as PageSize)}>
          {PAGE_SIZES.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <button type="button" className="h-10 rounded-[12px] border border-[#dbe4ee] px-3 font-bold disabled:opacity-40" disabled={page <= 1} onClick={() => onPage(page - 1)}>הקודם</button>
      <span className="font-bold">עמוד {page} מתוך {pages}</span>
      <button type="button" className="h-10 rounded-[12px] border border-[#dbe4ee] px-3 font-bold disabled:opacity-40" disabled={page >= pages} onClick={() => onPage(page + 1)}>הבא</button>
    </div>
  </footer>
);
