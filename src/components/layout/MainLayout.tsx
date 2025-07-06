import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const isMobile = useIsMobile();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header with Hamburger Menu */}
      {isMobile && (
        <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
              <DrawerTrigger asChild>
                <Button variant="ghost" size="sm" className="p-2 hover:bg-gray-100">
                  <Menu className="h-5 w-5" />
                </Button>
              </DrawerTrigger>
              <DrawerContent className="h-full max-h-full z-50">
                <div className="h-full overflow-hidden">
                  <Sidebar onNavigate={() => setIsDrawerOpen(false)} />
                </div>
              </DrawerContent>
            </Drawer>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
                </svg>
              </div>
              <span className="text-xl font-bold text-gray-900">Mlaiko</span>
            </div>
          </div>
          <Header />
        </div>
      )}

      {/* Main Layout Container */}
      <div className="flex min-h-screen">
        {/* Desktop Sidebar - Fixed */}
        {!isMobile && (
          <div className="w-64 fixed right-0 top-0 h-screen z-30 border-l border-gray-200 bg-white">
            <Sidebar />
          </div>
        )}

        {/* Main Content Area */}
        <div className={`flex-1 flex flex-col ${!isMobile ? 'mr-64' : ''} min-h-screen`}>
          {/* Desktop Header */}
          {!isMobile && (
            <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
              <Header />
            </div>
          )}
          
          {/* Main Content - Scrollable */}
          <main className="flex-1 overflow-y-auto">
            <div className={`${isMobile ? 'p-3' : 'p-4 md:p-6 lg:p-8'} min-h-full`}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
