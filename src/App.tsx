
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import StockApprovalRequests from './pages/StockApprovalRequests';
import Navbar from './components/Navbar';

// Create QueryClient
const queryClient = new QueryClient();

// Create a minimal Unauthorized component
const Unauthorized = () => (
  <div className="flex flex-col items-center justify-center min-h-screen">
    <h1 className="text-2xl font-bold">Unauthorized Access</h1>
    <p className="mt-2">You don't have permission to access this page</p>
  </div>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router>
          <Navbar />
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/stock-approval" element={<StockApprovalRequests />} />
            
            {/* Simplified routes */}
            <Route path="/" element={<div className="p-10">Inventory Management Home</div>} />
            
            {/* Unauthorized Route */}
            <Route path="/unauthorized" element={<Unauthorized />} />
          </Routes>
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
