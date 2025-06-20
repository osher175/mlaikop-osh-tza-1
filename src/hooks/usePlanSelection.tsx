
import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useProfile } from './useProfile';

export const usePlanSelection = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [needsPlanSelection, setNeedsPlanSelection] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || !profile) {
      setIsLoading(true);
      return;
    }

    // Admin users are exempt from plan selection
    if (profile.role === 'admin') {
      console.log('Admin user detected - bypassing plan selection');
      setNeedsPlanSelection(false);
      setIsLoading(false);
      return;
    }

    // Check if user needs to select a plan
    const hasPlan = !!profile.selected_plan_id;
    const hasOwnedBusiness = !!profile.owned_business_id;
    
    // Users with OWNER role who have completed setup don't need plan selection
    if (profile.role === 'OWNER' && hasOwnedBusiness && hasPlan) {
      setNeedsPlanSelection(false);
    } else if (!hasPlan && !hasOwnedBusiness) {
      // New users without plan or business need to select
      setNeedsPlanSelection(true);
    } else {
      setNeedsPlanSelection(false);
    }

    setIsLoading(false);
  }, [user, profile]);

  return {
    needsPlanSelection,
    isLoading,
  };
};
