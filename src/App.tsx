import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/hooks/useAuth';
import { SubscriptionGuard } from '@/components/subscription/SubscriptionGuard';
import { Dashboard } from '@/pages/Dashboard';
import { Inventory } from '@/pages/Inventory';
import { Reports } from '@/pages/Reports';
import { Settings } from '@/pages/Settings';
import { Auth } from '@/pages/Auth';
import { Subscribe } from '@/pages/Subscribe';
import { NotificationManagementPage as NotificationManagement } from '@/pages/NotificationManagementPage';
import { Suppliers } from '@/pages/Suppliers';
import { Subscriptions } from '@/pages/Subscriptions';
import { UserManagement } from '@/pages/UserManagement';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/subscribe" element={<Subscribe />} />
            
            {/* Protected routes that require subscription */}
            <Route path="/" element={
              <SubscriptionGuard>
                <Dashboard />
              </SubscriptionGuard>
            } />
            <Route path="/inventory" element={
              <SubscriptionGuard>
                <Inventory />
              </SubscriptionGuard>
            } />
            <Route path="/reports" element={
              <SubscriptionGuard>
                <Reports />
              </SubscriptionGuard>
            } />
            <Route path="/suppliers" element={
              <SubscriptionGuard>
                <Suppliers />
              </SubscriptionGuard>
            } />
            <Route path="/notification-management" element={
              <SubscriptionGuard>
                <NotificationManagement />
              </SubscriptionGuard>
            } />
            
            {/* Routes that don't require subscription */}
            <Route path="/settings" element={
              <SubscriptionGuard requiresSubscription={false}>
                <Settings />
              </SubscriptionGuard>
            } />
            <Route path="/subscriptions" element={
              <SubscriptionGuard requiresSubscription={false}>
                <Subscriptions />
              </SubscriptionGuard>
            } />
            <Route path="/user-management" element={
              <SubscriptionGuard requiresSubscription={false}>
                <UserManagement />
              </SubscriptionGuard>
            } />
            
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
          <Toaster />
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
