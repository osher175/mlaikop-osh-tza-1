
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Get the root element and create a root
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

const root = createRoot(rootElement);

// Render the app inside React.StrictMode
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
