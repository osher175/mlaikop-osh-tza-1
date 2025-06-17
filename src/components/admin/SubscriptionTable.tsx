
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Loader2 } from 'lucide-react';

export const SubscriptionTable: React.FC = () => {
  const { data: subscriptions, isLoading, error } = useQuery({
    queryKey: ['user-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_subscriptions_new')
        .select(`
          *,
          profiles:user_id (
            first_name,
            last_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const handleCancelAutoRenewal = async (subscriptionId: string) => {
    try {
      const { error } = await supabase
        .from('user_subscriptions_new')
        .update({ auto_renew: false })
        .eq('id', subscriptionId);

      if (error) throw error;
      
      console.log('Auto renewal cancelled for subscription:', subscriptionId);
      // TODO: Show success toast and refetch data
    } catch (error) {
      console.error('Error cancelling auto renewal:', error);
      // TODO: Show error toast
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="mr-2 font-rubik">טוען...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8">
          <p className="text-red-500 text-center font-rubik">שגיאה בטעינת המנויים</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900 font-rubik" dir="rtl">
          טבלת מנויים
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right font-rubik">משתמש</TableHead>
                <TableHead className="text-right font-rubik">תוכנית</TableHead>
                <TableHead className="text-right font-rubik">תאריך התחלה</TableHead>
                <TableHead className="text-right font-rubik">תאריך פגיעה</TableHead>
                <TableHead className="text-right font-rubik">סטטוס</TableHead>
                <TableHead className="text-right font-rubik">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions?.map((subscription) => (
                <TableRow key={subscription.id}>
                  <TableCell className="font-rubik">
                    <div>
                      <div className="font-medium">
                        {subscription.profiles?.first_name} {subscription.profiles?.last_name}
                      </div>
                      <div className="text-sm text-gray-500">{subscription.user_id}</div>
                    </div>
                  </TableCell>
                  <TableCell className="font-rubik">
                    <Badge variant="outline">{subscription.plan}</Badge>
                  </TableCell>
                  <TableCell className="font-rubik text-sm">
                    {subscription.started_at ? 
                      new Date(subscription.started_at).toLocaleDateString('he-IL') : 
                      '-'
                    }
                  </TableCell>
                  <TableCell className="font-rubik text-sm">
                    {subscription.expires_at ? 
                      new Date(subscription.expires_at).toLocaleDateString('he-IL') : 
                      'ללא הגבלה'
                    }
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={subscription.status === 'active' ? 'default' : 'destructive'}
                      className="font-rubik"
                    >
                      {subscription.status === 'active' ? 'פעיל' : 
                       subscription.status === 'expired' ? 'פג תוקף' :
                       subscription.status === 'cancelled' ? 'בוטל' : 'ממתין'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {subscription.auto_renew && subscription.status === 'active' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelAutoRenewal(subscription.id)}
                        className="text-red-600 hover:text-red-800 font-rubik"
                      >
                        <X className="h-4 w-4 ml-2" />
                        בטל חידוש אוטומטי
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {subscriptions?.length === 0 && (
            <div className="text-center py-8 text-gray-500 font-rubik">
              אין מנויים במערכת
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
