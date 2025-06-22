
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useBusinessMembers } from '@/hooks/useBusinessMembers';
import { Skeleton } from '@/components/ui/skeleton';

export const PendingApprovalsPanel: React.FC = () => {
  const { pendingMembers, isLoading, approveMember, rejectMember } = useBusinessMembers();
  const [selectedRoles, setSelectedRoles] = useState<{ [key: string]: string }>({});

  const handleApprove = (memberId: string) => {
    const role = selectedRoles[memberId] || 'EMPLOYEE';
    approveMember.mutate({ memberId, role });
  };

  const handleReject = (memberId: string) => {
    rejectMember.mutate(memberId);
  };

  const setMemberRole = (memberId: string, role: string) => {
    setSelectedRoles(prev => ({ ...prev, [memberId]: role }));
  };

  if (isLoading) {
    return (
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-right" dir="rtl">
            <Users className="w-5 h-5" />
            בקשות הצטרפות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="w-32 h-4" />
                    <Skeleton className="w-24 h-3" />
                  </div>
                </div>
                <Skeleton className="w-20 h-8" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pendingMembers.length === 0) {
    return (
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-right" dir="rtl">
            <Users className="w-5 h-5" />
            בקשות הצטרפות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500" dir="rtl">
            <Clock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-2">אין בקשות הצטרפות ממתינות</p>
            <p className="text-sm">כאשר יהיו בקשות חדשות, הן יופיעו כאן</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-right" dir="rtl">
          <Users className="w-5 h-5" />
          בקשות הצטרפות
          <Badge variant="secondary" className="mr-2">
            {pendingMembers.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {pendingMembers.map((member) => (
            <div key={member.id} className="border rounded-lg p-4 space-y-4">
              {/* Member Info */}
              <div className="flex items-center gap-3" dir="rtl">
                <Avatar>
                  <AvatarFallback>
                    {member.profiles?.first_name?.[0] || 'U'}
                    {member.profiles?.last_name?.[0] || ''}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-right">
                  <h3 className="font-medium text-gray-900">
                    {member.profiles?.first_name || 'משתמש'} {member.profiles?.last_name || ''}
                  </h3>
                  <p className="text-sm text-gray-600">ID: {member.user_id.slice(0, 8)}...</p>
                  <p className="text-xs text-gray-500">
                    נשלח בתאריך {new Date(member.joined_at).toLocaleDateString('he-IL')}
                  </p>
                </div>
                <Badge variant="outline" className="text-orange-600 border-orange-200">
                  ממתין לאישור
                </Badge>
              </div>

              {/* Role Selection */}
              <div className="flex items-center gap-3" dir="rtl">
                <span className="text-sm font-medium text-gray-700 min-w-fit">תפקיד:</span>
                <Select
                  value={selectedRoles[member.id] || 'EMPLOYEE'}
                  onValueChange={(value) => setMemberRole(member.id, value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMPLOYEE">עובד</SelectItem>
                    <SelectItem value="MANAGER">מנהל</SelectItem>
                    <SelectItem value="SUPERVISOR">מפקח</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={() => handleApprove(member.id)}
                  disabled={approveMember.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 ml-2" />
                  {approveMember.isPending ? 'מאשר...' : 'אשר'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleReject(member.id)}
                  disabled={rejectMember.isPending}
                  className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <XCircle className="w-4 h-4 ml-2" />
                  {rejectMember.isPending ? 'דוחה...' : 'דחה'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
