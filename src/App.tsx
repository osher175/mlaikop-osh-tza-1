
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Index } from "./pages/Index";
import { Auth } from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";
import { Inventory } from "./pages/Inventory";
import { AddProduct } from "./pages/AddProduct";
import { Reports } from "./pages/Reports";
import { BusinessSettings } from "./pages/BusinessSettings";
import { UserProfile } from "./pages/UserProfile";
import { AdminPanel } from "./pages/AdminPanel";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AdminSettings } from "./pages/AdminSettings";
import { NotFound } from "./pages/NotFound";
import { ResetPassword } from "./pages/ResetPassword";
import { SetNewPassword } from "./pages/SetNewPassword";
import { NotificationSettings } from "./pages/NotificationSettings";
import { UserManagement } from "./pages/UserManagement";
import { Subscriptions } from "./pages/Subscriptions";
import { BusinessSetup } from "./pages/BusinessSetup";
import { ChoosePlan } from "./pages/ChoosePlan";
import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/set-new-password" element={<SetNewPassword />} />
          <Route path="/business-setup" element={
            <ProtectedRoute requiresPlan={false}>
              <BusinessSetup />
            </ProtectedRoute>
          } />
          <Route path="/choose-plan" element={
            <ProtectedRoute requiresPlan={false}>
              <ChoosePlan />
            </ProtectedRoute>
          } />
          <Route path="/" element={
            <ProtectedRoute>
              <Index />
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/inventory" element={
            <ProtectedRoute>
              <Inventory />
            </ProtectedRoute>
          } />
          <Route path="/add-product" element={
            <ProtectedRoute>
              <AddProduct />
            </ProtectedRoute>
          } />
          <Route path="/reports" element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          } />
          <Route path="/business-settings" element={
            <ProtectedRoute>
              <BusinessSettings />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          } />
          <Route path="/notifications" element={
            <ProtectedRoute>
              <NotificationSettings />
            </ProtectedRoute>
          } />
          <Route path="/user-management" element={
            <ProtectedRoute>
              <UserManagement />
            </ProtectedRoute>
          } />
          <Route path="/subscriptions" element={
            <ProtectedRoute>
              <Subscriptions />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminPanel />
            </ProtectedRoute>
          } />
          <Route path="/admin/dashboard" element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/settings" element={
            <ProtectedRoute>
              <AdminSettings />
            </ProtectedRoute>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
