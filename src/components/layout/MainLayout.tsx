
import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useIsMobile, useIsSidebarDrawer } from '@/hooks/use-mobile';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BusinessDiagnosticPanel } from '@/components/dev/BusinessDiagnosticPanel';
import mlaikoLogo from '@/assets/mlaiko-logo-full.png';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const isMobile = useIsMobile();
  const isSidebarDrawer = useIsSidebarDrawer();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 w-full overflow-x-hidden">
      {/* Mobile/Tablet Header with Hamburger Menu */}
      {isSidebarDrawer && (
        <div className="bg-white border-b border-gray-200 px-3 md:px-4 py-2 md:py-3 flex items-center justify-between sticky top-0 z-40 w-full">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
              <DrawerTrigger asChild>
                <Button variant="ghost" size="sm" className="p-2 hover:bg-gray-100 flex-shrink-0 min-h-[44px] min-w-[44px]">
                  <Menu className="h-5 w-5" />
                </Button>
              </DrawerTrigger>
              <DrawerContent className="h-full max-h-full z-50">
                <div className="h-full overflow-hidden">
                  <Sidebar onNavigate={() => setIsDrawerOpen(false)} isMobileDrawer />
                </div>
              </DrawerContent>
            </Drawer>
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <img 
                src={mlaikoLogo} 
                alt="Mlaiko Logo" 
                className="h-8 md:h-10 flex-shrink-0 object-contain"
              />
            </div>
          </div>
          <div className="flex-shrink-0">
            <Header />
          </div>
        </div>
      )}

      {/* Main Layout Container */}
      <div className="flex min-h-screen w-full">
        {/* Fixed Sidebar for >=1024px (lg) */}
        {!isSidebarDrawer && (
          <div className="w-64 fixed right-0 top-0 h-screen z-30 border-l border-gray-200 bg-white">
            <Sidebar />
          </div>
        )}

        {/* Main Content Area */}
        <div
          className={`flex-1 flex flex-col min-h-screen w-full min-w-0 ${
            !isSidebarDrawer ? 'mr-64' : ''
          }`}
        >
          {/* Desktop Header */}
          {!isSidebarDrawer && (
            <div className="sticky top-0 z-20 bg-white border-b border-gray-200 w-full">
              <Header />
            </div>
          )}

          {/* Main Content - Scrollable */}
          <main className="flex-1 overflow-y-auto w-full">
            <div className={`${isMobile ? 'p-3' : isSidebarDrawer ? 'p-4' : 'p-4 md:p-6 lg:p-8'} min-h-full w-full max-w-full overflow-x-hidden`}>
              {children}
            </div>
          </main>
        </div>
      </div>
      <BusinessDiagnosticPanel />
    </div>
  );
};
