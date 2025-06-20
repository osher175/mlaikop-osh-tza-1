
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useBusiness } from '@/hooks/useBusiness';

export const ExpirationAlertsPanel: React.FC = () => {
  const { user } = useAuth();
  const { business } = useBusiness();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());

  const { data: expiringProducts = [], isLoading } = useQuery({
    queryKey: ['expiring-products', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];

      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', business.id)
        .eq('alert_dismissed', false)
        .not('expiration_date', 'is', null)
        .lte('expiration_date', sevenDaysFromNow.toISOString().split('T')[0])
        .order('expiration_date', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const handleDismissAlert = async (productId: string) => {
    setDismissingIds(prev => new Set(prev).add(productId));
    
    try {
      const { error } = await supabase
        .from('products')
        .update({ alert_dismissed: true })
        .eq('id', productId);

      if (error) throw error;

      toast({
        title: "התראה נדחתה",
        description: "התראת התפוגה סומנה כטופלה",
      });

      queryClient.invalidateQueries({ queryKey: ['expiring-products'] });
    } catch (error) {
      console.error('Error dismissing alert:', error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לדחות את התראה",
        variant: "destructive",
      });
    } finally {
      setDismissingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    }
  };

  const getExpirationStatus = (expirationDate: string) => {
    const today = new Date();
    const expiry = new Date(expirationDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { status: 'expired', label: 'פג תוקף', variant: 'destructive' as const };
    } else if (diffDays === 0) {
      return { status: 'expires-today', label: 'פג היום', variant: 'destructive' as const };
    } else if (diffDays <= 3) {
      return { status: 'expires-soon', label: `פג בעוד ${diffDays} ימים`, variant: 'destructive' as const };
    } else {
      return { status: 'expires-week', label: `פג בעוד ${diffDays} ימים`, variant: 'secondary' as const };
    }
  };

  if (isLoading) {
    return <div>טוען התראות...</div>;
  }

  if (expiringProducts.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          התראות תפוגה ({expiringProducts.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {expiringProducts.map((product) => {
            const expiration = getExpirationStatus(product.expiration_date!);
            const isDismissing = dismissingIds.has(product.id);
            
            return (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 border rounded-lg bg-red-50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{product.name}</span>
                    <Badge variant={expiration.variant}>{expiration.label}</Badge>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    מיקום: {product.location || 'לא צוין'} | כמות: {product.quantity}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDismissAlert(product.id)}
                  disabled={isDismissing}
                  className="mr-2"
                >
                  {isDismissing ? 'מעבד...' : 'סמן כטופל'}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
