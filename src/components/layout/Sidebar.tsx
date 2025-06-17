
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
}

const SidebarItem: React.FC<SidebarItemProps> = ({ to, icon, label, isActive, badge }) => (
  <Link
    to={to}
    className={cn(
      "flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 hover:text-primary transition-colors rounded-lg",
      isActive && "bg-primary/10 text-primary border-l-4 border-primary"
    )}
  >
    {icon}
    <span className="font-medium">{label}</span>
    {badge && <span className="mr-auto">{badge}</span>}
  </Link>
);

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const { userRole, permissions } = useUserRole();

  console.log('Sidebar - Current user role:', userRole);
  console.log('Sidebar - Permissions:', permissions);

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

  // Admin-specific menu items
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
    <div className="w-64 bg-white border-l border-gray-200 h-full">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Package className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">Mlaiko</span>
        </div>

        <nav className="space-y-2">
          {/* Regular menu items */}
          {menuItems.filter(item => item.show).map((item) => (
            <SidebarItem
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              isActive={location.pathname === item.to}
            />
          ))}

          {/* Admin section */}
          {permissions.isPlatformAdmin && (
            <>
              <div className="border-t border-gray-200 my-4"></div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2">
                ניהול מערכת
              </div>
              {adminMenuItems.filter(item => item.show).map((item) => (
                <SidebarItem
                  key={item.to}
                  to={item.to}
                  icon={item.icon}
                  label={item.label}
                  isActive={location.pathname === item.to}
                  badge={<Crown className="w-4 h-4 text-red-500" />}
                />
              ))}
            </>
          )}

          {/* Subscription link for non-admin users */}
          {!permissions.isPlatformAdmin && (
            <>
              <div className="border-t border-gray-200 my-4"></div>
              <SidebarItem
                to="/subscriptions"
                icon={<Crown className="w-5 h-5" />}
                label="ניהול מנוי"
                isActive={location.pathname === '/subscriptions'}
              />
            </>
          )}
        </nav>
      </div>
    </div>
  );
};
