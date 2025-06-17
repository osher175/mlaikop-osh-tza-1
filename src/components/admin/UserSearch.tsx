
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Mail, User, Crown } from 'lucide-react';
import { useUserByEmail } from '@/lib/data/getUserByEmail';

export const UserSearch: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { user, searchUser, isLoading, error } = useUserByEmail();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      searchUser(searchQuery.trim());
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
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            type="text"
            placeholder="הכנס אימייל או מזהה משתמש"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="font-rubik"
            dir="rtl"
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

        {user && (
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-500" />
              <span className="font-semibold font-rubik">{user.firstName} {user.lastName}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600 font-rubik">{user.email}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-gray-500" />
              <Badge variant={user.planType === 'freemium' ? 'secondary' : 'default'}>
                {user.planType}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 font-rubik">סטטוס:</span>
              <Badge variant={user.status === 'active' ? 'default' : 'destructive'}>
                {user.status === 'active' ? 'פעיל' : 'לא פעיל'}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
