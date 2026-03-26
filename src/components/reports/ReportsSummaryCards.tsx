import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart3, TrendingUp, DollarSign, Package } from 'lucide-react';
import { formatCurrency } from '@/lib/formatCurrency';
import { ReportsData } from '@/types/reports';

interface ReportsSummaryCardsProps {
  reportsData: ReportsData;
}

export const ReportsSummaryCards: React.FC<ReportsSummaryCardsProps> = ({ reportsData }) => {
  return (
    <>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-primary" />
              <div className="mr-4">
                <p className="text-sm font-medium text-muted-foreground">סה"כ נכנסו</p>
                <p className="text-2xl font-bold text-primary">{reportsData.total_added ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-purple-600" />
              <div className="mr-4">
                <p className="text-sm font-medium text-muted-foreground">סה"כ יצאו</p>
                <p className="text-2xl font-bold text-purple-600">{reportsData.total_removed ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-emerald-600" />
              <div className="mr-4">
                <p className="text-sm font-medium text-muted-foreground">שווי מלאי</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(reportsData.total_value)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-blue-600" />
              <div className="mr-4">
                <p className="text-sm font-medium text-muted-foreground">רווח נטו (לאחר מע״מ)</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(reportsData.net_profit)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};
