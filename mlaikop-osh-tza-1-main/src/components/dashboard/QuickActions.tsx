
import React from 'react';
import { Plus, Package, BarChart3, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const actions = [
  {
    title: 'הוסף מוצר חדש',
    description: 'הוסף פריט חדש למלאי',
    icon: Plus,
    color: 'bg-turquoise hover:bg-turquoise/90',
    href: '/add-product'
  },
  {
    title: 'סרוק ברקוד',
    description: 'סרוק מוצר קיים',
    icon: Package,
    color: 'bg-mango hover:bg-mango/90',
    href: '/scan'
  },
  {
    title: 'צפה בדוחות',
    description: 'דוחות מכירות ורווחיות',
    icon: BarChart3,
    color: 'bg-gray-600 hover:bg-gray-700',
    href: '/reports'
  },
  {
    title: 'נהל משתמשים',
    description: 'הוסף או ערוך משתמשים',
    icon: Users,
    color: 'bg-purple-600 hover:bg-purple-700',
    href: '/users'
  }
];

export const QuickActions: React.FC = () => {
  return (
    <Card className="card-shadow">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">
          פעולות מהירות
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {actions.map((action) => (
            <Button
              key={action.title}
              variant="outline"
              className={`h-auto p-4 flex flex-col items-center gap-2 ${action.color} text-white border-0`}
              onClick={() => window.location.href = action.href}
            >
              <action.icon className="w-6 h-6" />
              <div className="text-center">
                <div className="font-medium text-sm">{action.title}</div>
                <div className="text-xs opacity-90">{action.description}</div>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
