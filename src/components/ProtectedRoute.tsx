
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePlanSelection } from '@/hooks/usePlanSelection';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiresPlan?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiresPlan = true 
}) => {
  const { user, loading } = useAuth();
  const { hasPlan, isLoading: planLoading } = usePlanSelection();

  if (loading || planLoading) {
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

  // Check if plan is required and user hasn't selected one
  if (requiresPlan && !hasPlan) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="w-12 h-12 text-amber-500" />
            </div>
            <CardTitle className="text-xl">נדרש לבחור תוכנית</CardTitle>
            <CardDescription>
              אנא בחר תוכנית מנוי כדי לגשת למערכת הניהול
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => window.location.href = '/choose-plan'}
              className="w-full bg-primary hover:bg-primary-600"
            >
              בחר תוכנית עכשיו
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};
