
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';

export const JoinBusinessSuccess: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <Card className="shadow-xl border-0 text-center">
          <CardContent className="p-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">הבקשה נשלחה!</h2>
            <p className="text-gray-600 mb-6">
              הבקשה נשלחה לבעל העסק. לאחר אישור תוכל להתחבר למערכת.
            </p>
            <Button
              onClick={() => navigate('/auth')}
              className="w-full"
            >
              חזור להתחברות
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
