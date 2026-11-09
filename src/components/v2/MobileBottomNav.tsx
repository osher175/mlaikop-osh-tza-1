import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserRole } from '@/hooks/useUserRole';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { buildV2Nav, isNavActive } from './navConfig';
import { SidebarV2 } from './SidebarV2';

const PRIMARY_KEYS = ['dashboard', 'inventory', 'sales', 'purchasing'];

export const MOBILE_NAV_HEIGHT = 64;

export const MobileBottomNav: React.FC = () => {
  const { pathname } = useLocation();
  const { permissions } = useUserRole();
  const [moreOpen, setMoreOpen] = useState(false);
  const { primary } = buildV2Nav(permissions);
  const items = permissions.isPlatformAdmin ? primary.slice(0, 4) : primary.filter((i) => PRIMARY_KEYS.includes(i.key));

  const cell = 'flex-1 min-w-[44px] min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[12px] font-semibold';

  return (
    <>
      <nav
        aria-label="ניווט תחתון"
        className="fixed bottom-0 inset-x-0 z-40 bg-v2-surface border-t border-v2-border v2-safe-bottom"
      >
        <div className="flex items-stretch" style={{ height: MOBILE_NAV_HEIGHT }}>
          {items.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item.to);
            if (!item.to) {
              return (
                <div key={item.key} aria-disabled="true" className={cn(cell, 'text-v2-muted/60')}>
                  <Icon className="h-5 w-5" aria-hidden />
                  <span>{item.label}</span>
                  <span className="sr-only">עדיין לא זמין</span>
                </div>
              );
            }
            return (
              <Link
                key={item.key}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={cn(cell, active ? 'text-v2-primary-dark' : 'text-v2-navy')}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span>{item.label}</span>
                {active && <span className="h-[3px] w-6 rounded-full bg-v2-primary" aria-hidden />}
              </Link>
            );
          })}
          <button type="button" onClick={() => setMoreOpen(true)} className={cn(cell, 'text-v2-navy')} aria-haspopup="dialog">
            <MoreHorizontal className="h-5 w-5" aria-hidden />
            <span>עוד</span>
          </button>
        </div>
      </nav>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="v2-root h-[85vh] p-0 rounded-t-v2-panel" dir="rtl">
          <SheetHeader className="sr-only">
            <SheetTitle>כל היעדים</SheetTitle>
          </SheetHeader>
          <SidebarV2 onNavigate={() => setMoreOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
};
