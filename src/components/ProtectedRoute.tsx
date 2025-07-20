
import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

type SubscriptionStatus = {
  active: boolean;
  expired: boolean;
  trialEndsAt: string | null;
  type: "trial" | "paid" | null;
};

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { data: subStatus, isLoading: subLoading } = useSubscriptionStatus(user?.id) as { data: SubscriptionStatus | undefined, isLoading: boolean };
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    if (!loading && !subLoading && (!user || !subStatus?.active) && !redirected) {
      setRedirected(true);
      navigate("/subscription", { replace: true });
    }
  }, [user, loading, subStatus, subLoading, navigate, redirected]);

  if (loading || subLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">טוען...</p>
        </div>
      </div>
    );
  }

  if (!user || !subStatus?.active) {
    return null;
  }

  return <>{children}</>;
};
