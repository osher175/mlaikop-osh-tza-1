
import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useSupplierInvoices } from '@/hooks/useSupplierInvoices';
import { AddSupplierInvoiceDialog } from '@/components/supplier-invoices/AddSupplierInvoiceDialog';
import { DeleteSupplierInvoiceDialog } from '@/components/supplier-invoices/DeleteSupplierInvoiceDialog';
import { Plus, Receipt, Eye, Trash, FileText, Download } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type SupplierInvoice = Database['public']['Tables']['supplier_invoices']['Row'];

interface SupplierInvoiceWithSupplier extends SupplierInvoice {
  supplier: {
    name: string;
  } | null;
}

export const SupplierInvoices: React.FC = () => {
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [showDeleteInvoice, setShowDeleteInvoice] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<SupplierInvoice | null>(null);
  const { invoices, isLoading } = useSupplierInvoices();

  const handleDeleteInvoice = (invoice: SupplierInvoice) => {
    setSelectedInvoice(invoice);
    setShowDeleteInvoice(true);
  };

  const handleViewFile = (fileUrl: string) => {
    window.open(fileUrl, '_blank');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('he-IL');
  };

  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <Receipt className="w-8 h-8 text-turquoise" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">חשבוניות ספקים</h1>
              <p className="text-gray-600">ניהול וצפייה בחשבוניות מהספקים</p>
            </div>
          </div>
        </div>

        {/* Add Invoice Button */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">הוסף חשבונית חדשה</CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => setShowAddInvoice(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              הוסף חשבונית
            </Button>
          </CardContent>
        </Card>

        {/* Invoices Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              חשבוניות ({invoices.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-turquoise mx-auto"></div>
                <p className="mt-2 text-gray-600">טוען חשבוניות...</p>
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-8">
                <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  אין חשבוניות
                </h3>
                <p className="text-gray-600 mb-4">
                  התחל בהוספת החשבונית הראשונה שלך
                </p>
                <Button onClick={() => setShowAddInvoice(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  הוסף חשבונית ראשונה
                </Button>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">תאריך</TableHead>
                        <TableHead className="text-right">ספק</TableHead>
                        <TableHead className="text-right">סכום</TableHead>
                        <TableHead className="text-right">קובץ מצורף</TableHead>
                        <TableHead className="text-right">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(invoices as SupplierInvoiceWithSupplier[]).map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">
                            {formatDate(invoice.invoice_date)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {invoice.supplier?.name || 'לא ידוע'}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-green-600">
                              {formatCurrency(Number(invoice.amount))}
                            </span>
                          </TableCell>
                          <TableCell>
                            {invoice.file_url ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewFile(invoice.file_url!)}
                                className="flex items-center gap-2"
                              >
                                <FileText className="w-4 h-4" />
                                צפה
                              </Button>
                            ) : (
                              <span className="text-gray-400">אין קובץ</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {invoice.file_url && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleViewFile(invoice.file_url!)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteInvoice(invoice)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {(invoices as SupplierInvoiceWithSupplier[]).map((invoice) => (
                    <Card key={invoice.id} className="border-l-4 border-l-turquoise">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-lg">
                              {formatDate(invoice.invoice_date)}
                            </h3>
                            <div className="flex items-center gap-2">
                              {invoice.file_url && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleViewFile(invoice.file_url!)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteInvoice(invoice)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">ספק:</span>
                              <Badge variant="outline">
                                {invoice.supplier?.name || 'לא ידוע'}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">סכום:</span>
                              <span className="text-lg font-semibold text-green-600">
                                {formatCurrency(Number(invoice.amount))}
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">קובץ מצורף:</span>
                              {invoice.file_url ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleViewFile(invoice.file_url!)}
                                  className="flex items-center gap-2"
                                >
                                  <FileText className="w-4 h-4" />
                                  צפה בקובץ
                                </Button>
                              ) : (
                                <span className="text-sm text-gray-400">אין קובץ</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Dialogs */}
        <AddSupplierInvoiceDialog
          open={showAddInvoice}
          onOpenChange={setShowAddInvoice}
        />
        
        <DeleteSupplierInvoiceDialog
          open={showDeleteInvoice}
          onOpenChange={setShowDeleteInvoice}
          invoice={selectedInvoice}
        />
      </div>
    </MainLayout>
  );
};
