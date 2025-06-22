
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Users, ArrowRight } from 'lucide-react';
import { CreateBusinessForm } from '@/components/onboarding/CreateBusinessForm';
import { JoinBusinessForm } from '@/components/onboarding/JoinBusinessForm';

type OnboardingStep = 'choose' | 'create' | 'join';

export const Onboarding = () => {
  const [step, setStep] = useState<OnboardingStep>('choose');

  if (step === 'create') {
    return <CreateBusinessForm onBack={() => setStep('choose')} />;
  }

  if (step === 'join') {
    return <JoinBusinessForm onBack={() => setStep('choose')} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">ברוכים הבאים למערכת Mlaiko</h1>
          <p className="text-gray-600 text-lg">בחרו את הדרך המתאימה לכם להתחיל</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Create New Business Card */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-primary-200" 
                onClick={() => setStep('create')}>
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 mlaiko-gradient rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl text-gray-900">צרו עסק חדש</CardTitle>
              <CardDescription className="text-gray-600">
                התחילו עם עסק חדש ונהלו את המלאי שלכם
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-center text-sm text-gray-600">
                  <span>✓ ניהול מלאי מתקדם</span>
                </div>
                <div className="flex items-center justify-center text-sm text-gray-600">
                  <span>✓ דוחות מפורטים</span>
                </div>
                <div className="flex items-center justify-center text-sm text-gray-600">
                  <span>✓ ניהול משתמשים</span>
                </div>
              </div>
              <Button className="w-full bg-primary hover:bg-primary-600 text-white" size="lg">
                התחילו עכשיו
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Join Existing Business Card */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-accent-200"
                onClick={() => setStep('join')}>
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-accent to-accent-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl text-gray-900">הצטרפו לעסק קיים</CardTitle>
              <CardDescription className="text-gray-600">
                הצטרפו לעסק שכבר קיים במערכת
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-center text-sm text-gray-600">
                  <span>✓ גישה למערכת קיימת</span>
                </div>
                <div className="flex items-center justify-center text-sm text-gray-600">
                  <span>✓ שיתוף עם הצוות</span>
                </div>
                <div className="flex items-center justify-center text-sm text-gray-600">
                  <span>✓ הרשאות מותאמות</span>
                </div>
              </div>
              <Button className="w-full bg-accent hover:bg-accent-600 text-white" size="lg">
                הצטרפו לעסק
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
