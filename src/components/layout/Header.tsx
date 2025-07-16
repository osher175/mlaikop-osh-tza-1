
import React from 'react';
import { User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
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
  const { getRoleDisplayName, userRole } = useUserRole();

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

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 md:px-6">
      <div className="flex items-center justify-end">
        {/* Actions */}
        <div className="flex items-center gap-3">
          <NotificationDropdown />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-white text-xs">
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
