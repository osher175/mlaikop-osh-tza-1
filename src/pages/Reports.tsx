
import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, TrendingUp, DollarSign, Package, Calendar, Download } from 'lucide-react';
import { ProtectedFeature } from '@/components/ProtectedFeature';

export const Reports: React.FC = () => {
  const [dateRange, setDateRange] = useState('30days');

  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">דוחות וגרפים</h1>
            <p className="text-gray-600">ניתוח נתונים ותובנות עסקיות</p>
          </div>
          
          <ProtectedFeature requiredRole="pro_starter_user">
            <div className="flex gap-3">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7days">7 ימים אחרונים</SelectItem>
                  <SelectItem value="30days">30 ימים אחרונים</SelectItem>
                  <SelectItem value="90days">3 חודשים אחרונים</SelectItem>
                  <SelectItem value="year">שנה אחרונה</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="outline">
                <Download className="w-4 h-4 ml-2" />
                יצא דוח
              </Button>
            </div>
          </ProtectedFeature>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-green-500" />
                <div className="mr-4">
                  <p className="text-sm font-medium text-gray-600">סה״כ הכנסות</p>
                  <p className="text-2xl font-bold text-green-600">₪45,250</p>
                  <p className="text-xs text-green-500">+12.5% מהחודש הקודם</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-blue-500" />
                <div className="mr-4">
                  <p className="text-sm font-medium text-gray-600">רווח נקי</p>
                  <p className="text-2xl font-bold text-blue-600">₪12,890</p>
                  <p className="text-xs text-blue-500">+8.3% מהחודש הקודם</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Package className="h-8 w-8 text-orange-500" />
                <div className="mr-4">
                  <p className="text-sm font-medium text-gray-600">מוצרים שנמכרו</p>
                  <p className="text-2xl font-bold text-orange-600">1,247</p>
                  <p className="text-xs text-orange-500">+15.7% מהחודש הקודם</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <BarChart3 className="h-8 w-8 text-purple-500" />
                <div className="mr-4">
                  <p className="text-sm font-medium text-gray-600">אחוז רווח ממוצע</p>
                  <p className="text-2xl font-bold text-purple-600">28.5%</p>
                  <p className="text-xs text-purple-500">+2.1% מהחודש הקודם</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <ProtectedFeature requiredRole="pro_starter_user">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle>מגמת מכירות</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">גרף מגמת מכירות</p>
                    <p className="text-sm text-gray-400">נתונים מ{dateRange}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Products */}
            <Card>
              <CardHeader>
                <CardTitle>המוצרים הנמכרים ביותר</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { name: 'מחשב נייד Dell', sales: 45, revenue: '₪157,500' },
                    { name: 'עכבר אלחוטי', sales: 128, revenue: '₪11,392' },
                    { name: 'מקלדת מכנית', sales: 67, revenue: '₪20,033' },
                    { name: 'מסך 24 אינץ', sales: 34, revenue: '₪47,600' },
                  ].map((product, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-gray-600">{product.sales} יחידות נמכרו</p>
                      </div>
                      <p className="font-bold text-green-600">{product.revenue}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </ProtectedFeature>

        {/* Advanced Analytics */}
        <ProtectedFeature requiredRole="smart_master_user">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>ניתוח קטגוריות</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 flex items-center justify-center bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <BarChart3 className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">גרף עוגה - מכירות לפי קטגוריה</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>חיזוי מכירות (AI)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg">
                  <div className="text-center">
                    <TrendingUp className="h-10 w-10 text-purple-500 mx-auto mb-2" />
                    <p className="text-purple-700 font-medium">צפי לחודש הבא</p>
                    <p className="text-2xl font-bold text-purple-800">₪52,400</p>
                    <p className="text-sm text-purple-600">ביטחון: 87%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>המלצות חכמות</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm font-medium text-yellow-800">מלאי נמוך</p>
                    <p className="text-xs text-yellow-700">מומלץ להזמין עכבר אלחוטי</p>
                  </div>
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium text-green-800">הזדמנות רווח</p>
                    <p className="text-xs text-green-700">העלה מחיר מקלדת מכנית ב-15%</p>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-blue-800">מגמה עולה</p>
                    <p className="text-xs text-blue-700">ביקוש גובר למחשבים ניידים</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ProtectedFeature>

        {/* Quick Reports */}
        <Card>
          <CardHeader>
            <CardTitle>דוחות מהירים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button variant="outline" className="h-20 flex-col">
                <Calendar className="h-6 w-6 mb-2" />
                דוח יומי
              </Button>
              <Button variant="outline" className="h-20 flex-col">
                <Package className="h-6 w-6 mb-2" />
                דוח מלאי
              </Button>
              <Button variant="outline" className="h-20 flex-col">
                <DollarSign className="h-6 w-6 mb-2" />
                דוח רווחיות
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};
