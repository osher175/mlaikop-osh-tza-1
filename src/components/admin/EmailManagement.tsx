
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Mail, Search, Calendar, User, Download, Filter, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface EmailRecord {
  id: string;
  email: string;
  user_id: string | null;
  created_at: string;
}

export const EmailManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Debounce search term
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: emailRecords, isLoading, refetch } = useQuery({
    queryKey: ['admin-emails', debouncedSearchTerm],
    queryFn: async () => {
      console.log('=== Admin Email Management ===');
      console.log('Search term:', debouncedSearchTerm);

      let query = supabase
        .from('emails')
        .select('*')
        .order('created_at', { ascending: false });

      if (debouncedSearchTerm.trim()) {
        query = query.ilike('email', `%${debouncedSearchTerm.trim()}%`);
      }

      const { data, error } = await query.limit(50);

      if (error) {
        console.error('Email fetch error:', error);
        throw error;
      }

      console.log('Found emails:', data?.length || 0);
      return data as EmailRecord[];
    },
  });

  const exportEmails = async () => {
    try {
      const { data, error } = await supabase
        .from('emails')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Create CSV content
      const csvContent = [
        ['Email', 'User ID', 'Created At'].join(','),
        ...(data || []).map(record => [
          `"${record.email}"`,
          record.user_id || 'N/A',
          new Date(record.created_at).toLocaleString('he-IL')
        ].join(','))
      ].join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `emails_export_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      toast.success('רשימת המיילים יוצאה בהצלחה');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('שגיאה בייצוא רשימת המיילים');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900 font-rubik" dir="rtl">
          ניהול מיילים
        </CardTitle>
        <p className="text-sm text-gray-600 font-rubik" dir="rtl">
          צפייה וניהול של כל כתובות המייל שנרשמו במערכת
        </p>
      </CardHeader>
      <CardContent className="space-y-6" dir="rtl">
        {/* Search and Actions */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 right-0 pl-3 flex items-center pointer-events-none">
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              ) : (
                <Search className="w-4 h-4 text-gray-400" />
              )}
            </div>
            <Input
              type="text"
              placeholder="חפש לפי כתובת מייל..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="font-rubik pr-10"
            />
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={exportEmails}
              variant="outline"
              className="font-rubik"
            >
              <Download className="w-4 h-4 ml-2" />
              ייצא CSV
            </Button>
            <Button 
              onClick={() => refetch()}
              variant="outline"
              className="font-rubik"
            >
              <Filter className="w-4 h-4 ml-2" />
              רענן
            </Button>
          </div>
        </div>

        {/* Stats */}
        {emailRecords && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-2 border-turquoise/20">
              <CardContent className="p-4 text-center">
                <Mail className="w-8 h-8 text-turquoise mx-auto mb-2" />
                <p className="text-2xl font-bold font-rubik">{emailRecords.length}</p>
                <p className="text-sm text-gray-600 font-rubik">מיילים בתוצאות</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Email Records */}
        {emailRecords && emailRecords.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-turquoise" />
              <h3 className="text-lg font-semibold font-rubik">
                רשימת מיילים ({emailRecords.length})
              </h3>
            </div>

            <div className="space-y-3">
              {emailRecords.map((record) => (
                <Card key={record.id} className="border-2 border-gray-200 hover:border-turquoise transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-turquoise/10 rounded-full flex items-center justify-center">
                          <Mail className="w-5 h-5 text-turquoise" />
                        </div>
                        <div>
                          <h4 className="font-semibold font-rubik text-lg">
                            {record.email}
                          </h4>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            {record.user_id && (
                              <div className="flex items-center gap-1">
                                <User className="w-4 h-4" />
                                <span className="font-rubik">משתמש רשום</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span className="font-rubik">
                                {new Date(record.created_at).toLocaleDateString('he-IL')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Badge className={`font-rubik ${
                          record.user_id 
                            ? 'bg-green-500 text-white' 
                            : 'bg-gray-500 text-white'
                        }`}>
                          {record.user_id ? 'משתמש פעיל' : 'מייל בלבד'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {emailRecords && emailRecords.length === 0 && !isLoading && (
          <div className="text-center py-8 text-gray-500">
            <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="font-rubik">
              {debouncedSearchTerm.trim() 
                ? `לא נמצאו מיילים התואמים לחיפוש "${debouncedSearchTerm}"`
                : 'אין מיילים רשומים במערכת'
              }
            </p>
            <p className="text-sm font-rubik">
              מיילים יתווספו אוטומטית כאשר משתמשים חדשים נרשמים
            </p>
          </div>
        )}

        {!debouncedSearchTerm.trim() && !emailRecords && !isLoading && (
          <div className="text-center py-8 text-gray-500">
            <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="font-rubik">הכנס מונח חיפוש כדי לחפש במיילים</p>
            <p className="text-sm font-rubik">או השאר ריק כדי לראות את כל המיילים</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
