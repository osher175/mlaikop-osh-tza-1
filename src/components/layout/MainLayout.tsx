import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Custom hook to detect if sidebar should be a drawer (screen < 1024px)
function useIsSidebarDrawer() {
  const [isDrawer, setIsDrawer] = React.useState(false);
  React.useEffect(() => {
    const check = () => setIsDrawer(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isDrawer;
}

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const isMobile = useIsMobile();
  const isSidebarDrawer = useIsSidebarDrawer();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true); // for manual toggle on tablet

  // If sidebar is a drawer, open/close with drawer state
  // If sidebar is fixed, allow manual collapse/expand

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Hamburger Menu for <1024px */}
      {isSidebarDrawer && (
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
        {/* Fixed Sidebar for >=1024px (lg) */}
        {!isSidebarDrawer && sidebarOpen && (
          <div className="w-64 fixed right-0 top-0 h-screen z-30 border-l border-gray-200 bg-white transition-all duration-300">
            <Sidebar />
          </div>
        )}

        {/* Sidebar toggle button for tablets (>=640px and <1024px) */}
        {!isSidebarDrawer && (
          <button
            className="fixed right-4 top-4 z-40 bg-white border border-gray-200 rounded-full shadow p-2 lg:hidden"
            style={{ display: 'block' }}
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label={sidebarOpen ? 'סגור תפריט' : 'פתח תפריט'}
          >
            <Menu className="h-5 w-5 text-gray-700" />
          </button>
        )}

        {/* Main Content Area */}
        <div
          className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
            !isSidebarDrawer && sidebarOpen ? 'mr-64' : ''
          }`}
        >
          {/* Desktop Header */}
          {!isSidebarDrawer && (
            <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
              <Header />
            </div>
          )}

          {/* Main Content - Scrollable */}
          <main className="flex-1 overflow-y-auto">
            <div className={`${isSidebarDrawer ? 'p-3' : 'p-4 md:p-6 lg:p-8'} min-h-full`}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
