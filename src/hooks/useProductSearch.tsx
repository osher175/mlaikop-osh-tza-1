
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
    // Reset error state
    setError(null);
    
    // Don't search if no business context
    if (!businessContext?.business_id) {
      console.log('No business context available for search');
      setProducts([]);
      return;
    }
    
    setIsLoading(true);

    try {
      let query = supabase
        .from('products')
        .select(`
          *,
          product_categories(name)
        `)
        .eq('business_id', businessContext.business_id)
        .limit(30);

      // Only add search filters if term is not empty
      const trimmedTerm = term.trim();
      if (trimmedTerm.length > 0) {
        // Server-side search using ilike for case-insensitive search
        query = query.or(`
          name.ilike.%${trimmedTerm}%,
          location.ilike.%${trimmedTerm}%,
          barcode.ilike.%${trimmedTerm}%
        `);
      }

      const { data, error: searchError } = await query.order('created_at', { ascending: false });

      if (searchError) {
        console.error('Search error details:', {
          error: searchError,
          business_id: businessContext.business_id,
          search_term: trimmedTerm
        });
        
        // More specific error handling
        if (searchError.code === 'PGRST116') {
          setError('שגיאה בפרמטרי החיפוש');
        } else if (searchError.code === '42P01') {
          setError('שגיאה במבנה הנתונים');
        } else {
          setError('שגיאה בחיפוש המוצרים - אנא נסה שוב');
        }
        setProducts([]);
        return;
      }

      // Successfully got data
      setProducts(data || []);
      console.log('Search completed successfully:', {
        term: trimmedTerm,
        results: data?.length || 0
      });

    } catch (err) {
      console.error('Search exception details:', {
        error: err,
        business_id: businessContext?.business_id,
        search_term: term.trim()
      });
      
      // Network or other errors
      if (err instanceof Error) {
        if (err.message.includes('fetch')) {
          setError('בעיית חיבור לרשת - בדוק את החיבור שלך');
        } else {
          setError('שגיאה טכנית - אנא נסה שוב');
        }
      } else {
        setError('שגיאה לא צפויה - אנא רענן את הדף');
      }
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load all products initially (when no search term)
  const loadAllProducts = async () => {
    if (!businessContext?.business_id) {
      setProducts([]);
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: loadError } = await supabase
        .from('products')
        .select(`
          *,
          product_categories(name)
        `)
        .eq('business_id', businessContext.business_id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (loadError) {
        console.error('Load all products error:', loadError);
        setError('שגיאה בטעינת המוצרים');
        setProducts([]);
        return;
      }

      setProducts(data || []);
    } catch (err) {
      console.error('Load all products exception:', err);
      setError('שגיאה בטעינת המוצרים');
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const trimmedTerm = debouncedSearchTerm.trim();
    
    if (trimmedTerm.length === 0) {
      // Load all products when search is empty
      loadAllProducts();
    } else {
      // Search for specific products
      searchProducts(trimmedTerm);
    }
  }, [debouncedSearchTerm, businessContext?.business_id]);

  return {
    products,
    isLoading,
    error,
    hasResults: products.length > 0,
    isEmpty: !isLoading && products.length === 0 && debouncedSearchTerm.trim() !== ''
  };
};
