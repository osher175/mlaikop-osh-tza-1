
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, User, Mail, Crown, Calendar, Loader2, Users } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';

interface ProfileResult {
  id: string;
  first_name: string;
  last_name: string;
  created_at: string;
  user_roles?: Array<{ role: string }>;
  emails?: Array<{ email: string }>;
}

export const EnhancedUserSearch: React.FC = () => {
  const { getRoleDisplayName } = useUserRole();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Debounce search term with 500ms delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: searchResults, isLoading, error } = useQuery({
    queryKey: ['enhanced-user-search', debouncedSearchTerm],
    queryFn: async () => {
      if (!debouncedSearchTerm.trim() || debouncedSearchTerm.trim().length < 2) {
        return [];
      }

      console.log('=== Enhanced User Search ===');
      console.log('Search term:', debouncedSearchTerm);

      try {
        const searchPattern = `%${debouncedSearchTerm.trim()}%`;
        
        // Search profiles by first_name or last_name
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select(`
            id,
            first_name,
            last_name,
            created_at,
            user_roles!left(role),
            emails!left(email)
          `)
          .or(`first_name.ilike.${searchPattern},last_name.ilike.${searchPattern}`)
          .order('created_at', { ascending: false })
          .limit(20);

        if (profileError) {
          console.error('Profile search error:', profileError);
          throw profileError;
        }

        console.log('Found profiles:', profileData?.length || 0);
        return (profileData || []) as ProfileResult[];
        
      } catch (error) {
        console.error('Search failed:', error);
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

  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="border-2 border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

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
            placeholder="חפש לפי שם פרטי או שם משפחה..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="font-rubik pr-10"
            name="input_userSearch"
          />
          {searchTerm && searchTerm.length < 2 && (
            <p className="text-xs text-gray-500 mt-1 font-rubik">
              הכנס לפחות 2 תווים כדי להתחיל לחפש
            </p>
          )}
        </div>

        {/* Loading State */}
        {isLoading && <LoadingSkeleton />}

        {/* Error State */}
        {error && (
          <div className="text-center py-8 text-red-500">
            <p className="font-rubik">שגיאה בחיפוש המשתמשים</p>
            <p className="text-sm font-rubik mt-1">אנא נסה שוב מאוחר יותר</p>
          </div>
        )}

        {/* Search Results */}
        {searchResults && Array.isArray(searchResults) && searchResults.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-turquoise" />
              <h3 className="text-lg font-semibold font-rubik">
                נמצאו {searchResults.length} משתמשים
              </h3>
              {searchResults.length === 20 && (
                <span className="text-sm text-gray-500 font-rubik">(מוגבל ל-20 תוצאות)</span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4" data-name="repeatingGroup_profiles">
              {searchResults.map((profile) => {
                const userRole = profile.user_roles?.[0]?.role || 'free_user';
                const userEmail = profile.emails?.[0]?.email || 'לא זמין';

                return (
                  <Card key={profile.id} className="border-2 border-gray-200 hover:border-turquoise transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-turquoise/10 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-turquoise" />
                          </div>
                          <div>
                            <h4 className="font-semibold font-rubik">
                              {profile.first_name} {profile.last_name}
                            </h4>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Mail className="w-4 h-4" />
                              <span className="font-rubik">{userEmail}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <Badge className={`${getRoleBadgeColor(userRole)} font-rubik`}>
                            <Crown className="w-3 h-3 ml-1" />
                            {getRoleDisplayName(userRole as any)}
                          </Badge>
                          
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span className="font-rubik">
                              {new Date(profile.created_at).toLocaleDateString('he-IL')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* No Results State */}
        {searchResults && Array.isArray(searchResults) && searchResults.length === 0 && debouncedSearchTerm.trim().length >= 2 && !isLoading && (
          <div className="text-center py-8 text-gray-500">
            <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="font-rubik">לא נמצאו משתמשים התואמים לחיפוש "{debouncedSearchTerm}"</p>
            <p className="text-sm font-rubik mt-1">נסה לשנות את מונח החיפוש או חפש לפי שם בלבד</p>
          </div>
        )}

        {/* Initial State */}
        {!debouncedSearchTerm.trim() && (
          <div className="text-center py-8 text-gray-500">
            <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="font-rubik">הכנס לפחות 2 תווים כדי להתחיל לחפש</p>
            <p className="text-sm font-rubik mt-1">חיפוש בזמן אמת לפי שם פרטי או שם משפחה</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
