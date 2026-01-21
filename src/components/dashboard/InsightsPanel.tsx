import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingDown, 
  Percent, 
  Package, 
  AlertTriangle, 
  TrendingUp,
  Activity,
  ChevronLeft,
  Loader2,
  Info
} from 'lucide-react';
import { useInsights } from '@/hooks/useInsights';
import { InsightSeverity, InsightType } from '@/types/insights';
import { InsightDetailDrawer } from './InsightDetailDrawer';

interface InsightCardProps {
  title: string;
  summary: string;
  count: number;
  severity: InsightSeverity;
  icon: React.ReactNode;
  onClick: () => void;
  hasData: boolean;
}

const InsightCard: React.FC<InsightCardProps> = ({ 
  title, 
  summary, 
  count, 
  severity, 
  icon, 
  onClick,
  hasData 
}) => {
  const getSeverityColor = (severity: InsightSeverity) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  const getSeverityLabel = (severity: InsightSeverity) => {
    switch (severity) {
      case 'high': return 'קריטי';
      case 'medium': return 'בינוני';
      case 'low': return 'תקין';
    }
  };

  const getCardBorder = (severity: InsightSeverity, hasData: boolean) => {
    if (!hasData || count === 0) return 'border-muted';
    switch (severity) {
      case 'high': return 'border-red-300 border-2';
      case 'medium': return 'border-orange-300';
      case 'low': return 'border-green-200';
    }
  };

  return (
    <Card 
      className={`cursor-pointer hover:shadow-md transition-shadow ${getCardBorder(severity, hasData)}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="p-2 rounded-lg bg-muted">
            {icon}
          </div>
          {hasData && count > 0 && (
            <Badge className={getSeverityColor(severity)}>
              {getSeverityLabel(severity)}
            </Badge>
          )}
        </div>
        <h3 className="font-semibold text-foreground mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{summary}</p>
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-foreground">{count}</span>
          <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
            הצג פירוט
            <ChevronLeft className="h-4 w-4 mr-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export const InsightsPanel: React.FC = () => {
  const { insights, isLoading } = useInsights();
  const [selectedInsight, setSelectedInsight] = useState<InsightType | null>(null);

  const handleCloseDrawer = () => setSelectedInsight(null);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg font-semibold" dir="rtl">
            תובנות חכמות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!insights) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg font-semibold" dir="rtl">
            תובנות חכמות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <Info className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">אין מספיק נתונים לחישוב תובנות</p>
            <p className="text-sm text-muted-foreground mt-1">
              כשתירשם מכירה או קנייה, התובנות יופיעו כאן
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const insightCards = [
    {
      key: 'low_margin' as InsightType,
      ...insights.lowMargin,
      icon: <TrendingDown className="h-5 w-5 text-red-600" />,
    },
    {
      key: 'high_discount' as InsightType,
      ...insights.highDiscount,
      icon: <Percent className="h-5 w-5 text-orange-600" />,
    },
    {
      key: 'dead_stock' as InsightType,
      ...insights.deadStock,
      icon: <Package className="h-5 w-5 text-gray-600" />,
    },
    {
      key: 'stockout_risk' as InsightType,
      ...insights.stockoutRisk,
      icon: <AlertTriangle className="h-5 w-5 text-yellow-600" />,
    },
    {
      key: 'cost_spike' as InsightType,
      ...insights.costSpike,
      icon: <TrendingUp className="h-5 w-5 text-purple-600" />,
    },
    {
      key: 'business_health' as InsightType,
      ...insights.businessHealth,
      icon: <Activity className="h-5 w-5 text-blue-600" />,
    },
  ];

  // Count critical insights
  const criticalCount = insightCards.filter(c => c.severity === 'high' && c.count > 0).length;
  const warningCount = insightCards.filter(c => c.severity === 'medium' && c.count > 0).length;

  return (
    <>
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold" dir="rtl">
              תובנות חכמות
            </CardTitle>
            <div className="flex gap-2">
              {criticalCount > 0 && (
                <Badge variant="destructive">{criticalCount} קריטיים</Badge>
              )}
              {warningCount > 0 && (
                <Badge className="bg-orange-100 text-orange-800">{warningCount} לתשומת לב</Badge>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground" dir="rtl">
            ניתוח אוטומטי של נתוני המלאי והמכירות שלך
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {insightCards.map(card => (
              <InsightCard
                key={card.key}
                title={card.title}
                summary={card.summary}
                count={card.count}
                severity={card.severity}
                icon={card.icon}
                onClick={() => setSelectedInsight(card.key)}
                hasData={card.count > 0 || card.key === 'business_health'}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <InsightDetailDrawer
        isOpen={selectedInsight !== null}
        onClose={handleCloseDrawer}
        insightType={selectedInsight}
        insights={insights}
      />
    </>
  );
};
