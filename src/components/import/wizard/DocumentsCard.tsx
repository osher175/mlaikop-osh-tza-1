import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload } from 'lucide-react';
import { DOCUMENT_TYPE_LABELS } from '@/hooks/useImportOrder';

interface Props {
  documents: any[];
  uploadDocument: any;
  openDocument: (path: string) => void;
  isReadOnly?: boolean;
}

/** Documents live inside step 2 — invoices are what turn estimates into final costs. */
export const DocumentsCard: React.FC<Props> = ({ documents, uploadDocument, openDocument, isReadOnly }) => {
  const [docType, setDocType] = React.useState('commercial_invoice');
  return (
    <Card dir="rtl">
      <CardHeader className="pb-3"><CardTitle className="text-base">מסמכים וחשבוניות</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-2 min-w-[200px]">
            <Label>סוג מסמך</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(DOCUMENT_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>קובץ</Label>
            <Input
              type="file"
              disabled={isReadOnly || uploadDocument.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadDocument.mutate({ file, documentType: docType });
                e.target.value = '';
              }}
            />
          </div>
          {uploadDocument.isPending && <Loader2 className="w-4 h-4 animate-spin mb-3" />}
        </div>
        <div className="space-y-2">
          {documents.map((d: any) => (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <span>{DOCUMENT_TYPE_LABELS[d.document_type] ?? d.document_type}</span>
              <span className="text-muted-foreground truncate max-w-[50%]">{d.original_filename}</span>
              <Button variant="outline" size="sm" onClick={() => openDocument(d.storage_path)}>
                <Upload className="w-3.5 h-3.5 ml-1 rotate-180" />פתיחה
              </Button>
            </div>
          ))}
          {documents.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">אין מסמכים</p>}
        </div>
      </CardContent>
    </Card>
  );
};
