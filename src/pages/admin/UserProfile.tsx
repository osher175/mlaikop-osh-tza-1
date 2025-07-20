
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowRight, 
  User, 
  Mail, 
  Calendar, 
  Clock, 
  Building2, 
  Shield, 
  CheckCircle, 
  XCircle,
  ArrowLeft
} from 'lucide-react';

interface UserProfileData {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  created_at: string;
  role?: string;
  business_name?: string;
  subscription_status?: string;
  subscription_plan?: string;
}

const formatTimeInSystem = (createdAt: string): string => {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffDays < 7) {
    return `${diffDays} ימים`;
  } else if (diffWeeks < 4) {
    return `${diffWeeks} שבועות`;
  } else {
    return `${diffMonths} חודשים`;
  }
};

export const AdminUserProfile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const { data: userProfile, isLoading, error } = useQuery({
    queryKey: ['admin-user-profile', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');

      // Get user basic info
      const { data: profileData, error: profileError } = await supabase.rpc(
        'get_user_profile_for_admin',
        { target_user_id: userId }
      );

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        throw profileError;
      }

      // The function returns an array, we need the first item
      return (profileData && profileData.length > 0 ? profileData[0] : null) as UserProfileData | null;
    },
    enabled: !!userId,
  });

  const { data: subscriptionHistory } = useQuery({
    queryKey: ['admin-user-subscriptions', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans(name)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching subscription history:', error);
        return [];
      }

      return data;
    },
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <MainLayout>
        <ProtectedRoute allowedRoles={['admin']}>
          <div className="flex items-center justify-center min-h-[400px]" dir="rtl">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>טוען פרופיל משתמש...</p>
            </div>
          </div>
        </ProtectedRoute>
      </MainLayout>
    );
  }

  if (error || !userProfile) {
    return (
      <MainLayout>
        <ProtectedRoute allowedRoles={['admin']}>
          <div className="space-y-6" dir="rtl">
            <Button
              onClick={() => navigate('/admin')}
              variant="outline"
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 ml-2" />
              חזרה לניהול משתמשים
            </Button>
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-red-600">
                  שגיאה בטעינת פרופיל המשתמש. המשתמש לא נמצא או שאירעה שגיאה בטעינה.
                </div>
              </CardContent>
            </Card>
          </div>
        </ProtectedRoute>
      </MainLayout>
    );
  }

  const fullName = `${userProfile.first_name} ${userProfile.last_name}`.trim() || 'לא צוין';
  const timeInSystem = formatTimeInSystem(userProfile.created_at);

  return (
    <MainLayout>
      <ProtectedRoute allowedRoles={['admin']}>
        <div className="space-y-6" dir="rtl">
          {/* Header with back button */}
          <div className="flex items-center justify-between">
            <Button
              onClick={() => navigate('/admin')}
              variant="outline"
            >
              <ArrowLeft className="h-4 w-4 ml-2" />
              חזרה לניהול משתמשים
            </Button>
            
            <div className="flex items-center gap-4">
              <User className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">פרופיל משתמש</h1>
                <p className="text-gray-600">{fullName}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  פרטים בסיסיים
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">מזהה משתמש</p>
                      <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                        {userProfile.user_id}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">כתובת אימייל</p>
                      <p className="text-gray-900">{userProfile.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">תאריך הצטרפות</p>
                      <p className="text-gray-900">
                        {new Date(userProfile.created_at).toLocaleDateString('he-IL')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">זמן פעיל במערכת</p>
                      <p className="text-gray-900">{timeInSystem}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status and Role */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  סטטוס והרשאות
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">סטטוס פעיל</span>
                  <Badge 
                    className={`${userProfile.is_active 
                      ? 'bg-green-500 hover:bg-green-600' 
                      : 'bg-red-500 hover:bg-red-600'
                    } text-white`}
                  >
                    {userProfile.is_active ? (
                      <>
                        <CheckCircle className="h-3 w-3 ml-1" />
                        פעיל
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3 ml-1" />
                        מושבת
                      </>
                    )}
                  </Badge>
                </div>

                {userProfile.role && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">תפקיד במערכת</span>
                    <Badge variant="outline">
                      {userProfile.role}
                    </Badge>
                  </div>
                )}

                {userProfile.business_name && (
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">עסק מחובר</p>
                      <p className="text-gray-900">{userProfile.business_name}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Subscription History */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRight className="h-5 w-5" />
                  היסטוריית מנויים
                </CardTitle>
              </CardHeader>
              <CardContent>
                {subscriptionHistory && subscriptionHistory.length > 0 ? (
                  <div className="space-y-4">
                    {subscriptionHistory.map((subscription: any) => (
                      <div key={subscription.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge 
                              className={`${
                                subscription.status === 'active' 
                                  ? 'bg-green-500' 
                                  : subscription.status === 'trial'
                                  ? 'bg-blue-500'
                                  : 'bg-gray-500'
                              } text-white`}
                            >
                              {subscription.status === 'active' ? 'פעיל' : 
                               subscription.status === 'trial' ? 'ניסיון' : 
                               subscription.status === 'expired' ? 'פג תוקף' : subscription.status}
                            </Badge>
                            {subscription.subscription_plans?.name && (
                              <span className="text-sm font-medium">
                                {subscription.subscription_plans.name}
                              </span>
                            )}
                          </div>
                          <span className="text-sm text-gray-500">
                            {new Date(subscription.created_at).toLocaleDateString('he-IL')}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          {subscription.trial_started_at && (
                            <div>
                              <p className="text-gray-600">התחלת ניסיון:</p>
                              <p>{new Date(subscription.trial_started_at).toLocaleDateString('he-IL')}</p>
                            </div>
                          )}
                          {subscription.trial_ends_at && (
                            <div>
                              <p className="text-gray-600">סיום ניסיון:</p>
                              <p>{new Date(subscription.trial_ends_at).toLocaleDateString('he-IL')}</p>
                            </div>
                          )}
                          {subscription.subscription_started_at && (
                            <div>
                              <p className="text-gray-600">התחלת מנוי:</p>
                              <p>{new Date(subscription.subscription_started_at).toLocaleDateString('he-IL')}</p>
                            </div>
                          )}
                          {subscription.expires_at && (
                            <div>
                              <p className="text-gray-600">תפוגה:</p>
                              <p>{new Date(subscription.expires_at).toLocaleDateString('he-IL')}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <p>אין היסטוריית מנויים זמינה עבור משתמש זה</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </ProtectedRoute>
    </MainLayout>
  );
};
