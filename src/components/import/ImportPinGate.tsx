import React, { useState } from 'react';
import { Lock, ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useImportPin } from '@/hooks/useImportPin';

/**
 * Step-up screen for the import module. This is UX only — every import table
 * and RPC independently enforces business authorization server-side.
 */
export const ImportPinGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pinState, unlocked, isLoading, verifyPin, setPin } = useImportPin();
  const [pin, setPinValue] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (unlocked) return <>{children}</>;

  const configured = pinState?.isConfigured;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\d{4}$/.test(pin)) {
      setError('יש להזין קוד בן 4 ספרות');
      return;
    }
    setBusy(true);
    try {
      if (!configured) {
        if (pin !== confirmPin) {
          setError('הקודים אינם תואמים');
          return;
        }
        const res = await setPin(pin);
        if (!res.success) {
          setError(res.message ?? 'שגיאה בהגדרת הקוד');
          return;
        }
        const verify = await verifyPin(pin);
        if (!verify.success) setError(verify.message ?? 'שגיאה');
      } else {
        const res = await verifyPin(pin);
        if (!res.success) setError(res.message ?? 'קוד שגוי');
      }
    } finally {
      setBusy(false);
      setPinValue('');
      setConfirmPin('');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4" dir="rtl">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            {configured ? <Lock className="w-6 h-6 text-primary" /> : <ShieldCheck className="w-6 h-6 text-primary" />}
          </div>
          <CardTitle>{configured ? 'מודול יבוא נעול' : 'הגדרת קוד גישה ליבוא'}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {configured
              ? 'הזן את קוד הגישה בן 4 הספרות'
              : 'בחר קוד בן 4 ספרות שישמש לכניסה למודול היבוא'}
          </p>
        </CardHeader>
        <CardContent>
          {pinState?.isLocked ? (
            <Alert variant="destructive">
              <AlertDescription>
                המודול ננעל זמנית עקב ניסיונות שגויים. נסה שוב מאוחר יותר.
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                value={pin}
                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="text-center tracking-[0.6em] text-lg"
              />
              {!configured && (
                <Input
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="אישור קוד"
                  className="text-center tracking-[0.6em] text-lg"
                />
              )}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                {configured ? 'פתיחה' : 'שמירת קוד'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
