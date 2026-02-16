import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ShoppingCart, Package, Search, ScanLine, MoreVertical, AlertTriangle, Truck, CheckCircle, XCircle, Play, Settings, Users } from 'lucide-react';
import { useProcurementRequests } from '@/hooks/useProcurementRequests';
import { useLowStockProducts } from '@/hooks/useLowStockProducts';
import { useProcurementActions } from '@/hooks/useProcurementActions';
import { ProcurementStatusBadge } from '@/components/procurement/ProcurementStatusBadge';
import { ProcurementDetailDrawer } from '@/components/procurement/ProcurementDetailDrawer';
import { SupplierPairDialog } from '@/components/procurement/SupplierPairDialog';
import { ProcurementSettingsTab } from '@/components/procurement/ProcurementSettingsTab';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQueryClient } from '@tanstack/react-query';

export const Procurement: React.FC = () => {
  const [activeTab, setActiveTab] = useState('shortages');
  const [statusFilter, setStatusFilter] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [pairDialogRequest, setPairDialogRequest] = useState<any>(null);

  const { businessContext } = useBusinessAccess();
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const businessId = businessContext?.business_id;
  const { requests = [], isLoading: requestsLoading } = useProcurementRequests(statusFilter, searchTerm);
  const { products: rawLowStockProducts, isLoading: lowStockLoading } = useLowStockProducts();
  const lowStockProducts = rawLowStockProducts ?? [];
  const { updateStatus, approveRequest } = useProcurementActions();

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });

  const handleScanLowStock = async () => {
    if (!businessId || !user?.id) return;
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('procurement-backfill-low-stock', {
        body: { business_id: businessId, created_by: user.id, default_requested_quantity: 1 },
      });
      if (error) throw error;
      const pairedInfo = data.paired !== undefined
        ? ` (${data.paired} עם זוג ספקים, ${data.unpaired} ללא)`
        : '';
      toast({
        title: 'סריקה הושלמה',
        description: `נוצרו ${data.created} בקשות חדשות${pairedInfo}, ${data.skipped} דולגו (כבר קיימות)`,
      });
      queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock-products'] });
    } catch (err: any) {
      toast({ title: 'שגיאה בסריקה', description: err.message, variant: 'destructive' });
    } finally {
      setScanning(false);
    }
  };

  const openDrawer = (req: any) => {
    setSelectedRequest(req);
    setDrawerOpen(true);
  };

  const getApprovalBadge = (req: any) => {
    if (req.approval_status === 'approved') {
      return <Badge className="bg-green-100 text-green-800 border-green-300">אושר</Badge>;
    }
    if (req.approval_status === 'rejected') {
      return <Badge variant="destructive">נדחה</Badge>;
    }
    // pending
    if (req.supplier_a_id && req.supplier_b_id) {
      return (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            approveRequest.mutate(req.id);
          }}
        >
          <CheckCircle className="h-3 w-3 ml-1" />
          אשר (מוכן לשליחה)
        </Button>
      );
    }
    return (
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-xs"
        onClick={(e) => {
          e.stopPropagation();
          setPairDialogRequest(req);
        }}
      >
        <Users className="h-3 w-3 ml-1" />
        הגדר ספקים
      </Button>
    );
  };

  const getSupplierPairDisplay = (req: any) => {
    if (req.supplier_a_name && req.supplier_b_name) {
      return (
        <span className="text-xs font-medium">
          {req.supplier_a_name} + {req.supplier_b_name}
        </span>
      );
    }
    return (
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-xs text-muted-foreground"
        onClick={(e) => {
          e.stopPropagation();
          setPairDialogRequest(req);
        }}
      >
        לא הוגדר — הגדר
      </Button>
    );
  };

  if (!businessId) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-20" dir="rtl">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-lg">יש לבחור עסק כדי לצפות ברכש</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <ShoppingCart className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">רכש חכם</h1>
              <p className="text-muted-foreground text-sm">ניהול בקשות רכש והצעות מחיר</p>
            </div>
          </div>
          <Button onClick={handleScanLowStock} disabled={scanning}>
            <ScanLine className="h-4 w-4 ml-2" />
            {scanning ? 'סורק...' : 'סרוק חוסרים ופתח בקשות'}
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="shortages">
              <AlertTriangle className="h-4 w-4 ml-1" />
              חוסרים
              {lowStockProducts.length > 0 && (
                <span className="mr-1 bg-destructive text-destructive-foreground rounded-full px-1.5 py-0.5 text-xs font-bold">
                  {lowStockProducts.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="requests">
              <Package className="h-4 w-4 ml-1" />
              בקשות רכש
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 ml-1" />
              הגדרות רכש
            </TabsTrigger>
          </TabsList>

          {/* Tab: Shortages */}
          <TabsContent value="shortages" className="mt-4">
            {lowStockLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : lowStockProducts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <p className="text-muted-foreground text-lg">אין חוסרים כרגע</p>
                  <p className="text-muted-foreground text-sm mt-1">כל המוצרים מעל סף המינימום</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr className="border-b">
                          <th className="text-right p-3 font-medium text-sm">מוצר</th>
                          <th className="text-right p-3 font-medium text-sm">כמות</th>
                          <th className="text-right p-3 font-medium text-sm">סף</th>
                          <th className="text-right p-3 font-medium text-sm">בקשה פתוחה</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lowStockProducts.map(p => (
                          <tr key={p.product_id} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="p-3 text-sm font-medium">{p.product_name}</td>
                            <td className="p-3 text-sm">
                              <span className={p.quantity === 0 ? 'text-destructive font-bold' : 'text-orange-600 font-medium'}>
                                {p.quantity}
                              </span>
                            </td>
                            <td className="p-3 text-sm">{p.low_stock_threshold}</td>
                            <td className="p-3 text-sm">
                              {p.open_request_id ? (
                                <ProcurementStatusBadge status={p.open_request_status!} />
                              ) : (
                                <span className="text-muted-foreground text-xs">אין בקשה — לחץ על סריקה</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab: Requests */}
          <TabsContent value="requests" className="mt-4 space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="סנן לפי סטטוס" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">הכל</SelectItem>
                  <SelectItem value="active">פעילים (טיוטה + בטיפול)</SelectItem>
                  <SelectItem value="draft">טיוטה</SelectItem>
                  <SelectItem value="in_progress">בטיפול</SelectItem>
                  <SelectItem value="ordered_external">הוזמן חיצונית</SelectItem>
                  <SelectItem value="resolved_external">טופל</SelectItem>
                  <SelectItem value="cancelled">בוטל</SelectItem>
                  <SelectItem value="waiting_for_quotes">ממתין להצעות</SelectItem>
                  <SelectItem value="recommended">מומלץ</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="חיפוש לפי שם מוצר או ברקוד..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>

            {/* Table */}
            {requestsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : requests.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-lg">אין בקשות רכש עדיין</p>
                  <Button variant="outline" className="mt-3" onClick={handleScanLowStock} disabled={scanning}>
                    <ScanLine className="h-4 w-4 ml-2" />
                    סרוק חוסרים ופתח בקשות
                  </Button>
                </CardContent>
              </Card>
            ) : isMobile ? (
              <div className="space-y-3">
                {requests.map(req => (
                  <Card key={req.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openDrawer(req)}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-base truncate flex-1">{req.products?.name || 'מוצר'}</h3>
                        <ProcurementStatusBadge status={req.status} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <span>כמות: {req.requested_quantity}</span>
                        <span>{formatDate(req.updated_at)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">ספקים:</span>
                        {getSupplierPairDisplay(req)}
                      </div>
                      <div className="mt-2">{getApprovalBadge(req)}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr className="border-b">
                          <th className="text-right p-3 font-medium text-sm">מוצר</th>
                          <th className="text-right p-3 font-medium text-sm">כמות</th>
                          <th className="text-right p-3 font-medium text-sm">סטטוס</th>
                          <th className="text-right p-3 font-medium text-sm">זוג ספקים</th>
                          <th className="text-right p-3 font-medium text-sm">אישור</th>
                          <th className="text-right p-3 font-medium text-sm">עודכן</th>
                          <th className="text-right p-3 font-medium text-sm">פעולות</th>
                        </tr>
                      </thead>
                      <tbody>
                        {requests.map(req => (
                          <tr
                            key={req.id}
                            className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={() => openDrawer(req)}
                          >
                            <td className="p-3 text-sm font-medium">{req.products?.name || '-'}</td>
                            <td className="p-3 text-sm">{req.requested_quantity}</td>
                            <td className="p-3"><ProcurementStatusBadge status={req.status} /></td>
                            <td className="p-3">{getSupplierPairDisplay(req)}</td>
                            <td className="p-3">{getApprovalBadge(req)}</td>
                            <td className="p-3 text-sm">{formatDate(req.updated_at)}</td>
                            <td className="p-3" onClick={e => e.stopPropagation()}>
                              {!['resolved_external', 'cancelled', 'ordered'].includes(req.status) && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {req.status === 'draft' && (
                                      <DropdownMenuItem onClick={() => updateStatus.mutate({ requestId: req.id, status: 'in_progress' })}>
                                        <Play className="h-4 w-4 ml-2" />
                                        התחל טיפול
                                      </DropdownMenuItem>
                                    )}
                                    {['draft', 'in_progress'].includes(req.status) && (
                                      <DropdownMenuItem onClick={() => updateStatus.mutate({ requestId: req.id, status: 'ordered_external' })}>
                                        <Truck className="h-4 w-4 ml-2" />
                                        הוזמן חיצונית
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => updateStatus.mutate({ requestId: req.id, status: 'resolved_external' })}>
                                      <CheckCircle className="h-4 w-4 ml-2" />
                                      טופל
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => updateStatus.mutate({ requestId: req.id, status: 'cancelled' })} className="text-destructive">
                                      <XCircle className="h-4 w-4 ml-2" />
                                      ביטול
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab: Settings */}
          <TabsContent value="settings" className="mt-4">
            <ProcurementSettingsTab />
          </TabsContent>
        </Tabs>

        {/* Detail Drawer */}
        <ProcurementDetailDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          request={selectedRequest}
        />

        {/* Supplier Pair Dialog */}
        {pairDialogRequest && (
          <SupplierPairDialog
            open={!!pairDialogRequest}
            onOpenChange={(open) => { if (!open) setPairDialogRequest(null); }}
            request={pairDialogRequest}
          />
        )}
      </div>
    </MainLayout>
  );
};
