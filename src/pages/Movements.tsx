import React from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { MovementsV2 } from '@/components/v2/movements/MovementsV2';
import { useV2UiEnabled } from '@/lib/v2/uiFlag';

export const Movements: React.FC = () => {
  const v2 = useV2UiEnabled();
  return (
    <MainLayout>
      {v2 ? <MovementsV2 /> : (
        <div dir="rtl" className="py-10 text-center">
          <p className="mb-4">יומן תנועות המלאי זמין בתצוגת מלאיקו החדשה.</p>
          <Link to="/inventory" className="text-primary font-semibold">חזרה למלאי</Link>
        </div>
      )}
    </MainLayout>
  );
};
