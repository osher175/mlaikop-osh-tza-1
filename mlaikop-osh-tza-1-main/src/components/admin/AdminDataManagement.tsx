
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Database, Trash2, RefreshCw, Shield, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const AdminDataManagement: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const resetDataMutation = useMutation({
    mutationFn: async (dataType: string) => {
      setIsLoading(true);
      
      switch (dataType) {
        case 'notifications':
          const { error: notificationsError } = await supabase
            .from('notifications')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
          if (notificationsError) throw notificationsError;
          break;
          
        case 'test_data':
          // Reset test/demo data
          const { error: testDataError } = await supabase
            .from('products')
            .delete()
            .like('name', '%דמו%');
          if (testDataError) throw testDataError;
          break;
          
        case 'user_sessions':
          // This would typically involve auth management
          console.log('User sessions reset requested');
          break;
          
        default:
          throw new Error('Unknown data type');
      }
    },
    onSuccess: (_, dataType) => {
      queryClient.invalidateQueries();
      toast({
        title: "נתונים נמחקו בהצלחה",
        description: `${getDataTypeDisplayName(dataType)} נמחקו מהמערכת`,
      });
      setIsLoading(false);
    },
    onError: (error, dataType) => {
      console.error(`Error resetting ${dataType}:`, error);
      toast({
        title: "שגיאה במחיקת נתונים",
        description: "לא ניתן למחוק את הנתונים כרגע",
        variant: "destructive",
      });
      setIsLoading(false);
    },
  });

  const getDataTypeDisplayName = (dataType: string): string => {
    const displayNames: Record<string, string> = {
      'notifications': 'התראות',
      'test_data': 'נתוני דמו',
      'user_sessions': 'הפעלות משתמש',
    };
    return displayNames[dataType] || dataType;
  };

  const dataManagementOptions = [
    {
      id: 'notifications',
      title: 'מחיקת התראות',
      description: 'מחק את כל ההתראות במערכת',
      icon: <RefreshCw className="w-5 h-5" />,
      variant: 'secondary' as const,
      danger: false,
    },
    {
      id: 'test_data',
      title: 'מחיקת נתוני דמו',
      description: 'מחק מוצרים ונתונים שנוצרו לצורכי בדיקה',
      icon: <Database className="w-5 h-5" />,
      variant: 'secondary' as const,
      danger: false,
    },
    {
      id: 'user_sessions',
      title: 'איפוס הפעלות משתמש',
      description: 'נתק את כל המשתמשים המחוברים',
      icon: <Shield className="w-5 h-5" />,
      variant: 'destructive' as const,
      danger: true,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-900 font-rubik flex items-center gap-2" dir="rtl">
          <Database className="w-6 h-6 text-red-500" />
          ניהול נתונים
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6" dir="rtl">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span className="font-semibold text-amber-800 font-rubik">אזהרה</span>
          </div>
          <p className="text-amber-700 text-sm font-rubik">
            פעולות אלו עלולות למחוק נתונים באופן בלתי הפיך. יש לבצע אותן בזהירות רבה.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dataManagementOptions.map((option) => (
            <Card key={option.id} className={`border-2 ${option.danger ? 'border-red-200' : 'border-gray-200'}`}>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  {option.icon}
                  <div>
                    <h3 className="font-semibold text-gray-900 font-rubik">{option.title}</h3>
                    <p className="text-sm text-gray-600 font-rubik">{option.description}</p>
                  </div>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant={option.variant}
                      className="w-full font-rubik"
                      disabled={isLoading}
                    >
                      <Trash2 className="w-4 h-4 ml-2" />
                      {getDataTypeDisplayName(option.id)}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-rubik">
                        האם אתה בטוח?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="font-rubik">
                        פעולה זו היא בלתי הפיכה. {option.description.toLowerCase()}.
                        <br />
                        <strong>האם אתה מבין את ההשלכות ורוצה להמשיך?</strong>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="font-rubik">ביטול</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => resetDataMutation.mutate(option.id)}
                        className={`font-rubik ${option.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-turquoise hover:bg-turquoise/90'}`}
                      >
                        כן, מחק
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* System Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold font-rubik">סטטיסטיקות מערכת</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-turquoise font-rubik">1,247</div>
                <div className="text-sm text-gray-600 font-rubik">סה"כ משתמשים</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500 font-rubik">342</div>
                <div className="text-sm text-gray-600 font-rubik">עסקים רשומים</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500 font-rubik">15,678</div>
                <div className="text-sm text-gray-600 font-rubik">מוצרים במערכת</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-500 font-rubik">89</div>
                <div className="text-sm text-gray-600 font-rubik">התראות פעילות</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
};
