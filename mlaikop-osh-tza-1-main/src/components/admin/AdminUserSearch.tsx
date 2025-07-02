
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Users, UserCheck, UserX, Loader2 } from 'lucide-react';
import { useAdminUserSearch } from '@/hooks/useAdminUserSearch';
import { UserCard } from '@/components/admin/UserCard';

export const AdminUserSearch: React.FC = () => {
  const {
    searchTerm,
    setSearchTerm,
    activeUsers,
    inactiveUsers,
    isLoading,
    error,
    toggleUserStatus,
    deleteUser,
    isToggling,
    isDeleting,
  } = useAdminUserSearch();

  if (error) {
    return (
      <Card dir="rtl">
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            שגיאה בטעינת המשתמשים. אנא נסה שוב.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Search Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            חיפוש משתמשים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="חפש לפי שם פרטי, שם משפחה או כתובת אימייל..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="mr-2">טוען משתמשים...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics */}
      {!isLoading && (activeUsers.length > 0 || inactiveUsers.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">סה״כ משתמשים</p>
                  <p className="text-2xl font-bold">{activeUsers.length + inactiveUsers.length}</p>
                </div>
                <Users className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">משתמשים פעילים</p>
                  <p className="text-2xl font-bold text-green-600">{activeUsers.length}</p>
                </div>
                <UserCheck className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">משתמשים לא פעילים</p>
                  <p className="text-2xl font-bold text-red-600">{inactiveUsers.length}</p>
                </div>
                <UserX className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Users Section */}
      {!isLoading && activeUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge className="bg-green-500 text-white">
                <UserCheck className="h-4 w-4 ml-1" />
                משתמשים פעילים ({activeUsers.length})
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeUsers.map((user) => (
                <UserCard
                  key={user.user_id}
                  user={user}
                  onToggleStatus={toggleUserStatus}
                  onDelete={deleteUser}
                  isToggling={isToggling}
                  isDeleting={isDeleting}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inactive Users Section */}
      {!isLoading && inactiveUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge className="bg-red-500 text-white">
                <UserX className="h-4 w-4 ml-1" />
                משתמשים לא פעילים ({inactiveUsers.length})
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inactiveUsers.map((user) => (
                <UserCard
                  key={user.user_id}
                  user={user}
                  onToggleStatus={toggleUserStatus}
                  onDelete={deleteUser}
                  isToggling={isToggling}
                  isDeleting={isDeleting}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && activeUsers.length === 0 && inactiveUsers.length === 0 && (
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? 'לא נמצאו תוצאות' : 'אין משתמשים להצגה'}
              </h3>
              <p className="text-gray-600">
                {searchTerm 
                  ? `לא נמצאו משתמשים המתאימים לחיפוש "${searchTerm}"`
                  : 'התחל לחפש כדי לראות משתמשים'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
