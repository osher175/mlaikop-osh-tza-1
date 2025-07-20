
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import { ProtectedRoute } from "./components/ProtectedRoute";
import { OnboardingGuard } from "./components/OnboardingGuard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes - no auth required */}
          <Route path="/auth" element={<Auth />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          {/* Onboarding Routes */}
          <Route 
            path="/onboarding" 
            element={
              <ProtectedRoute>
                <OnboardingDecision />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/create-business" 
            element={
              <ProtectedRoute>
                <CreateBusiness />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/join-business" 
            element={
              <ProtectedRoute>
                <JoinBusiness />
              </ProtectedRoute>
            } 
          />
          
          {/* Protected Routes with Onboarding Guard */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <OnboardingGuard>
                  <Dashboard />
                </OnboardingGuard>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <OnboardingGuard>
                  <Dashboard />
                </OnboardingGuard>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/inventory" 
            element={
              <ProtectedRoute>
                <OnboardingGuard>
                  <Inventory />
                </OnboardingGuard>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/add-product" 
            element={
              <ProtectedRoute>
                <OnboardingGuard>
                  <AddProduct />
                </OnboardingGuard>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/reports" 
            element={
              <ProtectedRoute>
                <OnboardingGuard>
                  <Reports />
                </OnboardingGuard>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/users" 
            element={
              <ProtectedRoute>
                <OnboardingGuard>
                  <UserManagement />
                </OnboardingGuard>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/settings" 
            element={
              <ProtectedRoute>
                <OnboardingGuard>
                  <BusinessSettings />
                </OnboardingGuard>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <OnboardingGuard>
                  <UserProfile />
                </OnboardingGuard>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute>
                <AdminPanel />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin-dashboard" 
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/settings" 
            element={
              <ProtectedRoute>
                <AdminSettings />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/subscriptions" 
            element={
              <ProtectedRoute>
                <OnboardingGuard>
                  <Subscriptions />
                </OnboardingGuard>
              </ProtectedRoute>
            } 
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
