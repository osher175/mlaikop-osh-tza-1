import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MessageSquare, Bot, User, ChevronDown, Loader2, Zap } from 'lucide-react';
import { useProcurementConversations, useProcurementMessages } from '@/hooks/useProcurementConversations';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';

interface ConversationsListProps {
  requestId: string;
  productId: string;
  isTerminal: boolean;
}

const ConversationMessages: React.FC<{ conversationId: string }> = ({ conversationId }) => {
  const { messages, isLoading } = useProcurementMessages(conversationId);

  if (isLoading) return <div className="text-xs text-muted-foreground p-2">טוען הודעות...</div>;
  if (messages.length === 0) return <div className="text-xs text-muted-foreground p-2">אין הודעות</div>;

  return (
    <div className="space-y-1 p-2">
      {messages.map(msg => (
        <div
          key={msg.id}
          className={`text-xs p-2 rounded ${
            msg.direction === 'outgoing'
              ? 'bg-primary/10 text-right'
              : 'bg-muted text-right'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <Badge variant="outline" className="text-[10px]">
              {msg.direction === 'outgoing' ? 'יוצאת' : 'נכנסת'}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {msg.status}
            </Badge>
          </div>
          <p className="whitespace-pre-wrap">{msg.message_text}</p>
          <span className="text-muted-foreground text-[10px]">
            {new Date(msg.created_at).toLocaleString('he-IL')}
          </span>
        </div>
      ))}
    </div>
  );
};

export const ConversationsList: React.FC<ConversationsListProps> = ({
  requestId,
  productId,
  isTerminal,
}) => {
  const { conversations, conversationsLoading, toggleMode } = useProcurementConversations(requestId);
  const [startingOutreach, setStartingOutreach] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { businessContext } = useBusinessAccess();

  const hasActiveConversations = conversations.some(c => c.status === 'active');

  const handleStartOutreach = async () => {
    if (!businessContext?.business_id) return;
    setStartingOutreach(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `https://gtakgctmtayalcbpnryg.supabase.co/functions/v1/procurement-start-outreach`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            business_id: businessContext.business_id,
            procurement_request_id: requestId,
          }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'שגיאה');

      toast({
        title: 'סקר שוק הופעל',
        description: `שיחות חדשות: ${result.conversations_created}, הודעות: ${result.messages_queued}, כבר פעילות: ${result.already_active}`,
      });

      queryClient.invalidateQueries({ queryKey: ['procurement-conversations', requestId] });
      queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
    } catch (err: any) {
      toast({ title: 'שגיאה בהפעלת סקר שוק', description: err.message, variant: 'destructive' });
    } finally {
      setStartingOutreach(false);
    }
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-sm flex items-center gap-1">
          <MessageSquare className="h-4 w-4" />
          שיחות ספקים ({conversations.length})
        </h4>
        {!isTerminal && (
          <Button
            size="sm"
            variant={hasActiveConversations ? 'outline' : 'default'}
            onClick={handleStartOutreach}
            disabled={startingOutreach}
          >
            {startingOutreach ? (
              <Loader2 className="h-3 w-3 animate-spin ml-1" />
            ) : (
              <Zap className="h-3 w-3 ml-1" />
            )}
            {hasActiveConversations ? 'רענן סקר' : 'התחל סקר שוק'}
          </Button>
        )}
      </div>

      {conversationsLoading ? (
        <div className="text-sm text-muted-foreground">טוען...</div>
      ) : conversations.length === 0 ? (
        <p className="text-sm text-muted-foreground">אין שיחות עדיין. הפעל סקר שוק כדי ליצור קשר עם ספקים.</p>
      ) : (
        <div className="space-y-2">
          {conversations.map(conv => (
            <Collapsible key={conv.id}>
              <div className="border rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{conv.suppliers?.name || 'ספק'}</span>
                    <Badge variant={conv.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                      {conv.status === 'active' ? 'פעיל' : 'סגור'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      {conv.mode === 'bot' ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
                      {conv.mode === 'bot' ? 'בוט' : 'ידני'}
                    </span>
                    {!isTerminal && conv.status === 'active' && (
                      <Switch
                        checked={conv.mode === 'bot'}
                        onCheckedChange={(checked) =>
                          toggleMode.mutate({ conversationId: conv.id, newMode: checked ? 'bot' : 'manual' })
                        }
                        className="scale-75"
                      />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>שליחה אחרונה: {formatDate(conv.last_outgoing_at)}</span>
                  <span>תגובה אחרונה: {formatDate(conv.last_incoming_at)}</span>
                </div>
                {conv.status === 'active' && (
                  <div className="text-xs text-primary mt-1">כבר נשלח — לא תישלח הודעה כפולה</div>
                )}
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="mt-1 h-6 text-xs w-full">
                    <ChevronDown className="h-3 w-3 ml-1" />
                    הצג הודעות
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent>
                <ConversationMessages conversationId={conv.id} />
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}
    </div>
  );
};
