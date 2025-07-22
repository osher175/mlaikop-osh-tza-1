
import React from 'react';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';

// This is a simplified version of the component to fix the type error
const OptimizedInventory = () => {
  const { businessContext } = useBusinessAccess();
  
  const canManageInventory = businessContext?.user_role === 'MANAGER' || 
                            businessContext?.is_owner ||
                            businessContext?.user_role === 'admin';
  
  return (
    <div>
      <h2>Optimized Inventory</h2>
      {canManageInventory ? (
        <p>You have permission to manage inventory.</p>
      ) : (
        <p>You are in view-only mode.</p>
      )}
    </div>
  );
};

export default OptimizedInventory;
