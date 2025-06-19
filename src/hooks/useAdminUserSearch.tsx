
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface SearchUser {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  created_at: string;
}

export const useAdminUserSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const queryClient = useQueryClient();

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Search users query
  const { data: users, isLoading, error } = useQuery({
    queryKey: ['admin-user-search', debouncedSearchTerm],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_users_for_admin', {
        search_pattern: debouncedSearchTerm
      });

      if (error) {
        console.error('Error searching users:', error);
        throw error;
      }

      return data as SearchUser[];
    },
    enabled: true,
  });

  // Toggle user active status mutation
  const toggleUserStatusMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.rpc('toggle_user_active_status', {
        target_user_id: userId
      });

      if (error) {
        console.error('Error toggling user status:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-search'] });
      toast({
        title: "הצלחה",
        description: "סטטוס המשתמש עודכן בהצלחה",
      });
    },
    onError: (error: any) => {
      console.error('Error toggling user status:', error);
      toast({
        title: "שגיאה",
        description: "שגיאה בעדכון סטטוס המשתמש",
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.rpc('delete_user_by_admin', {
        target_user_id: userId
      });

      if (error) {
        console.error('Error deleting user:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-search'] });
      toast({
        title: "הצלחה",
        description: "המשתמש נמחק בהצלחה",
      });
    },
    onError: (error: any) => {
      console.error('Error deleting user:', error);
      toast({
        title: "שגיאה",
        description: "שגיאה במחיקת המשתמש",
        variant: "destructive",
      });
    },
  });

  // Separate active and inactive users
  const activeUsers = users?.filter(user => user.is_active) || [];
  const inactiveUsers = users?.filter(user => !user.is_active) || [];

  return {
    searchTerm,
    setSearchTerm,
    users: users || [],
    activeUsers,
    inactiveUsers,
    isLoading,
    error,
    toggleUserStatus: toggleUserStatusMutation.mutate,
    deleteUser: deleteUserMutation.mutate,
    isToggling: toggleUserStatusMutation.isPending,
    isDeleting: deleteUserMutation.isPending,
  };
};
