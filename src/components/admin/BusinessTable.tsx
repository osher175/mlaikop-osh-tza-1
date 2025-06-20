
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Building, Users, Mail, TrendingUp } from 'lucide-react';

export const BusinessTable: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: businesses, isLoading } = useQuery({
    queryKey: ['admin-businesses', searchTerm],
    queryFn: async () => {
      let businessQuery = supabase
        .from('businesses')
        .select('*')
        .order('created_at', { ascending: false });

      if (searchTerm) {
        businessQuery = businessQuery.or(`name.ilike.%${searchTerm}%,industry.ilike.%${searchTerm}%,official_email.ilike.%${searchTerm}%`);
      }

      const { data: businessData, error: businessError } = await businessQuery;
      if (businessError) throw businessError;

      // Manually fetch owner profiles
      const businessesWithOwners = [];
      for (const business of businessData || []) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', business.owner_id)
          .single();

        businessesWithOwners.push({
          ...business,
          profiles: profileError ? null : profile
        });
      }

      return businessesWithOwners;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>טוען עסקים...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="w-5 h-5" />
          ניהול עסקים ({businesses?.length || 0})
        </CardTitle>
        <div className="relative">
          <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="חיפוש עסקים..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>שם העסק</TableHead>
                <TableHead>בעלים</TableHead>
                <TableHead>תחום</TableHead>
                <TableHead>אימייל</TableHead>
                <TableHead>עובדים</TableHead>
                <TableHead>הכנסה חודשית</TableHead>
                <TableHead>תאריך הקמה</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {businesses?.map((business) => (
                <TableRow key={business.id}>
                  <TableCell className="font-medium">{business.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">
                        {business.profiles?.first_name} {business.profiles?.last_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {business.industry ? (
                      <Badge variant="outline">{business.industry}</Badge>
                    ) : (
                      <span className="text-gray-400">לא צוין</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Mail className="w-3 h-3 text-gray-400" />
                      <span className="text-sm">{business.official_email || 'לא צוין'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-gray-400" />
                      <span className="text-sm">{business.employee_count || 1}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {business.avg_monthly_revenue ? (
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-green-500" />
                        <span className="text-sm">₪{business.avg_monthly_revenue.toLocaleString()}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">לא צוין</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600">
                      {business.created_at ? new Date(business.created_at).toLocaleDateString('he-IL') : 'לא ידוע'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {!businesses?.length && (
          <div className="text-center py-8 text-gray-500">
            לא נמצאו עסקים
          </div>
        )}
      </CardContent>
    </Card>
  );
};
