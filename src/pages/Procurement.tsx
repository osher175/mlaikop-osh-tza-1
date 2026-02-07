import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingCart, Package, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProcurementRequests } from '@/hooks/useProcurementRequests';
import { ProcurementStatusBadge, UrgencyBadge, TriggerBadge } from '@/components/procurement/ProcurementStatusBadge';
import { useIsMobile } from '@/hooks/use-mobile';

export const Procurement: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState('all');
  const { requests, isLoading } = useProcurementRequests(statusFilter);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <ShoppingCart className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">רכש חכם</h1>
              <p className="text-gray-600 text-sm">ניהול בקשות רכש והצעות מחיר</p>
            </div>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="סנן לפי סטטוס" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">הכל</SelectItem>
              <SelectItem value="waiting_for_quotes">ממתין להצעות</SelectItem>
              <SelectItem value="quotes_received">הצעות התקבלו</SelectItem>
              <SelectItem value="waiting_for_approval">ממתין לאישור</SelectItem>
              <SelectItem value="approved">מאושר</SelectItem>
              <SelectItem value="ordered">הוזמן</SelectItem>
              <SelectItem value="cancelled">בוטל</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : requests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 text-lg">אין בקשות רכש פעילות</p>
              <p className="text-gray-400 text-sm mt-1">בקשות רכש נוצרות אוטומטית כשמוצר אוזל או שהמלאי יורד מתחת לסף</p>
            </CardContent>
          </Card>
        ) : isMobile ? (
          // Mobile card view
          <div className="space-y-3">
            {requests.map(req => (
              <Card key={req.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/procurement/${req.id}`)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-base truncate flex-1">{req.products?.name || 'מוצר'}</h3>
                    <ProcurementStatusBadge status={req.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                    <span>כמות: {req.requested_quantity}</span>
                    <span>הצעות: {req.supplier_quotes?.length || 0}</span>
                    <span>{formatDate(req.created_at)}</span>
                    <TriggerBadge trigger={req.trigger_type} />
                  </div>
                  {req.recommended_quote && (
                    <div className="text-sm text-green-700 bg-green-50 rounded px-2 py-1">
                      מומלץ: {req.recommended_quote.suppliers?.name} - ₪{req.recommended_quote.price_per_unit}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          // Desktop table view
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead className="bg-gray-50">
                    <tr className="border-b">
                      <th className="text-right p-3 font-medium text-sm">תאריך</th>
                      <th className="text-right p-3 font-medium text-sm">מוצר</th>
                      <th className="text-right p-3 font-medium text-sm">כמות</th>
                      <th className="text-right p-3 font-medium text-sm">סוג</th>
                      <th className="text-right p-3 font-medium text-sm">סטטוס</th>
                      <th className="text-right p-3 font-medium text-sm">הצעות</th>
                      <th className="text-right p-3 font-medium text-sm">ספק מומלץ</th>
                      <th className="text-right p-3 font-medium text-sm">פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map(req => (
                      <tr key={req.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-3 text-sm">{formatDate(req.created_at)}</td>
                        <td className="p-3 text-sm font-medium">{req.products?.name || '-'}</td>
                        <td className="p-3 text-sm">{req.requested_quantity}</td>
                        <td className="p-3"><TriggerBadge trigger={req.trigger_type} /></td>
                        <td className="p-3"><ProcurementStatusBadge status={req.status} /></td>
                        <td className="p-3 text-sm">{req.supplier_quotes?.length || 0}</td>
                        <td className="p-3 text-sm">
                          {req.recommended_quote ? (
                            <span className="text-green-700">{req.recommended_quote.suppliers?.name} - ₪{req.recommended_quote.price_per_unit}</span>
                          ) : '-'}
                        </td>
                        <td className="p-3">
                          <Button size="sm" variant="outline" onClick={() => navigate(`/procurement/${req.id}`)}>
                            <ArrowLeft className="w-3 h-3 ml-1" />
                            פרטים
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
};
