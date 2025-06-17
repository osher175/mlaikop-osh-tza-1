
import React, { useState } from 'react';
import { Home, Package, Plus, BarChart3, Users, Settings, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const menuItems = [
  { icon: Home, label: 'דשבורד', href: '/dashboard', active: true },
  { icon: Package, label: 'מלאי', href: '/inventory' },
  { icon: Plus, label: 'הוספת מוצר', href: '/add-product' },
  { icon: BarChart3, label: 'דוחות', href: '/reports' },
  { icon: Users, label: 'משתמשים', href: '/users' },
  { icon: Settings, label: 'הגדרות', href: '/settings' },
];

export const Sidebar: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 right-4 z-50 md:hidden"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed right-0 top-0 z-40 h-screen bg-white border-l border-gray-200 transition-all duration-300 md:relative md:translate-x-0",
        isCollapsed ? "w-16" : "w-64",
        isMobileOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 mlaiko-gradient rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              {!isCollapsed && (
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Mlaiko</h1>
                  <p className="text-sm text-gray-500">ניהול מלאי</p>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <ul className="space-y-2">
              {menuItems.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                      item.active 
                        ? "bg-turquoise text-white" 
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {!isCollapsed && (
                      <span className="font-medium">{item.label}</span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Collapse Button */}
          <div className="p-4 border-t border-gray-200 hidden md:block">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="w-full justify-start"
            >
              <Menu className="w-4 h-4" />
              {!isCollapsed && <span className="mr-2">כווץ תפריט</span>}
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
};
