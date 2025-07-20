
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
  Crown,
  User
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

  // Admin menu items - only for platform admins
  const adminMenuItems = [
    {
      to: '/admin/dashboard',
      icon: <BarChart3 className="w-5 h-5" />,
      label: 'דשבורד מנהל',
      show: permissions.isPlatformAdmin
    },
    {
      to: '/admin',
      icon: <Shield className="w-5 h-5" />,
      label: 'פאנל מנהל',
      show: permissions.isPlatformAdmin
    },
    {
      to: '/users',
      icon: <Users className="w-5 h-5" />,
      label: 'ניהול משתמשים',
      show: permissions.isPlatformAdmin
    },
    {
      to: '/admin/settings',
      icon: <Settings className="w-5 h-5" />,
      label: 'הגדרות מערכת',
      show: permissions.isPlatformAdmin
    },
    {
      to: '/profile',
      icon: <User className="w-5 h-5" />,
      label: 'פרופיל אישי',
      show: permissions.isPlatformAdmin
    }
  ];

  // Business menu items - only for non-admin users
  const businessMenuItems = [
    {
      to: '/dashboard',
      icon: <Home className="w-5 h-5" />,
      label: 'לוח הבקרה',
      show: !permissions.isPlatformAdmin
    },
    {
      to: '/inventory',
      icon: <Package className="w-5 h-5" />,
      label: 'מלאי',
      show: !permissions.isPlatformAdmin && permissions.canViewProducts
    },
    {
      to: '/add-product',
      icon: <PlusCircle className="w-5 h-5" />,
      label: 'הוספת מוצר',
      show: !permissions.isPlatformAdmin && permissions.canEditProducts
    },
    {
      to: '/reports',
      icon: <BarChart3 className="w-5 h-5" />,
      label: 'דוחות',
      show: !permissions.isPlatformAdmin && permissions.canViewReports
    },
    {
      to: '/settings',
      icon: <Settings className="w-5 h-5" />,
      label: 'הגדרות עסק',
      show: !permissions.isPlatformAdmin && permissions.canManageSettings
    },
    {
      to: '/subscriptions',
      icon: <Crown className="w-5 h-5" />,
      label: 'ניהול מנוי',
      show: !permissions.isPlatformAdmin
    }
  ];

  const currentMenuItems = permissions.isPlatformAdmin ? adminMenuItems : businessMenuItems;

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-center w-full h-32">
          <div className="w-24 h-24 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <Package className="w-16 h-16 text-white" />
          </div>
          <span className="text-2xl font-bold text-gray-900 truncate mr-3">Mlaiko</span>
        </div>
      </div>

      {/* Navigation Menu - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <nav className="space-y-1 py-4">
          {/* Display appropriate menu items based on user role */}
          {currentMenuItems.filter(item => item.show).map((item) => (
            <SidebarItem
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              isActive={location.pathname === item.to}
              badge={permissions.isPlatformAdmin ? <Crown className="w-4 h-4 text-red-500 flex-shrink-0" /> : undefined}
              onClick={onNavigate}
            />
          ))}
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
