
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  Package, 
  PlusCircle, 
  BarChart3, 
  Users, 
  Settings,
  Shield,
  Crown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserRole } from '@/hooks/useUserRole';

interface SidebarItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  badge?: React.ReactNode;
  onClick?: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ to, icon, label, isActive, badge, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 hover:text-primary transition-colors rounded-lg mx-2",
      isActive && "bg-primary/10 text-primary border-l-4 border-primary"
    )}
  >
    {icon}
    <span className="font-medium truncate">{label}</span>
    {badge && <span className="mr-auto">{badge}</span>}
  </Link>
);

interface SidebarProps {
  onNavigate?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onNavigate }) => {
  const location = useLocation();
  const { userRole, permissions } = useUserRole();

  const menuItems = [
    {
      to: '/',
      icon: <Home className="w-5 h-5" />,
      label: 'לוח הבקרה',
      show: true
    },
    {
      to: '/inventory',
      icon: <Package className="w-5 h-5" />,
      label: 'מלאי',
      show: permissions.canViewProducts
    },
    {
      to: '/add-product',
      icon: <PlusCircle className="w-5 h-5" />,
      label: 'הוספת מוצר',
      show: permissions.canEditProducts
    },
    {
      to: '/reports',
      icon: <BarChart3 className="w-5 h-5" />,
      label: 'דוחות',
      show: permissions.canViewReports
    },
    {
      to: '/users',
      icon: <Users className="w-5 h-5" />,
      label: 'ניהול משתמשים',
      show: permissions.canManageUsers && !permissions.isPlatformAdmin
    },
    {
      to: '/settings',
      icon: <Settings className="w-5 h-5" />,
      label: 'הגדרות',
      show: permissions.canManageSettings && !permissions.isPlatformAdmin
    }
  ];

  const adminMenuItems = [
    {
      to: '/admin',
      icon: <Shield className="w-5 h-5" />,
      label: 'פאנל מנהל',
      show: permissions.isPlatformAdmin
    },
    {
      to: '/admin-dashboard',
      icon: <BarChart3 className="w-5 h-5" />,
      label: 'דשבורד מנהל',
      show: permissions.isPlatformAdmin
    },
    {
      to: '/admin/settings',
      icon: <Settings className="w-5 h-5" />,
      label: 'הגדרות מערכת',
      show: permissions.isPlatformAdmin
    }
  ];

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-center">
          <img 
            src="/lovable-uploads/350d6f82-170a-4eef-816c-1e0d30c9f352.png" 
            alt="Mlaiko Logo" 
            className="h-12 w-auto object-contain max-w-full sm:h-16 md:h-20"
          />
        </div>
      </div>

      {/* Navigation Menu - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <nav className="space-y-1 py-4">
          {/* Regular menu items */}
          {menuItems.filter(item => item.show).map((item) => (
            <SidebarItem
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              isActive={location.pathname === item.to}
              onClick={onNavigate}
            />
          ))}

          {/* Admin section */}
          {permissions.isPlatformAdmin && (
            <>
              <div className="border-t border-gray-200 my-4 mx-4"></div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-2">
                ניהול מערכת
              </div>
              {adminMenuItems.filter(item => item.show).map((item) => (
                <SidebarItem
                  key={item.to}
                  to={item.to}
                  icon={item.icon}
                  label={item.label}
                  isActive={location.pathname === item.to}
                  badge={<Crown className="w-4 h-4 text-red-500 flex-shrink-0" />}
                  onClick={onNavigate}
                />
              ))}
            </>
          )}

          {/* Subscription link for non-admin users */}
          {!permissions.isPlatformAdmin && (
            <>
              <div className="border-t border-gray-200 my-4 mx-4"></div>
              <SidebarItem
                to="/subscriptions"
                icon={<Crown className="w-5 h-5" />}
                label="ניהול מנוי"
                isActive={location.pathname === '/subscriptions'}
                onClick={onNavigate}
              />
            </>
          )}
        </nav>
      </div>

      {/* Footer - Always at bottom */}
      <div className="p-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
        <div className="text-xs text-gray-500 text-center">
          © 2024 Mlaiko
        </div>
      </div>
    </div>
  );
};
