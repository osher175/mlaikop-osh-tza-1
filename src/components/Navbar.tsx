import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useStockApprovalRequests } from '@/hooks/useStockApprovalRequests';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useBusinessAccess } from '@/hooks/useBusinessAccess';

const Navbar = () => {
  const { pendingRequests } = useStockApprovalRequests();
  const { signOut } = useAuth();
  const { user } = useAuth();
  const { businessContext } = useBusinessAccess();

  return (
    <nav className="bg-primary text-primary-foreground shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="text-lg font-semibold">
            Mlaikop
          </Link>
          
          <div className="flex items-center space-x-4">
            {/* Add Stock Approval Requests with badge if there are pending requests */}
            {businessContext?.business_id && (
              <Link 
                to="/stock-approval" 
                className="flex items-center px-3 py-2 rounded-md text-sm font-medium hover:bg-primary-foreground/10 transition-colors relative"
              >
                אישורי מלאי
                {pendingRequests.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-white">
                    {pendingRequests.length}
                  </span>
                )}
              </Link>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.user_metadata?.avatar_url || ""} alt={user?.user_metadata?.full_name || "User Avatar"} />
                    <AvatarFallback>{user?.user_metadata?.full_name?.slice(0, 2).toUpperCase() || "UN"}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel>החשבון שלי</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>התנתק</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
