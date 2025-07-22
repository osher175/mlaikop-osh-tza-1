import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import StockApprovalRequests from './pages/StockApprovalRequests';
import { Toaster } from "@/components/ui/toaster";
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Examples } from "@/components/examples"
import { Docs } from "@/components/docs"
import { Pricing } from "@/components/pricing"
import { Authentication } from "@/components/authentication"
import { Dashboard } from "@/components/dashboard"
import { Settings } from "@/components/settings"
import { Tasks } from "@/components/tasks"
import { Kanban } from "@/components/kanban"
import { Analytics } from "@/components/analytics"
import { Mail } from "@/components/mail"
import { Chat } from "@/components/chat"
import { Calendar } from "@/components/calendar"
import { Customers } from "@/components/customers"
import { Products } from "@/components/products"
import { Invoices } from "@/components/invoices"
import { Suppliers } from "@/components/suppliers"
import { StockAlerts } from "@/components/stock-alerts"
import { RecentActivity } from "@/components/recent-activity"
import { RoleBasedRoute } from './components/RoleBasedRoute';
import { Unauthorized } from './components/Unauthorized';

function App() {
  return (
    <Router>
      <Toaster />
      <Routes>
        <Route path="/stock-approval" element={<StockApprovalRequests />} />
        
        {/* Add your existing routes here */}
        <Route path="/" element={<Examples />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/authentication" element={<Authentication />} />
        
        {/* Dashboard Routes - Accessible to all authenticated users */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/kanban" element={<Kanban />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/mail" element={<Mail />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/calendar" element={<Calendar />} />
        
        {/* Business Routes - Accessible only to business users */}
        <Route path="/customers" element={
          <RoleBasedRoute allowedForBusiness={true}>
            <Customers />
          </RoleBasedRoute>
        } />
        <Route path="/products" element={
          <RoleBasedRoute allowedForBusiness={true}>
            <Products />
          </RoleBasedRoute>
        } />
        <Route path="/invoices" element={
          <RoleBasedRoute allowedForBusiness={true}>
            <Invoices />
          </RoleBasedRoute>
        } />
        <Route path="/suppliers" element={
          <RoleBasedRoute allowedForBusiness={true}>
            <Suppliers />
          </RoleBasedRoute>
        } />
        <Route path="/stock-alerts" element={
          <RoleBasedRoute allowedForBusiness={true}>
            <StockAlerts />
          </RoleBasedRoute>
        } />
        <Route path="/recent-activity" element={
          <RoleBasedRoute allowedForBusiness={true}>
            <RecentActivity />
          </RoleBasedRoute>
        } />

        {/* Unauthorized Route */}
        <Route path="/unauthorized" element={<Unauthorized />} />
      </Routes>
    </Router>
  );
}

export default App;
