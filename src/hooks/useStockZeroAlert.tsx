
import { useState, useEffect, useRef } from 'react';
import { useBusinessAccess } from './useBusinessAccess';

interface StockZeroProduct {
  id: string;
  name: string;
}

export const useStockZeroAlert = () => {
  const [alertProduct, setAlertProduct] = useState<StockZeroProduct | null>(null);
  const { businessContext } = useBusinessAccess();
  const previousQuantities = useRef<Record<string, number>>({});

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
    
    // Close alert after confirming
    hideAlert();
  };

  const checkForStockChanges = (products: any[]) => {
    products.forEach(product => {
      const previousQuantity = previousQuantities.current[product.id];
      const currentQuantity = product.quantity;
      
      // Show alert only when quantity changes from > 0 to exactly 0
      if (previousQuantity !== undefined && previousQuantity > 0 && currentQuantity === 0) {
        showAlert({ id: product.id, name: product.name });
      }
      
      // Update the tracked quantity
      previousQuantities.current[product.id] = currentQuantity;
    });
  };

  return {
    alertProduct,
    showAlert,
    hideAlert,
    triggerSendToSupplier,
    checkForStockChanges,
  };
};
