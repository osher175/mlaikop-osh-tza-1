
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from './useBusiness';
import { useMemo } from 'react';

interface OptimizedProduct {
  id: string;
  name: string;
  barcode: string | null;
  quantity: number;
  location: string | null;
  expiration_date: string | null;
  price: number | null;
  cost: number | null;
  category_name: string | null;
  supplier_name: string | null;
  stock_status: string;
  search_rank: number;
}

export const useOptimizedProducts = (searchTerm = '', limit = 50) => {
  const { business } = useBusiness();

  const queryKey = useMemo(() => [
    'optimized_products',
    business?.id,
    searchTerm,
    limit,
  ], [business?.id, searchTerm, limit]);

  const { data: products = [], isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!business?.id) return [];
      
      console.log('Fetching optimized products:', { business_id: business.id, searchTerm, limit });
      
      // Use direct SQL query instead of RPC since the function might not be recognized by TypeScript
      const { data, error } = await supabase
        .from('products_with_status')
        .select('*')
        .eq('business_id', business.id)
        .ilike('name', `%${searchTerm}%`)
        .limit(limit);
      
      if (error) {
        console.error('Error fetching optimized products:', error);
        throw error;
      }
      
      return data as OptimizedProduct[];
    },
    enabled: !!business?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });

  return {
    products,
    isLoading,
    error,
    refetch,
  };
};
