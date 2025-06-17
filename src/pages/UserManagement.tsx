
import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Plus, Search, Edit, Trash2, Mail, Phone, Crown } from 'lucide-react';
import { ProtectedFeature } from '@/components/ProtectedFeature';
import { useUserRole } from '@/hooks/useUserRole';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  lastLogin: string;
  status: 'active' | 'inactive';
}

const mockUsers: User[] = [
  {
    id: '1',
    name: 'יוסי כהן',
    email: 'yossi@example.com',
    role: 'admin',
    phone: '050-1234567',
    lastLogin: '2024-01-15',
    status: 'active'
  },
  {
    id: '2',
    name: 'מרים לוי',
    email: 'miriam@example.com',
    role: 'elite_pilot_user',
    phone: '052-9876543',
    lastLogin: '2024-01-14',
    status: 'active'
  },
  {
    id: '3',
    name: 'דוד ישראלי',
    email: 'david@example.com',
    role: 'pro_starter_user',
    lastLogin: '2024-01-10',
    status: 'inactive'
  }
];

export const UserManagement: React.FC = () => {
  const { getRoleDisplayName } = useUserRole();
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredUsers, setFilteredUsers] = useState(mockUsers);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    const filtered = mockUsers.filter(user =>
      user.name.includes(value) ||
      user.email.includes(value)
    );
    setFilteredUsers(filtered);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-500';
      case 'elite_pilot_user':
        return 'bg-purple-500';
      case 'smart_master_user':
        return 'bg-blue-500';
      case 'pro_starter_user':
        return 'bg-amber-500';
      case 'free_user':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <MainLayout>
      <ProtectedFeature requiredRole="elite_pilot_user">
        <div className="space-y-6" dir="rtl">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">ניהול משתמשים</h1>
                <p className="text-gray-600">נהל את המשתמשים וההרשאות במערכת</p>
              </div>
            </div>
            
            <Button className="bg-primary hover:bg-primary-600">
              <Plus className="w-4 h-4 ml-2" />
              הוסף משתמש חדש
            </Button>
          </div>

          {/* Search and Filters */}
          <Card>
            <CardContent className="p-6">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="חפש משתמשים..."
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pr-10"
                  />
                </div>
                <Select>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="סנן לפי תפקיד" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל התפקידים</SelectItem>
                    <SelectItem value="admin">מנהל</SelectItem>
                    <SelectItem value="elite_pilot_user">פיילוט עילית</SelectItem>
                    <SelectItem value="smart_master_user">מאסטר חכם</SelectItem>
                    <SelectItem value="pro_starter_user">פרו התחלתי</SelectItem>
                    <SelectItem value="free_user">משתמש חינם</SelectItem>
                  </SelectContent>
                </Select>
                <Select>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="סטטוס" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">הכל</SelectItem>
                    <SelectItem value="active">פעיל</SelectItem>
                    <SelectItem value="inactive">לא פעיל</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-primary" />
                  <div className="mr-4">
                    <p className="text-sm font-medium text-gray-600">סה״כ משתמשים</p>
                    <p className="text-2xl font-bold">{mockUsers.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-green-500" />
                  <div className="mr-4">
                    <p className="text-sm font-medium text-gray-600">פעילים</p>
                    <p className="text-2xl font-bold text-green-600">
                      {mockUsers.filter(u => u.status === 'active').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Crown className="h-8 w-8 text-purple-500" />
                  <div className="mr-4">
                    <p className="text-sm font-medium text-gray-600">משתמשי פרימיום</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {mockUsers.filter(u => !['free_user', 'admin'].includes(u.role)).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-red-500" />
                  <div className="mr-4">
                    <p className="text-sm font-medium text-gray-600">מנהלים</p>
                    <p className="text-2xl font-bold text-red-600">
                      {mockUsers.filter(u => u.role === 'admin').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle>רשימת משתמשים</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-right p-4">שם</th>
                      <th className="text-right p-4">אימייל</th>
                      <th className="text-right p-4">תפקיד</th>
                      <th className="text-right p-4">טלפון</th>
                      <th className="text-right p-4">כניסה אחרונה</th>
                      <th className="text-right p-4">סטטוס</th>
                      <th className="text-right p-4">פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b hover:bg-gray-50">
                        <td className="p-4 font-medium">{user.name}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-400" />
                            {user.email}
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge className={`${getRoleBadgeColor(user.role)} text-white`}>
                            <Crown className="w-3 h-3 ml-1" />
                            {getRoleDisplayName(user.role as any)}
                          </Badge>
                        </td>
                        <td className="p-4">
                          {user.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-gray-400" />
                              {user.phone}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-gray-600">{user.lastLogin}</td>
                        <td className="p-4">
                          <Badge className={user.status === 'active' ? 'bg-green-500' : 'bg-gray-500'}>
                            {user.status === 'active' ? 'פעיל' : 'לא פעיל'}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>פעולות מהירות</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button variant="outline" className="h-20 flex-col">
                  <Users className="h-6 w-6 mb-2" />
                  הזמן משתמשים חדשים
                </Button>
                <Button variant="outline" className="h-20 flex-col">
                  <Crown className="h-6 w-6 mb-2" />
                  שדרג הרשאות
                </Button>
                <Button variant="outline" className="h-20 flex-col">
                  <Mail className="h-6 w-6 mb-2" />
                  שלח הודעה קבוצתית
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </ProtectedFeature>
    </MainLayout>
  );
};
