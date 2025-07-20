
import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useSuppliers } from '@/hooks/useSuppliers';
import { AddSupplierDialog } from '@/components/suppliers/AddSupplierDialog';
import { Plus, Users, Search, Edit, Trash, Mail, Phone, User } from 'lucide-react';

// Define local types
interface Supplier {
  id: string;
  name: string;
  contact_email?: string;
  phone?: string;
  sales_agent_name?: string;
  sales_agent_phone?: string;
  business_id?: string;
  created_at?: string;
  updated_at?: string;
}

export const Suppliers: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const { suppliers, isLoading } = useSuppliers();

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (supplier.contact_email && supplier.contact_email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (supplier.sales_agent_name && supplier.sales_agent_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-turquoise" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">ספקים</h1>
              <p className="text-gray-600">ניהול פרטי הספקים והקשר איתם</p>
            </div>
          </div>
        </div>

        {/* Search and Add Button */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">חיפוש וניהול ספקים</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="חפש ספקים..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Button 
                onClick={() => setShowAddSupplier(true)}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                הוסף ספק חדש
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Suppliers Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              רשימת ספקים ({filteredSuppliers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-turquoise mx-auto"></div>
                <p className="mt-2 text-gray-600">טוען ספקים...</p>
              </div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {searchTerm ? 'לא נמצאו ספקים' : 'אין ספקים'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {searchTerm ? 'נסה לשנות את מונחי החיפוש' : 'התחל בהוספת הספק הראשון שלך'}
                </p>
                {!searchTerm && (
                  <Button onClick={() => setShowAddSupplier(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    הוסף ספק ראשון
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">שם הספק</TableHead>
                        <TableHead className="text-right">פרטי קשר</TableHead>
                        <TableHead className="text-right">נציג מכירות</TableHead>
                        <TableHead className="text-right">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSuppliers.map((supplier) => (
                        <TableRow key={supplier.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">
                                {supplier.name}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {supplier.contact_email && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Mail className="w-4 h-4 text-gray-400" />
                                  <span>{supplier.contact_email}</span>
                                </div>
                              )}
                              {supplier.phone && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Phone className="w-4 h-4 text-gray-400" />
                                  <span>{supplier.phone}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {supplier.sales_agent_name && (
                                <div className="flex items-center gap-2 text-sm">
                                  <User className="w-4 h-4 text-gray-400" />
                                  <span>{supplier.sales_agent_name}</span>
                                </div>
                              )}
                              {supplier.sales_agent_phone && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Phone className="w-4 h-4 text-gray-400" />
                                  <span>{supplier.sales_agent_phone}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline">
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
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
                  {filteredSuppliers.map((supplier) => (
                    <Card key={supplier.id} className="border-l-4 border-l-turquoise">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Badge variant="secondary" className="text-base">
                              {supplier.name}
                            </Badge>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline">
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <h4 className="font-medium text-sm text-gray-700">פרטי קשר:</h4>
                            <div className="space-y-1">
                              {supplier.contact_email && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Mail className="w-4 h-4 text-gray-400" />
                                  <span>{supplier.contact_email}</span>
                                </div>
                              )}
                              {supplier.phone && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Phone className="w-4 h-4 text-gray-400" />
                                  <span>{supplier.phone}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {(supplier.sales_agent_name || supplier.sales_agent_phone) && (
                            <div className="space-y-2">
                              <h4 className="font-medium text-sm text-gray-700">נציג מכירות:</h4>
                              <div className="space-y-1">
                                {supplier.sales_agent_name && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <User className="w-4 h-4 text-gray-400" />
                                    <span>{supplier.sales_agent_name}</span>
                                  </div>
                                )}
                                {supplier.sales_agent_phone && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Phone className="w-4 h-4 text-gray-400" />
                                    <span>{supplier.sales_agent_phone}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Add Supplier Dialog */}
        <AddSupplierDialog
          open={showAddSupplier}
          onOpenChange={setShowAddSupplier}
        />
      </div>
    </MainLayout>
  );
};
