
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

  // Check if we have any search terms
  const hasSearchTerms = searchTerms.firstName.trim() || searchTerms.lastName.trim() || searchTerms.email.trim();

  const { data: searchResults, isLoading, refetch } = useQuery({
    queryKey: ['admin-user-search', searchTerms],
    queryFn: async () => {
      console.log('=== Starting user search ===');
      console.log('Search terms:', searchTerms);

      if (!hasSearchTerms) {
        console.log('No search terms provided');
        return [];
      }

      try {
        let query = supabase
          .from('profiles')
          .select(`
            id,
            first_name,
            last_name,
            created_at,
            user_roles!left(role)
          `);

        // Build search conditions based on what the user entered
        const conditions = [];
        
        if (searchTerms.firstName.trim()) {
          conditions.push(`first_name.ilike.%${searchTerms.firstName.trim()}%`);
          console.log('Added first name condition:', searchTerms.firstName.trim());
        }
        
        if (searchTerms.lastName.trim()) {
          conditions.push(`last_name.ilike.%${searchTerms.lastName.trim()}%`);
          console.log('Added last name condition:', searchTerms.lastName.trim());
        }

        // For email search, we'll search in both first and last name as fallback
        // since we can't directly access auth.users table
        if (searchTerms.email.trim()) {
          const emailTerm = searchTerms.email.trim();
          console.log('Email search term provided:', emailTerm);
          
          // Try to extract name parts from email
          const beforeAt = emailTerm.split('@')[0];
          if (beforeAt && beforeAt.length > 2) {
            conditions.push(`first_name.ilike.%${beforeAt}%`);
            conditions.push(`last_name.ilike.%${beforeAt}%`);
            console.log('Added email-based name conditions for:', beforeAt);
          }
        }

        if (conditions.length === 0) {
          console.log('No valid search conditions built');
          return [];
        }

        // Apply OR conditions
        const orCondition = conditions.join(',');
        console.log('Final OR condition:', orCondition);
        
        query = query.or(orCondition).limit(20);

        const { data: profileData, error: profileError } = await query;

        if (profileError) {
          console.error('Profile search error:', profileError);
          throw profileError;
        }

        console.log('Raw profile data:', profileData);

        // Transform the data to match our interface
        const transformedData: SearchedUser[] = (profileData || []).map(profile => {
          const transformedUser = {
            user_id: profile.id,
            email: 'מוסתר מטעמי אבטחה', // Hidden for security
            first_name: profile.first_name || '',
            last_name: profile.last_name || '',
            role: (profile.user_roles as any)?.[0]?.role || 'free_user',
            created_at: profile.created_at || '',
          };
          console.log('Transformed user:', transformedUser);
          return transformedUser;
        });

        console.log(`=== Search completed: Found ${transformedData.length} users ===`);
        return transformedData;
      } catch (error) {
        console.error('Search failed:', error);
        return [];
      }
    },
    enabled: false, // Only run when manually triggered
  });

  const handleSearch = () => {
    if (hasSearchTerms) {
      console.log('=== Manual search triggered ===');
      console.log('Current search terms:', searchTerms);
      setIsSearching(true);
      refetch().finally(() => setIsSearching(false));
    } else {
      console.log('Search attempted but no terms provided');
    }
  };

  const handleInputChange = (field: keyof typeof searchTerms, value: string) => {
    console.log(`Input changed - ${field}:`, value);
    setSearchTerms(prev => ({ ...prev, [field]: value }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
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
            <Label htmlFor="email" className="font-rubik">כתובת אימייל (חיפוש חלקי)</Label>
            <Input
              id="email"
              type="text"
              placeholder="הכנס חלק מהאימייל"
              value={searchTerms.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              onKeyPress={handleKeyPress}
              className="font-rubik"
            />
            <p className="text-xs text-gray-500 mt-1 font-rubik">
              חיפוש אימייל יחפש לפי חלק מהשם שלפני ה-@
            </p>
          </div>
        </div>

        <div className="flex justify-center">
          <Button 
            onClick={handleSearch}
            disabled={isLoading || isSearching || !hasSearchTerms}
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

        {searchResults && searchResults.length === 0 && hasSearchTerms && !isLoading && (
          <div className="text-center py-8 text-gray-500">
            <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="font-rubik">לא נמצאו משתמשים התואמים לחיפוש</p>
            <p className="text-sm font-rubik">נסה לשנות את מונחי החיפוש או חפש לפי שם בלבד</p>
          </div>
        )}

        {!hasSearchTerms && (
          <div className="text-center py-8 text-gray-500">
            <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="font-rubik">הכנס לפחות שדה אחד כדי להתחיל לחפש</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
