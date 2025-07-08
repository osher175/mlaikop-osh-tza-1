
import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const Unauthorized: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <Shield className="w-6 h-6 text-red-600" />
          </div>
          <CardTitle className="text-xl font-bold text-gray-900">
            אין הרשאת גישה
          </CardTitle>
          <CardDescription className="text-gray-600">
            אין לך הרשאות מספיקות כדי לגשת לדף זה
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-gray-500 text-center">
            אם אתה חושב שזה טעות, אנא פנה למנהל המערכת או לבעל העסק
          </div>
          <div className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link to="/">
                <Home className="w-4 h-4 ml-2" />
                חזור לדף הבית
              </Link>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link to="/profile">
                <ArrowRight className="w-4 h-4 ml-2" />
                עבור לפרופיל
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
