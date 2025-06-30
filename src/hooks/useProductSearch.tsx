
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

    // Validate search term - minimum 2 characters for search
    const trimmedTerm = term.trim();
    if (trimmedTerm.length > 0 && trimmedTerm.length < 2) {
      console.log('Search term too short, skipping search');
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

      // Only add search filters if term is not empty and valid
      if (trimmedTerm.length >= 2) {
        // Server-side search using ilike for case-insensitive search
        // Escape special characters to prevent SQL injection
        const safeTerm = trimmedTerm.replace(/[%_]/g, '\\$&');
        
        query = query.or(`
          name.ilike.%${safeTerm}%,
          location.ilike.%${safeTerm}%,
          barcode.ilike.%${safeTerm}%
        `);
      }

      const { data, error: searchError } = await query.order('created_at', { ascending: false });

      if (searchError) {
        console.error('Search error details:', {
          error: searchError,
          business_id: businessContext.business_id,
          search_term: trimmedTerm,
          error_code: searchError.code,
          error_message: searchError.message
        });
        
        // More specific error handling based on error codes
        if (searchError.code === 'PGRST116') {
          setError('פרמטרי החיפוש אינם תקינים');
        } else if (searchError.code === '42P01') {
          setError('שגיאה במבנה הנתונים');
        } else if (searchError.code === 'PGRST301') {
          setError('אין הרשאה לגשת לנתונים');
        } else if (searchError.message?.includes('permission')) {
          setError('אין הרשאה לחפש במוצרים');
        } else {
          setError('שגיאה בחיפוש המוצרים');
        }
        setProducts([]);
        return;
      }

      // Successfully got data
      setProducts(data || []);
      console.log('Search completed successfully:', {
        term: trimmedTerm,
        results: data?.length || 0,
        business_id: businessContext.business_id
      });

    } catch (err) {
      console.error('Search exception details:', {
        error: err,
        business_id: businessContext?.business_id,
        search_term: term.trim(),
        stack: err instanceof Error ? err.stack : 'No stack trace'
      });
      
      // Network or other errors
      if (err instanceof Error) {
        if (err.message.includes('fetch') || err.message.includes('network')) {
          setError('בעיית חיבור - בדוק את החיבור לאינטרנט');
        } else if (err.message.includes('timeout')) {
          setError('החיפוש לוקח זמן רב מדי - נסה שוב');
        } else {
          setError('שגיאה טכנית בחיפוש');
        }
      } else {
        setError('שגיאה לא צפויה');
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
        console.error('Load all products error:', {
          error: loadError,
          business_id: businessContext.business_id,
          error_code: loadError.code
        });
        setError('שגיאה בטעינת המוצרים');
        setProducts([]);
        return;
      }

      setProducts(data || []);
      console.log('All products loaded successfully:', {
        count: data?.length || 0,
        business_id: businessContext.business_id
      });
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
    } else if (trimmedTerm.length >= 2) {
      // Only search if term is at least 2 characters
      searchProducts(trimmedTerm);
    }
    // If term is 1 character, do nothing (don't search, don't clear)
  }, [debouncedSearchTerm, businessContext?.business_id]);

  return {
    products,
    isLoading,
    error,
    hasResults: products.length > 0,
    isEmpty: !isLoading && products.length === 0 && debouncedSearchTerm.trim().length >= 2
  };
};
