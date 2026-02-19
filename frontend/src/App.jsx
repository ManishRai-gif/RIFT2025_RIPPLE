import React, { useEffect } from 'react';
import { useAgent } from './context/AgentContext';
import Dashboard from './components/Dashboard';
import RunForm from './components/RunForm';

export default function App() {
  const { loadResults, error } = useAgent();

  useEffect(() => {
    loadResults();
    const id = setInterval(loadResults, 5000);
    return () => clearInterval(id);
  }, [loadResults]);

  return (
    <div className="app">
      <header className="header">
        <h1>Ripple DevOps Agent</h1>
        <span className="tag">Autonomous CI Fix</span>
      </header>
      {error && (
        <div className="banner error">
          {error}
        </div>
      )}
      <main className="main">
        <RunForm />
        <Dashboard />
      </main>
    </div>
  );
}
