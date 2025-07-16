import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSubscription } from '@/hooks/useSubscription';
import { 
  Home, 
  Package, 
  BarChart3, 
  Settings, 
  Bell, 
  Users, 
  Building2,
  Crown,
  AlertTriangle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { subscription, isTrialValid, daysLeftInTrial, isSubscriptionActive } = useSubscription();

  const navigationItems = [
    {
      to: '/',
      icon: Home,
      label: 'דף הבית',
      requiresSubscription: true
    },
    {
      to: '/inventory',
      icon: Package,
      label: 'מלאי',
      requiresSubscription: true
    },
    {
      to: '/reports',
      icon: BarChart3,
      label: 'דוחות',
      requiresSubscription: true
    },
    {
      to: '/suppliers',
      icon: Building2,
      label: 'ספקים',
      requiresSubscription: true
    },
    {
      to: '/notification-management',
      icon: Bell,
      label: 'ניהול התראות',
      requiresSubscription: true
    },
    {
      to: '/settings',
      icon: Settings,
      label: 'הגדרות',
      requiresSubscription: false
    },
    {
      to: '/subscriptions',
      icon: Crown,
      label: 'מנויים',
      requiresSubscription: false
    },
    {
      to: '/user-management',
      icon: Users,
      label: 'ניהול משתמשים',
      requiresSubscription: false
    }
  ];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      <aside className={`
        fixed top-0 right-0 h-full w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out z-50
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold text-gray-800" dir="rtl">מלאיקו</h2>
          </div>

          {subscription && (
            <div className="p-4 border-b bg-gray-50">
              {subscription.status === 'trial' && isTrialValid && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-orange-600">
                    <Crown className="h-4 w-4" />
                    <span className="text-sm font-medium">ניסיון חינם</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    נותרו {daysLeftInTrial} ימים
                  </div>
                  <Button 
                    size="sm" 
                    className="w-full"
                    onClick={() => window.location.href = '/subscribe'}
                  >
                    שדרג עכשיו
                  </Button>
                </div>
              )}
              {subscription.status === 'active' && (
                <div className="flex items-center gap-2 text-green-600">
                  <Crown className="h-4 w-4" />
                  <span className="text-sm font-medium">מנוי פעיל</span>
                </div>
              )}
              {!isSubscriptionActive && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">מנוי לא פעיל</span>
                  </div>
                  <Button 
                    size="sm" 
                    className="w-full"
                    onClick={() => window.location.href = '/subscribe'}
                  >
                    חדש מנוי
                  </Button>
                </div>
              )}
            </div>
          )}

          <nav className="flex-1 p-4 space-y-2" dir="rtl">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isRestricted = item.requiresSubscription && !isSubscriptionActive;
              
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2 rounded-lg transition-colors
                    ${isActive ? 'bg-primary text-primary-foreground' : 'text-gray-700 hover:bg-gray-100'}
                    ${isRestricted ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  {...(isRestricted && { 
                    onClick: (e) => {
                      e.preventDefault();
                      window.location.href = '/subscribe?expired=true';
                    }
                  })}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                  {isRestricted && (
                    <Badge variant="secondary" className="text-xs">נדרש מנוי</Badge>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
};
