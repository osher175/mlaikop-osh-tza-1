import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { GoodsReceivingV2 } from '@/components/v2/procurement/GoodsReceivingV2';

export const GoodsReceiving: React.FC = () => (
  <MainLayout>
    <GoodsReceivingV2 />
  </MainLayout>
);
