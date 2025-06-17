
import React from 'react';
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
import { X } from 'lucide-react';

// Dummy subscription data
const subscriptions = [
  {
    id: 1,
    userName: 'יוסי כהן',
    email: 'yossi@example.com',
    plan: 'Premium 2',
    startDate: '2024-01-15',
    renewalDate: '2024-07-15',
    status: 'active',
    autoRenewal: true,
  },
  {
    id: 2,
    userName: 'מרים לוי',
    email: 'miriam@example.com',
    plan: 'Premium 1',
    startDate: '2024-02-01',
    renewalDate: '2024-08-01',
    status: 'active',
    autoRenewal: true,
  },
  {
    id: 3,
    userName: 'דוד ישראלי',
    email: 'david@example.com',
    plan: 'Premium 3',
    startDate: '2024-03-10',
    renewalDate: '2024-09-10',
    status: 'expired',
    autoRenewal: false,
  },
  {
    id: 4,
    userName: 'שרה אברהם',
    email: 'sarah@example.com',
    plan: 'Premium 1',
    startDate: '2024-04-05',
    renewalDate: '2024-10-05',
    status: 'active',
    autoRenewal: true,
  },
];

export const SubscriptionTable: React.FC = () => {
  const handleCancelAutoRenewal = (subscriptionId: number) => {
    console.log('Cancelling auto renewal for subscription:', subscriptionId);
    // TODO: Implement cancel auto renewal logic
  };

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
                <TableHead className="text-right font-rubik">תאריך חידוש</TableHead>
                <TableHead className="text-right font-rubik">סטטוס</TableHead>
                <TableHead className="text-right font-rubik">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((subscription) => (
                <TableRow key={subscription.id}>
                  <TableCell className="font-rubik">
                    <div>
                      <div className="font-medium">{subscription.userName}</div>
                      <div className="text-sm text-gray-500">{subscription.email}</div>
                    </div>
                  </TableCell>
                  <TableCell className="font-rubik">
                    <Badge variant="outline">{subscription.plan}</Badge>
                  </TableCell>
                  <TableCell className="font-rubik text-sm">
                    {new Date(subscription.startDate).toLocaleDateString('he-IL')}
                  </TableCell>
                  <TableCell className="font-rubik text-sm">
                    {new Date(subscription.renewalDate).toLocaleDateString('he-IL')}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={subscription.status === 'active' ? 'default' : 'destructive'}
                      className="font-rubik"
                    >
                      {subscription.status === 'active' ? 'פעיל' : 'פג תוקף'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {subscription.autoRenewal && subscription.status === 'active' && (
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
        </div>
      </CardContent>
    </Card>
  );
};
