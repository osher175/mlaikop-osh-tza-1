
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
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
          
          window.location.href = '/auth';
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

  if (loading || isCheckingStatus) {
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
    window.location.href = '/auth';
    return null;
  }

  return <>{children}</>;
};
