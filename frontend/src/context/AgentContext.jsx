import React, { createContext, useContext, useState, useCallback } from 'react';
import { fetchResults, runAgent, getApiBase } from '../api/agentApi';

const AgentContext = createContext(null);

export function AgentProvider({ children }) {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);

  const loadResults = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchResults();
      setResults(data);
    } catch (err) {
      const msg = `Cannot reach backend at ${getApiBase()}. Check VITE_API_URL.`;
      setError(msg);
      setResults(null);
      console.warn('[Agent] loadResults failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerRun = useCallback(async (repo, teamName, leaderName) => {
    setRunning(true);
    setError(null);
    console.warn('[Agent] Starting run:', { repo, teamName, leaderName });
    try {
      const data = await runAgent({ repo, teamName, leaderName });
      console.warn('[Agent] Run completed with response:', data);
      setResults(data);
      if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      const msg = err.message || 'Failed to start agent';
      setError(msg);
      console.warn('[Agent] Run failed:', err);
    } finally {
      setRunning(false);
    }
  }, []);

  const value = {
    results,
    loading,
    error,
    running,
    loadResults,
    triggerRun,
  };

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function useAgent() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error('useAgent must be used within AgentProvider');
  return ctx;
}
