
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (!loading) {
        if (user) {
          console.log('User authenticated, redirecting to dashboard');
          navigate('/dashboard', { replace: true });
        } else {
          console.log('User not authenticated, redirecting to auth');
          navigate('/auth', { replace: true });
        }
      }
    }, 100); // Small delay to ensure auth state is settled

    return () => clearTimeout(timeoutId);
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
