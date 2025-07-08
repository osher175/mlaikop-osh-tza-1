
import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';

export const SessionWarningDialog: React.FC = () => {
  const { sessionWarning, extendSession } = useAuth();

  return (
    <AlertDialog open={sessionWarning}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-orange-600">
            התחברות תפוג בקרוב
          </AlertDialogTitle>
          <AlertDialogDescription>
            ההתחברות שלך תפוג בעוד 5 דקות עקב חוסר פעילות.
            <br />
            לחץ על "המשך" כדי להישאר מחובר.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={extendSession}>
            המשך
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
