
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { Dashboard } from "./pages/Dashboard";
import { Auth } from "./pages/Auth";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { Subscriptions } from "./pages/Subscriptions";
import { Inventory } from "./pages/Inventory";
import { AddProduct } from "./pages/AddProduct";
import { Reports } from "./pages/Reports";
import { UserManagement } from "./pages/UserManagement";
import { BusinessSettings } from "./pages/BusinessSettings";
import { UserProfile } from "./pages/UserProfile";
import { AdminPanel } from "./pages/AdminPanel";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AdminSettings } from "./pages/AdminSettings";
import { OnboardingDecision } from "./pages/OnboardingDecision";
import { CreateBusiness } from "./pages/CreateBusiness";
import { JoinBusiness } from "./pages/JoinBusiness";
import { Unauthorized } from "./pages/Unauthorized";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { OnboardingGuard } from "./components/OnboardingGuard";
import { useUserRole } from "./hooks/useUserRole";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes - no auth required */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            
            {/* Onboarding Routes - only for business users */}
            <Route 
              path="/onboarding" 
              element={
                <ProtectedRoute allowedRoles={['free_user', 'pro_starter_user', 'smart_master_user', 'elite_pilot_user', 'OWNER']}>
                  <OnboardingDecision />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/create-business" 
              element={
                <ProtectedRoute allowedRoles={['free_user', 'pro_starter_user', 'smart_master_user', 'elite_pilot_user', 'OWNER']}>
                  <CreateBusiness />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/join-business" 
              element={
                <ProtectedRoute allowedRoles={['free_user', 'pro_starter_user', 'smart_master_user', 'elite_pilot_user', 'OWNER']}>
                  <JoinBusiness />
                </ProtectedRoute>
              } 
            />
            
            {/* Admin Routes - only for platform admins */}
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
            
            {/* Business Routes - only for business users */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['free_user', 'pro_starter_user', 'smart_master_user', 'elite_pilot_user', 'OWNER']}>
                  <OnboardingGuard>
                    <Dashboard />
                  </OnboardingGuard>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/inventory" 
              element={
                <ProtectedRoute allowedRoles={['free_user', 'pro_starter_user', 'smart_master_user', 'elite_pilot_user', 'OWNER']}>
                  <OnboardingGuard>
                    <Inventory />
                  </OnboardingGuard>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/add-product" 
              element={
                <ProtectedRoute allowedRoles={['smart_master_user', 'elite_pilot_user', 'OWNER']}>
                  <OnboardingGuard>
                    <AddProduct />
                  </OnboardingGuard>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports" 
              element={
                <ProtectedRoute allowedRoles={['smart_master_user', 'elite_pilot_user', 'OWNER']}>
                  <OnboardingGuard>
                    <Reports />
                  </OnboardingGuard>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute allowedRoles={['free_user', 'pro_starter_user', 'smart_master_user', 'elite_pilot_user', 'OWNER']}>
                  <OnboardingGuard>
                    <BusinessSettings />
                  </OnboardingGuard>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/subscriptions" 
              element={
                <ProtectedRoute allowedRoles={['free_user', 'pro_starter_user', 'smart_master_user', 'elite_pilot_user', 'OWNER']}>
                  <OnboardingGuard>
                    <Subscriptions />
                  </OnboardingGuard>
                </ProtectedRoute>
              } 
            />
            
            {/* Profile - available for both admin and business users */}
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <UserProfile />
                </ProtectedRoute>
              } 
            />
            
            {/* Root route - redirect based on user role */}
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <AdminDashboardRedirect />
                </ProtectedRoute>
              } 
            />
            
            {/* Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

// Component to redirect admin to admin dashboard and business users to business dashboard
const AdminDashboardRedirect = () => {
  const { permissions } = useUserRole();
  
  if (permissions.isPlatformAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  } else {
    return (
      <OnboardingGuard>
        <Dashboard />
      </OnboardingGuard>
    );
  }
};

export default App;
