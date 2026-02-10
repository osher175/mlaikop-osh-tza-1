import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, CheckCircle, XCircle, Star, Send, AlertTriangle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useProcurementRequests } from '@/hooks/useProcurementRequests';
import { useProcurementActions } from '@/hooks/useProcurementActions';
import { useSupplierQuotes } from '@/hooks/useSupplierQuotes';
import { ProcurementStatusBadge, UrgencyBadge } from '@/components/procurement/ProcurementStatusBadge';
import { ManualQuoteDialog } from '@/components/procurement/ManualQuoteDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export const ProcurementDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { requests, cancelRequest } = useProcurementRequests();
  const { updateStatus, updateRecommendedQuote } = useProcurementActions();
  const { quotes, isLoading: quotesLoading } = useSupplierQuotes(id);

  const request = requests.find(r => r.id === id);

  if (!request) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-12" dir="rtl">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  const isActionable = ['waiting_for_approval', 'quotes_received', 'recommended'].includes(request.status);
  const canSendQuotes = request.status === 'waiting_for_quotes';
  const canAddQuotes = !['ordered', 'cancelled'].includes(request.status);

  const handleApprove = (quoteId: string) => {
    updateStatus.mutate({ requestId: request.id, status: 'approved' });
    updateRecommendedQuote.mutate({ requestId: request.id, quoteId });
  };

  const handleCancel = () => {
    cancelRequest.mutate(request.id);
  };

  const handleSelectQuote = (quoteId: string) => {
    updateRecommendedQuote.mutate({ requestId: request.id, quoteId });
  };

  return (
    <MainLayout>
      <div className="space-y-6 max-w-4xl mx-auto" dir="rtl">
        {/* Back button */}
        <Button variant="ghost" onClick={() => navigate('/procurement')} className="gap-2">
          <ArrowRight className="w-4 h-4" />
          חזרה לרשימת בקשות
        </Button>

        {/* Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
                  {request.products?.name || 'מוצר'}
                </h1>
                <div className="flex flex-wrap gap-2 items-center">
                  <ProcurementStatusBadge status={request.status} />
                  <UrgencyBadge urgency={request.urgency} />
                  <span className="text-sm text-gray-600">כמות מבוקשת: {request.requested_quantity}</span>
                  <span className="text-sm text-gray-500">
                    מלאי נוכחי: {request.products?.quantity ?? '-'}
                  </span>
                </div>
                {request.notes && (
                  <p className="text-sm text-gray-500 mt-2">הערות: {request.notes}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {canSendQuotes && (
                  <Button
                    variant="outline"
                    onClick={() => updateStatus.mutate({ requestId: request.id, status: 'in_progress' })}
                    disabled={updateStatus.isPending}
                  >
                    <Send className="w-4 h-4 ml-1" />
                    התחל טיפול
                  </Button>
                )}
                {canAddQuotes && <ManualQuoteDialog requestId={request.id} />}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recommendation explanation */}
        {request.recommended_quote_id && quotes.length > 0 && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4 flex items-start gap-3">
              <Star className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-800">המלצת המערכת</p>
                <p className="text-sm text-green-700">
                  ההצעה המומלצת נבחרה על בסיס הציון הכולל הגבוה ביותר, בשקלול מחיר, זמני אספקה, ועדיפות ספק.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quotes table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">הצעות מחיר ({quotes.length})</CardTitle>
          </CardHeader>
          <CardContent className={quotes.length === 0 ? 'py-8' : 'p-0'}>
            {quotesLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : quotes.length === 0 ? (
              <div className="text-center text-gray-500">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p>עדיין לא התקבלו הצעות מחיר</p>
              </div>
            ) : isMobile ? (
              // Mobile card view for quotes
              <div className="space-y-3 p-4">
                {quotes.map(quote => {
                  const isRecommended = quote.id === request.recommended_quote_id;
                  return (
                    <Card key={quote.id} className={isRecommended ? 'border-green-300 bg-green-50' : ''}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{quote.suppliers?.name || 'ספק'}</span>
                          {isRecommended && (
                            <Badge className="bg-green-100 text-green-700 border-green-300 gap-1">
                              <Star className="w-3 h-3" /> מומלץ
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                          <span>מחיר: ₪{quote.price_per_unit}</span>
                          <span>זמין: {quote.available ? '✓' : '✗'}</span>
                          <span>אספקה: {quote.delivery_time_days ? `${quote.delivery_time_days} ימים` : '-'}</span>
                          <span>ציון: {quote.score?.toFixed(2) || '-'}</span>
                        </div>
                        {isActionable && quote.available && (
                          <div className="flex gap-2">
                            {!isRecommended && (
                              <Button size="sm" variant="outline" onClick={() => handleSelectQuote(quote.id)} className="flex-1">
                                בחר הצעה
                              </Button>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700">
                                  <CheckCircle className="w-3 h-3 ml-1" />
                                  אשר הזמנה
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent dir="rtl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>אישור הזמנה</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    האם לאשר הזמנה של {request.requested_quantity} יחידות מ{quote.suppliers?.name} במחיר ₪{quote.price_per_unit} ליחידה?
                                    <br />סה"כ: ₪{(quote.price_per_unit * request.requested_quantity).toFixed(2)}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>ביטול</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleApprove(quote.id)} className="bg-green-600 hover:bg-green-700">
                                    אשר הזמנה
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              // Desktop table
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr className="border-b">
                      <th className="text-right p-3 font-medium text-sm">ספק</th>
                      <th className="text-right p-3 font-medium text-sm">מחיר ליחידה</th>
                      <th className="text-right p-3 font-medium text-sm">זמין</th>
                      <th className="text-right p-3 font-medium text-sm">ימי אספקה</th>
                      <th className="text-right p-3 font-medium text-sm">ציון</th>
                      <th className="text-right p-3 font-medium text-sm">מקור</th>
                      <th className="text-right p-3 font-medium text-sm">פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.map(quote => {
                      const isRecommended = quote.id === request.recommended_quote_id;
                      return (
                        <tr key={quote.id} className={`border-b hover:bg-gray-50 ${isRecommended ? 'bg-green-50' : ''}`}>
                          <td className="p-3 text-sm font-medium flex items-center gap-2">
                            {isRecommended && <Star className="w-4 h-4 text-green-600" />}
                            {quote.suppliers?.name || '-'}
                          </td>
                          <td className="p-3 text-sm font-medium">₪{quote.price_per_unit}</td>
                          <td className="p-3">
                            {quote.available ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400" />
                            )}
                          </td>
                          <td className="p-3 text-sm">{quote.delivery_time_days ?? '-'}</td>
                          <td className="p-3 text-sm font-mono">{quote.score?.toFixed(2) || '-'}</td>
                          <td className="p-3 text-sm text-gray-500">{quote.quote_source}</td>
                          <td className="p-3">
                            {isActionable && quote.available && (
                              <div className="flex gap-1">
                                {!isRecommended && (
                                  <Button size="sm" variant="outline" onClick={() => handleSelectQuote(quote.id)} className="text-xs h-7">
                                    בחר
                                  </Button>
                                )}
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs h-7">
                                      <CheckCircle className="w-3 h-3 ml-1" />
                                      אשר
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent dir="rtl">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>אישור הזמנה</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        האם לאשר הזמנה של {request.requested_quantity} יחידות מ{quote.suppliers?.name} במחיר ₪{quote.price_per_unit} ליחידה?
                                        <br />סה"כ: ₪{(quote.price_per_unit * request.requested_quantity).toFixed(2)}
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>ביטול</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleApprove(quote.id)} className="bg-green-600 hover:bg-green-700">
                                        אשר הזמנה
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        {request.status !== 'ordered' && request.status !== 'cancelled' && (
          <Card>
            <CardContent className="p-4 flex justify-end">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <XCircle className="w-4 h-4 ml-1" />
                    בטל בקשה
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent dir="rtl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>ביטול בקשת רכש</AlertDialogTitle>
                    <AlertDialogDescription>
                      האם אתה בטוח שברצונך לבטל את בקשת הרכש?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>חזרה</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancel} className="bg-red-600 hover:bg-red-700">
                      בטל בקשה
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
};
