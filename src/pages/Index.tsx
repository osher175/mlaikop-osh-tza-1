
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // If user is authenticated, redirect to dashboard
        navigate('/dashboard', { replace: true });
      } else {
        // If user is not authenticated, redirect to auth page
        navigate('/auth', { replace: true });
      }
    }
  }, [user, loading, navigate]);

  // Show loading spinner while checking authentication
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-gray-600">טוען...</p>
      </div>
    </div>
  );
};

export default Index;
