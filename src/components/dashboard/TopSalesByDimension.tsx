import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Medal, Award, Star, Circle, AlertCircle } from 'lucide-react';
import { useSalesByDimension } from '@/hooks/useSalesByDimension';
import { formatCurrency } from '@/lib/formatCurrency';
import { SALES_DIMENSIONS, getDimensionConfig } from '@/types/salesDimensions';
import type { SalesDimension } from '@/types/salesDimensions';

const rankIcons = [Trophy, Medal, Award, Star, Circle];
const rankColors = ['text-yellow-500', 'text-muted-foreground', 'text-amber-600', 'text-primary', 'text-green-600'];

export const TopSalesByDimension: React.FC = () => {
  const [dimension, setDimension] = useState<SalesDimension>('product');
  const { items, isLoading, isFetching } = useSalesByDimension(dimension);
  const [changedKeys, setChangedKeys] = useState<Set<string>>(new Set());
  const prevDataRef = useRef<string>('');

  const config = getDimensionConfig(dimension);

  // Detect changes for highlight animation
  useEffect(() => {
    const newKey = JSON.stringify(items.map(i => `${i.key}:${i.quantity_sold}:${i.revenue}`));
    if (prevDataRef.current && prevDataRef.current !== newKey) {
      const newSet = new Set(items.map(i => i.key));
      setChangedKeys(newSet);
      const timer = setTimeout(() => setChangedKeys(new Set()), 1500);
      return () => clearTimeout(timer);
    }
    prevDataRef.current = newKey;
  }, [items]);

  const hasData = items.length > 0;

  return (
    <Card className={`w-full transition-all duration-300 ${isFetching && !isLoading ? 'opacity-90' : ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-semibold text-foreground" dir="rtl">
              {config.title}
            </CardTitle>
            <div className="text-sm text-muted-foreground" dir="rtl">
              {config.subtitle}
            </div>
          </div>
          <Select
            value={dimension}
            onValueChange={(val) => setDimension(val as SalesDimension)}
            dir="rtl"
          >
            <SelectTrigger className="w-[120px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SALES_DIMENSIONS.map((dim) => (
                <SelectItem key={dim.value} value={dim.value}>
                  {dim.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-muted-foreground animate-pulse">טוען נתונים...</div>
          </div>
        ) : !hasData ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-3" />
            <div className="text-muted-foreground mb-2 text-lg">{config.emptyMessage}</div>
            <div className="text-sm text-muted-foreground">
              כאן יוצגו הנתונים המובילים לפי {config.label}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {items.slice(0, 5).map((item, index) => {
              const IconComponent = rankIcons[index] ?? Circle;
              const iconColor = rankColors[index] ?? 'text-muted-foreground';
              const isChanged = changedKeys.has(item.key);

              return (
                <div
                  key={item.key}
                  className={`flex items-center justify-between p-3 bg-muted rounded-lg transition-all duration-500 ${
                    isChanged ? 'ring-2 ring-primary/40 bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0" dir="rtl">
                    <IconComponent className={`w-6 h-6 flex-shrink-0 ${iconColor}`} />
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-foreground truncate">{item.label}</span>
                      <span className="text-sm text-muted-foreground">
                        {item.quantity_sold} יחידות נמכרו
                      </span>
                    </div>
                  </div>
                  <div className="text-left flex-shrink-0 mr-2" dir="ltr">
                    <div className="text-lg font-bold text-primary">
                      {formatCurrency(item.revenue)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
