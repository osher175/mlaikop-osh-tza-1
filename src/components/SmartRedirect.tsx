import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";

export const SmartRedirect = () => {
  const { user, loading } = useAuth();
  const { userRole, isLoading } = useUserRole();

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">טוען...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Admin users go to admin panel
  if (userRole === 'admin') {
    console.log('SmartRedirect: Admin user detected, redirecting to /admin');
    return <Navigate to="/admin" replace />;
  }

  // Business users go to dashboard
  return <Navigate to="/dashboard" replace />;
};
