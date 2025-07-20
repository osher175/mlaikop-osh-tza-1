
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, loading: authLoading } = useAuth();
  const { userRole, isLoading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  useEffect(() => {
    const checkUserStatus = async () => {
      if (!user) {
        setIsCheckingStatus(false);
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('is_active')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error checking user status in ProtectedRoute:', error);
          setIsCheckingStatus(false);
          return;
        }

        if (profile?.is_active === false) {
          console.log('User account is disabled, redirecting to auth:', user.email);
          await supabase.auth.signOut();
          
          toast({
            title: 'החשבון מושבת',
            description: 'החשבון שלך הושבת. פנה למנהל המערכת.',
            variant: 'destructive',
          });
          
          return;
        }

        setIsCheckingStatus(false);
      } catch (error) {
        console.error('Error in checkUserStatus:', error);
        setIsCheckingStatus(false);
      }
    };

    checkUserStatus();
  }, [user, toast]);

  if (authLoading || roleLoading || isCheckingStatus) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">טוען...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Check role permissions if allowedRoles is specified
  if (allowedRoles && allowedRoles.length > 0) {
    if (!userRole || !allowedRoles.includes(userRole)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
};
