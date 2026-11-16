import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { EmployeesV2 } from '@/components/v2/employees/EmployeesV2';
import { useV2UiEnabled } from '@/lib/v2/uiFlag';
import { Link } from 'react-router-dom';

export const Employees: React.FC = () => {
  const v2 = useV2UiEnabled();
  return (
    <MainLayout>
      {v2 ? <EmployeesV2 /> : (
        <div dir="rtl" className="py-10 text-center">
          <p className="mb-4">עובדים וביצועים זמינים בתצוגת מלאיקו החדשה.</p>
          <Link to="/dashboard" className="text-primary font-semibold">חזרה ללוח הבקרה</Link>
        </div>
      )}
    </MainLayout>
  );
};
