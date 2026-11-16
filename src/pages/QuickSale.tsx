import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { QuickSaleV2 } from '@/components/v2/sale/QuickSaleV2';
import { useV2UiEnabled } from '@/lib/v2/uiFlag';
import { Link } from 'react-router-dom';

export const QuickSale: React.FC = () => {
  const v2 = useV2UiEnabled();
  return (
    <MainLayout>
      {v2 ? <QuickSaleV2 /> : (
        <div dir="rtl" className="py-10 text-center">
          <p className="mb-4">מכירה מהירה זמינה בתצוגת מלאיקו החדשה.</p>
          <Link to="/inventory" className="text-primary font-semibold">חזרה למלאי</Link>
        </div>
      )}
    </MainLayout>
  );
};
