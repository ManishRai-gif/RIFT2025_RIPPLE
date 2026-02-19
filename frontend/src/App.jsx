import React, { useEffect } from 'react';
import { useAgent } from './context/AgentContext';
import Dashboard from './components/Dashboard';
import RunForm from './components/RunForm';
import LoadingOverlay from './components/LoadingOverlay';

export default function App() {
  const { loadResults, error, running, loading } = useAgent();

  useEffect(() => {
    loadResults(false);
  }, [loadResults]);

  return (
    <div className="app">
      <LoadingOverlay visible={running || (loading && !error)} />
      <header className="header">
        <h1>Ripple DevOps Agent</h1>
        <span className="tag">Autonomous CI Fix</span>
      </header>
      {error && (
        <div className="banner error">
          {error}
          <div className="error-hint">Open browser DevTools (F12) → Console to see details</div>
        </div>
      )}
      <main className="main">
        <RunForm />
        <Dashboard />
      </main>
    </div>
  );
}
