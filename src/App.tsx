
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Import pages
import Index from "./pages/Index";
import { Auth } from "./pages/Auth";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { Dashboard } from "./pages/Dashboard";
import { Inventory } from "./pages/Inventory";
import { AddProduct } from "./pages/AddProduct";
import { Reports } from "./pages/Reports";
import { UserManagement } from "./pages/UserManagement";
import { BusinessSettings } from "./pages/BusinessSettings";
import { UserProfile } from "./pages/UserProfile";
import { AdminPanel } from "./pages/AdminPanel";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AdminSettings } from "./pages/AdminSettings";
import NotFound from "./pages/NotFound";
import { CreateBusiness } from "./pages/CreateBusiness";
import { OnboardingDecision } from "./pages/OnboardingDecision";
import { JoinBusiness } from "./pages/JoinBusiness";
import { Subscriptions } from "./pages/Subscriptions";
import { NotificationSettingsPage } from "./pages/NotificationSettings";
import { Suppliers } from "./pages/Suppliers";
import { SupplierInvoices } from "./pages/SupplierInvoices";
import { Unauthorized } from "./pages/Unauthorized";
import { ProtectedRouteWithRole } from "./components/ProtectedRouteWithRole";

// Import components
import { ProtectedRoute } from "./components/ProtectedRoute";
import { OnboardingGuard } from "./components/OnboardingGuard";
import { AdminNavigationHelper } from "./components/AdminNavigationHelper";
import { SessionWarningDialog } from "./components/SessionWarningDialog";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <SessionWarningDialog />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* Protected routes with onboarding guard */}
            <Route path="/" element={
              <ProtectedRoute>
                <OnboardingGuard>
                  <Index />
                </OnboardingGuard>
              </ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <OnboardingGuard>
                  <Dashboard />
                </OnboardingGuard>
              </ProtectedRoute>
            } />
            <Route path="/inventory" element={
              <ProtectedRoute>
                <OnboardingGuard>
                  <Inventory />
                </OnboardingGuard>
              </ProtectedRoute>
            } />
            <Route path="/add-product" element={
              <ProtectedRoute>
                <OnboardingGuard>
                  <AddProduct />
                </OnboardingGuard>
              </ProtectedRoute>
            } />
            <Route path="/suppliers" element={
              <ProtectedRoute>
                <OnboardingGuard>
                  <Suppliers />
                </OnboardingGuard>
              </ProtectedRoute>
            } />
            <Route path="/supplier-invoices" element={
              <ProtectedRoute>
                <OnboardingGuard>
                  <SupplierInvoices />
                </OnboardingGuard>
              </ProtectedRoute>
            } />
            
            {/* Reports - requires business access */}
            <Route path="/reports" element={
              <ProtectedRoute>
                <OnboardingGuard>
                  <ProtectedRouteWithRole requireBusinessAccess={true}>
                    <Reports />
                  </ProtectedRouteWithRole>
                </OnboardingGuard>
              </ProtectedRoute>
            } />
            
            {/* Hide User Management for MVP - keep code for future use */}
            {/* <Route path="/users" element={
              <ProtectedRoute>
                <OnboardingGuard>
                  <ProtectedRouteWithRole requiredRole="OWNER">
                    <UserManagement />
                  </ProtectedRouteWithRole>
                </OnboardingGuard>
              </ProtectedRoute>
            } /> */}
            
            <Route path="/settings" element={
              <ProtectedRoute>
                <OnboardingGuard>
                  <ProtectedRouteWithRole requiredRole="OWNER">
                    <BusinessSettings />
                  </ProtectedRouteWithRole>
                </OnboardingGuard>
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <UserProfile />
              </ProtectedRoute>
            } />
            
            {/* Hide Subscriptions for MVP - keep code for future use */}
            {/* <Route path="/subscriptions" element={
              <ProtectedRoute>
                <OnboardingGuard>
                  <ProtectedRouteWithRole requiredRole="OWNER">
                    <Subscriptions />
                  </ProtectedRouteWithRole>
                </OnboardingGuard>
              </ProtectedRoute>
            } /> */}
            
            <Route path="/notifications" element={
              <ProtectedRoute>
                <OnboardingGuard>
                  <NotificationSettingsPage />
                </OnboardingGuard>
              </ProtectedRoute>
            } />

            {/* Onboarding routes */}
            <Route path="/onboarding" element={
              <ProtectedRoute>
                <OnboardingDecision />
              </ProtectedRoute>
            } />
            <Route path="/create-business" element={
              <ProtectedRoute>
                <CreateBusiness />
              </ProtectedRoute>
            } />
            <Route path="/join-business" element={
              <ProtectedRoute>
                <JoinBusiness />
              </ProtectedRoute>
            } />

            {/* Admin routes - require admin role */}
            <Route path="/admin" element={
              <ProtectedRoute>
                <ProtectedRouteWithRole requiredRole="admin">
                  <AdminNavigationHelper>
                    <AdminPanel />
                  </AdminNavigationHelper>
                </ProtectedRouteWithRole>
              </ProtectedRoute>
            } />
            <Route path="/admin-dashboard" element={
              <ProtectedRoute>
                <ProtectedRouteWithRole requiredRole="admin">
                  <AdminNavigationHelper>
                    <AdminDashboard />
                  </AdminNavigationHelper>
                </ProtectedRouteWithRole>
              </ProtectedRoute>
            } />
            <Route path="/admin/settings" element={
              <ProtectedRoute>
                <ProtectedRouteWithRole requiredRole="admin">
                  <AdminNavigationHelper>
                    <AdminSettings />
                  </AdminNavigationHelper>
                </ProtectedRouteWithRole>
              </ProtectedRoute>
            } />

            {/* 404 route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
