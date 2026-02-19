import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AgentProvider } from './context/AgentContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AgentProvider>
      <App />
    </AgentProvider>
  </React.StrictMode>
);
