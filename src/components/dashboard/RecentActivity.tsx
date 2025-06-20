
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const activities = [
  {
    id: 1,
    action: 'הוסף מוצר חדש',
    item: 'חולצת כותנה כחולה',
    user: 'יוסי כהן',
    time: 'לפני 5 דקות',
    type: 'success'
  },
  {
    id: 2,
    action: 'עדכון מלאי',
    item: 'נעלי ספורט אדידס',
    user: 'שרה לוי',
    time: 'לפני 12 דקות',
    type: 'info'
  },
  {
    id: 3,
    action: 'מוצר נגמר',
    item: 'ג\'ינס שחור M',
    user: 'מערכת',
    time: 'לפני 23 דקות',
    type: 'warning'
  },
  {
    id: 4,
    action: 'מכירה',
    item: 'תיק יד עור',
    user: 'דן אברהם',
    time: 'לפני 31 דקות',
    type: 'success'
  }
];

const getActivityColor = (type: string) => {
  switch (type) {
    case 'success': return 'bg-green-100 text-green-800';
    case 'warning': return 'bg-yellow-100 text-yellow-800';
    case 'info': return 'bg-blue-100 text-blue-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const RecentActivity: React.FC = () => {
  return (
    <Card className="card-shadow">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">
          פעילות אחרונה
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className={getActivityColor(activity.type)}>
                    {activity.action}
                  </Badge>
                </div>
                <p className="text-sm font-medium text-gray-900">{activity.item}</p>
                <p className="text-xs text-gray-500">
                  {activity.user} • {activity.time}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
