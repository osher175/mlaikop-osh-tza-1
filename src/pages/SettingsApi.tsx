import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveBusiness } from "@/hooks/useActiveBusiness";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, Trash2, Ban, KeyRound, AlertTriangle } from "lucide-react";

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export default function SettingsApi() {
  const { activeBusinessId } = useActiveBusiness();
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newExpires, setNewExpires] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const baseUrl = `https://${projectRef}.supabase.co/functions/v1/public-api`;

  const load = async () => {
    if (!activeBusinessId) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("api-keys-manage", {
      body: { action: "list", business_id: activeBusinessId },
    });
    if (error) {
      toast({ title: "שגיאה בטעינת מפתחות", description: error.message, variant: "destructive" });
    } else {
      setKeys(data?.data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [activeBusinessId]);

  const create = async () => {
    if (!activeBusinessId) return;
    if (!newName.trim()) {
      toast({ title: "נא להזין שם למפתח", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("api-keys-manage", {
      body: {
        action: "create",
        business_id: activeBusinessId,
        name: newName.trim(),
        expires_at: newExpires || null,
      },
    });
    setCreating(false);
    if (error || !data?.data?.api_key) {
      toast({ title: "שגיאה ביצירת מפתח", description: error?.message, variant: "destructive" });
      return;
    }
    setCreatedKey(data.data.api_key);
    setNewName(""); setNewExpires("");
    setOpenCreate(false);
    load();
  };

  const revoke = async (id: string) => {
    if (!confirm("לבטל את המפתח? לא ניתן יהיה להשתמש בו יותר.")) return;
    const { error } = await supabase.functions.invoke("api-keys-manage", {
      body: { action: "revoke", id },
    });
    if (error) toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    else { toast({ title: "המפתח בוטל" }); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("למחוק את המפתח לצמיתות?")) return;
    const { error } = await supabase.functions.invoke("api-keys-manage", {
      body: { action: "delete", id },
    });
    if (error) toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    else { toast({ title: "המפתח נמחק" }); load(); }
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: "הועתק ללוח" });
  };

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <KeyRound className="h-6 w-6" /> מפתחות API
          </h1>
          <p className="text-muted-foreground mt-1">
            צרו מפתחות לקריאת נתונים ממערכות חיצוניות (Excel, Power BI, Make, n8n וכו'). קריאה בלבד.
          </p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button>צור מפתח חדש</Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>יצירת מפתח API חדש</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>שם תיאורי</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder="לדוגמה: Power BI – דוחות חודשיים" maxLength={100} />
              </div>
              <div>
                <Label>תאריך תפוגה (אופציונלי)</Label>
                <Input type="date" value={newExpires}
                  onChange={(e) => setNewExpires(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenCreate(false)}>ביטול</Button>
              <Button onClick={create} disabled={creating}>
                {creating ? "יוצר..." : "צור מפתח"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {createdKey && (
        <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              שמרו את המפתח עכשיו — הוא לא יוצג שוב!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-background rounded border font-mono text-sm break-all">
              <span className="flex-1">{createdKey}</span>
              <Button size="sm" variant="ghost" onClick={() => copy(createdKey)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" onClick={() => setCreatedKey(null)}>שמרתי, סגור</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>המפתחות שלך</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">טוען...</p>
          ) : keys.length === 0 ? (
            <p className="text-muted-foreground">אין מפתחות עדיין. צרו מפתח ראשון כדי להתחיל.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">שם</TableHead>
                  <TableHead className="text-right">Prefix</TableHead>
                  <TableHead className="text-right">סטטוס</TableHead>
                  <TableHead className="text-right">נוצר</TableHead>
                  <TableHead className="text-right">שימוש אחרון</TableHead>
                  <TableHead className="text-right">תפוגה</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => {
                  const expired = k.expires_at && new Date(k.expires_at) < new Date();
                  const status = k.revoked_at ? "מבוטל" : expired ? "פג תוקף" : "פעיל";
                  const variant = k.revoked_at || expired ? "destructive" : "default";
                  return (
                    <TableRow key={k.id}>
                      <TableCell>{k.name}</TableCell>
                      <TableCell className="font-mono text-xs">{k.key_prefix}…</TableCell>
                      <TableCell><Badge variant={variant as any}>{status}</Badge></TableCell>
                      <TableCell>{new Date(k.created_at).toLocaleDateString("he-IL")}</TableCell>
                      <TableCell>
                        {k.last_used_at ? new Date(k.last_used_at).toLocaleString("he-IL") : "—"}
                      </TableCell>
                      <TableCell>
                        {k.expires_at ? new Date(k.expires_at).toLocaleDateString("he-IL") : "—"}
                      </TableCell>
                      <TableCell className="flex gap-2">
                        {!k.revoked_at && (
                          <Button size="sm" variant="outline" onClick={() => revoke(k.id)}>
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => remove(k.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>תיעוד API</CardTitle>
          <CardDescription>קריאה בלבד · GET בלבד · ILS · מע"מ 18% · Asia/Jerusalem</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">כתובת הבסיס:</p>
          <pre className="bg-muted p-3 rounded text-xs overflow-x-auto" dir="ltr">{baseUrl}</pre>
          <p className="text-sm">דוגמת קריאה:</p>
          <pre className="bg-muted p-3 rounded text-xs overflow-x-auto" dir="ltr">{`curl -H "x-mlaiko-api-key: YOUR_KEY" \\
  ${baseUrl}/products?page=1&limit=100`}</pre>
          <div className="text-sm">
            <p className="font-semibold mb-2">Endpoints זמינים:</p>
            <ul className="list-disc pr-6 space-y-1 text-muted-foreground">
              <li><code dir="ltr">GET /products</code> — רשימת מוצרים</li>
              <li><code dir="ltr">GET /products/:id</code> — מוצר בודד</li>
              <li><code dir="ltr">GET /inventory-actions?from&to</code> — תנועות מלאי</li>
              <li><code dir="ltr">GET /suppliers</code> — ספקים</li>
              <li><code dir="ltr">GET /categories</code> — קטגוריות</li>
              <li><code dir="ltr">GET /sales?from&to</code> — מכירות</li>
              <li><code dir="ltr">GET /reports/summary?from&to</code> — סיכום פיננסי</li>
              <li><code dir="ltr">GET /stock-alerts</code> — התראות מלאי</li>
              <li><code dir="ltr">GET /low-stock</code> — מוצרים מתחת לסף</li>
            </ul>
          </div>
          <p className="text-xs text-muted-foreground pt-2">
            הגבלה: 60 קריאות לדקה לכל מפתח. עד 500 פריטים בעמוד.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
