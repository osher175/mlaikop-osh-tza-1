import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Eye, EyeOff } from 'lucide-react';

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ChangePasswordDialog: React.FC<ChangePasswordDialogProps> = ({
  open,
  onOpenChange,
}) => {
  console.log('ChangePasswordDialog rendered, open:', open);
  
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const validateForm = () => {
    const newErrors = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    };

    // בדיקת שדות חובה
    if (!formData.currentPassword.trim()) {
      newErrors.currentPassword = 'סיסמה נוכחית נדרשת';
    }

    if (!formData.newPassword.trim()) {
      newErrors.newPassword = 'סיסמה חדשה נדרשת';
    } else if (formData.newPassword.length < 6) {
      newErrors.newPassword = 'הסיסמה חייבת להכיל לפחות 6 תווים';
    }

    if (!formData.confirmPassword.trim()) {
      newErrors.confirmPassword = 'אימות סיסמה נדרש';
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'הסיסמאות אינן זהות';
    }

    setErrors(newErrors);
    return !Object.values(newErrors).some(error => error !== '');
  };

  const handlePasswordChange = async () => {
    console.log('handlePasswordChange called');
    
    if (!validateForm()) return;

    setLoading(true);
    try {
      // בדיקת הסיסמה הנוכחית על ידי התחברות מחדש
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error('לא נמצא משתמש מחובר');
      }

      console.log('Verifying current password for user:', user.email);

      // נסיון התחברות מחדש עם הסיסמה הנוכחית
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: formData.currentPassword,
      });

      if (signInError) {
        console.error('Current password verification failed:', signInError);
        setErrors(prev => ({
          ...prev,
          currentPassword: 'הסיסמה הנוכחית שגויה'
        }));
        return;
      }

      console.log('Current password verified, updating to new password');

      // עדכון הסיסמה החדשה
      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.newPassword
      });

      if (updateError) {
        console.error('Password update error:', updateError);
        throw updateError;
      }

      console.log('Password updated successfully');

      toast({
        title: "הסיסמה עודכנה בהצלחה",
        description: "הסיסמה שלך שונתה בהצלחה",
      });

      // איפוס הטופס וסגירת הדיאלוג
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setErrors({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      onOpenChange(false);

    } catch (error: any) {
      console.error('Error changing password:', error);
      
      let errorMessage = 'שגיאה בשינוי הסיסמה';
      if (error.message?.includes('Invalid login credentials')) {
        errorMessage = 'הסיסמה הנוכחית שגויה';
        setErrors(prev => ({
          ...prev,
          currentPassword: errorMessage
        }));
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "שגיאה",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>שינוי סיסמה</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* סיסמה נוכחית */}
          <div>
            <Label htmlFor="currentPassword">סיסמה נוכחית</Label>
            <div className="relative mt-1">
              <Input
                id="currentPassword"
                type={showPasswords.current ? "text" : "password"}
                value={formData.currentPassword}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, currentPassword: e.target.value }));
                  if (errors.currentPassword) {
                    setErrors(prev => ({ ...prev, currentPassword: '' }));
                  }
                }}
                className={errors.currentPassword ? "border-red-500" : ""}
                placeholder="הזן את הסיסמה הנוכחית"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('current')}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPasswords.current ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="text-red-500 text-sm mt-1">{errors.currentPassword}</p>
            )}
          </div>

          {/* סיסמה חדשה */}
          <div>
            <Label htmlFor="newPassword">סיסמה חדשה</Label>
            <div className="relative mt-1">
              <Input
                id="newPassword"
                type={showPasswords.new ? "text" : "password"}
                value={formData.newPassword}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, newPassword: e.target.value }));
                  if (errors.newPassword) {
                    setErrors(prev => ({ ...prev, newPassword: '' }));
                  }
                }}
                className={errors.newPassword ? "border-red-500" : ""}
                placeholder="הזן סיסמה חדשה (לפחות 6 תווים)"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('new')}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPasswords.new ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-red-500 text-sm mt-1">{errors.newPassword}</p>
            )}
          </div>

          {/* אימות סיסמה חדשה */}
          <div>
            <Label htmlFor="confirmPassword">אימות סיסמה חדשה</Label>
            <div className="relative mt-1">
              <Input
                id="confirmPassword"
                type={showPasswords.confirm ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, confirmPassword: e.target.value }));
                  if (errors.confirmPassword) {
                    setErrors(prev => ({ ...prev, confirmPassword: '' }));
                  }
                }}
                className={errors.confirmPassword ? "border-red-500" : ""}
                placeholder="הזן שוב את הסיסמה החדשה"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('confirm')}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPasswords.confirm ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>
            )}
          </div>

          {/* כפתורי פעולה */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handlePasswordChange}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  משנה סיסמה...
                </>
              ) : (
                'שמור שינויים'
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1"
            >
              ביטול
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
