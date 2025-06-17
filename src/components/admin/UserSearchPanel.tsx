
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, User, Crown, Mail } from 'lucide-react';

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
  const [searchResult, setSearchResult] = useState<SearchedUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError(null);
    setSearchResult(null);

    try {
      // TODO: Replace with actual Supabase query
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Dummy data for demonstration
      if (searchQuery.includes('@')) {
        setSearchResult({
          id: 'user-123',
          email: searchQuery,
          firstName: 'יוסי',
          lastName: 'כהן',
          currentPlan: 'Premium 1',
          status: 'active',
          joinDate: '2024-01-15',
          subscriptionExpiry: '2024-07-15',
        });
      } else {
        setError('משתמש לא נמצא');
      }
    } catch (err) {
      setError('שגיאה בחיפוש המשתמש');
    } finally {
      setIsLoading(false);
    }
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
            placeholder="הכנס אימייל או מזהה משתמש"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="font-rubik"
          />
          <Button 
            type="submit" 
            disabled={isLoading}
            className="bg-turquoise hover:bg-turquoise/90"
          >
            <Search className="h-4 w-4" />
          </Button>
        </form>

        {isLoading && (
          <div className="text-center py-4 text-gray-500 font-rubik">
            מחפש...
          </div>
        )}

        {error && (
          <div className="text-center py-4 text-red-500 font-rubik">
            {error}
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
