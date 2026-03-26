import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, TrendingUp, TrendingDown, AlertTriangle, ShieldAlert, Info, CheckCircle2 } from 'lucide-react';
import { BusinessInsight, InsightSeverity } from '../businessInsights/types';

interface BusinessInsightsSectionProps {
  insights: BusinessInsight[];
  isLoading: boolean;
  dateRangeLabel: string;
}

const severityConfig: Record<InsightSeverity, {
  border: string;
  bg: string;
  icon: React.ElementType;
  iconColor: string;
  badge: string;
  badgeText: string;
}> = {
  critical: {
    border: 'border-destructive/30',
    bg: 'bg-destructive/5',
    icon: ShieldAlert,
    iconColor: 'text-destructive',
    badge: 'bg-destructive/10 text-destructive',
    badgeText: 'קריטי',
  },
  warning: {
    border: 'border-yellow-500/30',
    bg: 'bg-yellow-50',
    icon: AlertTriangle,
    iconColor: 'text-yellow-600',
    badge: 'bg-yellow-100 text-yellow-700',
    badgeText: 'אזהרה',
  },
  info: {
    border: 'border-blue-500/30',
    bg: 'bg-blue-50',
    icon: Info,
    iconColor: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-700',
    badgeText: 'מידע',
  },
  positive: {
    border: 'border-green-500/30',
    bg: 'bg-green-50',
    icon: CheckCircle2,
    iconColor: 'text-green-600',
    badge: 'bg-green-100 text-green-700',
    badgeText: 'חיובי',
  },
};

function InsightCard({ insight, isNew }: { insight: BusinessInsight; isNew: boolean }) {
  const config = severityConfig[insight.severity];
  const Icon = config.icon;

  const TrendIcon = insight.changePercent
    ? insight.changePercent > 0 ? TrendingUp : TrendingDown
    : null;

  return (
    <Card className={`${config.border} ${config.bg} transition-all duration-500 hover:shadow-md ${
      isNew ? 'ring-2 ring-primary/30 animate-in fade-in slide-in-from-top-2' : ''
    }`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <Icon className={`h-5 w-5 ${config.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="font-semibold text-foreground text-sm">{insight.title}</h4>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.badge}`}>
                {config.badgeText}
              </span>
              {TrendIcon && insight.changePercent !== undefined && (
                <span className={`flex items-center gap-0.5 text-xs font-medium ${
                  insight.changePercent > 0 ? 'text-green-600' : 'text-destructive'
                }`}>
                  <TrendIcon className="h-3 w-3" />
                  {Math.abs(insight.changePercent).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-2">{insight.description}</p>
            <p className="text-xs text-muted-foreground/80 flex items-center gap-1">
              <Lightbulb className="h-3 w-3" />
              {insight.recommendation}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function BusinessInsightsSection({ insights, isLoading, dateRangeLabel }: BusinessInsightsSectionProps) {
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const prevIdsRef = useRef<string>('');

  // Detect new/changed insights for animation
  useEffect(() => {
    const currentKey = insights.map(i => i.id).sort().join(',');
    if (prevIdsRef.current && prevIdsRef.current !== currentKey) {
      const prevSet = new Set(prevIdsRef.current.split(','));
      const changed = new Set(insights.filter(i => !prevSet.has(i.id)).map(i => i.id));
      if (changed.size > 0) {
        setNewIds(changed);
        const timer = setTimeout(() => setNewIds(new Set()), 2000);
        return () => clearTimeout(timer);
      }
    }
    prevIdsRef.current = currentKey;
  }, [insights]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            תובנות עסקיות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-20 bg-muted rounded-lg" />
            <div className="h-20 bg-muted rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (insights.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            תובנות עסקיות
            <span className="text-xs text-muted-foreground font-normal">
              ({dateRangeLabel})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            אין תובנות מיוחדות לתקופה הנבחרת — הכול נראה תקין ✓
          </p>
        </CardContent>
      </Card>
    );
  }

  const criticalCount = insights.filter(i => i.severity === 'critical').length;
  const warningCount = insights.filter(i => i.severity === 'warning').length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            תובנות עסקיות
            <span className="text-xs text-muted-foreground font-normal">
              ({dateRangeLabel})
            </span>
          </CardTitle>
          <div className="flex items-center gap-2 text-xs">
            {criticalCount > 0 && (
              <span className="bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">
                {criticalCount} קריטי
              </span>
            )}
            {warningCount > 0 && (
              <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                {warningCount} אזהרה
              </span>
            )}
            <span className="text-muted-foreground">
              {insights.length} תובנות
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} isNew={newIds.has(insight.id)} />
        ))}
      </CardContent>
    </Card>
  );
}
