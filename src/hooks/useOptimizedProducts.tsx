
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
      
      // Build the query dynamically
      let query = supabase
        .from('products')
        .select(`
          id,
          name,
          barcode,
          quantity,
          location,
          expiration_date,
          price,
          cost,
          product_categories!inner(name),
          suppliers(name)
        `)
        .eq('business_id', business.id);

      // Add search filter if provided
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,barcode.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%`);
      }

      // Add limit and ordering
      query = query
        .order('created_at', { ascending: false })
        .limit(limit);
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching optimized products:', error);
        throw error;
      }
      
      // Transform the data to match our interface
      const transformedData: OptimizedProduct[] = (data || []).map(item => ({
        id: item.id,
        name: item.name,
        barcode: item.barcode,
        quantity: item.quantity,
        location: item.location,
        expiration_date: item.expiration_date,
        price: item.price,
        cost: item.cost,
        category_name: item.product_categories?.name || null,
        supplier_name: item.suppliers?.name || null,
        stock_status: item.quantity === 0 ? 'out_of_stock' : 
                     item.quantity <= 5 ? 'low_stock' : 'in_stock',
        search_rank: searchTerm ? 
          (item.name.toLowerCase().includes(searchTerm.toLowerCase()) ? 2 : 1) : 1
      }));
      
      return transformedData;
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
