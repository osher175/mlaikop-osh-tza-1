
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Users, Package } from 'lucide-react';

export const OnboardingDecision: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mlaiko-gradient rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Package className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">ברוכים הבאים ל-Mlaiko</h1>
          <p className="text-gray-600 text-lg">בחר כיצד תרצה להתחיל</p>
        </div>

        {/* Decision Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Create New Business */}
          <Card className="shadow-xl border-0 hover:shadow-2xl transition-shadow cursor-pointer group">
            <CardHeader className="text-center pb-4">
              <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary-200 transition-colors">
                <Building2 className="w-10 h-10 text-primary" />
              </div>
              <CardTitle className="text-xl text-gray-900">יצירת עסק חדש</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 mb-6">
                התחל מהתחלה ויצור עסק חדש במערכת. תהיה בעל העסק ותוכל לנהל את כל המערכת.
              </p>
              <ul className="text-sm text-gray-500 mb-6 text-right space-y-2">
                <li>• ניהול מלא של המערכת</li>
                <li>• הוספת עובדים ומשתמשים</li>
                <li>• גישה לכל הדוחות והנתונים</li>
                <li>• התאמה אישית של המערכת</li>
              </ul>
              <Button 
                onClick={() => navigate('/create-business')}
                className="w-full bg-primary hover:bg-primary-600 text-white font-medium py-3"
              >
                יצירת עסק חדש
              </Button>
            </CardContent>
          </Card>

          {/* Join Existing Business */}
          <Card className="shadow-xl border-0 hover:shadow-2xl transition-shadow cursor-pointer group">
            <CardHeader className="text-center pb-4">
              <div className="w-20 h-20 bg-accent-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-accent-200 transition-colors">
                <Users className="w-10 h-10 text-accent" />
              </div>
              <CardTitle className="text-xl text-gray-900">הצטרפות לעסק קיים</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 mb-6">
                הצטרף לעסק קיים במערכת. תקבל הרשאות בהתאם לתפקיד שלך בארגון.
              </p>
              <ul className="text-sm text-gray-500 mb-6 text-right space-y-2">
                <li>• גישה למלאי ולמוצרים</li>
                <li>• עבודה בצוות</li>
                <li>• הרשאות מותאמות לתפקיד</li>
                <li>• התחברות מהירה למערכת</li>
              </ul>
              <Button 
                onClick={() => navigate('/join-business')}
                className="w-full bg-accent hover:bg-accent-600 text-white font-medium py-3"
              >
                הצטרפות לעסק קיים
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>לאחר בחירה תוכל להתחיל לעבוד עם המערכת מיד</p>
        </div>
      </div>
    </div>
  );
};
