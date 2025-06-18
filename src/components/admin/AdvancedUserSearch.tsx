
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, User, Mail, Crown, Calendar } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';

interface SearchedUser {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  created_at: string;
}

export const AdvancedUserSearch: React.FC = () => {
  const { getRoleDisplayName } = useUserRole();
  const [searchTerms, setSearchTerms] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });
  const [isSearching, setIsSearching] = useState(false);

  // Create a combined search term from all inputs
  const combinedSearchTerm = [
    searchTerms.firstName,
    searchTerms.lastName,
    searchTerms.email
  ].filter(term => term.trim()).join(' ');

  const { data: searchResults, isLoading, refetch } = useQuery({
    queryKey: ['admin-user-search', combinedSearchTerm],
    queryFn: async () => {
      if (!combinedSearchTerm.trim()) return [];

      console.log('Searching for users with term:', combinedSearchTerm);
      
      try {
        // Use direct query since the RPC function might not be in generated types yet
        const { data, error } = await supabase
          .from('profiles')
          .select(`
            id,
            first_name,
            last_name,
            created_at,
            user_roles!left(role)
          `)
          .or(`first_name.ilike.%${combinedSearchTerm}%,last_name.ilike.%${combinedSearchTerm}%`)
          .limit(20);

        if (error) {
          console.error('Search error:', error);
          throw error;
        }

        // Transform the data to match our interface
        const transformedData: SearchedUser[] = (data || []).map(profile => ({
          user_id: profile.id,
          email: '', // We'll get this separately if needed
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          role: (profile.user_roles as any)?.[0]?.role || 'free_user',
          created_at: profile.created_at || '',
        }));

        console.log('Search results:', transformedData);
        return transformedData;
      } catch (error) {
        console.error('Search failed:', error);
        return [];
      }
    },
    enabled: false, // Only run when manually triggered
  });

  const handleSearch = () => {
    if (combinedSearchTerm.trim()) {
      setIsSearching(true);
      refetch().finally(() => setIsSearching(false));
    }
  };

  const handleInputChange = (field: keyof typeof searchTerms, value: string) => {
    setSearchTerms(prev => ({ ...prev, [field]: value }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

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
        {/* Search Form */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="firstName" className="font-rubik">שם פרטי</Label>
            <Input
              id="firstName"
              type="text"
              placeholder="הכנס שם פרטי"
              value={searchTerms.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              onKeyPress={handleKeyPress}
              className="font-rubik"
            />
          </div>
          <div>
            <Label htmlFor="lastName" className="font-rubik">שם משפחה</Label>
            <Input
              id="lastName"
              type="text"
              placeholder="הכנס שם משפחה"
              value={searchTerms.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              onKeyPress={handleKeyPress}
              className="font-rubik"
            />
          </div>
          <div>
            <Label htmlFor="email" className="font-rubik">כתובת אימייל</Label>
            <Input
              id="email"
              type="email"
              placeholder="הכנס אימייל"
              value={searchTerms.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              onKeyPress={handleKeyPress}
              className="font-rubik"
            />
          </div>
        </div>

        <div className="flex justify-center">
          <Button 
            onClick={handleSearch}
            disabled={isLoading || isSearching || !combinedSearchTerm.trim()}
            className="bg-turquoise hover:bg-turquoise/90 font-rubik"
          >
            <Search className="w-4 h-4 ml-2" />
            {isLoading || isSearching ? 'מחפש...' : 'חפש משתמשים'}
          </Button>
        </div>

        {/* Search Results */}
        {searchResults && searchResults.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-turquoise" />
              <h3 className="text-lg font-semibold font-rubik">
                נמצאו {searchResults.length} משתמשים
              </h3>
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

        {searchResults && searchResults.length === 0 && combinedSearchTerm.trim() && !isLoading && (
          <div className="text-center py-8 text-gray-500">
            <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="font-rubik">לא נמצאו משתמשים התואמים לחיפוש</p>
            <p className="text-sm font-rubik">נסה לשנות את מונחי החיפוש</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
