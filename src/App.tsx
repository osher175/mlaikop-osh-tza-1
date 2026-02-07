
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SmartRedirect } from "@/components/SmartRedirect";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Auth } from "@/pages/Auth";
import { Dashboard } from "@/pages/Dashboard";
import { Inventory } from "@/pages/Inventory";
import { Suppliers } from "@/pages/Suppliers";
import { AddProduct } from "@/pages/AddProduct";
import { Reports } from "@/pages/Reports";
import { UserProfile } from "@/pages/UserProfile";
import { Unauthorized } from "@/pages/Unauthorized";
import { UserManagement } from "@/pages/UserManagement";
import { AdminUserProfile } from "@/pages/admin/UserProfile";
import { Subscriptions } from "@/pages/Subscriptions";
import { BusinessSettings } from "@/pages/BusinessSettings";
import { AdminPanel } from "@/pages/AdminPanel";
import { AdminDashboard } from "@/pages/AdminDashboard";
import { AdminSettings } from "@/pages/AdminSettings";
import StorageManagement from "@/pages/admin/StorageManagement";
import { Procurement } from "@/pages/Procurement";
import { ProcurementDetail } from "@/pages/ProcurementDetail";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
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
              
              {/* Business user routes - admin יכול לגשת לכל הדפים לצורכי ניהול */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'OWNER', 'smart_master_user', 'elite_pilot_user', 'pro_starter_user', 'free_user']}>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'OWNER', 'smart_master_user', 'elite_pilot_user', 'pro_starter_user', 'free_user']}>
                    <Inventory />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/suppliers"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'OWNER', 'smart_master_user', 'elite_pilot_user', 'pro_starter_user', 'free_user']}>
                    <Suppliers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/add-product"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'OWNER', 'smart_master_user', 'elite_pilot_user']}>
                    <AddProduct />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'OWNER', 'smart_master_user', 'elite_pilot_user']}>
                    <Reports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'OWNER', 'smart_master_user', 'elite_pilot_user', 'pro_starter_user', 'free_user']}>
                    <UserProfile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/subscriptions"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'OWNER', 'smart_master_user', 'elite_pilot_user', 'pro_starter_user', 'free_user']}>
                    <Subscriptions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'OWNER', 'smart_master_user', 'elite_pilot_user']}>
                    <BusinessSettings />
                  </ProtectedRoute>
                }
              />

              {/* Procurement routes */}
              <Route
                path="/procurement"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'OWNER', 'smart_master_user', 'elite_pilot_user']}>
                    <Procurement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/procurement/:id"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'OWNER', 'smart_master_user', 'elite_pilot_user']}>
                    <ProcurementDetail />
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
              <Route
                path="/admin/storage"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'OWNER']}>
                    <StorageManagement />
                  </ProtectedRoute>
                }
              />

              {/* Default redirects */}
              <Route path="/" element={<SmartRedirect />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
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
