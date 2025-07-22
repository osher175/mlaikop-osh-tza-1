
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useSuppliers } from '@/hooks/useSuppliers';
import { AddSupplierDialog } from '@/components/inventory/AddSupplierDialog';
import { EditSupplierDialog } from '@/components/inventory/EditSupplierDialog';
import { DeleteSupplierDialog } from '@/components/inventory/DeleteSupplierDialog';
import { Plus, Search, Users, Phone, Mail, UserCheck, Edit, Trash } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Supplier = Database['public']['Tables']['suppliers']['Row'];

export const Suppliers: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [showEditSupplier, setShowEditSupplier] = useState(false);
  const [showDeleteSupplier, setShowDeleteSupplier] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const { suppliers, isLoading } = useSuppliers();

  const filteredSuppliers = suppliers.filter((supplier) =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (supplier.agent_name && supplier.agent_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleEditSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowEditSupplier(true);
  };

  const handleDeleteSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowDeleteSupplier(true);
  };

  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-turquoise" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">רשימת ספקים</h1>
              <p className="text-gray-600">ניהול ספקים ואנשי קשר</p>
            </div>
          </div>
        </div>

        {/* Search and Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">חיפוש וניהול ספקים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="חיפוש לפי שם ספק או שם סוכן..."
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
              ספקים ({filteredSuppliers.length})
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
                  {searchTerm 
                    ? 'נסה לשנות את מילות החיפוש'
                    : 'התחל בהוספת הספק הראשון שלך'
                  }
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
                        <TableHead className="text-right">שם הסוכן</TableHead>
                        <TableHead className="text-right">טלפון</TableHead>
                        <TableHead className="text-right">אימייל</TableHead>
                        <TableHead className="text-right">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSuppliers.map((supplier) => (
                        <ContextMenu key={supplier.id}>
                          <ContextMenuTrigger asChild>
                            <TableRow className="cursor-context-menu">
                              <TableCell className="font-medium">
                                {supplier.name}
                              </TableCell>
                              <TableCell>
                                {supplier.agent_name ? (
                                  <div className="flex items-center gap-2">
                                    <UserCheck className="w-4 h-4 text-green-600" />
                                    {supplier.agent_name}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">לא צוין</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {supplier.phone ? (
                                  <div className="flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-blue-600" />
                                    {supplier.phone}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">לא צוין</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {supplier.contact_email ? (
                                  <div className="flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-purple-600" />
                                    {supplier.contact_email}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">לא צוין</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditSupplier(supplier)}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDeleteSupplier(supplier)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem onClick={() => handleEditSupplier(supplier)}>
                              <Edit className="w-4 h-4 mr-2" />
                              ערוך ספק
                            </ContextMenuItem>
                            <ContextMenuItem 
                              onClick={() => handleDeleteSupplier(supplier)}
                              className="text-red-600"
                            >
                              <Trash className="w-4 h-4 mr-2" />
                              מחק ספק
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {filteredSuppliers.map((supplier) => (
                    <ContextMenu key={supplier.id}>
                      <ContextMenuTrigger asChild>
                        <Card className="border-l-4 border-l-turquoise cursor-context-menu">
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-lg">{supplier.name}</h3>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">ספק</Badge>
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleEditSupplier(supplier)}
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleDeleteSupplier(supplier)}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <UserCheck className="w-4 h-4 text-green-600" />
                                  <span className="text-sm text-gray-600">סוכן:</span>
                                  <span className="text-sm">
                                    {supplier.agent_name || 'לא צוין'}
                                  </span>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <Phone className="w-4 h-4 text-blue-600" />
                                  <span className="text-sm text-gray-600">טלפון:</span>
                                  <span className="text-sm">
                                    {supplier.phone || 'לא צוין'}
                                  </span>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <Mail className="w-4 h-4 text-purple-600" />
                                  <span className="text-sm text-gray-600">אימייל:</span>
                                  <span className="text-sm">
                                    {supplier.contact_email || 'לא צוין'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => handleEditSupplier(supplier)}>
                          <Edit className="w-4 h-4 mr-2" />
                          ערוך ספק
                        </ContextMenuItem>
                        <ContextMenuItem 
                          onClick={() => handleDeleteSupplier(supplier)}
                          className="text-red-600"
                        >
                          <Trash className="w-4 h-4 mr-2" />
                          מחק ספק
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Dialogs */}
        <AddSupplierDialog
          open={showAddSupplier}
          onOpenChange={setShowAddSupplier}
        />
        
        <EditSupplierDialog
          open={showEditSupplier}
          onOpenChange={setShowEditSupplier}
          supplier={selectedSupplier}
        />
        
        <DeleteSupplierDialog
          open={showDeleteSupplier}
          onOpenChange={setShowDeleteSupplier}
          supplier={selectedSupplier}
        />
      </div>
    </MainLayout>
  );
};
