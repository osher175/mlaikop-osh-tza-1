
import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { User, Mail, Phone, Calendar, Crown, Save, Camera, Shield } from 'lucide-react';

export const UserProfile: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { userRole, getRoleDisplayName } = useUserRole();
  
  const [profile, setProfile] = useState({
    firstName: 'יוסי',
    lastName: 'כהן',
    email: user?.email || '',
    phone: '050-1234567',
    joinDate: '2024-01-01',
    lastLogin: '2024-01-15'
  });

  const handleSave = () => {
    toast({
      title: "הפרופיל עודכן בהצלחה",
      description: "הנתונים שלך נשמרו במערכת",
    });
  };

  const updateProfile = (field: string, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const getRoleBadgeColor = () => {
    switch (userRole) {
      case 'admin':
        return 'bg-red-500';
      case 'elite_pilot_user':
        return 'bg-purple-500';
      case 'smart_master_user':
        return 'bg-blue-500';
      case 'pro_starter_user':
        return 'bg-amber-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <User className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">פרופיל משתמש</h1>
            <p className="text-gray-600">נהל את הפרטים האישיים שלך</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>פרטים אישיים</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">שם פרטי</Label>
                    <Input
                      id="firstName"
                      value={profile.firstName}
                      onChange={(e) => updateProfile('firstName', e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="lastName">שם משפחה</Label>
                    <Input
                      id="lastName"
                      value={profile.lastName}
                      onChange={(e) => updateProfile('lastName', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">כתובת אימייל</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => updateProfile('email', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="phone">מספר טלפון</Label>
                  <Input
                    id="phone"
                    value={profile.phone}
                    onChange={(e) => updateProfile('phone', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Account Info */}
            <Card>
              <CardHeader>
                <CardTitle>מידע חשבון</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium">תאריך הצטרפות</p>
                      <p className="text-gray-600">{profile.joinDate}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium">כניסה אחרונה</p>
                      <p className="text-gray-600">{profile.lastLogin}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Crown className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">סוג חשבון</p>
                    <Badge className={`${getRoleBadgeColor()} text-white mt-1`}>
                      <Crown className="w-3 h-3 ml-1" />
                      {getRoleDisplayName(userRole)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Security Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  הגדרות אבטחה
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full justify-start">
                  שינוי סיסמה
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  הפעלת אימות דו-שלבי
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  היסטוריית התחברויות
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Profile Picture */}
            <Card>
              <CardHeader>
                <CardTitle>תמונת פרופיל</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="w-32 h-32 mx-auto bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center mb-4">
                  <User className="w-16 h-16 text-white" />
                </div>
                <Button variant="outline" className="w-full">
                  <Camera className="w-4 h-4 ml-2" />
                  שנה תמונה
                </Button>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>סטטיסטיקות מהירות</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">מוצרים במלאי:</span>
                  <span className="font-bold">247</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">מכירות החודש:</span>
                  <span className="font-bold">₪12,450</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">התראות פעילות:</span>
                  <span className="font-bold">3</span>
                </div>
              </CardContent>
            </Card>

            {/* Account Actions */}
            <Card>
              <CardHeader>
                <CardTitle>פעולות חשבון</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button onClick={handleSave} className="w-full bg-primary hover:bg-primary-600">
                  <Save className="w-4 h-4 ml-2" />
                  שמור שינויים
                </Button>
                
                <Button variant="outline" className="w-full">
                  שדרג חשבון
                </Button>
                
                <Button variant="outline" className="w-full">
                  ייצא נתונים
                </Button>
              </CardContent>
            </Card>

            {/* Support */}
            <Card>
              <CardHeader>
                <CardTitle>תמיכה</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full">
                  <Mail className="w-4 h-4 ml-2" />
                  פנה לתמיכה
                </Button>
                
                <Button variant="outline" className="w-full">
                  <Phone className="w-4 h-4 ml-2" />
                  חייג לתמיכה
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};
