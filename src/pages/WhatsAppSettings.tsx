import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { SubscriptionGuard } from '@/components/subscription/SubscriptionGuard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, CheckCircle, XCircle, Wifi, WifiOff, Send, RefreshCw, Phone } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const WhatsAppSettings: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeBusinessId } = useActiveBusiness();
  const queryClient = useQueryClient();
  const [testPhone, setTestPhone] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Fetch channel status
  const { data: channel, isLoading } = useQuery({
    queryKey: ['business-channel', activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId) return null;
      const { data, error } = await supabase
        .from('business_channels')
        .select('*')
        .eq('business_id', activeBusinessId)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!activeBusinessId,
  });

  // Embedded Signup form state
  const [signupForm, setSignupForm] = useState({
    waba_id: '',
    phone_number_id: '',
    phone_number: '',
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      if (!activeBusinessId) throw new Error('No active business');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `https://gtakgctmtayalcbpnryg.supabase.co/functions/v1/meta-embedded-signup-complete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            business_id: activeBusinessId,
            waba_id: signupForm.waba_id,
            phone_number_id: signupForm.phone_number_id,
            phone_number: signupForm.phone_number || undefined,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Connection failed');
      return result;
    },
    onSuccess: () => {
      toast({ title: 'WhatsApp חובר בהצלחה! ✅' });
      queryClient.invalidateQueries({ queryKey: ['business-channel'] });
      setSignupForm({ waba_id: '', phone_number_id: '', phone_number: '' });
    },
    onError: (err: Error) => {
      toast({ title: 'שגיאה בחיבור', description: err.message, variant: 'destructive' });
    },
  });

  const handleSendTest = async () => {
    if (!activeBusinessId || !testPhone) return;
    setIsSendingTest(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `https://gtakgctmtayalcbpnryg.supabase.co/functions/v1/meta-send-message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            business_id: activeBusinessId,
            to: testPhone.replace(/\D/g, ''),
            message_text: '🔔 הודעת בדיקה ממערכת Mlaiko — החיבור תקין!',
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Send failed');
      toast({ title: 'הודעת בדיקה נשלחה בהצלחה! ✅' });
    } catch (err: any) {
      toast({ title: 'שגיאה בשליחה', description: err.message, variant: 'destructive' });
    } finally {
      setIsSendingTest(false);
    }
  };

  const statusConfig = {
    connected: { icon: CheckCircle, color: 'text-green-600', badge: 'bg-green-100 text-green-800', label: 'מחובר' },
    disconnected: { icon: WifiOff, color: 'text-muted-foreground', badge: 'bg-muted text-muted-foreground', label: 'לא מחובר' },
    error: { icon: XCircle, color: 'text-destructive', badge: 'bg-destructive/10 text-destructive', label: 'שגיאה' },
  };

  const currentStatus = channel?.status as keyof typeof statusConfig || 'disconnected';
  const StatusIcon = statusConfig[currentStatus]?.icon || WifiOff;

  return (
    <SubscriptionGuard>
      <MainLayout>
        <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto" dir="rtl">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">הגדרות WhatsApp</h1>
              <p className="text-muted-foreground text-sm">חבר את מספר ה-WhatsApp Business שלך למערכת</p>
            </div>
          </div>

          {/* Connection Status */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wifi className="h-5 w-5" />
                  סטטוס חיבור
                </CardTitle>
                <Badge className={statusConfig[currentStatus]?.badge}>
                  <StatusIcon className={`h-3 w-3 ml-1 ${statusConfig[currentStatus]?.color}`} />
                  {statusConfig[currentStatus]?.label}
                </Badge>
              </div>
            </CardHeader>
            {channel && (
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">WABA ID:</span>
                  <span className="font-mono">{channel.waba_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone Number ID:</span>
                  <span className="font-mono">{channel.phone_number_id}</span>
                </div>
                {channel.phone_number && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">מספר טלפון:</span>
                    <span className="font-mono">{channel.phone_number}</span>
                  </div>
                )}
                {channel.last_error && currentStatus === 'error' && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertDescription className="text-xs font-mono break-all">
                      {channel.last_error}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            )}
          </Card>

          {/* Connect / Reconnect Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Phone className="h-5 w-5" />
                {channel ? 'עדכון חיבור' : 'חיבור WhatsApp Business'}
              </CardTitle>
              <CardDescription>
                הזן את פרטי ה-WhatsApp Business API מ-Meta Business Suite
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="waba_id">WABA ID *</Label>
                <Input
                  id="waba_id"
                  placeholder="123456789012345"
                  value={signupForm.waba_id}
                  onChange={(e) => setSignupForm(prev => ({ ...prev, waba_id: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone_number_id">Phone Number ID *</Label>
                <Input
                  id="phone_number_id"
                  placeholder="123456789012345"
                  value={signupForm.phone_number_id}
                  onChange={(e) => setSignupForm(prev => ({ ...prev, phone_number_id: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone_number">מספר טלפון (אופציונלי)</Label>
                <Input
                  id="phone_number"
                  placeholder="+972501234567"
                  value={signupForm.phone_number}
                  onChange={(e) => setSignupForm(prev => ({ ...prev, phone_number: e.target.value }))}
                />
              </div>
              <Button
                onClick={() => connectMutation.mutate()}
                disabled={!signupForm.waba_id || !signupForm.phone_number_id || connectMutation.isPending}
                className="w-full"
              >
                {connectMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <MessageSquare className="h-4 w-4 ml-2" />
                )}
                {channel ? 'עדכן חיבור' : 'חבר WhatsApp'}
              </Button>
            </CardContent>
          </Card>

          {/* Test Message */}
          {channel?.status === 'connected' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  שליחת הודעת בדיקה
                </CardTitle>
                <CardDescription>
                  שלח הודעת בדיקה כדי לוודא שהחיבור תקין
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="test_phone">מספר טלפון לבדיקה</Label>
                  <Input
                    id="test_phone"
                    placeholder="972501234567"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleSendTest}
                  disabled={!testPhone || isSendingTest}
                  variant="outline"
                  className="w-full"
                >
                  {isSendingTest ? (
                    <RefreshCw className="h-4 w-4 ml-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 ml-2" />
                  )}
                  שלח הודעת בדיקה
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </MainLayout>
    </SubscriptionGuard>
  );
};
