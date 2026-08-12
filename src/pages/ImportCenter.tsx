import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ship, Search, Plus, Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ImportPinGate } from '@/components/import/ImportPinGate';
import { CreateImportOrderDialog } from '@/components/import/CreateImportOrderDialog';
import { useImportPin } from '@/hooks/useImportPin';
import {
  useImportOrdersPage, IMPORT_PAGE_SIZE, IMPORT_STATUSES,
  IMPORT_STATUS_LABELS, PURCHASE_TYPE_LABELS,
} from '@/hooks/useImportOrders';
import { formatCurrency } from '@/lib/formatCurrency';
import { useDebounce } from '@/hooks/use-debounce';

const statusVariant = (status: string) =>
  status === 'completed' ? 'secondary' : status === 'cancelled' ? 'destructive' : 'default';

const ImportCenterContent: React.FC = () => {
  const navigate = useNavigate();
  const { lock } = useImportPin();
  const [scope, setScope] = useState<'active' | 'completed' | 'all'>('active');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('__all__');
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useImportOrdersPage({
    scope,
    search: debouncedSearch,
    status: status === '__all__' ? null : status,
    page,
  });

  const rows = data?.rows ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / IMPORT_PAGE_SIZE));

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <Ship className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">מרכז יבוא</h1>
            <p className="text-sm text-muted-foreground">ניהול הזמנות יבוא, עלויות ותשלומים</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => lock()}>
            <Lock className="w-4 h-4 ml-2" />
            נעילה
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 ml-2" />
            הזמנת יבוא חדשה
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <CardTitle className="text-lg">הזמנות יבוא</CardTitle>
          <div className="flex flex-wrap gap-3">
            <Tabs value={scope} onValueChange={(v) => { setScope(v as typeof scope); setPage(0); }}>
              <TabsList>
                <TabsTrigger value="active">פעילות</TabsTrigger>
                <TabsTrigger value="completed">הושלמו</TabsTrigger>
                <TabsTrigger value="all">הכל</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                placeholder="חיפוש לפי מספר יבוא או ספק"
                className="pr-9"
              />
            </div>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="כל הסטטוסים" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">כל הסטטוסים</SelectItem>
                {IMPORT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{IMPORT_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Ship className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>לא נמצאו הזמנות יבוא</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">מספר יבוא</TableHead>
                    <TableHead className="text-right">ספק</TableHead>
                    <TableHead className="text-right">סוג רכישה</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                    <TableHead className="text-right">תאריך הזמנה</TableHead>
                    <TableHead className="text-right">הגעה משוערת</TableHead>
                    <TableHead className="text-right">יחידות</TableHead>
                    <TableHead className="text-right">עלות סחורה</TableHead>
                    <TableHead className="text-right">עלות כוללת משוערת</TableHead>
                    <TableHead className="text-right">שולם</TableHead>
                    <TableHead className="text-right">יתרה</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/import/${row.id}`)}
                    >
                      <TableCell className="font-medium">{row.import_number}</TableCell>
                      <TableCell>{row.supplier_name ?? '—'}</TableCell>
                      <TableCell>{PURCHASE_TYPE_LABELS[row.purchase_type] ?? row.purchase_type}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={statusVariant(row.status)}>
                            {journeyMilestone(row.status)
                              ? `${journeyMilestone(row.status)!.icon} ${journeyMilestone(row.status)!.label}`
                              : IMPORT_STATUS_LABELS[row.status] ?? row.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{journeyProgress(row.status)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>{row.order_date}</TableCell>
                      <TableCell>{row.estimated_arrival_date ?? '—'}</TableCell>
                      <TableCell>{row.ordered_units}</TableCell>
                      <TableCell>{formatCurrency(Number(row.goods_cost_ils))}</TableCell>
                      <TableCell>{formatCurrency(Number(row.estimated_total_cost_ils))}</TableCell>
                      <TableCell>{formatCurrency(Number(row.paid_ils))}</TableCell>
                      <TableCell>{formatCurrency(Number(row.remaining_payment_ils))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {totalCount > IMPORT_PAGE_SIZE && (
            <div className="flex items-center justify-between pt-4">
              <span className="text-sm text-muted-foreground">
                עמוד {page + 1} מתוך {totalPages} · {totalCount} הזמנות
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  הקודם
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  הבא
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateImportOrderDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
};

export const ImportCenter: React.FC = () => (
  <ImportPinGate>
    <ImportCenterContent />
  </ImportPinGate>
);

export default ImportCenter;
