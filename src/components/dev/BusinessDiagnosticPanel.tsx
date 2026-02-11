import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { isValidUUID } from '@/lib/utils/businessId';

/**
 * Dev-only diagnostic panel. Only renders when import.meta.env.DEV is true.
 * Shows current user ID, active business ID, and all linked businesses.
 */
export const BusinessDiagnosticPanel: React.FC = () => {
  if (!import.meta.env.DEV) return null;

  const { user } = useAuth();
  const { activeBusinessId, businesses, isLoading } = useActiveBusiness();

  return (
    <div
      dir="ltr"
      className="fixed bottom-2 left-2 z-[9999] bg-background border border-border rounded-lg shadow-lg p-3 text-xs max-w-xs opacity-80 hover:opacity-100 transition-opacity"
    >
      <h4 className="font-bold mb-1 text-foreground">🛠 Dev Diagnostics</h4>
      <div className="space-y-1 text-muted-foreground">
        <div>
          <span className="font-medium text-foreground">User ID:</span>{' '}
          <code className="text-[10px]">{user?.id ?? 'N/A'}</code>
        </div>
        <div>
          <span className="font-medium text-foreground">Active Business:</span>{' '}
          <code className={`text-[10px] ${activeBusinessId && isValidUUID(activeBusinessId) ? 'text-green-600' : 'text-destructive'}`}>
            {activeBusinessId ?? 'NONE'}
          </code>
          {activeBusinessId && !isValidUUID(activeBusinessId) && (
            <span className="text-destructive ml-1">⚠ INVALID UUID</span>
          )}
        </div>
        <div>
          <span className="font-medium text-foreground">Businesses ({isLoading ? '…' : businesses.length}):</span>
          {businesses.length === 0 && !isLoading && <span className="text-destructive ml-1">None</span>}
          <ul className="mt-0.5 ml-2">
            {businesses.map((b) => (
              <li key={b.business_id} className="text-[10px]">
                {b.business_name} — {b.user_role} {b.is_owner ? '(owner)' : ''}
                <code className="ml-1 text-muted-foreground">{b.business_id.slice(0, 8)}…</code>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
