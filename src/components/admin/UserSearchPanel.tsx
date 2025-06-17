
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, User, Crown, Mail, Loader2 } from 'lucide-react';

interface SearchedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  currentPlan: string;
  status: 'active' | 'inactive' | 'expired';
  joinDate: string;
  subscriptionExpiry?: string;
}

export const UserSearchPanel: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTriggered, setSearchTriggered] = useState(false);

  const { data: searchResult, isLoading, error } = useQuery({
    queryKey: ['user-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return null;

      // Search for user by email pattern in auth.users through profiles
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`
          id,
          first_name,
          last_name
        `)
        .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`)
        .limit(1)
        .single();

      if (profileError && profileError.code !== 'PGRST116') throw profileError;

      if (!profileData) {
        // Try searching by user ID directly
        const { data: directSearch, error: directError } = await supabase
          .from('profiles')
          .select(`
            id,
            first_name,
            last_name
          `)
          .eq('id', searchQuery)
          .single();

        if (directError && directError.code !== 'PGRST116') throw directError;
        if (!directSearch) return null;

        profileData.id = directSearch.id;
        profileData.first_name = directSearch.first_name;
        profileData.last_name = directSearch.last_name;
      }

      // Get user's current subscription
      const { data: subscriptionData, error: subError } = await supabase
        .from('user_subscriptions_new')
        .select('plan, status, started_at, expires_at')
        .eq('user_id', profileData.id)
        .eq('status', 'active')
        .single();

      if (subError && subError.code !== 'PGRST116') {
        console.log('No active subscription found for user');
      }

      return {
        id: profileData.id,
        email: searchQuery.includes('@') ? searchQuery : 'לא זמין',
        firstName: profileData.first_name || 'לא',
        lastName: profileData.last_name || 'זמין',
        currentPlan: subscriptionData?.plan || 'free',
        status: subscriptionData?.status === 'active' ? 'active' : 'inactive',
        joinDate: subscriptionData?.started_at || new Date().toISOString(),
        subscriptionExpiry: subscriptionData?.expires_at,
      } as SearchedUser;
    },
    enabled: searchTriggered && searchQuery.trim().length > 0,
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchTriggered(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500 font-rubik">פעיל</Badge>;
      case 'expired':
        return <Badge variant="destructive" className="font-rubik">פג תוקף</Badge>;
      default:
        return <Badge variant="secondary" className="font-rubik">לא פעיל</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900 font-rubik" dir="rtl">
          חיפוש משתמש
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2" dir="rtl">
          <Input
            type="text"
            placeholder="הכנס שם פרטי, שם משפחה או מזהה משתמש"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="font-rubik"
          />
          <Button 
            type="submit" 
            disabled={isLoading}
            className="bg-turquoise hover:bg-turquoise/90"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </form>

        {isLoading && (
          <div className="text-center py-4 text-gray-500 font-rubik flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin ml-2" />
            מחפש...
          </div>
        )}

        {error && (
          <div className="text-center py-4 text-red-500 font-rubik">
            שגיאה בחיפוש המשתמש
          </div>
        )}

        {searchTriggered && !isLoading && !searchResult && !error && (
          <div className="text-center py-4 text-gray-500 font-rubik">
            משתמש לא נמצא
          </div>
        )}

        {searchResult && (
          <Card className="border-2 border-turquoise/20">
            <CardContent className="pt-6" dir="rtl">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <span className="font-semibold font-rubik">
                    {searchResult.firstName} {searchResult.lastName}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600 font-rubik">{searchResult.email}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-gray-500" />
                  <Badge variant="outline" className="font-rubik">{searchResult.currentPlan}</Badge>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 font-rubik">סטטוס:</span>
                  {getStatusBadge(searchResult.status)}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 font-rubik">תאריך הצטרפות:</span>
                    <p className="font-rubik">{new Date(searchResult.joinDate).toLocaleDateString('he-IL')}</p>
                  </div>
                  {searchResult.subscriptionExpiry && (
                    <div>
                      <span className="text-gray-500 font-rubik">תפוגת מנוי:</span>
                      <p className="font-rubik">{new Date(searchResult.subscriptionExpiry).toLocaleDateString('he-IL')}</p>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <Button 
                    className="w-full bg-mango hover:bg-mango/90 font-rubik"
                    onClick={() => console.log('Edit subscription for:', searchResult.id)}
                  >
                    ערוך מנוי
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};
