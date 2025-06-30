
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Mobile Header with Hamburger Menu */}
      {isMobile && (
        <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
              <DrawerTrigger asChild>
                <Button variant="ghost" size="sm" className="p-2">
                  <Menu className="h-5 w-5" />
                </Button>
              </DrawerTrigger>
              <DrawerContent className="h-full max-h-full">
                <div className="h-full overflow-hidden">
                  <Sidebar onNavigate={() => setIsDrawerOpen(false)} />
                </div>
              </DrawerContent>
            </Drawer>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
                </svg>
              </div>
              <span className="text-xl font-bold text-gray-900">Mlaiko</span>
            </div>
          </div>
          <Header />
        </div>
      )}

      {/* Desktop Layout */}
      <div className="flex-1 flex">
        {/* Desktop Sidebar - Fixed height */}
        {!isMobile && (
          <div className="w-64 bg-white border-l border-gray-200 fixed right-0 top-0 h-screen z-10 overflow-y-auto">
            <Sidebar />
          </div>
        )}

        {/* Main Content Area */}
        <div className={`flex-1 flex flex-col ${!isMobile ? 'ml-0 mr-64' : ''}`}>
          {/* Desktop Header */}
          {!isMobile && <Header />}
          
          {/* Main Content */}
          <main className={`flex-1 ${isMobile ? 'p-2' : 'p-4 md:p-6 lg:p-8'} overflow-y-auto`}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};
