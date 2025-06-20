
import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from './useBusiness';
import { useDebounce } from './useDebounce';

interface SearchProduct {
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
  search_rank: number;
}

interface AutocompleteSuggestion {
  suggestion: string;
  product_count: number;
}

export const useProductSearch = (searchTerm: string, enabled: boolean = true) => {
  const { business } = useBusiness();
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const { data: searchResults = [], isLoading: isSearching, error } = useQuery({
    queryKey: ['product_search', debouncedSearchTerm, business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      
      const { data, error } = await supabase.rpc('search_products', {
        search_term: debouncedSearchTerm,
        business_uuid: business.id,
        limit_count: 20
      });
      
      if (error) {
        console.error('Error searching products:', error);
        throw error;
      }
      
      return data as SearchProduct[];
    },
    enabled: enabled && !!business?.id,
  });

  return {
    searchResults,
    isSearching,
    error,
  };
};

export const useProductAutocomplete = (searchTerm: string, enabled: boolean = true) => {
  const { business } = useBusiness();
  const debouncedSearchTerm = useDebounce(searchTerm, 200);

  const { data: suggestions = [], isLoading: isLoadingSuggestions } = useQuery({
    queryKey: ['product_autocomplete', debouncedSearchTerm, business?.id],
    queryFn: async () => {
      if (!business?.id || debouncedSearchTerm.length < 2) return [];
      
      const { data, error } = await supabase.rpc('get_product_autocomplete', {
        search_term: debouncedSearchTerm,
        business_uuid: business.id,
        limit_count: 5
      });
      
      if (error) {
        console.error('Error getting autocomplete suggestions:', error);
        throw error;
      }
      
      return data as AutocompleteSuggestion[];
    },
    enabled: enabled && !!business?.id && debouncedSearchTerm.length >= 2,
  });

  return {
    suggestions,
    isLoadingSuggestions,
  };
};
