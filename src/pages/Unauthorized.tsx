
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, ArrowRight, Home } from 'lucide-react';

export const Unauthorized: React.FC = () => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-red-100 rounded-full">
              <Shield className="w-8 h-8 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            גישה לא מורשית
          </CardTitle>
          <CardDescription className="text-gray-600">
            אין לך הרשאה לצפות בדף זה. אנא פנה למנהל המערכת או בדוק את ההרשאות שלך.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              <strong>מה אפשר לעשות?</strong>
            </p>
            <ul className="text-sm text-amber-700 mt-2 space-y-1 list-disc list-inside">
              <li>פנה למנהל העסק שלך</li>
              <li>בדוק שאתה מחובר עם המשתמש הנכון</li>
              <li>חזור לדף הבית ונסה שוב</li>
            </ul>
          </div>
          
          <div className="flex gap-3">
            <Button 
              onClick={handleGoHome}
              className="flex-1 bg-turquoise hover:bg-turquoise/90"
            >
              <Home className="w-4 h-4 ml-2" />
              חזור לדף הבית
            </Button>
            <Button 
              onClick={handleGoBack}
              variant="outline"
              className="flex-1"
            >
              <ArrowRight className="w-4 h-4 ml-2" />
              חזור אחורה
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
