import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { SupplierReturnsV2 } from '@/components/v2/procurement/SupplierReturnsV2';

export const SupplierReturns: React.FC = () => (
  <MainLayout>
    <SupplierReturnsV2 />
  </MainLayout>
);
