
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Package, Clock, CheckCircle } from 'lucide-react';
import { useStockAlerts } from '@/hooks/useStockAlerts';

export const StockAlertsPanel: React.FC = () => {
  const { stockAlerts, isLoading, resolveAlert } = useStockAlerts();

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'out_of_stock':
        return <Package className="h-4 w-4" />;
      case 'expiration_soon':
        return <Clock className="h-4 w-4" />;
      case 'low_stock':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getAlertLabel = (alertType: string) => {
    switch (alertType) {
      case 'out_of_stock':
        return 'מוצר אזל';
      case 'expiration_soon':
        return 'תוקף קרוב';
      case 'low_stock':
        return 'מלאי נמוך';
      default:
        return 'התראה';
    }
  };

  const getAlertVariant = (alertType: string) => {
    switch (alertType) {
      case 'out_of_stock':
        return 'destructive' as const;
      case 'expiration_soon':
        return 'secondary' as const;
      case 'low_stock':
        return 'outline' as const;
      default:
        return 'outline' as const;
    }
  };

  if (isLoading) {
    return <div>טוען התראות...</div>;
  }

  if (stockAlerts.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-600">
          <AlertTriangle className="h-5 w-5" />
          התראות מלאי ({stockAlerts.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {stockAlerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between p-3 border rounded-lg bg-orange-50"
              dir="rtl"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {getAlertIcon(alert.alert_type)}
                  <span className="font-medium">{alert.product_name}</span>
                  <Badge variant={getAlertVariant(alert.alert_type)}>
                    {getAlertLabel(alert.alert_type)}
                  </Badge>
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {alert.supplier_name && `ספק: ${alert.supplier_name}`}
                  {alert.supplier_name && alert.supplier_phone && ' | '}
                  {alert.supplier_phone && `טלפון: ${alert.supplier_phone}`}
                  {(alert.supplier_name || alert.supplier_phone) && ' | '}
                  כמות: {alert.quantity_at_trigger}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(alert.created_at).toLocaleDateString('he-IL')} בשעה{' '}
                  {new Date(alert.created_at).toLocaleTimeString('he-IL', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => resolveAlert.mutate(alert.id)}
                disabled={resolveAlert.isPending}
                className="mr-2"
              >
                <CheckCircle className="h-4 w-4 ml-1" />
                {resolveAlert.isPending ? 'מעבד...' : 'סמן כטופל'}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
