
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import { Auth } from "@/pages/Auth";
import { Dashboard } from "@/pages/Dashboard";
import { Inventory } from "@/pages/Inventory";
import { AddProduct } from "@/pages/AddProduct";
import { Reports } from "@/pages/Reports";
import { UserProfile } from "@/pages/UserProfile";
import { Subscriptions } from "@/pages/Subscriptions";
import { BusinessSettings } from "@/pages/BusinessSettings";
import { Unauthorized } from "@/pages/Unauthorized";
import { UserManagement } from "@/pages/UserManagement";
import { AdminPanel } from "@/pages/AdminPanel";
import { AdminDashboard } from "@/pages/AdminDashboard";
import { AdminSettings } from "@/pages/AdminSettings";
import { AdminUserProfile } from "@/pages/admin/UserProfile";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/unauthorized" element={<Unauthorized />} />
              
              {/* Root route - redirect to dashboard */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* Business user routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'OWNER', 'smart_master_user', 'pro_starter_user']}>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'OWNER', 'smart_master_user']}>
                    <Inventory />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/add-product"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'OWNER', 'smart_master_user']}>
                    <AddProduct />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'OWNER', 'smart_master_user']}>
                    <Reports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/subscriptions"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'OWNER']}>
                    <Subscriptions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'OWNER']}>
                    <BusinessSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <UserProfile />
                  </ProtectedRoute>
                }
              />

              {/* Admin routes */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminPanel />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/users"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <UserManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/user/:userId"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminUserProfile />
                  </ProtectedRoute>
                }
              />

              {/* Catch all - redirect to unauthorized */}
              <Route path="*" element={<Navigate to="/unauthorized" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
        <Toaster />
        <Sonner />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
