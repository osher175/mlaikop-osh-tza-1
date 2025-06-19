
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Mail, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface EmailSendDialogProps {
  isOpen: boolean;
  onClose: () => void;
  recipient?: string;
  recipients?: string[];
  isBulk?: boolean;
}

export const EmailSendDialog: React.FC<EmailSendDialogProps> = ({
  isOpen,
  onClose,
  recipient,
  recipients,
  isBulk = false
}) => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error('נא למלא את כל השדות');
      return;
    }

    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('נדרשת התחברות');
        return;
      }

      const emailData = {
        to: isBulk ? recipients : recipient,
        subject: subject,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2 style="color: #00BFBF; margin-bottom: 20px;">הודעה ממערכת Mlaiko</h2>
            <div style="margin-bottom: 20px; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
              ${message.replace(/\n/g, '<br>')}
            </div>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
            <p style="color: #666; font-size: 14px;">
              הודעה זו נשלחה מפאנל הניהול של מערכת Mlaiko
            </p>
          </div>
        `,
        isBulk: isBulk
      };

      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/send-admin-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(emailData),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(result.message || 'המייל נשלח בהצלחה');
        setSubject('');
        setMessage('');
        onClose();
      } else {
        toast.error(result.error || 'שגיאה בשליחת המייל');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('שגיאה בשליחת המייל');
    } finally {
      setIsLoading(false);
    }
  };

  const recipientCount = isBulk ? (recipients?.length || 0) : 1;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold font-rubik flex items-center gap-2">
            <Mail className="w-5 h-5 text-turquoise" />
            {isBulk ? `שליחת מייל לכל הכתובות (${recipientCount} נמענים)` : 'שליחת מייל אישי'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Recipient Display */}
          <div>
            <Label className="text-sm font-medium font-rubik text-gray-700">
              {isBulk ? 'נמענים:' : 'נמען:'}
            </Label>
            <div className="mt-1 p-3 bg-gray-50 rounded-md border text-sm font-rubik">
              {isBulk ? (
                <span>{recipientCount} כתובות מייל נבחרו</span>
              ) : (
                <span>{recipient}</span>
              )}
            </div>
          </div>

          {/* Subject */}
          <div>
            <Label htmlFor="subject" className="text-sm font-medium font-rubik text-gray-700">
              נושא המייל *
            </Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="הכנס את נושא המייל..."
              className="font-rubik mt-1"
              disabled={isLoading}
            />
          </div>

          {/* Message */}
          <div>
            <Label htmlFor="message" className="text-sm font-medium font-rubik text-gray-700">
              תוכן ההודעה *
            </Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="הכנס את תוכן ההודעה..."
              className="font-rubik mt-1 min-h-32"
              disabled={isLoading}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSend}
              disabled={isLoading || !subject.trim() || !message.trim()}
              className="font-rubik flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                  שולח...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 ml-2" />
                  שלח מייל
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="font-rubik"
            >
              ביטול
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
