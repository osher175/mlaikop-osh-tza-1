
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import StockApprovalRequests from './pages/StockApprovalRequests';
import { Toaster } from "@/components/ui/toaster";
import Navbar from './components/Navbar';

// Create a minimal Unauthorized component
const Unauthorized = () => (
  <div className="flex flex-col items-center justify-center min-h-screen">
    <h1 className="text-2xl font-bold">Unauthorized Access</h1>
    <p className="mt-2">You don't have permission to access this page</p>
  </div>
);

// Create a minimal RoleBasedRoute component
const RoleBasedRoute = ({ 
  children, 
  allowedForBusiness = false 
}: { 
  children: React.ReactNode, 
  allowedForBusiness?: boolean 
}) => {
  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <Navbar />
      <Toaster />
      <Routes>
        <Route path="/stock-approval" element={<StockApprovalRequests />} />
        
        {/* Simplified routes */}
        <Route path="/" element={<div className="p-10">Inventory Management Home</div>} />
        
        {/* Unauthorized Route */}
        <Route path="/unauthorized" element={<Unauthorized />} />
      </Routes>
    </Router>
  );
}

export default App;
