import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AuthLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">טוען...</p>
      </div>
    </div>
  );
}

export function SessionRecovery() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6" dir="rtl">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-xl font-semibold">לא הצלחנו לשחזר את החיבור</h1>
        <p className="text-muted-foreground">
          ההפעלה נשמרה במכשיר. זה קורה כשהרשת או שחזור ההתחברות נתקעים. נסו שוב בלי להתחבר מחדש.
        </p>
        <Button type="button" onClick={() => window.location.reload()}>
          נסו שוב
        </Button>
      </div>
    </div>
  );
}
