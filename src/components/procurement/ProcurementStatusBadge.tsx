import React from 'react';
import { Badge } from '@/components/ui/badge';

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: 'טיוטה', className: 'bg-gray-100 text-gray-700 border-gray-300' },
  in_progress: { label: 'בטיפול', className: 'bg-blue-100 text-blue-700 border-blue-300' },
  waiting_for_quotes: { label: 'ממתין להצעות', className: 'bg-blue-100 text-blue-700 border-blue-300' },
  quotes_received: { label: 'הצעות התקבלו', className: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  recommended: { label: 'מומלץ', className: 'bg-purple-100 text-purple-700 border-purple-300' },
  waiting_for_approval: { label: 'ממתין לאישור', className: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  approved: { label: 'מאושר', className: 'bg-green-100 text-green-700 border-green-300' },
  ordered: { label: 'הוזמן', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  ordered_external: { label: 'הוזמן חיצונית', className: 'bg-teal-100 text-teal-800 border-teal-300' },
  resolved_external: { label: 'טופל', className: 'bg-green-100 text-green-800 border-green-300' },
  cancelled: { label: 'בוטל', className: 'bg-red-100 text-red-700 border-red-300' },
};

const urgencyConfig: Record<string, { label: string; className: string }> = {
  low: { label: 'נמוכה', className: 'bg-gray-100 text-gray-600' },
  normal: { label: 'רגילה', className: 'bg-blue-50 text-blue-600' },
  high: { label: 'דחופה', className: 'bg-red-100 text-red-700' },
};

const triggerConfig: Record<string, { label: string; className: string }> = {
  out_of_stock: { label: 'אזל מהמלאי', className: 'bg-red-50 text-red-600' },
  below_threshold: { label: 'מתחת לסף', className: 'bg-yellow-50 text-yellow-600' },
  manual: { label: 'ידני', className: 'bg-gray-50 text-gray-600' },
};

export const ProcurementStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-600' };
  return <Badge variant="outline" className={`${config.className} text-xs`}>{config.label}</Badge>;
};

export const UrgencyBadge: React.FC<{ urgency: string }> = ({ urgency }) => {
  const config = urgencyConfig[urgency] || urgencyConfig.normal;
  return <Badge variant="outline" className={`${config.className} text-xs`}>{config.label}</Badge>;
};

export const TriggerBadge: React.FC<{ trigger: string }> = ({ trigger }) => {
  const config = triggerConfig[trigger] || { label: trigger, className: 'bg-gray-50 text-gray-600' };
  return <Badge variant="outline" className={`${config.className} text-xs`}>{config.label}</Badge>;
};
