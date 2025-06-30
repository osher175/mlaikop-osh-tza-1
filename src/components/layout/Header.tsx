
import React from 'react';
import { User, LogOut, Crown, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Header: React.FC = () => {
  const { signOut, user } = useAuth();
  const { userRole, getRoleDisplayName, permissions } = useUserRole();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      console.log('Starting logout process...');
      await signOut();
      console.log('Logout completed successfully');
    } catch (error) {
      console.error('Error during logout:', error);
      // Force navigation to auth page even if logout fails
      window.location.href = '/auth';
    }
  };

  const handleSubscriptionManagement = () => {
    navigate('/subscriptions');
  };

  const getRoleBadgeColor = () => {
    switch (userRole) {
      case 'admin':
        return 'bg-red-500';
      case 'elite_pilot_user':
        return 'bg-purple-500';
      case 'smart_master_user':
        return 'bg-blue-500';
      case 'pro_starter_user':
        return 'bg-amber-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 md:px-6">
      <div className="flex items-center justify-end">
        {/* Actions */}
        <div className="flex items-center gap-3">
          <NotificationDropdown />
          
          {/* Admin Settings Button - Only for admins */}
          {userRole === 'admin' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.href = '/admin/settings'}
              className="flex items-center gap-2 text-red-600 hover:text-red-800"
            >
              <Settings className="w-4 h-4" />
              <span>הגדרות מערכת</span>
            </Button>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Badge className={`${getRoleBadgeColor()} text-white text-xs`}>
                    <Crown className="w-3 h-3 ml-1" />
                    {getRoleDisplayName(userRole)}
                  </Badge>
                  <User className="w-5 h-5" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-right">
                <div className="flex flex-col">
                  <span>{user?.email}</span>
                  <span className="text-xs text-gray-500 font-normal">
                    {getRoleDisplayName(userRole)}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleSubscriptionManagement}
                className="text-right cursor-pointer"
              >
                <Crown className="ml-2 h-4 w-4" />
                ניהול מנוי
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleSignOut}
                className="text-right cursor-pointer"
              >
                <LogOut className="ml-2 h-4 w-4" />
                התנתק
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
