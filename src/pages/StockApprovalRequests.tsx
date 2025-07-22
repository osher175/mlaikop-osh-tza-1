
import React from 'react';
import { format } from 'date-fns';
import { Loader2, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { useStockApprovalRequests } from '@/hooks/useStockApprovalRequests';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useSuppliers } from '@/hooks/useSuppliers';

const StockApprovalRequests = () => {
  const { 
    pendingRequests, 
    isLoading, 
    error, 
    approveRequest, 
    rejectRequest 
  } = useStockApprovalRequests();
  
  const { suppliers } = useSuppliers();

  const getSupplierName = (supplierId: string | null) => {
    if (!supplierId) return 'ללא ספק';
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier?.name || 'ספק לא ידוע';
  };

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="mr-2">טוען בקשות אישור...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <span className="mr-2">שגיאה בטעינת הבקשות. נסה שנית מאוחר יותר.</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 rtl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">אישורי מלאי</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-medium">אין בקשות ממתינות לאישור</h3>
              <p className="text-muted-foreground mt-2">
                כל הבקשות טופלו. בקשות חדשות יופיעו כאן כאשר מוצרים יגיעו לכמות אפס.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם המוצר</TableHead>
                  <TableHead>ספק</TableHead>
                  <TableHead>כמות</TableHead>
                  <TableHead>תאריך יצירה</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.product_name}</TableCell>
                    <TableCell>{getSupplierName(request.supplier_id)}</TableCell>
                    <TableCell>
                      <Badge variant="destructive" className="text-xs">
                        {request.quantity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(request.created_at), 'dd/MM/yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="success"
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white ml-2"
                          onClick={() => approveRequest.mutate(request.id)}
                          disabled={approveRequest.isPending}
                        >
                          {approveRequest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'שלח לסוכן'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => rejectRequest.mutate(request.id)}
                          disabled={rejectRequest.isPending}
                        >
                          {rejectRequest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'בטל'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StockApprovalRequests;
