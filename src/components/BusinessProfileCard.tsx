
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building, Users, Mail, TrendingUp, Briefcase } from 'lucide-react';
import { useBusiness } from '@/hooks/useBusiness';

export const BusinessProfileCard: React.FC = () => {
  const { business, isLoading } = useBusiness();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            טוען פרטי עסק...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!business) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            פרטי עסק
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">לא נמצא עסק משויך לחשבון זה</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="w-5 h-5" />
          {business.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {business.industry && (
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-gray-500" />
            <span className="text-sm">תחום: {business.industry}</span>
          </div>
        )}
        
        {business.official_email && (
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-gray-500" />
            <span className="text-sm">{business.official_email}</span>
          </div>
        )}
        
        {business.employee_count && (
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            <span className="text-sm">מספר עובדים: {business.employee_count}</span>
          </div>
        )}
        
        {business.avg_monthly_revenue && (
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            <span className="text-sm">הכנסה חודשית ממוצעת: ₪{business.avg_monthly_revenue.toLocaleString()}</span>
          </div>
        )}
        
        {business.address && (
          <div className="text-sm text-gray-600">
            <strong>כתובת:</strong> {business.address}
          </div>
        )}
        
        {business.phone && (
          <div className="text-sm text-gray-600">
            <strong>טלפון:</strong> {business.phone}
          </div>
        )}
        
        <div className="pt-2">
          <Badge variant="outline" className="text-xs">
            נוצר: {new Date(business.created_at || '').toLocaleDateString('he-IL')}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};
