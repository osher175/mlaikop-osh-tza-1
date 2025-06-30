
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from './useBusinessAccess';
import { useDebounce } from './useDebounce';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'] & {
  product_categories?: { name: string } | null;
};

export const useProductSearch = (searchTerm: string) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { businessContext } = useBusinessAccess();
  
  // Debounce search term by 350ms
  const debouncedSearchTerm = useDebounce(searchTerm, 350);

  const searchProducts = async (term: string) => {
    if (!businessContext?.business_id) return;
    
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('products')
        .select(`
          *,
          product_categories(name)
        `)
        .eq('business_id', businessContext.business_id)
        .limit(30);

      if (term.trim()) {
        // Server-side search using ilike for case-insensitive search
        query = query.or(`
          name.ilike.%${term}%,
          location.ilike.%${term}%,
          barcode.ilike.%${term}%
        `);
      }

      const { data, error: searchError } = await query.order('created_at', { ascending: false });

      if (searchError) {
        console.error('Search error:', searchError);
        setError('שגיאה בחיפוש המוצרים');
        return;
      }

      setProducts(data || []);
    } catch (err) {
      console.error('Search exception:', err);
      setError('שגיאה בחיפוש המוצרים');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    searchProducts(debouncedSearchTerm);
  }, [debouncedSearchTerm, businessContext?.business_id]);

  return {
    products,
    isLoading,
    error,
    hasResults: products.length > 0,
    isEmpty: !isLoading && products.length === 0 && debouncedSearchTerm.trim() !== ''
  };
};
