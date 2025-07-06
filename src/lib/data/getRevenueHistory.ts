import { useQuery } from '@tanstack/react-query';

interface RevenueData {
  month: string;
  revenue: number;
}

export const useRevenueHistory = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['revenue-history', 'monthly'],
    queryFn: async (): Promise<RevenueData[]> => {
      // TODO: Replace with actual Supabase query when revenue tracking is implemented
      // For now, return dummy data
      const dummyData: RevenueData[] = [
        { month: 'ינואר', revenue: 45000 },
        { month: 'פברואר', revenue: 52000 },
        { month: 'מרץ', revenue: 48000 },
        { month: 'אפריל', revenue: 61000 },
        { month: 'מאי', revenue: 55000 },
        { month: 'יוני', revenue: 67000 },
      ];

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return dummyData;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    revenueData: data || [],
    isLoading,
    error,
  };
};
