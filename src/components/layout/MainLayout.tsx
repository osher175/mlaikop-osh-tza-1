
import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useIsMobile } from '@/hooks/use-mobile';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      {!isMobile && <Sidebar />}
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className={`flex-1 ${isMobile ? 'p-2' : 'p-4 md:p-6 lg:p-8'} overflow-hidden`}>
          <div className="h-full overflow-y-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
