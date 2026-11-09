import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BillingReadOnlyBanner } from '@/components/billing/BillingReadOnlyBanner';
import { BusinessDiagnosticPanel } from '@/components/dev/BusinessDiagnosticPanel';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile, useIsSidebarDrawer } from '@/hooks/use-mobile';
import { useMediaQuery } from './useMediaQuery';
import { SidebarV2 } from './SidebarV2';
import { MobileBottomNav, MOBILE_NAV_HEIGHT } from './MobileBottomNav';
import mlaikoLogo from '@/assets/mlaiko-logo-full.png';

/**
 * V2 application shell. Same providers, guards and billing banner as the legacy MainLayout —
 * only the chrome changes. ≥1440: 232px sidebar · 1024–1439: 76px rail · 768–1023: drawer · <768: bottom nav.
 */
export const AppShellV2: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isMobile = useIsMobile();
  const isDrawer = useIsSidebarDrawer();
  const isWide = useMediaQuery('(min-width: 1440px)');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const sidebarWidth = isDrawer ? 0 : isWide ? 232 : 76;
  const padding = isMobile ? 16 : isWide ? 24 : 20;

  return (
    <div dir="rtl" className="v2-root min-h-screen w-full overflow-x-hidden">
      {!isDrawer && (
        <aside className="fixed right-0 top-0 h-screen z-30 border-l border-v2-border" style={{ width: sidebarWidth }}>
          <SidebarV2 collapsed={!isWide} />
        </aside>
      )}

      <div className="flex flex-col min-h-screen min-w-0" style={{ marginRight: sidebarWidth }}>
        <BillingReadOnlyBanner />
        <header className="sticky top-0 z-20 h-[60px] bg-v2-surface border-b border-v2-border flex items-center gap-2 px-4">
          {isDrawer && !isMobile && (
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-v2-control text-v2-navy hover:bg-v2-table-head"
                aria-label="פתיחת תפריט"
              >
                <Menu className="h-5 w-5" aria-hidden />
              </button>
              <SheetContent side="right" className="v2-root w-[280px] p-0" dir="rtl">
                <SheetHeader className="sr-only">
                  <SheetTitle>תפריט</SheetTitle>
                </SheetHeader>
                <SidebarV2 onNavigate={() => setDrawerOpen(false)} />
              </SheetContent>
            </Sheet>
          )}
          {isDrawer && <img src={mlaikoLogo} alt="Mlaiko" className="h-8 object-contain" />}
          <div className="ms-auto">
            <Header />
          </div>
        </header>

        <main
          className="flex-1 w-full min-w-0 overflow-x-hidden"
          style={{ padding, paddingBottom: isMobile ? `calc(${MOBILE_NAV_HEIGHT + padding}px + env(safe-area-inset-bottom))` : padding }}
        >
          {children}
        </main>
      </div>

      {isMobile && <MobileBottomNav />}
      <BusinessDiagnosticPanel />
    </div>
  );
};
