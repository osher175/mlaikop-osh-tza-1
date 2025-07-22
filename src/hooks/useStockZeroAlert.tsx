
import { useState, useEffect } from 'react';
import { useBusinessAccess } from './useBusinessAccess';

interface StockZeroProduct {
  id: string;
  name: string;
}

export const useStockZeroAlert = () => {
  const [alertProduct, setAlertProduct] = useState<StockZeroProduct | null>(null);
  const { businessContext } = useBusinessAccess();

  const showAlert = (product: StockZeroProduct) => {
    // Only show alert for owners or inventory managers
    if (businessContext?.is_owner || businessContext?.user_role === 'inventory_manager') {
      setAlertProduct(product);
    }
  };

  const hideAlert = () => {
    setAlertProduct(null);
  };

  const triggerSendToSupplier = (productId: string) => {
    console.log(`Triggering send to supplier for product: ${productId}`);
    // This function will be implemented by your team later
    // For now, just log the action
    
    // TODO: Implement the actual webhook call to clever-service edge function
    // This will be done in the next phase
  };

  return {
    alertProduct,
    showAlert,
    hideAlert,
    triggerSendToSupplier,
  };
};
