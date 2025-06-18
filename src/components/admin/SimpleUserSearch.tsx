
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, User, Mail, Crown, Calendar, Loader2 } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';

interface SearchedUser {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  created_at: string;
}

export const SimpleUserSearch: React.FC = () => {
  const { getRoleDisplayName } = useUserRole();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['admin-user-search', debouncedSearchTerm],
    queryFn: async () => {
      if (!debouncedSearchTerm.trim() || debouncedSearchTerm.trim().length < 2) {
        return [];
      }

      console.log('=== Admin User Search (Enhanced) ===');
      console.log('Search term:', debouncedSearchTerm);

      try {
        const searchPattern = `%${debouncedSearchTerm.trim()}%`;
        
        // Get admin data using RPC function that can access auth schema
        const { data: adminData, error: adminError } = await supabase.rpc('get_users_for_admin_search', {
          search_pattern: searchPattern
        });

        if (adminError) {
          console.error('Admin search RPC error:', adminError);
          
          // Fallback to profiles table search if RPC fails
          console.log('Falling back to profiles search...');
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select(`
              id,
              first_name,
              last_name,
              created_at,
              user_roles!left(role)
            `)
            .or(`first_name.ilike.${searchPattern},last_name.ilike.${searchPattern}`)
            .limit(20);

          if (profileError) {
            console.error('Fallback profile search error:', profileError);
            throw profileError;
          }

          // Transform fallback data
          const transformedData: SearchedUser[] = (profileData || []).map(profile => ({
            user_id: profile.id,
            email: 'דורש הרשאות מנהל מתקדמות',
            first_name: profile.first_name || '',
            last_name: profile.last_name || '',
            role: (profile.user_roles as any)?.[0]?.role || 'free_user',
            created_at: profile.created_at || '',
          }));

          console.log('Fallback results:', transformedData.length);
          return transformedData;
        }

        console.log('Admin RPC found:', adminData?.length || 0, 'users');
        return adminData || [];
        
      } catch (error) {
        console.error('Search failed completely:', error);
        return [];
      }
    },
    enabled: debouncedSearchTerm.trim().length >= 2,
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-500 text-white';
      case 'elite_pilot_user':
        return 'bg-purple-500 text-white';
      case 'smart_master_user':
        return 'bg-blue-500 text-white';
      case 'pro_starter_user':
        return 'bg-amber-500 text-white';
      case 'free_user':
        return 'bg-gray-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900 font-rubik" dir="rtl">
          חיפוש משתמשים מתקדם
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6" dir="rtl">
        {/* Search Input */}
        <div className="relative">
          <div className="absolute inset-y-0 right-0 pl-3 flex items-center pointer-events-none">
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : (
              <Search className="w-4 h-4 text-gray-400" />
            )}
          </div>
          <Input
            type="text"
            placeholder="חפש לפי שם פרטי, שם משפחה או אימייל..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="font-rubik pr-10"
          />
          {searchTerm && searchTerm.length < 2 && (
            <p className="text-xs text-gray-500 mt-1 font-rubik">
              הכנס לפחות 2 תווים כדי להתחיל לחפש
            </p>
          )}
        </div>

        {/* Search Results */}
        {searchResults && searchResults.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-turquoise" />
              <h3 className="text-lg font-semibold font-rubik">
                נמצאו {searchResults.length} משתמשים
              </h3>
              {searchResults.length === 20 && (
                <span className="text-sm text-gray-500 font-rubik">(מוגבל ל-20 תוצאות)</span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              {searchResults.map((user) => (
                <Card key={user.user_id} className="border-2 border-gray-200 hover:border-turquoise transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-turquoise/10 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-turquoise" />
                        </div>
                        <div>
                          <h4 className="font-semibold font-rubik">
                            {user.first_name} {user.last_name}
                          </h4>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="w-4 h-4" />
                            <span className="font-rubik">{user.email}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Badge className={`${getRoleBadgeColor(user.role)} font-rubik`}>
                          <Crown className="w-3 h-3 ml-1" />
                          {getRoleDisplayName(user.role as any)}
                        </Badge>
                        
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span className="font-rubik">
                            {new Date(user.created_at).toLocaleDateString('he-IL')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {searchResults && searchResults.length === 0 && debouncedSearchTerm.trim().length >= 2 && !isLoading && (
          <div className="text-center py-8 text-gray-500">
            <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="font-rubik">לא נמצאו משתמשים התואמים לחיפוש "{debouncedSearchTerm}"</p>
            <p className="text-sm font-rubik">נסה לשנות את מונח החיפוש או חפש לפי שם בלבד</p>
          </div>
        )}

        {!debouncedSearchTerm.trim() && (
          <div className="text-center py-8 text-gray-500">
            <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="font-rubik">הכנס לפחות 2 תווים כדי להתחיל לחפש</p>
            <p className="text-sm font-rubik">חיפוש בזמן אמת לפי שם פרטי, שם משפחה או אימייל</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
